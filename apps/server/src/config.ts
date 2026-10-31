import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

/** One codebase, several processes: `api` serves the app's RPC, `admin` only the admin HttpApi. */
export type ServerMode = "api" | "admin";

const DEFAULT_PORTS: Record<ServerMode, number> = { api: 4300, admin: 4301 };

export class ServerConfig extends Context.Service<
  ServerConfig,
  {
    readonly mode: ServerMode;
    readonly host: string;
    readonly port: number;
    readonly dbPath: string;
    /** Built SPA to serve (web in `api` mode, backoffice in `admin`); unset in dev, where Vite serves it. */
    readonly webDistDir: Option.Option<string>;
  }
>()("chalk/ServerConfig") {}

export const layer = Layer.effect(
  ServerConfig,
  Effect.gen(function* () {
    const mode = yield* Config.Literals(["api", "admin"], "CHALK_MODE").pipe(
      Config.withDefault("api"),
    );
    const config = yield* Config.all({
      host: Config.String("CHALK_HOST").pipe(Config.withDefault("127.0.0.1")),
      port: Config.Port("CHALK_PORT").pipe(Config.withDefault(DEFAULT_PORTS[mode])),
      dbPath: Config.String("CHALK_DB_PATH").pipe(Config.withDefault("data/chalk.sqlite")),
      webDistDir: Config.String("CHALK_WEB_DIST").pipe(Config.option),
    });
    return ServerConfig.of({ mode, ...config });
  }),
);

export const layerTest = (dbPath = ":memory:") =>
  Layer.succeed(
    ServerConfig,
    ServerConfig.of({ mode: "api", host: "127.0.0.1", port: 0, dbPath, webDistDir: Option.none() }),
  );
