import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: seeded movements that are variations of a seeded core movement.
const VARIATIONS: ReadonlyArray<readonly [id: string, variationOf: string]> = [
  ["power-snatch", "snatch"],
  ["hang-power-snatch", "snatch"],
  ["power-clean", "clean"],
  ["hang-power-clean", "clean"],
];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // One level: a core movement is never itself a variation (enforced by CatalogStore).
  yield* sql`ALTER TABLE movements ADD COLUMN variation_of TEXT REFERENCES movements (id)`;
  yield* sql`CREATE INDEX movements_variation_of ON movements (variation_of)`;
  for (const [id, variationOf] of VARIATIONS)
    yield* sql`UPDATE movements SET variation_of = ${variationOf} WHERE id = ${id}`;

  // The coach's intent per block as JSON: [{ text, quantities }].
  yield* sql`ALTER TABLE workout_blocks ADD COLUMN intent TEXT NOT NULL DEFAULT '[]'`;
});
