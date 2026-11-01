import {
  RestDay,
  RestDayNotFoundError,
  type IsoDate,
  type MarkRestDayInput,
  type RestDaySource,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class RestDayPersistenceError extends Schema.TaggedError<RestDayPersistenceError>()(
  "RestDayPersistenceError",
  {
    operation: Schema.Literals(["list rest days", "mark a rest day", "clear a rest day"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

export class RestDayStore extends Context.Service<
  RestDayStore,
  {
    /** Every marked day, oldest first. */
    readonly list: () => Effect.Effect<ReadonlyArray<RestDay>, RestDayPersistenceError>;
    /** Marks the day; a day marked again keeps only the new kind and who marked it. */
    readonly mark: (
      input: MarkRestDayInput,
      source: RestDaySource,
    ) => Effect.Effect<RestDay, RestDayPersistenceError>;
    readonly clear: (
      day: IsoDate,
    ) => Effect.Effect<void, RestDayNotFoundError | RestDayPersistenceError>;
  }
>()("chalk/rest/RestDayStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const selectAll = SqlSchema.findAll({
    Request: Schema.Void,
    Result: RestDay,
    execute: () => sql`
      SELECT day, kind, source, created_at AS "createdAt" FROM rest_days ORDER BY day
    `,
  });

  const list = Effect.fn("RestDayStore.list")(
    function* () {
      return yield* selectAll(undefined);
    },
    Effect.mapError((cause) => new RestDayPersistenceError({ operation: "list rest days", cause })),
  );

  const mark = Effect.fn("RestDayStore.mark")(
    function* (input: MarkRestDayInput, source: RestDaySource) {
      const createdAt = DateTime.formatIso(yield* DateTime.now);
      yield* sql`
        INSERT INTO rest_days (day, kind, source, created_at)
        VALUES (${input.day}, ${input.kind}, ${source}, ${createdAt})
        ON CONFLICT (day) DO UPDATE SET
          kind = excluded.kind, source = excluded.source, created_at = excluded.created_at
      `;
      return { day: input.day, kind: input.kind, source, createdAt } satisfies RestDay;
    },
    Effect.mapError(
      (cause) => new RestDayPersistenceError({ operation: "mark a rest day", cause }),
    ),
  );

  const clear = Effect.fn("RestDayStore.clear")(function* (day: IsoDate) {
    const deleted = yield* sql<{ day: string }>`
      DELETE FROM rest_days WHERE day = ${day} RETURNING day
    `.pipe(
      Effect.mapError(
        (cause) => new RestDayPersistenceError({ operation: "clear a rest day", cause }),
      ),
    );
    if (deleted.length === 0) return yield* new RestDayNotFoundError({ day });
  });

  return RestDayStore.of({ list, mark, clear });
});

export const layer = Layer.effect(RestDayStore, make);
