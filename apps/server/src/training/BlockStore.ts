import {
  BlockId,
  BlockInvalidError,
  BlockNotFoundError,
  blockProblems,
  MovementId,
  ProgrammedLine,
  ProgrammedSession,
  ProgrammedSessionId,
  ProgrammedSessionNotFoundError,
  TrainingBlock,
  TrainingMax,
  type BlockSource,
  type DraftBlockInput,
  type IsoDate,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class BlockPersistenceError extends Schema.TaggedError<BlockPersistenceError>()(
  "BlockPersistenceError",
  {
    operation: Schema.Literals([
      "list training blocks",
      "save a training block",
      "schedule a training block",
      "remove a training block",
      "set a training max",
      "move a session",
      "tick a line",
      "remove a session",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

type Operation = BlockPersistenceError["operation"];
const failedTo = (operation: Operation) => (cause: unknown) =>
  new BlockPersistenceError({ operation, cause });

const MaxesJson = Schema.fromJsonString(Schema.Array(TrainingMax));
const LinesJson = Schema.fromJsonString(Schema.Array(ProgrammedLine));
const TickedJson = Schema.fromJsonString(Schema.Array(Schema.Int));

const BlockRow = Schema.Struct({
  id: BlockId,
  name: Schema.String,
  goal: Schema.String,
  status: TrainingBlock.fields.status,
  source: TrainingBlock.fields.source,
  trainingMaxes: MaxesJson,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const SessionRow = Schema.Struct({
  id: ProgrammedSessionId,
  blockId: BlockId,
  day: Schema.String,
  title: Schema.String,
  note: Schema.NullOr(Schema.String),
  lines: LinesJson,
  ticked: TickedJson,
});
type SessionRow = typeof SessionRow.Type;

const decodeBlock = Schema.decodeUnknownEffect(TrainingBlock);
const decodeSession = Schema.decodeUnknownEffect(ProgrammedSession);
const encodeMaxes = Schema.encodeEffect(MaxesJson);
const encodeLines = Schema.encodeEffect(LinesJson);
const encodeTicked = Schema.encodeEffect(TickedJson);

const sessionOf = (row: SessionRow) =>
  decodeSession({
    id: row.id,
    blockId: row.blockId,
    day: row.day,
    title: row.title,
    ...(row.note === null ? {} : { note: row.note }),
    lines: row.lines,
    ticked: row.ticked,
  });

const SESSION_SELECT = `
  SELECT id, block_id AS "blockId", day, title, note, lines, ticked
  FROM programmed_sessions
`;

export class BlockStore extends Context.Service<
  BlockStore,
  {
    /** Every block, drafts included, oldest first, each with its sessions by day. */
    readonly list: () => Effect.Effect<ReadonlyArray<TrainingBlock>, BlockPersistenceError>;
    /**
     * Saves a written block as a draft, or rewrites the draft `replaces` in place. Refused when
     * it does not hold together (see `blockProblems`), or `replaces` is not a draft.
     */
    readonly draft: (
      input: DraftBlockInput,
      source: BlockSource,
      replaces?: BlockId,
    ) => Effect.Effect<
      TrainingBlock,
      BlockInvalidError | BlockNotFoundError | BlockPersistenceError
    >;
    readonly schedule: (
      id: BlockId,
    ) => Effect.Effect<TrainingBlock, BlockNotFoundError | BlockPersistenceError>;
    readonly remove: (
      id: BlockId,
    ) => Effect.Effect<void, BlockNotFoundError | BlockPersistenceError>;
    readonly setTrainingMax: (
      id: BlockId,
      max: TrainingMax,
    ) => Effect.Effect<TrainingBlock, BlockNotFoundError | BlockPersistenceError>;
    readonly move: (
      id: ProgrammedSessionId,
      day: IsoDate,
    ) => Effect.Effect<ProgrammedSession, ProgrammedSessionNotFoundError | BlockPersistenceError>;
    readonly tick: (
      id: ProgrammedSessionId,
      line: number,
      done: boolean,
    ) => Effect.Effect<ProgrammedSession, ProgrammedSessionNotFoundError | BlockPersistenceError>;
    readonly removeSession: (
      id: ProgrammedSessionId,
    ) => Effect.Effect<void, ProgrammedSessionNotFoundError | BlockPersistenceError>;
  }
>()("chalk/training/BlockStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  const selectBlocks = SqlSchema.findAll({
    Request: Schema.Void,
    Result: BlockRow,
    execute: () => sql`
      SELECT id, name, goal, status, source, training_maxes AS "trainingMaxes",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM training_blocks ORDER BY created_at, id
    `,
  });
  const selectSessions = SqlSchema.findAll({
    Request: Schema.Void,
    Result: SessionRow,
    execute: () => sql`${sql.unsafe(SESSION_SELECT)} ORDER BY day, position`,
  });
  const selectSession = SqlSchema.findAll({
    Request: Schema.String,
    Result: SessionRow,
    execute: (id) => sql`${sql.unsafe(SESSION_SELECT)} WHERE id = ${id}`,
  });
  const selectMovementNames = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Schema.Struct({ id: MovementId, name: Schema.String }),
    execute: () => sql`SELECT id, name FROM movements`,
  });

  const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));

  const loadAll = Effect.gen(function* () {
    const [blocks, sessions] = yield* Effect.all([
      selectBlocks(undefined),
      selectSessions(undefined),
    ]);
    const byBlock = new Map<string, Array<SessionRow>>();
    for (const row of sessions)
      byBlock.set(row.blockId, [...(byBlock.get(row.blockId) ?? []), row]);
    return yield* Effect.forEach(blocks, (block) =>
      Effect.forEach(byBlock.get(block.id) ?? [], sessionOf).pipe(
        Effect.flatMap((rows) => decodeBlock({ ...block, sessions: rows })),
      ),
    );
  });

  const loadBlock = (id: BlockId) =>
    loadAll.pipe(Effect.map((blocks) => blocks.find((block) => block.id === id)));

  const list = Effect.fn("BlockStore.list")(
    function* () {
      return yield* loadAll;
    },
    Effect.mapError(failedTo("list training blocks")),
  );

  const draft = Effect.fn("BlockStore.draft")(function* (
    input: DraftBlockInput,
    source: BlockSource,
    replaces?: BlockId,
  ) {
    const failed = failedTo("save a training block");
    const names = yield* selectMovementNames(undefined).pipe(Effect.mapError(failed));
    const nameById = new Map(names.map((row) => [row.id, row.name]));
    const problems = blockProblems(input, (id) => nameById.get(id));
    if (problems.length > 0) return yield* new BlockInvalidError({ problems: [...problems] });

    const at = yield* now;
    const maxes = yield* encodeMaxes(input.trainingMaxes).pipe(Effect.mapError(failed));
    const sessions = yield* Effect.forEach(input.sessions, (session, position) =>
      Effect.gen(function* () {
        const id = ProgrammedSessionId.make(yield* random.uuidV7());
        const lines = yield* encodeLines(session.lines);
        return { id, session, position, lines };
      }),
    ).pipe(Effect.mapError(failed));

    const write = Effect.gen(function* () {
      let id: BlockId;
      if (replaces === undefined) {
        id = BlockId.make(yield* random.uuidV7());
        yield* sql`
          INSERT INTO training_blocks
            (id, name, goal, status, source, training_maxes, created_at, updated_at)
          VALUES (${id}, ${input.name}, ${input.goal}, 'draft', ${source}, ${maxes}, ${at}, ${at})
        `;
      } else {
        id = replaces;
        const updated = yield* sql<{ id: string }>`
          UPDATE training_blocks
          SET name = ${input.name}, goal = ${input.goal}, source = ${source},
              training_maxes = ${maxes}, updated_at = ${at}
          WHERE id = ${id} AND status = 'draft'
          RETURNING id
        `;
        if (updated.length === 0) return yield* new BlockNotFoundError({ id });
        yield* sql`DELETE FROM programmed_sessions WHERE block_id = ${id}`;
      }
      for (const { id: sessionId, session, position, lines } of sessions)
        yield* sql`
          INSERT INTO programmed_sessions
            (id, block_id, day, title, note, lines, ticked, position, updated_at)
          VALUES (${sessionId}, ${id}, ${session.day}, ${session.title},
                  ${session.note ?? null}, ${lines}, '[]', ${position}, ${at})
        `;
      return id;
    });
    const id = yield* write.pipe(
      sql.withTransaction,
      Effect.catchTags({ SqlError: (cause) => Effect.fail(failed(cause)) }),
    );
    const saved = yield* loadBlock(id).pipe(Effect.mapError(failed));
    if (saved === undefined) return yield* new BlockNotFoundError({ id });
    return saved;
  });

  /** Runs an UPDATE on one block, then reads it back; a missing row is a not-found. */
  const updateBlock = Effect.fn("BlockStore.updateBlock")(function* (
    id: BlockId,
    operation: Operation,
    update: Effect.Effect<ReadonlyArray<unknown>, unknown>,
  ) {
    const updated = yield* update.pipe(Effect.mapError(failedTo(operation)));
    if (updated.length === 0) return yield* new BlockNotFoundError({ id });
    const block = yield* loadBlock(id).pipe(Effect.mapError(failedTo(operation)));
    if (block === undefined) return yield* new BlockNotFoundError({ id });
    return block;
  });

  const schedule = Effect.fn("BlockStore.schedule")(function* (id: BlockId) {
    const at = yield* now;
    return yield* updateBlock(
      id,
      "schedule a training block",
      sql`UPDATE training_blocks SET status = 'scheduled', updated_at = ${at}
          WHERE id = ${id} RETURNING id`,
    );
  });

  const setTrainingMax = Effect.fn("BlockStore.setTrainingMax")(function* (
    id: BlockId,
    max: TrainingMax,
  ) {
    const failed = failedTo("set a training max");
    const block = yield* loadBlock(id).pipe(Effect.mapError(failed));
    if (block === undefined) return yield* new BlockNotFoundError({ id });
    const maxes = [
      ...block.trainingMaxes.filter((entry) => entry.movementId !== max.movementId),
      max,
    ];
    const encoded = yield* encodeMaxes(maxes).pipe(Effect.mapError(failed));
    const at = yield* now;
    return yield* updateBlock(
      id,
      "set a training max",
      sql`UPDATE training_blocks SET training_maxes = ${encoded}, updated_at = ${at}
          WHERE id = ${id} RETURNING id`,
    );
  });

  const remove = Effect.fn("BlockStore.remove")(function* (id: BlockId) {
    const deleted = yield* Effect.gen(function* () {
      yield* sql`DELETE FROM programmed_sessions WHERE block_id = ${id}`;
      return yield* sql<{ id: string }>`DELETE FROM training_blocks WHERE id = ${id} RETURNING id`;
    }).pipe(sql.withTransaction, Effect.mapError(failedTo("remove a training block")));
    if (deleted.length === 0) return yield* new BlockNotFoundError({ id });
  });

  /** Runs an UPDATE on one session, then reads it back; a missing row is a not-found. */
  const updateSession = Effect.fn("BlockStore.updateSession")(function* (
    id: ProgrammedSessionId,
    operation: Operation,
    update: (row: SessionRow) => Effect.Effect<unknown, unknown>,
  ) {
    const failed = failedTo(operation);
    const [row] = yield* selectSession(id).pipe(Effect.mapError(failed));
    if (row === undefined) return yield* new ProgrammedSessionNotFoundError({ id });
    yield* update(row).pipe(Effect.mapError(failed));
    const [after] = yield* selectSession(id).pipe(Effect.mapError(failed));
    if (after === undefined) return yield* new ProgrammedSessionNotFoundError({ id });
    return yield* sessionOf(after).pipe(Effect.mapError(failed));
  });

  const move = Effect.fn("BlockStore.move")(function* (id: ProgrammedSessionId, day: IsoDate) {
    const at = yield* now;
    return yield* updateSession(
      id,
      "move a session",
      () => sql`UPDATE programmed_sessions SET day = ${day}, updated_at = ${at} WHERE id = ${id}`,
    );
  });

  const tick = Effect.fn("BlockStore.tick")(function* (
    id: ProgrammedSessionId,
    line: number,
    done: boolean,
  ) {
    const at = yield* now;
    return yield* updateSession(id, "tick a line", (row) =>
      Effect.gen(function* () {
        if (line >= row.lines.length) return;
        const rest = row.ticked.filter((index) => index !== line);
        const ticked = yield* encodeTicked(done ? [...rest, line].sort((a, b) => a - b) : rest);
        yield* sql`UPDATE programmed_sessions SET ticked = ${ticked}, updated_at = ${at}
                   WHERE id = ${id}`;
      }),
    );
  });

  const removeSession = Effect.fn("BlockStore.removeSession")(function* (id: ProgrammedSessionId) {
    const deleted = yield* sql<{ id: string }>`
      DELETE FROM programmed_sessions WHERE id = ${id} RETURNING id
    `.pipe(Effect.mapError(failedTo("remove a session")));
    if (deleted.length === 0) return yield* new ProgrammedSessionNotFoundError({ id });
  });

  return BlockStore.of({
    list,
    draft,
    schedule,
    remove,
    setTrainingMax,
    move,
    tick,
    removeSession,
  });
});

export const layer = Layer.effect(BlockStore, make);
