import { describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";

import { ADMIN_OPENAPI_FILE, adminOpenApiJson } from "./openapi.ts";

describe("ChalkAdminApi", () => {
  it("matches the checked-in OpenAPI document (regenerate with `pnpm openapi`)", () => {
    expect(NodeFS.readFileSync(ADMIN_OPENAPI_FILE, "utf8")).toBe(adminOpenApiJson());
  });
});
