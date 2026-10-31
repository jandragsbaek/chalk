import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: variations the level sheet grades by, as catalog movements. Ids may already exist
// as user-added movements (same slug); those rows are kept as they are.
const MOVEMENTS: ReadonlyArray<
  readonly [id: string, name: string, category: string, variationOf: string | null]
> = [
  ["jumping-pull-up", "Jumping pull-up", "gymnastics", "pull-up"],
  ["ring-row", "Ring row", "gymnastics", null],
  ["strict-ring-muscle-up", "Strict ring muscle-up", "gymnastics", "ring-muscle-up"],
  ["hanging-knee-raise", "Hanging knee raise", "gymnastics", "toes-to-bar"],
  ["strict-toes-to-bar", "Strict toes-to-bar", "gymnastics", "toes-to-bar"],
  ["strict-handstand-push-up", "Strict handstand push-up", "gymnastics", "handstand-push-up"],
  ["pike-push-up", "Pike push-up", "gymnastics", null],
  ["handstand-walk", "Handstand walk", "gymnastics", null],
  ["legless-rope-climb", "Legless rope climb", "gymnastics", "rope-climb"],
  ["ghd-sit-up", "GHD sit-up", "gymnastics", null],
  ["box-step-up", "Box step-up", "gymnastics", "box-jump"],
  ["single-under", "Single-under", "monostructural", null],
  ["triple-under", "Triple-under", "monostructural", "double-under"],
  ["double-crossover", "Double crossover", "monostructural", "double-under"],
  [
    "russian-kettlebell-swing",
    "Russian kettlebell swing",
    "dumbbell_kettlebell",
    "kettlebell-swing",
  ],
  [
    "american-kettlebell-swing",
    "American kettlebell swing",
    "dumbbell_kettlebell",
    "kettlebell-swing",
  ],
];

// Keys are the normalized phrase (`normalizeMovementPhrase`): lower case, words split on
// punctuation, a trailing plural "s" dropped from words of three letters or more.
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["jumping pullup", "Jumping pullup", "jumping-pull-up"],
  ["heel above hip", "Heels above hips", "hanging-knee-raise"],
  ["hah", "HAH", "hanging-knee-raise"],
  ["knee raise", "Knee raise", "hanging-knee-raise"],
  ["strict t2b", "Strict T2B", "strict-toes-to-bar"],
  ["strict hspu", "Strict HSPU", "strict-handstand-push-up"],
  ["hsw", "HSW", "handstand-walk"],
  ["ghd", "GHD", "ghd-sit-up"],
  ["ghd situp", "GHD situp", "ghd-sit-up"],
  ["su", "SU", "single-under"],
  ["box step", "Box step", "box-step-up"],
  ["step up", "Step-ups", "box-step-up"],
  ["russian kb swing", "Russian KB swing", "russian-kettlebell-swing"],
  ["american kb swing", "American KB swing", "american-kettlebell-swing"],
];

// Frozen seed: the sheet row each movement is graded on. Ids that do not exist are no-ops.
const FAMILIES: ReadonlyArray<readonly [id: string, family: string]> = [
  ["deadlift", "bb-deadlift"],
  ["sumo-deadlift", "bb-deadlift"],
  ["front-squat", "bb-front-squat"],
  ["back-squat", "bb-back-squat"],
  ["overhead-squat", "bb-overhead-squat"],
  ["clean", "bb-clean"],
  ["power-clean", "bb-clean"],
  ["hang-power-clean", "bb-clean"],
  ["clean-and-jerk", "bb-clean"],
  ["strict-press", "bb-press"],
  ["push-press", "bb-press"],
  ["push-jerk", "bb-press"],
  ["split-jerk", "bb-press"],
  ["thruster", "bb-thruster"],
  ["snatch", "bb-snatch"],
  ["power-snatch", "bb-snatch"],
  ["hang-power-snatch", "bb-snatch"],
  ["kettlebell-swing", "kb-swing"],
  ["russian-kettlebell-swing", "kb-swing"],
  ["american-kettlebell-swing", "kb-swing"],
  ["dumbbell-snatch", "db-snatch"],
  ["wall-ball", "wall-balls"],
  ["jumping-pull-up", "pull-ups"],
  ["ring-row", "pull-ups"],
  ["pull-up", "pull-ups"],
  ["chest-to-bar-pull-up", "pull-ups"],
  ["bar-muscle-up", "pull-ups"],
  ["ring-muscle-up", "pull-ups"],
  ["strict-ring-muscle-up", "pull-ups"],
  ["hanging-knee-raise", "toes-to-bar"],
  ["toes-to-bar", "toes-to-bar"],
  ["strict-toes-to-bar", "toes-to-bar"],
  ["pike-push-up", "hspu"],
  ["handstand-push-up", "hspu"],
  ["strict-handstand-push-up", "hspu"],
  ["handstand-walk", "handstand-walk"],
  ["single-under", "skipping-rope"],
  ["double-under", "skipping-rope"],
  ["triple-under", "skipping-rope"],
  ["double-crossover", "skipping-rope"],
  ["pistol", "pistols"],
  ["rope-climb", "rope-climbs"],
  ["legless-rope-climb", "rope-climbs"],
  ["box-step-up", "box-jumps"],
  ["box-jump", "box-jumps"],
  ["push-up", "push-ups"],
  ["ghd-sit-up", "ghd-sit-ups"],
];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Grading and accessory tags live on the movement, so every session sees the same answer.
  yield* sql`ALTER TABLE movements ADD COLUMN level_family TEXT`;
  yield* sql`ALTER TABLE movements ADD COLUMN accessory INTEGER NOT NULL DEFAULT 0`;
  yield* sql`ALTER TABLE movements ADD COLUMN complements TEXT NOT NULL DEFAULT '[]'`;
  yield* sql`ALTER TABLE movements ADD COLUMN supports TEXT NOT NULL DEFAULT '[]'`;

  // How a programmed movement was done (load, reps by variation, biggest unbroken set) as JSON;
  // re-derived from the import document on every save.
  yield* sql`ALTER TABLE workout_items ADD COLUMN performance TEXT`;

  for (const [id, name, category, variationOf] of MOVEMENTS) {
    yield* sql`
      INSERT INTO movements (id, name, category, user_added)
      VALUES (${id}, ${name}, ${category}, 0)
      ON CONFLICT DO NOTHING
    `;
    // One level of variations: only under a core, and only if the movement has none itself.
    if (variationOf !== null)
      yield* sql`
        UPDATE movements SET variation_of = ${variationOf}
        WHERE id = ${id} AND variation_of IS NULL
          AND EXISTS (SELECT 1 FROM movements WHERE id = ${variationOf} AND variation_of IS NULL)
          AND NOT EXISTS (SELECT 1 FROM movements WHERE variation_of = ${id})
      `;
  }
  for (const [key, alias, movementId] of ALIASES)
    yield* sql`
      INSERT INTO movement_aliases (key, alias, movement_id)
      SELECT ${key}, ${alias}, ${movementId}
      WHERE EXISTS (SELECT 1 FROM movements WHERE id = ${movementId})
      ON CONFLICT DO NOTHING
    `;
  for (const [id, family] of FAMILIES)
    yield* sql`UPDATE movements SET level_family = ${family} WHERE id = ${id}`;
});
