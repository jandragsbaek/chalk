import { ADMIN_API_PREFIX, ChalkAdminApi, ChalkRpcGroup, RPC_PATH } from "@chalk/contracts";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpStaticServer from "effect/http/HttpStaticServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as NodeHttp from "node:http";

import * as AdminApi from "./adminApi.ts";
import * as Bookingboard from "./bookingboard/Bookingboard.ts";
import * as CatalogStore from "./catalog/CatalogStore.ts";
import * as CoachService from "./coach/CoachService.ts";
import * as CoachStore from "./coach/CoachStore.ts";
import * as ServerConfig from "./config.ts";
import * as Garmin from "./garmin/Garmin.ts";
import * as Sqlite from "./persistence/Sqlite.ts";
import * as ImportStore from "./import/ImportStore.ts";
import * as LevelStore from "./levels/LevelStore.ts";
import * as PlanStore from "./plan/PlanStore.ts";
import * as ProfileStore from "./profile/ProfileStore.ts";
import * as PowerStore from "./power/PowerStore.ts";
import * as RestDayStore from "./rest/RestDayStore.ts";
import * as Rpc from "./rpc.ts";
import * as StrengthStore from "./strength/StrengthStore.ts";
import * as BlockStore from "./training/BlockStore.ts";
import * as WorkoutStore from "./workout/WorkoutStore.ts";

const layerStores = Layer.mergeAll(
  WorkoutStore.layer,
  StrengthStore.layer,
  CatalogStore.layer,
  ImportStore.layer,
  CoachStore.layer,
  PlanStore.layer,
  ProfileStore.layer,
  Garmin.layer.pipe(Layer.provide(Layer.mergeAll(ProfileStore.layer, FetchHttpClient.layer))),
  PowerStore.layer,
  Bookingboard.layer.pipe(Layer.provide(FetchHttpClient.layer)),
  RestDayStore.layer,
  BlockStore.layer,
  LevelStore.layer.pipe(Layer.provide(CatalogStore.layer)),
).pipe(Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)));

/** The stores, plus the coach that reads them through its tools, and the timed Garmin read. */
const layerServices = Layer.mergeAll(
  CoachService.layer.pipe(Layer.provide(CoachService.layerModel)),
  Garmin.layerTimedSync,
).pipe(Layer.provideMerge(layerStores));

/**
 * The app's RPC endpoint. Newline-delimited JSON, so a streamed reply (the coach's reads)
 * reaches the client as it happens; plain JSON would hold it until the stream ends.
 */
const layerRpcRoute = RpcServer.layerHttp({
  group: ChalkRpcGroup,
  path: RPC_PATH,
  protocol: "http",
}).pipe(Layer.provide(Rpc.layer), Layer.provide(RpcSerialization.layerNdjson));

/** The admin HttpApi (workout search, catalog edits, imports), plus its OpenAPI document. */
const layerAdminApiRoute = HttpApiBuilder.layer(ChalkAdminApi, {
  openapiPath: `${ADMIN_API_PREFIX}/openapi.json`,
}).pipe(
  Layer.provide(
    Layer.mergeAll(
      AdminApi.layerWorkouts,
      AdminApi.layerMovements,
      AdminApi.layerImports,
      AdminApi.layerPlans,
    ),
  ),
);

/** In production the server also serves the built SPA, so one origin hosts everything. */
const layerSpaRoute = Layer.unwrap(
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

export const layer = HttpRouter.serve(
  Layer.mergeAll(layerRpcRoute, layerAdminApiRoute, layerSpaRoute),
).pipe(
  Layer.provide(layerServices),
  Layer.provide(layerHttpServer),
  Layer.provide(ServerConfig.layer),
);
