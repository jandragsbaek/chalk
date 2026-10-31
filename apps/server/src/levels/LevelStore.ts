import {
  IsoDate,
  LevelItem,
  MovementId,
  Performance,
  Quantity,
  WorkoutId,
  type LevelOverview,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import * as CatalogStore from "../catalog/CatalogStore.ts";

export class LevelPersistenceError extends Schema.TaggedError<LevelPersistenceError>()(
  "LevelPersistenceError",
  { operation: Schema.Literals(["load levels"]), cause: Schema.Defect() },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const ItemRow = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  movementId: MovementId,
  alternative: Schema.Number,
  prescription: Schema.fromJsonString(
    Schema.Array(Schema.Struct({ quantities: Schema.Array(Quantity) })),
  ),
  performance: Schema.NullOr(Schema.fromJsonString(Performance)),
  liftedKg: Schema.NullOr(Schema.Finite),
});

export class LevelStore extends Context.Service<
  LevelStore,
  {
    /**
     * The catalog with each movement's sheet row, and every programmed movement of every saved
     * session, oldest first. Grading happens in the client with the contracts' functions, the
     * same ones the importer uses.
     */
    readonly overview: () => Effect.Effect<LevelOverview, LevelPersistenceError>;
  }
>()("chalk/levels/LevelStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const catalog = yield* CatalogStore.CatalogStore;

  const selectItems = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ItemRow,
    execute: () => sql`
      SELECT w.id AS "workoutId", w.performed_on AS "performedOn", i.movement_id AS "movementId",
             (i.alternative_of IS NOT NULL) AS alternative, i.prescription, i.performance,
             (SELECT MAX(l.load_kg) FROM lift_sets l WHERE l.workout_item_id = i.id) AS "liftedKg"
      FROM workout_items i
      JOIN workout_blocks b ON b.id = i.block_id
      JOIN workout_parts p ON p.id = b.part_id
      JOIN workouts w ON w.id = p.workout_id
      ORDER BY w.performed_on, p.position, b.position, i.position
    `,
  });

  const overview = Effect.fn("LevelStore.overview")(function* () {
    const movements = yield* catalog
      .list()
      .pipe(
        Effect.mapError(
          (error) => new LevelPersistenceError({ operation: "load levels", cause: error.cause }),
        ),
      );
    const rows = yield* selectItems(undefined).pipe(
      Effect.mapError((cause) => new LevelPersistenceError({ operation: "load levels", cause })),
    );
    const items = rows.map((row): LevelItem => ({
      workoutId: row.workoutId,
      performedOn: row.performedOn,
      movementId: row.movementId,
      alternative: row.alternative === 1,
      sets: row.prescription,
      ...(row.performance === null ? {} : { performance: row.performance }),
      ...(row.liftedKg === null ? {} : { liftedKg: row.liftedKg }),
    }));
    return { movements, items };
  });

  return LevelStore.of({ overview });
});

export const layer = Layer.effect(LevelStore, make);
