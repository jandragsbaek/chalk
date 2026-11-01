import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as SqliteMigrator from "@effect/sql-sqlite-node/SqliteMigrator";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Migrator from "effect/sql/Migrator";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as ServerConfig from "../config.ts";
import Migration001 from "./Migrations/001_Workouts.ts";
import Migration002 from "./Migrations/002_Strength.ts";
import Migration003 from "./Migrations/003_SessionImports.ts";
import Migration004 from "./Migrations/004_VariationsAndIntent.ts";
import Migration005 from "./Migrations/005_LiftResults.ts";
import Migration006 from "./Migrations/006_Debriefs.ts";
import Migration007 from "./Migrations/007_Levels.ts";
import Migration008 from "./Migrations/008_Benchmarks.ts";
import Migration009 from "./Migrations/009_Coach.ts";
import Migration010 from "./Migrations/010_SessionPlans.ts";
import Migration011 from "./Migrations/011_CoachTurnModel.ts";
import Migration012 from "./Migrations/012_LiftingAccessories.ts";
import Migration013 from "./Migrations/013_AthleteProfile.ts";
import Migration014 from "./Migrations/014_Bookingboard.ts";
import Migration015 from "./Migrations/015_RestDays.ts";
import Migration016 from "./Migrations/016_SessionCoaching.ts";
import Migration017 from "./Migrations/017_TrainingBlocks.ts";
import Migration018 from "./Migrations/018_Garmin.ts";

// Explicit list: Migrator skips every id at or below the highest one recorded, so ids must only grow.
const migrations = Migrator.fromRecord({
  "1_Workouts": Migration001,
  "2_Strength": Migration002,
  "3_SessionImports": Migration003,
  "4_VariationsAndIntent": Migration004,
  "5_LiftResults": Migration005,
  "6_Debriefs": Migration006,
  "7_Levels": Migration007,
  "8_Benchmarks": Migration008,
  "9_Coach": Migration009,
  "10_SessionPlans": Migration010,
  "11_CoachTurnModel": Migration011,
  "12_LiftingAccessories": Migration012,
  "13_AthleteProfile": Migration013,
  "14_Bookingboard": Migration014,
  "15_RestDays": Migration015,
  "16_SessionCoaching": Migration016,
  "17_TrainingBlocks": Migration017,
  "18_Garmin": Migration018,
});

const layerMigrations = SqliteMigrator.layer({ loader: migrations });

const layerClient = Layer.unwrap(
  Effect.gen(function* () {
    const { dbPath } = yield* ServerConfig.ServerConfig;
    if (dbPath !== ":memory:") NodeFS.mkdirSync(NodePath.dirname(dbPath), { recursive: true });
    return SqliteClient.layer({ filename: dbPath });
  }),
);

/** SQL client with every migration applied before anything can query it. */
export const layer = layerMigrations.pipe(Layer.provideMerge(layerClient));
