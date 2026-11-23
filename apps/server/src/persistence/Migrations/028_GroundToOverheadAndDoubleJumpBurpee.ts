import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: dumbbell ground-to-overhead ("Dual" in the phrase names the pair) and the burpee
// that jumps over the dumbbell and back. Ids are the slug of the name, so a user-added one with
// the same name is kept, and one spelled like an alias here keeps the phrase.
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
  [
    "dumbbell-ground-to-overhead",
    "Dumbbell ground-to-overhead",
    "dumbbell ground to overhead",
    "dumbbell_kettlebell",
    null,
  ],
  [
    "burpee-double-jump-over-dumbbell",
    "Burpee double jump over dumbbell",
    "burpee double jump over dumbbell",
    "gymnastics",
    "burpee",
  ],
];

// Keys are the normalized phrase (`normalizeMovementPhrase`): "o." is the word "o".
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["db ground to overhead", "DB ground-to-overhead", "dumbbell-ground-to-overhead"],
  ["dual db ground to overhead", "Dual DB ground-to-overhead", "dumbbell-ground-to-overhead"],
  [
    "dual dumbbell ground to overhead",
    "Dual dumbbell ground-to-overhead",
    "dumbbell-ground-to-overhead",
  ],
  ["db g2oh", "DB G2OH", "dumbbell-ground-to-overhead"],
  ["dual db g2oh", "Dual DB G2OH", "dumbbell-ground-to-overhead"],
  ["dumbbell g2oh", "Dumbbell G2OH", "dumbbell-ground-to-overhead"],
  ["burpee double jump over db", "Burpee double jump over DB", "burpee-double-jump-over-dumbbell"],
  [
    "burpee double jump over the dumbbell",
    "Burpee double jump over the dumbbell",
    "burpee-double-jump-over-dumbbell",
  ],
  ["burpee double jump o db", "Burpee double jump o. DB", "burpee-double-jump-over-dumbbell"],
  [
    "burpee double jump o dumbbell",
    "Burpee double jump o. dumbbell",
    "burpee-double-jump-over-dumbbell",
  ],
];

// What each is usually scaled to, first offered first (as `021_Scalings`).
const SCALINGS: ReadonlyArray<readonly [id: string, scalings: ReadonlyArray<string>]> = [
  ["burpee-double-jump-over-dumbbell", ["burpee-over-dumbbell", "burpee"]],
];

/** `normalizeMovementPhrase` as of this migration: lower case, words, plural "s" dropped. */
const phraseKey = (phrase: string) =>
  Array.from(phrase.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu), ([word]) =>
    word.length >= 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word,
  ).join(" ");

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Skipped when the athlete already has it under another spelling ("DB G2OH").
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
  // A phrase taught as the plain core ("Burpee double jump over DB" as Burpee) had no closer
  // movement yet.
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
