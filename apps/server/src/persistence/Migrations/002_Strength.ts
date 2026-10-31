import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: later catalog changes go in new migrations, so ids stay stable once referenced.
const MOVEMENTS: Arr.NonEmptyReadonlyArray<readonly [id: string, name: string, category: string]> =
  [
    ["back-squat", "Back squat", "barbell"],
    ["front-squat", "Front squat", "barbell"],
    ["overhead-squat", "Overhead squat", "barbell"],
    ["deadlift", "Deadlift", "barbell"],
    ["sumo-deadlift", "Sumo deadlift", "barbell"],
    ["bench-press", "Bench press", "barbell"],
    ["strict-press", "Strict press", "barbell"],
    ["push-press", "Push press", "barbell"],
    ["push-jerk", "Push jerk", "barbell"],
    ["split-jerk", "Split jerk", "barbell"],
    ["clean", "Clean", "barbell"],
    ["power-clean", "Power clean", "barbell"],
    ["hang-power-clean", "Hang power clean", "barbell"],
    ["clean-and-jerk", "Clean and jerk", "barbell"],
    ["snatch", "Snatch", "barbell"],
    ["power-snatch", "Power snatch", "barbell"],
    ["hang-power-snatch", "Hang power snatch", "barbell"],
    ["thruster", "Thruster", "barbell"],
    ["kettlebell-swing", "Kettlebell swing", "dumbbell_kettlebell"],
    ["dumbbell-snatch", "Dumbbell snatch", "dumbbell_kettlebell"],
    ["wall-ball", "Wall ball", "dumbbell_kettlebell"],
    ["pull-up", "Pull-up", "gymnastics"],
    ["chest-to-bar-pull-up", "Chest-to-bar pull-up", "gymnastics"],
    ["bar-muscle-up", "Bar muscle-up", "gymnastics"],
    ["ring-muscle-up", "Ring muscle-up", "gymnastics"],
    ["toes-to-bar", "Toes-to-bar", "gymnastics"],
    ["handstand-push-up", "Handstand push-up", "gymnastics"],
    ["push-up", "Push-up", "gymnastics"],
    ["ring-dip", "Ring dip", "gymnastics"],
    ["rope-climb", "Rope climb", "gymnastics"],
    ["box-jump", "Box jump", "gymnastics"],
    ["burpee", "Burpee", "gymnastics"],
    ["air-squat", "Air squat", "gymnastics"],
    ["pistol", "Pistol", "gymnastics"],
    ["sit-up", "Sit-up", "gymnastics"],
    ["double-under", "Double-under", "monostructural"],
    ["row", "Row", "monostructural"],
    ["run", "Run", "monostructural"],
    ["bike", "Bike", "monostructural"],
    ["ski-erg", "Ski erg", "monostructural"],
  ];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE movements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE TABLE lift_sets (
      id TEXT PRIMARY KEY,
      movement_id TEXT NOT NULL REFERENCES movements (id),
      performed_on TEXT NOT NULL,
      reps INTEGER NOT NULL CHECK (reps >= 1),
      load_kg REAL NOT NULL CHECK (load_kg > 0),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX lift_sets_movement ON lift_sets (movement_id, performed_on)`;
  yield* sql`CREATE INDEX lift_sets_performed_on ON lift_sets (performed_on DESC, id DESC)`;
  yield* sql`INSERT INTO movements ${sql.insert(
    Arr.map(MOVEMENTS, ([id, name, category]) => ({ id, name, category })),
  )}`;
});
