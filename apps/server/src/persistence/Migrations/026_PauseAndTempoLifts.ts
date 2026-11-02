import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: paused and tempo helper lifts, each a variation of its lift so its loads keep
// rep maxes of their own; no level family. Tempo pulls are accessories, like `012`'s deficit
// pulls. The importer reads "X with 2 sec pause at knee" as "Pause X". A user-added one with
// the same name is kept.
const MOVEMENTS: ReadonlyArray<
  readonly [
    id: string,
    name: string,
    /** `normalizeMovementPhrase` of the name. */
    nameKey: string,
    variationOf: string,
    supports: ReadonlyArray<string>,
    complements: ReadonlyArray<string>,
  ]
> = [
  ["pause-clean", "Pause clean", "pause clean", "clean", [], []],
  ["pause-power-clean", "Pause power clean", "pause power clean", "clean", [], []],
  ["pause-snatch", "Pause snatch", "pause snatch", "snatch", [], []],
  ["pause-power-snatch", "Pause power snatch", "pause power snatch", "snatch", [], []],
  ["pause-back-squat", "Pause back squat", "pause back squat", "back-squat", [], []],
  ["pause-front-squat", "Pause front squat", "pause front squat", "front-squat", [], []],
  ["pause-deadlift", "Pause deadlift", "pause deadlift", "deadlift", [], []],
  ["tempo-back-squat", "Tempo back squat", "tempo back squat", "back-squat", [], []],
  ["tempo-front-squat", "Tempo front squat", "tempo front squat", "front-squat", [], []],
  ["tempo-deadlift", "Tempo deadlift", "tempo deadlift", "deadlift", [], []],
  [
    "tempo-clean-pull",
    "Tempo clean pull",
    "tempo clean pull",
    "clean-pull",
    ["bb-clean"],
    ["hinge", "upper_back", "hamstrings"],
  ],
  [
    "tempo-snatch-pull",
    "Tempo snatch pull",
    "tempo snatch pull",
    "snatch-pull",
    ["bb-snatch"],
    ["hinge", "upper_back", "hamstrings"],
  ],
];

// Keys are the normalized phrase (`normalizeMovementPhrase`).
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["paused clean", "Paused clean", "pause-clean"],
  ["pause squat clean", "Pause squat clean", "pause-clean"],
  ["paused power clean", "Paused power clean", "pause-power-clean"],
  ["paused snatch", "Paused snatch", "pause-snatch"],
  ["pause squat snatch", "Pause squat snatch", "pause-snatch"],
  ["paused power snatch", "Paused power snatch", "pause-power-snatch"],
  ["paused back squat", "Paused back squat", "pause-back-squat"],
  ["pause squat", "Pause squat", "pause-back-squat"],
  ["paused squat", "Paused squat", "pause-back-squat"],
  ["paused front squat", "Paused front squat", "pause-front-squat"],
  ["paused deadlift", "Paused deadlift", "pause-deadlift"],
  ["tempo squat", "Tempo squat", "tempo-back-squat"],
  ["tempo cl pull", "Tempo CL pull", "tempo-clean-pull"],
  ["tempo sn pull", "Tempo SN pull", "tempo-snatch-pull"],
];

/** `normalizeMovementPhrase` as of this migration: lower case, words, plural "s" dropped. */
const phraseKey = (phrase: string) =>
  Array.from(phrase.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu), ([word]) =>
    word.length >= 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word,
  ).join(" ");

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Skipped when the athlete already has it under another spelling ("Paused clean").
  const names = yield* sql<{ id: string; name: string }>`SELECT id, name FROM movements`;
  for (const [id, name, nameKey] of MOVEMENTS) {
    const keys = new Set([nameKey, ...ALIASES.flatMap(([key, , to]) => (to === id ? [key] : []))]);
    if (names.some((other) => other.id !== id && keys.has(phraseKey(other.name)))) continue;
    yield* sql`
      INSERT INTO movements (id, name, category, user_added)
      VALUES (${id}, ${name}, 'barbell', 0)
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
  for (const [id, , , variationOf] of MOVEMENTS)
    yield* sql`
      UPDATE movements SET variation_of = ${variationOf}
      WHERE id = ${id} AND variation_of IS NULL
        AND EXISTS (SELECT 1 FROM movements WHERE id = ${variationOf} AND variation_of IS NULL)
        AND NOT EXISTS (SELECT 1 FROM movements WHERE variation_of = ${id})
    `;
  // Tags only where the athlete has set none.
  for (const [id, , , , supports, complements] of MOVEMENTS)
    if (supports.length > 0)
      yield* sql`
        UPDATE movements
        SET accessory = 1, supports = ${JSON.stringify(supports)},
            complements = ${JSON.stringify(complements)}
        WHERE id = ${id} AND accessory = 0 AND supports = '[]' AND complements = '[]'
      `;
  // A phrase taught as the plain lift ("Paused clean" as Clean) had no closer movement yet.
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
});
