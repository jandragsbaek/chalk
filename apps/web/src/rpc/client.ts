import { ChalkRpcGroup, RPC_PATH } from "@chalk/contracts";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";

/** Typed client for the server's RpcGroup, exposed as atoms (queries) and atom functions (mutations). */
export class ChalkClient extends AtomRpc.Service<ChalkClient>()("ChalkClient", {
  group: ChalkRpcGroup,
  protocol: RpcClient.layerProtocolHttp({
    url: new URL(RPC_PATH, window.location.origin).toString(),
  }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
}) {}
