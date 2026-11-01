import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: weightlifting pulls, deadlifts and drills as accessories supporting the lift's
// sheet row, never variations of it (a snatch pull has no catch; its reps are not snatch reps).
// Ungraded: the sheet has no row for them. A user-added one with the same slug keeps its tags.
const MOVEMENTS: ReadonlyArray<
  readonly [
    id: string,
    name: string,
    variationOf: string | null,
    supports: ReadonlyArray<string>,
    complements: ReadonlyArray<string>,
  ]
> = [
  ["snatch-pull", "Snatch pull", null, ["bb-snatch"], ["hinge", "upper_back", "hamstrings"]],
  [
    "deficit-snatch-pull",
    "Deficit snatch pull",
    "snatch-pull",
    ["bb-snatch"],
    ["hinge", "upper_back", "hamstrings"],
  ],
  [
    "snatch-high-pull",
    "Snatch high pull",
    null,
    ["bb-snatch"],
    ["hinge", "vertical_pull", "upper_back"],
  ],
  [
    "snatch-deadlift",
    "Snatch deadlift",
    null,
    ["bb-snatch"],
    ["hinge", "upper_back", "hamstrings"],
  ],
  [
    "snatch-balance",
    "Snatch balance",
    null,
    ["bb-snatch", "bb-overhead-squat"],
    ["squat", "vertical_push", "shoulders"],
  ],
  ["drop-snatch", "Drop snatch", null, ["bb-snatch", "bb-overhead-squat"], ["squat", "shoulders"]],
  [
    "muscle-snatch",
    "Muscle snatch",
    null,
    ["bb-snatch"],
    ["vertical_pull", "shoulders", "upper_back"],
  ],
  ["tall-snatch", "Tall snatch", null, ["bb-snatch"], ["vertical_pull", "squat", "shoulders"]],
  ["clean-pull", "Clean pull", null, ["bb-clean"], ["hinge", "upper_back", "hamstrings"]],
  [
    "deficit-clean-pull",
    "Deficit clean pull",
    "clean-pull",
    ["bb-clean"],
    ["hinge", "upper_back", "hamstrings"],
  ],
  [
    "clean-high-pull",
    "Clean high pull",
    null,
    ["bb-clean"],
    ["hinge", "vertical_pull", "upper_back"],
  ],
  [
    "clean-deadlift",
    "Clean deadlift",
    null,
    ["bb-clean", "bb-deadlift"],
    ["hinge", "upper_back", "hamstrings"],
  ],
  ["jerk-dip-squat", "Jerk dip squat", null, ["bb-press"], ["squat", "quads"]],
];

// Keys are the normalized phrase (`normalizeMovementPhrase`).
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["sn pull", "SN pull", "snatch-pull"],
  ["snatch grip pull", "Snatch-grip pull", "snatch-pull"],
  ["deficit sn pull", "Deficit SN pull", "deficit-snatch-pull"],
  ["sn high pull", "SN high pull", "snatch-high-pull"],
  ["snatch grip high pull", "Snatch-grip high pull", "snatch-high-pull"],
  ["sn deadlift", "SN deadlift", "snatch-deadlift"],
  ["sn dl", "SN DL", "snatch-deadlift"],
  ["snatch dl", "Snatch DL", "snatch-deadlift"],
  ["snatch grip deadlift", "Snatch-grip deadlift", "snatch-deadlift"],
  ["sgdl", "SGDL", "snatch-deadlift"],
  ["sn balance", "SN balance", "snatch-balance"],
  ["cl pull", "CL pull", "clean-pull"],
  ["clean grip pull", "Clean-grip pull", "clean-pull"],
  ["deficit cl pull", "Deficit CL pull", "deficit-clean-pull"],
  ["cl high pull", "CL high pull", "clean-high-pull"],
  ["cl deadlift", "CL deadlift", "clean-deadlift"],
  ["cl dl", "CL DL", "clean-deadlift"],
  ["clean dl", "Clean DL", "clean-deadlift"],
  ["clean grip deadlift", "Clean-grip deadlift", "clean-deadlift"],
  ["dip squat", "Dip squat", "jerk-dip-squat"],
  ["jerk dip", "Jerk dip", "jerk-dip-squat"],
];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  for (const [id, name] of MOVEMENTS)
    yield* sql`
      INSERT INTO movements (id, name, category, user_added)
      VALUES (${id}, ${name}, 'barbell', 0)
      ON CONFLICT DO NOTHING
    `;
  // A movement's name takes its phrase from any alias that meant another movement. The names
  // above are plain words, so lower case is their matcher key.
  for (const [id, name] of MOVEMENTS)
    yield* sql`
      DELETE FROM movement_aliases WHERE key = ${name.toLowerCase()} AND movement_id <> ${id}
    `;
  // One level of variations: only under a core, and only if the movement has none itself.
  for (const [id, , variationOf] of MOVEMENTS)
    if (variationOf !== null)
      yield* sql`
        UPDATE movements SET variation_of = ${variationOf}
        WHERE id = ${id} AND variation_of IS NULL
          AND EXISTS (SELECT 1 FROM movements WHERE id = ${variationOf} AND variation_of IS NULL)
          AND NOT EXISTS (SELECT 1 FROM movements WHERE variation_of = ${id})
      `;
  // Tags only where the athlete has set none.
  for (const [id, , , supports, complements] of MOVEMENTS)
    yield* sql`
      UPDATE movements
      SET accessory = 1, supports = ${JSON.stringify(supports)},
          complements = ${JSON.stringify(complements)}
      WHERE id = ${id} AND accessory = 0 AND supports = '[]' AND complements = '[]'
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
