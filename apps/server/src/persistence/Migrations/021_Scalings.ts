import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: the walk-out, the usual scaling of a wall walk, as a catalog movement.
const WALK_OUT = { id: "walk-out", name: "Walk-out", key: "walk out" } as const;
// Keys are the normalized phrase (`normalizeMovementPhrase`).
const ALIASES: ReadonlyArray<readonly [key: string, alias: string, movementId: string]> = [
  ["walkout", "Walkout", "walk-out"],
];

// Frozen seed: what each movement is usually scaled to, first offered first. Easier rows of a
// variant level family are offered on top of these by `scalingOptions`, so only swaps the sheet
// does not know are listed for those. Ids that do not exist are skipped.
const SCALINGS: ReadonlyArray<readonly [id: string, scalings: ReadonlyArray<string>]> = [
  ["pull-up", ["ring-row", "jumping-pull-up"]],
  ["strict-pull-up", ["ring-row", "jumping-pull-up"]],
  ["l-pull-up", ["pull-up"]],
  ["chest-to-bar-pull-up", ["pull-up", "ring-row"]],
  ["bar-muscle-up", ["chest-to-bar-pull-up", "pull-up"]],
  ["ring-muscle-up", ["bar-muscle-up", "chest-to-bar-pull-up"]],
  ["burpee-pull-up", ["burpee"]],
  ["toes-to-bar", ["hanging-knee-raise", "knees-to-elbows", "sit-up"]],
  ["toes-to-ring", ["toes-to-bar", "hanging-knee-raise"]],
  ["knees-to-elbows", ["hanging-knee-raise"]],
  ["ghd-sit-up", ["sit-up"]],
  ["handstand-push-up", ["pike-push-up", "push-up"]],
  ["strict-handstand-push-up", ["handstand-push-up", "pike-push-up"]],
  ["wall-walk", ["walk-out", "bear-crawl"]],
  ["handstand-walk", ["wall-walk", "bear-crawl"]],
  ["ring-dip", ["bar-dip", "push-up"]],
  ["strict-ring-dip", ["ring-dip", "bar-dip"]],
  ["ring-push-up", ["push-up"]],
  ["legless-rope-climb", ["rope-climb"]],
  ["l-sit-rope-climb", ["rope-climb"]],
  ["double-under", ["single-under"]],
  ["triple-under", ["double-under"]],
  ["double-crossover", ["double-under"]],
  ["box-jump", ["box-step-up"]],
  ["box-jump-over", ["box-step-over"]],
  ["burpee-box-jump-over", ["burpee"]],
  ["pistol", ["air-squat"]],
  ["overhead-walking-lunge", ["walking-lunge"]],
  ["run", ["row", "bike"]],
];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // What a movement is done as instead when scaled, as JSON [movementId]; offered in the
  // importer as one-click "Scale to" options.
  yield* sql`ALTER TABLE movements ADD COLUMN scalings TEXT NOT NULL DEFAULT '[]'`;

  yield* sql`
    INSERT INTO movements (id, name, category, user_added)
    VALUES (${WALK_OUT.id}, ${WALK_OUT.name}, 'gymnastics', 0)
    ON CONFLICT DO NOTHING
  `;
  yield* sql`
    DELETE FROM movement_aliases WHERE key = ${WALK_OUT.key} AND movement_id <> ${WALK_OUT.id}
  `;
  for (const [key, alias, movementId] of ALIASES)
    yield* sql`
      INSERT INTO movement_aliases (key, alias, movement_id)
      SELECT ${key}, ${alias}, ${movementId}
      WHERE EXISTS (SELECT 1 FROM movements WHERE id = ${movementId})
        AND NOT EXISTS (SELECT 1 FROM movements WHERE id <> ${movementId} AND lower(name) = lower(${alias}))
      ON CONFLICT DO NOTHING
    `;
  // Only movements that exist, in the order written.
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
