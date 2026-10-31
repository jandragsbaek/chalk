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

// Explicit list: Migrator skips every id at or below the highest one recorded, so ids must only grow.
const migrations = Migrator.fromRecord({
  "1_Workouts": Migration001,
  "2_Strength": Migration002,
  "3_SessionImports": Migration003,
  "4_VariationsAndIntent": Migration004,
  "5_LiftResults": Migration005,
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
