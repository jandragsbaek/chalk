import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Frozen seed: what one unit of a catalog movement is, for the volume grid. Everything else
// stays reps. Ids that do not exist are skipped; the athlete changes them on /movements.
const MEASURES: ReadonlyArray<readonly [id: string, measure: string]> = [
  ["run", "distance_m"],
  ["row", "distance_m"],
  ["ski-erg", "distance_m"],
  ["swim", "distance_m"],
  ["shuttle-run", "distance_m"],
  ["farmers-carry", "distance_m"],
  ["front-rack-carry", "distance_m"],
  ["overhead-carry", "distance_m"],
  ["plate-carry", "distance_m"],
  ["sandbag-carry", "distance_m"],
  ["buddy-carry", "distance_m"],
  ["waiter-walk", "distance_m"],
  ["sled-push", "distance_m"],
  ["sled-pull", "distance_m"],
  ["handstand-walk", "distance_m"],
  ["bear-crawl", "distance_m"],
  ["bike", "calories"],
  ["versaclimber", "calories"],
  ["dead-hang", "seconds"],
  ["handstand-hold", "seconds"],
];

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // What one unit of the movement is: 'reps', 'distance_m', 'calories' or 'seconds'. The
  // volume grid reads a movement's weeks in it; a count written in another unit is kept too.
  yield* sql`ALTER TABLE movements ADD COLUMN measure TEXT NOT NULL DEFAULT 'reps'`;
  for (const [id, measure] of MEASURES)
    yield* sql`UPDATE movements SET measure = ${measure} WHERE id = ${id}`;
});
