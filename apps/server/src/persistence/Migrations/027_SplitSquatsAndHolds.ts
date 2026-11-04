import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: split squats and the static holds the box programs in an EMOM ("10 Bulgarian
// split squat", "20 sec ring support hold", "20 sec L-sit hold"). A Bulgarian split squat is a
// split squat with the back foot up; a hold counts seconds. Ids are the slug of the name, so a
// user-added one with the same name is kept, and one spelled like an alias here keeps the phrase.
const MOVEMENTS: ReadonlyArray<
  readonly [
    id: string,
    name: string,
    /** `normalizeMovementPhrase` of the name. */
    nameKey: string,
    variationOf: string | null,
    measure: "reps" | "seconds",
  ]
> = [
  ["split-squat", "Split squat", "split squat", null, "reps"],
  [
    "bulgarian-split-squat",
    "Bulgarian split squat",
    "bulgarian split squat",
    "split-squat",
    "reps",
  ],
  ["ring-support-hold", "Ring support hold", "ring support hold", null, "seconds"],
  ["l-sit", "L-sit", "l sit", null, "seconds"],
];

// Keys are the normalized phrase (`normalizeMovementPhrase`).
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["bulgarian squat", "Bulgarian squat", "bulgarian-split-squat"],
  ["rear foot elevated split squat", "Rear-foot elevated split squat", "bulgarian-split-squat"],
  ["rfe split squat", "RFE split squat", "bulgarian-split-squat"],
  ["ring support", "Ring support", "ring-support-hold"],
  ["support hold", "Support hold", "ring-support-hold"],
  ["l sit hold", "L-sit hold", "l-sit"],
];

/** `normalizeMovementPhrase` as of this migration: lower case, words, plural "s" dropped. */
const phraseKey = (phrase: string) =>
  Array.from(phrase.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu), ([word]) =>
    word.length >= 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word,
  ).join(" ");

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Skipped when the athlete already has it under another spelling ("L sit").
  const names = yield* sql<{ id: string; name: string }>`SELECT id, name FROM movements`;
  for (const [id, name, nameKey, , measure] of MOVEMENTS) {
    const keys = new Set([nameKey, ...ALIASES.flatMap(([key, , to]) => (to === id ? [key] : []))]);
    if (names.some((other) => other.id !== id && keys.has(phraseKey(other.name)))) continue;
    yield* sql`
      INSERT INTO movements (id, name, category, measure, user_added)
      VALUES (${id}, ${name}, 'gymnastics', ${measure}, 0)
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
    if (variationOf !== null)
      yield* sql`
        UPDATE movements SET variation_of = ${variationOf}
        WHERE id = ${id} AND variation_of IS NULL
          AND EXISTS (SELECT 1 FROM movements WHERE id = ${variationOf} AND variation_of IS NULL)
          AND NOT EXISTS (SELECT 1 FROM movements WHERE variation_of = ${id})
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
