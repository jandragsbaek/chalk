import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: standard whiteboard shorthand for seeded movements. Keys are the normalized
// phrase (`normalizeMovementPhrase`): lower case, words split on punctuation, plural "s" dropped.
const ALIASES: Arr.NonEmptyReadonlyArray<
  readonly [key: string, alias: string, movementId: string]
> = [
  ["du", "DU", "double-under"],
  ["hpc", "HPC", "hang-power-clean"],
  ["hp", "HPS", "hang-power-snatch"],
  ["t2b", "T2B", "toes-to-bar"],
  ["ttb", "TTB", "toes-to-bar"],
  ["c2b", "C2B", "chest-to-bar-pull-up"],
  ["hspu", "HSPU", "handstand-push-up"],
  ["oh", "OHS", "overhead-squat"],
  ["kb swing", "KB swing", "kettlebell-swing"],
  ["wb", "WB", "wall-ball"],
  ["db snatch", "DB snatch", "dumbbell-snatch"],
  ["squat snatch", "Squat snatch", "snatch"],
  ["squat clean", "Squat clean", "clean"],
  ["pullup", "Pullup", "pull-up"],
  ["pushup", "Pushup", "push-up"],
  ["situp", "Situp", "sit-up"],
  ["shoulder press", "Shoulder press", "strict-press"],
  ["bmu", "BMU", "bar-muscle-up"],
  ["rmu", "RMU", "ring-muscle-up"],
  ["assault bike", "Assault bike", "bike"],
  ["echo bike", "Echo bike", "bike"],
  ["bike erg", "Bike erg", "bike"],
  ["ski", "Ski", "ski-erg"],
  ["skierg", "SkiErg", "ski-erg"],
];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`ALTER TABLE movements ADD COLUMN user_added INTEGER NOT NULL DEFAULT 0`;
  yield* sql`
    CREATE TABLE movement_aliases (
      key TEXT PRIMARY KEY,
      alias TEXT NOT NULL,
      movement_id TEXT NOT NULL REFERENCES movements (id)
    )
  `;
  yield* sql`CREATE INDEX movement_aliases_movement ON movement_aliases (movement_id)`;
  yield* sql`INSERT INTO movement_aliases ${sql.insert(
    Arr.map(ALIASES, ([key, alias, movementId]) => ({ key, alias, movement_id: movementId })),
  )}`;

  // The pasted text and its spans are the source of truth; parts, blocks and items are derived.
  yield* sql`
    CREATE TABLE session_imports (
      workout_id TEXT PRIMARY KEY REFERENCES workouts (id),
      session_number INTEGER UNIQUE,
      performed_on TEXT NOT NULL,
      document TEXT NOT NULL,
      imported_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX session_imports_performed_on ON session_imports (performed_on)`;

  yield* sql`
    CREATE TABLE workout_parts (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL REFERENCES workouts (id),
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      raw_text TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX workout_parts_workout ON workout_parts (workout_id, position)`;

  yield* sql`
    CREATE TABLE workout_blocks (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL REFERENCES workout_parts (id),
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      format TEXT,
      params TEXT NOT NULL,
      score TEXT NOT NULL DEFAULT ''
    )
  `;
  yield* sql`CREATE INDEX workout_blocks_part ON workout_blocks (part_id, position)`;

  yield* sql`
    CREATE TABLE workout_items (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES workout_blocks (id),
      position INTEGER NOT NULL,
      movement_id TEXT NOT NULL REFERENCES movements (id),
      alternative_of TEXT REFERENCES workout_items (id),
      prescription TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX workout_items_block ON workout_items (block_id, position)`;
  yield* sql`CREATE INDEX workout_items_movement ON workout_items (movement_id)`;

  yield* sql`ALTER TABLE lift_sets ADD COLUMN workout_id TEXT REFERENCES workouts (id)`;
  yield* sql`CREATE INDEX lift_sets_workout ON lift_sets (workout_id)`;
});
