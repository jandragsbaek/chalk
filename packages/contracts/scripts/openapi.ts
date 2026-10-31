// Regenerates the checked-in OpenAPI documents. `adminApi.test.ts` fails when they are stale.
import * as NodeFS from "node:fs";

import { ADMIN_OPENAPI_FILE, adminOpenApiJson } from "../src/openapi.ts";

NodeFS.writeFileSync(ADMIN_OPENAPI_FILE, adminOpenApiJson());
