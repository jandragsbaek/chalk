import { ADMIN_API_PREFIX, ChalkAdminApi, ChalkRpcGroup, RPC_PATH } from "@chalk/contracts";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpStaticServer from "effect/http/HttpStaticServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as NodeHttp from "node:http";

import * as AdminApi from "./adminApi.ts";
import * as ServerConfig from "./config.ts";
import * as Sqlite from "./persistence/Sqlite.ts";
import * as Rpc from "./rpc.ts";
import * as StrengthStore from "./strength/StrengthStore.ts";
import * as WorkoutStore from "./workout/WorkoutStore.ts";

const layerServices = Layer.mergeAll(WorkoutStore.layer, StrengthStore.layer).pipe(
  Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
);

/** `api` mode: the app's RPC endpoint. */
const layerRpcRoute = RpcServer.layerHttp({
  group: ChalkRpcGroup,
  path: RPC_PATH,
  protocol: "http",
}).pipe(Layer.provide(Rpc.layer), Layer.provide(RpcSerialization.layerJson));

/** `admin` mode: only the admin HttpApi, plus its OpenAPI document. */
const layerAdminApiRoute = HttpApiBuilder.layer(ChalkAdminApi, {
  openapiPath: `${ADMIN_API_PREFIX}/openapi.json`,
}).pipe(Layer.provide(AdminApi.layerWorkouts));

/** In production the server also serves the mode's built SPA, so one origin hosts everything. */
const layerSpaRoute = Layer.unwrap(
  Effect.gen(function* () {
    const { webDistDir } = yield* ServerConfig.ServerConfig;
    return Option.match(webDistDir, {
      onNone: () => Layer.empty,
      onSome: (root) => HttpStaticServer.layer({ root, spa: true }),
    });
  }),
);

/** Either mode's routes; it needs whatever either one needs. */
type LayerModeRoutes = Layer.Layer<
  never,
  never,
  Layer.Services<typeof layerAdminApiRoute> | Layer.Services<typeof layerRpcRoute>
>;

const layerModeRoutes = Layer.unwrap(
  Effect.gen(function* () {
    const { mode } = yield* ServerConfig.ServerConfig;
    const routes: LayerModeRoutes = mode === "admin" ? layerAdminApiRoute : layerRpcRoute;
    return routes;
  }),
);

const layerHttpServer = Layer.unwrap(
  Effect.gen(function* () {
    const { host, port } = yield* ServerConfig.ServerConfig;
    return NodeHttpServer.layer(() => NodeHttp.createServer(), { host, port });
  }),
);

export const layer = HttpRouter.serve(Layer.mergeAll(layerModeRoutes, layerSpaRoute)).pipe(
  Layer.provide(layerServices),
  Layer.provide(layerHttpServer),
  Layer.provide(ServerConfig.layer),
);
