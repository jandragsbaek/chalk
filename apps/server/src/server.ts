import { ChalkRpcGroup, RPC_PATH } from "@chalk/contracts";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpStaticServer from "effect/http/HttpStaticServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as NodeHttp from "node:http";

import * as ServerConfig from "./config.ts";
import * as Sqlite from "./persistence/Sqlite.ts";
import * as Rpc from "./rpc.ts";
import * as WorkoutStore from "./workout/WorkoutStore.ts";

const layerServices = WorkoutStore.layer.pipe(
  Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
);

const layerRpcRoute = RpcServer.layerHttp({
  group: ChalkRpcGroup,
  path: RPC_PATH,
  protocol: "http",
}).pipe(Layer.provide(Rpc.layer), Layer.provide(RpcSerialization.layerJson));

/** In production the server also serves the built web app, so one origin hosts everything. */
const layerWebRoute = Layer.unwrap(
  Effect.gen(function* () {
    const { webDistDir } = yield* ServerConfig.ServerConfig;
    return Option.match(webDistDir, {
      onNone: () => Layer.empty,
      onSome: (root) => HttpStaticServer.layer({ root, spa: true }),
    });
  }),
);

const layerHttpServer = Layer.unwrap(
  Effect.gen(function* () {
    const { host, port } = yield* ServerConfig.ServerConfig;
    return NodeHttpServer.layer(() => NodeHttp.createServer(), { host, port });
  }),
);

export const layer = HttpRouter.serve(Layer.mergeAll(layerRpcRoute, layerWebRoute)).pipe(
  Layer.provide(layerServices),
  Layer.provide(layerHttpServer),
  Layer.provide(ServerConfig.layer),
);
