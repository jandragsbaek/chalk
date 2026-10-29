import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

export class ServerConfig extends Context.Service<
  ServerConfig,
  {
    readonly host: string;
    readonly port: number;
    readonly dbPath: string;
    /** Built web app to serve; unset in dev, where Vite serves the UI. */
    readonly webDistDir: Option.Option<string>;
  }
>()("chalk/ServerConfig") {}

export const layer = Layer.effect(
  ServerConfig,
  Effect.gen(function* () {
    const config = yield* Config.all({
      host: Config.String("CHALK_HOST").pipe(Config.withDefault("127.0.0.1")),
      port: Config.Port("CHALK_PORT").pipe(Config.withDefault(4300)),
      dbPath: Config.String("CHALK_DB_PATH").pipe(Config.withDefault("data/chalk.sqlite")),
      webDistDir: Config.String("CHALK_WEB_DIST").pipe(Config.option),
    });
    return ServerConfig.of(config);
  }),
);

export const layerTest = (dbPath = ":memory:") =>
  Layer.succeed(
    ServerConfig,
    ServerConfig.of({ host: "127.0.0.1", port: 0, dbPath, webDistDir: Option.none() }),
  );
