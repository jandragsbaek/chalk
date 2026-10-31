import {
  LiftSet,
  LiftSetId,
  LiftSetNotFoundError,
  Movement,
  MovementNotFoundError,
  type LogLiftSetInput,
  type MovementRecords,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { computeRecords } from "./repMaxes.ts";

export class StrengthPersistenceError extends Schema.TaggedError<StrengthPersistenceError>()(
  "StrengthPersistenceError",
  {
    operation: Schema.Literals([
      "list movements",
      "list lift sets",
      "log lift set",
      "delete lift set",
      "compute rep maxes",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

export class StrengthStore extends Context.Service<
  StrengthStore,
  {
    /** The movement catalog, by category then name. */
    readonly movements: () => Effect.Effect<ReadonlyArray<Movement>, StrengthPersistenceError>;
    /** Every set, newest day first. */
    readonly list: () => Effect.Effect<ReadonlyArray<LiftSet>, StrengthPersistenceError>;
    readonly log: (
      input: LogLiftSetInput,
    ) => Effect.Effect<LiftSet, MovementNotFoundError | StrengthPersistenceError>;
    readonly remove: (
      id: LiftSetId,
    ) => Effect.Effect<void, LiftSetNotFoundError | StrengthPersistenceError>;
    /** Rep maxes of every movement with at least one set. */
    readonly records: () => Effect.Effect<ReadonlyArray<MovementRecords>, StrengthPersistenceError>;
  }
>()("chalk/strength/StrengthStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  const selectMovements = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Movement,
    execute: () => sql`SELECT id, name, category FROM movements ORDER BY category, name`,
  });

  const findMovement = SqlSchema.findAll({
    Request: Schema.String,
    Result: Schema.Struct({ id: Schema.String }),
    execute: (id) => sql`SELECT id FROM movements WHERE id = ${id}`,
  });

  const selectSets = SqlSchema.findAll({
    Request: Schema.Void,
    Result: LiftSet,
    execute: () => sql`
      SELECT id, movement_id AS "movementId", performed_on AS "performedOn", reps,
             load_kg AS "loadKg", notes, created_at AS "createdAt"
      FROM lift_sets
      ORDER BY performed_on DESC, id DESC
    `,
  });

  const movements = Effect.fn("StrengthStore.movements")(function* () {
    return yield* selectMovements(undefined).pipe(
      Effect.mapError(
        (cause) => new StrengthPersistenceError({ operation: "list movements", cause }),
      ),
    );
  });

  const list = Effect.fn("StrengthStore.list")(function* () {
    return yield* selectSets(undefined).pipe(
      Effect.mapError(
        (cause) => new StrengthPersistenceError({ operation: "list lift sets", cause }),
      ),
    );
  });

  const log = Effect.fn("StrengthStore.log")(function* (input: LogLiftSetInput) {
    const known = yield* findMovement(input.movementId).pipe(
      Effect.mapError(
        (cause) => new StrengthPersistenceError({ operation: "log lift set", cause }),
      ),
    );
    if (known.length === 0) return yield* new MovementNotFoundError({ id: input.movementId });

    const set: LiftSet = {
      ...input,
      id: LiftSetId.make(yield* random.uuidV7()),
      createdAt: DateTime.formatIso(yield* DateTime.now),
    };
    yield* sql`
      INSERT INTO lift_sets (id, movement_id, performed_on, reps, load_kg, notes, created_at)
      VALUES (${set.id}, ${set.movementId}, ${set.performedOn}, ${set.reps}, ${set.loadKg},
              ${set.notes}, ${set.createdAt})
    `.pipe(
      Effect.mapError(
        (cause) => new StrengthPersistenceError({ operation: "log lift set", cause }),
      ),
    );
    return set;
  });

  const remove = Effect.fn("StrengthStore.remove")(function* (id: LiftSetId) {
    const deleted = yield* sql<{
      id: string;
    }>`DELETE FROM lift_sets WHERE id = ${id} RETURNING id`.pipe(
      Effect.mapError(
        (cause) => new StrengthPersistenceError({ operation: "delete lift set", cause }),
      ),
    );
    if (deleted.length === 0) return yield* new LiftSetNotFoundError({ id });
  });

  const records = Effect.fn("StrengthStore.records")(function* () {
    const sets = yield* selectSets(undefined).pipe(
      Effect.mapError(
        (cause) => new StrengthPersistenceError({ operation: "compute rep maxes", cause }),
      ),
    );
    return computeRecords(sets);
  });

  return StrengthStore.of({ movements, list, log, remove, records });
});

export const layer = Layer.effect(StrengthStore, make);
