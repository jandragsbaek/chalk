import {
  CoachReceipt,
  CoachThread,
  CoachThreadId,
  CoachThreadNotFoundError,
  CoachTurn,
  type CoachThreadDetail,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class CoachPersistenceError extends Schema.TaggedError<CoachPersistenceError>()(
  "CoachPersistenceError",
  {
    operation: Schema.Literals([
      "list coach threads",
      "load coach thread",
      "start coach thread",
      "save coach turn",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

/** A turn before it has a place in the thread. */
export type NewCoachTurn = Omit<CoachTurn, "seq" | "createdAt">;

const ThreadRow = Schema.Struct({
  id: CoachThreadId,
  title: Schema.String,
  model: Schema.String,
  turns: Schema.Number,
  reads: Schema.Number,
  unanswered: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const toThread = (row: typeof ThreadRow.Type): CoachThread => ({
  ...row,
  unanswered: row.unanswered === 1,
});

const TurnRow = Schema.Struct({
  seq: Schema.Number,
  role: CoachTurn.fields.role,
  text: Schema.String,
  receipts: Schema.fromJsonString(Schema.Array(CoachReceipt)),
  stopped: Schema.NullOr(Schema.Literals(["read-limit", "step-limit", "model-error"])),
  createdAt: Schema.String,
});

const toTurn = ({ stopped, ...row }: typeof TurnRow.Type): CoachTurn =>
  stopped === null ? row : { ...row, stopped };

const encodeReceipts = Schema.encodeSync(Schema.fromJsonString(Schema.Array(CoachReceipt)));

export class CoachStore extends Context.Service<
  CoachStore,
  {
    /** Every thread, most recently answered first. */
    readonly threads: () => Effect.Effect<ReadonlyArray<CoachThread>, CoachPersistenceError>;
    readonly detail: (
      id: CoachThreadId,
    ) => Effect.Effect<CoachThreadDetail, CoachThreadNotFoundError | CoachPersistenceError>;
    readonly start: (input: {
      readonly title: string;
      readonly model: string;
    }) => Effect.Effect<CoachThread, CoachPersistenceError>;
    /** The model's transcript of the thread, as the Chat export JSON (empty until the coach first answers). */
    readonly history: (
      id: CoachThreadId,
    ) => Effect.Effect<string, CoachThreadNotFoundError | CoachPersistenceError>;
    /**
     * Appends a turn and, in the same transaction, stamps the thread: answered now, by `model`,
     * with the transcript `history` when given.
     */
    readonly append: (
      id: CoachThreadId,
      turn: NewCoachTurn,
      stamp: { readonly model: string; readonly history?: string },
    ) => Effect.Effect<
      { readonly thread: CoachThread; readonly turn: CoachTurn },
      CoachThreadNotFoundError | CoachPersistenceError
    >;
  }
>()("chalk/coach/CoachStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  const selectThreads = SqlSchema.findAll({
    Request: Schema.NullOr(Schema.String),
    Result: ThreadRow,
    execute: (id) => sql`
      SELECT t.id, t.title, t.model, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
             COUNT(u.seq) AS turns, COALESCE(SUM(json_array_length(u.receipts)), 0) AS reads,
             COALESCE((
               SELECT l.role = 'athlete' OR l.stopped = 'model-error' FROM coach_turns l
               WHERE l.thread_id = t.id ORDER BY l.seq DESC LIMIT 1
             ), 0) AS unanswered
      FROM coach_threads t
      LEFT JOIN coach_turns u ON u.thread_id = t.id
      ${id === null ? sql`` : sql`WHERE t.id = ${id}`}
      GROUP BY t.id
      ORDER BY t.updated_at DESC, t.id DESC
    `,
  });

  const selectTurns = SqlSchema.findAll({
    Request: Schema.String,
    Result: TurnRow,
    execute: (id) => sql`
      SELECT seq, role, text, receipts, stopped, created_at AS "createdAt"
      FROM coach_turns WHERE thread_id = ${id} ORDER BY seq
    `,
  });

  const findThread = Effect.fnUntraced(function* (
    id: CoachThreadId,
    operation: CoachPersistenceError["operation"],
  ) {
    const [thread] = yield* selectThreads(id).pipe(
      Effect.mapError((cause) => new CoachPersistenceError({ operation, cause })),
    );
    if (thread === undefined) return yield* new CoachThreadNotFoundError({ id });
    return toThread(thread);
  });

  const threads = Effect.fn("CoachStore.threads")(function* () {
    const rows = yield* selectThreads(null).pipe(
      Effect.mapError(
        (cause) => new CoachPersistenceError({ operation: "list coach threads", cause }),
      ),
    );
    return rows.map(toThread);
  });

  const detail = Effect.fn("CoachStore.detail")(function* (id: CoachThreadId) {
    const thread = yield* findThread(id, "load coach thread");
    const turns = yield* selectTurns(id).pipe(
      Effect.mapError(
        (cause) => new CoachPersistenceError({ operation: "load coach thread", cause }),
      ),
    );
    return { thread, turns: turns.map(toTurn) };
  });

  const start = Effect.fn("CoachStore.start")(function* (input: {
    readonly title: string;
    readonly model: string;
  }) {
    const id = CoachThreadId.make(yield* random.uuidV7());
    const now = DateTime.formatIso(yield* DateTime.now);
    yield* sql`
      INSERT INTO coach_threads (id, title, model, created_at, updated_at)
      VALUES (${id}, ${input.title}, ${input.model}, ${now}, ${now})
    `.pipe(
      Effect.mapError(
        (cause) => new CoachPersistenceError({ operation: "start coach thread", cause }),
      ),
    );
    return {
      id,
      ...input,
      turns: 0,
      reads: 0,
      unanswered: false,
      createdAt: now,
      updatedAt: now,
    };
  });

  const history = Effect.fn("CoachStore.history")(function* (id: CoachThreadId) {
    const rows = yield* sql<{ history: string }>`
      SELECT history FROM coach_threads WHERE id = ${id}
    `.pipe(
      Effect.mapError(
        (cause) => new CoachPersistenceError({ operation: "load coach thread", cause }),
      ),
    );
    const [row] = rows;
    if (row === undefined) return yield* new CoachThreadNotFoundError({ id });
    return row.history;
  });

  const append = Effect.fn("CoachStore.append")(function* (
    id: CoachThreadId,
    turn: NewCoachTurn,
    stamp: { readonly model: string; readonly history?: string },
  ) {
    const createdAt = DateTime.formatIso(yield* DateTime.now);
    const seq = yield* Effect.gen(function* () {
      const [last] = yield* sql<{ seq: number | null }>`
        SELECT MAX(seq) AS seq FROM coach_turns WHERE thread_id = ${id}
      `;
      const next = (last?.seq ?? 0) + 1;
      yield* sql`
        INSERT INTO coach_turns (thread_id, seq, role, text, receipts, stopped, created_at)
        VALUES (${id}, ${next}, ${turn.role}, ${turn.text}, ${encodeReceipts(turn.receipts)},
                ${turn.stopped ?? null}, ${createdAt})
      `;
      yield* stamp.history === undefined
        ? sql`UPDATE coach_threads SET model = ${stamp.model}, updated_at = ${createdAt}
              WHERE id = ${id}`
        : sql`UPDATE coach_threads SET model = ${stamp.model}, updated_at = ${createdAt},
                history = ${stamp.history} WHERE id = ${id}`;
      return next;
    }).pipe(
      sql.withTransaction,
      Effect.mapError(
        (cause) => new CoachPersistenceError({ operation: "save coach turn", cause }),
      ),
    );
    const thread = yield* findThread(id, "save coach turn");
    return { thread, turn: { ...turn, seq, createdAt } };
  });

  return CoachStore.of({ threads, detail, start, history, append });
});

export const layer = Layer.effect(CoachStore, make);
