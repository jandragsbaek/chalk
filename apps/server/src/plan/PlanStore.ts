import {
  blockingIssues,
  deriveSession,
  ImportDocument,
  ImportInvalidError,
  MovementId,
  PlanId,
  PlanNotFoundError,
  SessionPlan,
  type SavePlanInput,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class PlanPersistenceError extends Schema.TaggedError<PlanPersistenceError>()(
  "PlanPersistenceError",
  {
    operation: Schema.Literals(["list plans", "load a plan", "save a plan", "delete a plan"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const PlanRow = Schema.Struct({
  id: PlanId,
  plannedOn: Schema.String,
  name: Schema.String,
  document: Schema.fromJsonString(ImportDocument),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
const decodePlan = Schema.decodeUnknownEffect(SessionPlan);
const encodeDocument = Schema.encodeEffect(Schema.fromJsonString(ImportDocument));

const PLAN_SELECT = `
  SELECT id, planned_on AS "plannedOn", name, document, created_at AS "createdAt",
         updated_at AS "updatedAt"
  FROM session_plans
`;

export class PlanStore extends Context.Service<
  PlanStore,
  {
    /** Every plan not logged yet, oldest day first. */
    readonly list: () => Effect.Effect<ReadonlyArray<SessionPlan>, PlanPersistenceError>;
    readonly get: (
      id: PlanId,
    ) => Effect.Effect<SessionPlan, PlanNotFoundError | PlanPersistenceError>;
    /**
     * Stores the document as a plan, new or over `id`. It must derive like an import would (a
     * day, every movement resolved), so logging it later only adds what was done.
     */
    readonly save: (
      input: SavePlanInput,
    ) => Effect.Effect<SessionPlan, ImportInvalidError | PlanNotFoundError | PlanPersistenceError>;
    readonly remove: (id: PlanId) => Effect.Effect<void, PlanNotFoundError | PlanPersistenceError>;
  }
>()("chalk/plan/PlanStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  const selectAll = SqlSchema.findAll({
    Request: Schema.Void,
    Result: PlanRow,
    execute: () => sql`${sql.unsafe(PLAN_SELECT)} ORDER BY planned_on, created_at`,
  });
  const selectOne = SqlSchema.findAll({
    Request: Schema.String,
    Result: PlanRow,
    execute: (id) => sql`${sql.unsafe(PLAN_SELECT)} WHERE id = ${id}`,
  });
  const selectMovementNames = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Schema.Struct({ id: MovementId, name: Schema.String }),
    execute: () => sql`SELECT id, name FROM movements`,
  });

  const list = Effect.fn("PlanStore.list")(
    function* () {
      const rows = yield* selectAll(undefined);
      return yield* Effect.forEach(rows, (row) => decodePlan(row));
    },
    Effect.mapError((cause) => new PlanPersistenceError({ operation: "list plans", cause })),
  );

  const load = Effect.fn("PlanStore.load")(function* (id: PlanId) {
    const [row] = yield* selectOne(id);
    return row === undefined ? undefined : yield* decodePlan(row);
  });

  const get = Effect.fn("PlanStore.get")(function* (id: PlanId) {
    const plan = yield* load(id).pipe(
      Effect.mapError((cause) => new PlanPersistenceError({ operation: "load a plan", cause })),
    );
    if (plan === undefined) return yield* new PlanNotFoundError({ id });
    return plan;
  });

  const save = Effect.fn("PlanStore.save")(function* (input: SavePlanInput) {
    const failed = (cause: unknown) =>
      new PlanPersistenceError({ operation: "save a plan", cause });
    const names = yield* selectMovementNames(undefined).pipe(Effect.mapError(failed));
    const nameById = new Map(names.map((row) => [row.id, row.name]));
    const session = deriveSession(input.document, (id) => nameById.get(id));
    const problems = blockingIssues(session).map((issue) => issue.message);
    const plannedOn = session.performedOn;
    if (problems.length > 0 || plannedOn === undefined)
      return yield* new ImportInvalidError({ problems });

    const now = DateTime.formatIso(yield* DateTime.now);
    const document = yield* encodeDocument(input.document).pipe(Effect.mapError(failed));
    if (input.id === undefined) {
      const id = PlanId.make(yield* random.uuidV7());
      yield* sql`
        INSERT INTO session_plans (id, planned_on, name, document, created_at, updated_at)
        VALUES (${id}, ${plannedOn}, ${session.name}, ${document}, ${now}, ${now})
      `.pipe(Effect.mapError(failed));
      return yield* get(id);
    }
    const updated = yield* sql<{ id: string }>`
      UPDATE session_plans
      SET planned_on = ${plannedOn}, name = ${session.name}, document = ${document},
          updated_at = ${now}
      WHERE id = ${input.id}
      RETURNING id
    `.pipe(Effect.mapError(failed));
    if (updated.length === 0) return yield* new PlanNotFoundError({ id: input.id });
    return yield* get(input.id);
  });

  const remove = Effect.fn("PlanStore.remove")(function* (id: PlanId) {
    const deleted = yield* sql<{ id: string }>`
      DELETE FROM session_plans WHERE id = ${id} RETURNING id
    `.pipe(
      Effect.mapError((cause) => new PlanPersistenceError({ operation: "delete a plan", cause })),
    );
    if (deleted.length === 0) return yield* new PlanNotFoundError({ id });
  });

  return PlanStore.of({ list, get, save, remove });
});

export const layer = Layer.effect(PlanStore, make);
