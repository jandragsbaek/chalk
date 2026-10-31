import {
  blockingIssues,
  normalizeDebrief,
  deriveSession,
  ImportConflictError,
  ImportDocument,
  ImportInvalidError,
  ImportNotFoundError,
  ImportSummary,
  MovementId,
  Quantity,
  WorkoutId,
  type DerivedIntent,
  type DerivedItem,
  type DerivedSet,
  type SaveImportInput,
  type StoredImport,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { deleteWorkoutRows } from "../workout/deleteWorkoutRows.ts";

export class ImportPersistenceError extends Schema.TaggedError<ImportPersistenceError>()(
  "ImportPersistenceError",
  {
    operation: Schema.Literals(["list imports", "load an import", "save an import"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const DocumentJson = Schema.fromJsonString(ImportDocument);
const encodeDocument = Schema.encodeEffect(DocumentJson);
const decodeDocument = Schema.decodeEffect(DocumentJson);

const SetsJson = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ line: Schema.Int, quantities: Schema.Array(Schema.Unknown) })),
);
const encodeSets = Schema.encodeEffect(SetsJson);

const IntentsJson = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ text: Schema.String, quantities: Schema.Array(Quantity) })),
);
const encodeIntentsJson = Schema.encodeEffect(IntentsJson);
const encodeIntents = (intents: ReadonlyArray<DerivedIntent>) =>
  encodeIntentsJson(intents.map(({ text, quantities }) => ({ text, quantities })));

const MovementNameRow = Schema.Struct({ id: MovementId, name: Schema.String });

const SUMMARY_SELECT = `
  SELECT si.workout_id AS "workoutId", si.performed_on AS "performedOn",
         si.session_number AS "sessionNumber", w.name AS name, si.imported_at AS "importedAt",
         (SELECT COUNT(*) FROM workout_parts p WHERE p.workout_id = si.workout_id) AS "partCount",
         (SELECT COUNT(*) FROM workout_items i
            JOIN workout_blocks b ON b.id = i.block_id
            JOIN workout_parts p ON p.id = b.part_id
          WHERE p.workout_id = si.workout_id) AS "itemCount",
         (SELECT COUNT(*) FROM lift_sets l WHERE l.workout_id = si.workout_id) AS "liftSetCount",
         (SELECT COALESCE(SUM(l.reps * l.load_kg), 0) FROM lift_sets l
          WHERE l.workout_id = si.workout_id) AS "tonnageKg"
  FROM session_imports si JOIN workouts w ON w.id = si.workout_id
`;

export class ImportStore extends Context.Service<
  ImportStore,
  {
    /** Imported sessions, newest day first. */
    readonly list: () => Effect.Effect<ReadonlyArray<ImportSummary>, ImportPersistenceError>;
    readonly get: (
      workoutId: WorkoutId,
    ) => Effect.Effect<StoredImport, ImportNotFoundError | ImportPersistenceError>;
    /**
     * Derives the session from the document and stores it: workout, parts, blocks, items, lift
     * sets from the notes and from the items' results, and the debrief. The derivation runs
     * here too, so the client cannot save something the editor would have refused.
     */
    readonly save: (
      input: SaveImportInput,
    ) => Effect.Effect<
      ImportSummary,
      ImportInvalidError | ImportConflictError | ImportPersistenceError
    >;
  }
>()("chalk/import/ImportStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;
  const newId = random.uuidV7();

  const selectSummaries = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ImportSummary,
    execute: () =>
      sql`${sql.unsafe(SUMMARY_SELECT)} ORDER BY si.performed_on DESC, si.session_number DESC`,
  });

  const selectSummary = SqlSchema.findAll({
    Request: Schema.String,
    Result: ImportSummary,
    execute: (workoutId) => sql`${sql.unsafe(SUMMARY_SELECT)} WHERE si.workout_id = ${workoutId}`,
  });

  /** The import a new one would duplicate: same session number, else same day. */
  const selectClash = SqlSchema.findAll({
    Request: Schema.Struct({
      sessionNumber: Schema.NullOr(Schema.Int),
      performedOn: Schema.String,
    }),
    Result: ImportSummary,
    execute: ({ sessionNumber, performedOn }) =>
      sessionNumber === null
        ? sql`${sql.unsafe(SUMMARY_SELECT)} WHERE si.performed_on = ${performedOn}`
        : sql`${sql.unsafe(SUMMARY_SELECT)} WHERE si.session_number = ${sessionNumber}`,
  });

  const selectDocument = SqlSchema.findAll({
    Request: Schema.String,
    Result: Schema.Struct({ document: Schema.String }),
    execute: (workoutId) =>
      sql`SELECT document FROM session_imports WHERE workout_id = ${workoutId}`,
  });

  const selectMovementNames = SqlSchema.findAll({
    Request: Schema.Void,
    Result: MovementNameRow,
    execute: () => sql`SELECT id, name FROM movements`,
  });

  const list = Effect.fn("ImportStore.list")(function* () {
    return yield* selectSummaries(undefined).pipe(
      Effect.mapError((cause) => new ImportPersistenceError({ operation: "list imports", cause })),
    );
  });

  const get = Effect.fn("ImportStore.get")(function* (workoutId: WorkoutId) {
    const loaded = yield* Effect.gen(function* () {
      const [summary] = yield* selectSummary(workoutId);
      const [row] = yield* selectDocument(workoutId);
      if (!summary || !row) return undefined;
      return { summary, document: yield* decodeDocument(row.document) } satisfies StoredImport;
    }).pipe(
      Effect.mapError(
        (cause) => new ImportPersistenceError({ operation: "load an import", cause }),
      ),
    );
    if (!loaded) return yield* new ImportNotFoundError({ workoutId });
    return loaded;
  });

  /** An item and its alternatives ("or ..."), which point back at it, with their results. */
  const insertItem = Effect.fn("ImportStore.insertItem")(function* (
    blockId: string,
    position: number,
    item: DerivedItem,
    lifted: { workoutId: WorkoutId; performedOn: string; notes: string; createdAt: string },
  ) {
    const queue: Array<readonly [DerivedItem, string | null]> = [[item, null]];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [current, alternativeOf] = next;
      if (current.movementId === undefined) continue;
      const id = yield* newId;
      const prescription = yield* encodeSets(current.sets as ReadonlyArray<DerivedSet>);
      yield* sql`
        INSERT INTO workout_items (id, block_id, position, movement_id, alternative_of, prescription)
        VALUES (${id}, ${blockId}, ${position}, ${current.movementId}, ${alternativeOf}, ${prescription})
      `;
      for (const [index, set] of current.performed.entries())
        yield* sql`
          INSERT INTO lift_sets (id, movement_id, performed_on, reps, load_kg, notes, created_at,
                                 workout_id, workout_item_id, set_number)
          VALUES (${yield* newId}, ${current.movementId}, ${lifted.performedOn}, ${set.reps},
                  ${set.loadKg}, ${lifted.notes}, ${lifted.createdAt}, ${lifted.workoutId}, ${id},
                  ${index + 1})
        `;
      for (const alternative of current.alternatives) queue.push([alternative, id]);
    }
  });

  const save = Effect.fn("ImportStore.save")(function* (input: SaveImportInput) {
    const names = yield* selectMovementNames(undefined).pipe(
      Effect.mapError(
        (cause) => new ImportPersistenceError({ operation: "save an import", cause }),
      ),
    );
    const nameById = new Map(names.map((row) => [row.id, row.name]));
    const session = deriveSession(input.document, (id) => nameById.get(id));
    const problems = blockingIssues(session).map((issue) => issue.message);
    const performedOn = session.performedOn;
    if (problems.length > 0 || performedOn === undefined)
      return yield* new ImportInvalidError({ problems });

    const write = Effect.gen(function* () {
      const clashes = yield* selectClash({
        sessionNumber: session.sessionNumber ?? null,
        performedOn,
      });
      const clash = clashes.find((summary) => summary.workoutId !== input.replace);
      if (clash) return yield* new ImportConflictError({ existing: clash });

      if (input.replace !== undefined) yield* deleteWorkoutRows(sql, input.replace);

      const workoutId = WorkoutId.make(yield* newId);
      const now = DateTime.formatIso(yield* DateTime.now);
      const debrief = normalizeDebrief(input.document.debrief ?? {});
      const { debrief: _entered, ...rest } = input.document;
      const stored: ImportDocument = Object.keys(debrief).length > 0 ? { ...rest, debrief } : rest;
      // The athlete's headline result beats the block scores joined.
      yield* sql`
        INSERT INTO workouts (id, performed_on, name, kind, score, rx, notes, created_at)
        VALUES (${workoutId}, ${performedOn}, ${session.name}, ${session.kind},
                ${debrief.result ?? session.score}, 0,
                ${session.notes}, ${now})
      `;
      if (Object.keys(debrief).length > 0)
        yield* sql`
          INSERT INTO workout_debriefs (workout_id, result, feel, effort, capacity,
                                        minutes, limiters, pain, next_time, notes)
          VALUES (${workoutId}, ${debrief.result ?? null},
                  ${debrief.feel ?? null}, ${debrief.effort ?? null}, ${debrief.capacity ?? null},
                  ${debrief.minutes ?? null}, ${JSON.stringify(debrief.limiters ?? [])},
                  ${debrief.pain ?? null}, ${debrief.nextTime ?? null}, ${debrief.notes ?? null})
        `;
      yield* sql`
        INSERT INTO session_imports (workout_id, session_number, performed_on, document, imported_at)
        VALUES (${workoutId}, ${session.sessionNumber ?? null}, ${performedOn},
                ${yield* encodeDocument(stored)}, ${now})
      `;
      for (const [partPosition, part] of session.parts.entries()) {
        const partId = yield* newId;
        yield* sql`
          INSERT INTO workout_parts (id, workout_id, position, title, raw_text)
          VALUES (${partId}, ${workoutId}, ${partPosition}, ${part.title}, ${part.rawText})
        `;
        for (const [blockPosition, block] of part.blocks.entries()) {
          const blockId = yield* newId;
          yield* sql`
            INSERT INTO workout_blocks (id, part_id, position, title, format, params, score, intent)
            VALUES (${blockId}, ${partId}, ${blockPosition}, ${block.title}, ${block.format ?? null},
                    ${JSON.stringify(block.params)}, ${block.scores.join(" · ")},
                    ${yield* encodeIntents(block.intents)})
          `;
          for (const [itemPosition, item] of block.items.entries())
            yield* insertItem(blockId, itemPosition, item, {
              workoutId,
              performedOn,
              notes: `Imported from ${session.name}`,
              createdAt: now,
            });
        }
      }
      for (const set of session.liftSets)
        for (let copy = 0; copy < set.count; copy++) {
          yield* sql`
            INSERT INTO lift_sets (id, movement_id, performed_on, reps, load_kg, notes, created_at, workout_id)
            VALUES (${yield* newId}, ${set.movementId}, ${performedOn}, ${set.reps}, ${set.loadKg},
                    ${`Imported from ${session.name}`}, ${now}, ${workoutId})
          `;
        }
      const [summary] = yield* selectSummary(workoutId);
      return summary!;
    });

    return yield* write.pipe(
      sql.withTransaction,
      Effect.catchTags({
        SqlError: (cause) =>
          Effect.fail(new ImportPersistenceError({ operation: "save an import", cause })),
        SchemaError: (cause) =>
          Effect.fail(new ImportPersistenceError({ operation: "save an import", cause })),
      }),
    );
  });

  return ImportStore.of({ list, get, save });
});

export const layer = Layer.effect(ImportStore, make);
