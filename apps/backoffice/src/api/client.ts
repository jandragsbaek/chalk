import { ChalkAdminApi } from "@chalk/contracts";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

/** Typed client for the admin HttpApi, exposed as atoms (queries) and atom functions (mutations). */
export class AdminClient extends AtomHttpApi.Service<AdminClient>()("AdminClient", {
  api: ChalkAdminApi,
  httpClient: FetchHttpClient.layer,
  baseUrl: window.location.origin,
}) {}
