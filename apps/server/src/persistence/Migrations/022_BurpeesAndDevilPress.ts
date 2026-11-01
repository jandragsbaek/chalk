import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: the burpee variations and devil presses the box programs. The board shortens
// "over" to "o." ("Burpee o. line"), so each "over" movement has that alias too. A devil press
// is two dumbbells; one dumbbell is the single-arm variation. Ids are the slug of the name, so a
// user-added one with the same name is kept, and one spelled like an alias here keeps the phrase.
const MOVEMENTS: ReadonlyArray<
  readonly [
    id: string,
    name: string,
    /** `normalizeMovementPhrase` of the name. */
    nameKey: string,
    category: string,
    variationOf: string | null,
  ]
> = [
  ["burpee-over-line", "Burpee over line", "burpee over line", "gymnastics", "burpee"],
  ["burpee-over-dumbbell", "Burpee over dumbbell", "burpee over dumbbell", "gymnastics", "burpee"],
  ["burpee-broad-jump", "Burpee broad jump", "burpee broad jump", "gymnastics", "burpee"],
  ["burpee-tuck-jump", "Burpee tuck jump", "burpee tuck jump", "gymnastics", "burpee"],
  ["devil-press", "Devil press", "devil press", "dumbbell_kettlebell", null],
  [
    "single-arm-devil-press",
    "Single-arm devil press",
    "single arm devil press",
    "dumbbell_kettlebell",
    "devil-press",
  ],
];

// Keys are the normalized phrase (`normalizeMovementPhrase`): "o." is the word "o".
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["burpee o line", "Burpee o. line", "burpee-over-line"],
  ["burpee over the line", "Burpee over the line", "burpee-over-line"],
  ["lateral burpee over line", "Lateral burpee over line", "burpee-over-line"],
  ["lateral burpee over the line", "Lateral burpee over the line", "burpee-over-line"],
  ["lateral burpee o line", "Lateral burpee o. line", "burpee-over-line"],
  ["line facing burpee", "Line-facing burpee", "burpee-over-line"],
  ["burpee o dumbbell", "Burpee o. dumbbell", "burpee-over-dumbbell"],
  ["burpee over db", "Burpee over DB", "burpee-over-dumbbell"],
  ["burpee o db", "Burpee o. DB", "burpee-over-dumbbell"],
  ["burpee over the dumbbell", "Burpee over the dumbbell", "burpee-over-dumbbell"],
  ["lateral burpee over dumbbell", "Lateral burpee over dumbbell", "burpee-over-dumbbell"],
  ["lateral burpee over db", "Lateral burpee over DB", "burpee-over-dumbbell"],
  ["burpee o bar", "Burpee o. bar", "bar-facing-burpee"],
  ["burpee o the bar", "Burpee o. the bar", "bar-facing-burpee"],
  ["burpee o barbell", "Burpee o. barbell", "bar-facing-burpee"],
  ["lateral burpee over bar", "Lateral burpee over bar", "bar-facing-burpee"],
  ["lateral burpee over barbell", "Lateral burpee over barbell", "bar-facing-burpee"],
  ["burpee o rower", "Burpee o. rower", "burpee-over-rower"],
  ["burpee o the rower", "Burpee o. the rower", "burpee-over-rower"],
  ["burpee over box", "Burpee over box", "burpee-box-jump-over"],
  ["burpee o box", "Burpee o. box", "burpee-box-jump-over"],
  ["burpee box jump o", "Burpee box jump o.", "burpee-box-jump-over"],
  ["burpee tuck", "Burpee tuck", "burpee-tuck-jump"],
  ["devil s press", "Devil's press", "devil-press"],
  ["db devil press", "DB devil press", "devil-press"],
  ["dumbbell devil press", "Dumbbell devil press", "devil-press"],
  ["double db devil press", "Double DB devil press", "devil-press"],
  ["double dumbbell devil press", "Double dumbbell devil press", "devil-press"],
  ["dual db devil press", "Dual DB devil press", "devil-press"],
  ["dual dumbbell devil press", "Dual dumbbell devil press", "devil-press"],
  ["single arm devil s press", "Single-arm devil's press", "single-arm-devil-press"],
  ["sa devil press", "SA devil press", "single-arm-devil-press"],
  ["one arm devil press", "One-arm devil press", "single-arm-devil-press"],
  ["single db devil press", "Single DB devil press", "single-arm-devil-press"],
  ["single dumbbell devil press", "Single dumbbell devil press", "single-arm-devil-press"],
  ["one db devil press", "One DB devil press", "single-arm-devil-press"],
  ["one dumbbell devil press", "One dumbbell devil press", "single-arm-devil-press"],
];

// What each is usually scaled to, first offered first (as `021_Scalings`).
const SCALINGS: ReadonlyArray<readonly [id: string, scalings: ReadonlyArray<string>]> = [
  ["burpee-over-dumbbell", ["burpee"]],
  ["burpee-broad-jump", ["burpee"]],
  ["burpee-tuck-jump", ["burpee"]],
  ["devil-press", ["single-arm-devil-press", "dumbbell-burpee-deadlift"]],
  ["single-arm-devil-press", ["dumbbell-snatch"]],
];

/** `normalizeMovementPhrase` as of this migration: lower case, words, plural "s" dropped. */
const phraseKey = (phrase: string) =>
  Array.from(phrase.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu), ([word]) =>
    word.length >= 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word,
  ).join(" ");

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Skipped when the athlete already has it under another spelling ("Devils press").
  const names = yield* sql<{ id: string; name: string }>`SELECT id, name FROM movements`;
  for (const [id, name, nameKey, category] of MOVEMENTS) {
    const keys = new Set([nameKey, ...ALIASES.flatMap(([key, , to]) => (to === id ? [key] : []))]);
    if (names.some((other) => other.id !== id && keys.has(phraseKey(other.name)))) continue;
    yield* sql`
      INSERT INTO movements (id, name, category, user_added)
      VALUES (${id}, ${name}, ${category}, 0)
      ON CONFLICT DO NOTHING
    `;
  }
  // A movement's name takes its phrase from any alias that meant another movement.
  for (const [id, , nameKey] of MOVEMENTS)
    yield* sql`
      DELETE FROM movement_aliases
      WHERE key = ${nameKey} AND movement_id <> ${id}
        AND EXISTS (SELECT 1 FROM movements WHERE id = ${id})
    `;
  // One level of variations: only under a core, and only if the movement has none itself.
  for (const [id, , , , variationOf] of MOVEMENTS)
    if (variationOf !== null)
      yield* sql`
        UPDATE movements SET variation_of = ${variationOf}
        WHERE id = ${id} AND variation_of IS NULL
          AND EXISTS (SELECT 1 FROM movements WHERE id = ${variationOf} AND variation_of IS NULL)
          AND NOT EXISTS (SELECT 1 FROM movements WHERE variation_of = ${id})
      `;
  // A phrase taught as the plain core ("Burpee o. line" as Burpee) had no closer movement yet.
  for (const [key, , movementId] of ALIASES)
    yield* sql`
      UPDATE movement_aliases SET movement_id = ${movementId}
      WHERE key = ${key}
        AND movement_id = (SELECT variation_of FROM movements WHERE id = ${movementId})
    `;
  for (const [key, alias, movementId] of ALIASES)
    yield* sql`
      INSERT INTO movement_aliases (key, alias, movement_id)
      SELECT ${key}, ${alias}, ${movementId}
      WHERE EXISTS (SELECT 1 FROM movements WHERE id = ${movementId})
        AND NOT EXISTS (SELECT 1 FROM movements WHERE id <> ${movementId} AND lower(name) = lower(${alias}))
      ON CONFLICT DO NOTHING
    `;
  const existing = new Set(
    (yield* sql<{ readonly id: string }>`SELECT id FROM movements`).map((row) => row.id),
  );
  for (const [id, scalings] of SCALINGS) {
    const kept = scalings.filter((other) => existing.has(other));
    if (existing.has(id) && kept.length > 0)
      yield* sql`
        UPDATE movements SET scalings = ${JSON.stringify(kept)}
        WHERE id = ${id} AND scalings = '[]'
      `;
  }
});
