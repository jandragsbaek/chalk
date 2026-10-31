import * as OpenApi from "effect/http-api/OpenApi";

import { ChalkAdminApi } from "./adminApi.ts";

/** Checked-in OpenAPI document for the admin API; native clients and MCP generate from it. */
export const ADMIN_OPENAPI_FILE = new URL("../openapi/admin.json", import.meta.url);

export const adminOpenApiJson = () =>
  `${JSON.stringify(OpenApi.fromApi(ChalkAdminApi), null, 2)}\n`;
