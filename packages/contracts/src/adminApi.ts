import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as OpenApi from "effect/http-api/OpenApi";
import * as Schema from "effect/Schema";

import { WorkoutId } from "./baseSchemas.ts";
import { Workout, WorkoutKind, WorkoutNotFoundError, WorkoutStorageError } from "./workout.ts";

export const WorkoutKindCount = Schema.Struct({
  kind: WorkoutKind,
  count: Schema.Int,
});
export type WorkoutKindCount = typeof WorkoutKindCount.Type;

export const WorkoutStats = Schema.Struct({
  total: Schema.Int,
  rxCount: Schema.Int,
  byKind: Schema.Array(WorkoutKindCount),
}).annotate({ identifier: "WorkoutStats" });
export type WorkoutStats = typeof WorkoutStats.Type;

export const AdminWorkoutsGroup = HttpApiGroup.make("workouts")
  .add(
    HttpApiEndpoint.get("search", "/", {
      query: { q: Schema.optional(Schema.String) },
      success: Schema.Array(Workout),
      error: WorkoutStorageError,
    }),
    HttpApiEndpoint.get("stats", "/stats", {
      success: WorkoutStats,
      error: WorkoutStorageError,
    }),
    HttpApiEndpoint.delete("remove", "/:id", {
      params: { id: WorkoutId },
      error: [WorkoutNotFoundError, WorkoutStorageError],
    }),
  )
  .prefix("/workouts");

/** Mount point of the admin API on the admin host, and the backoffice dev proxy. */
export const ADMIN_API_PREFIX = "/api/admin";

/** Request/response API for the backoffice. Served only by the server's `admin` mode. */
export class ChalkAdminApi extends HttpApi.make("chalk-admin")
  .add(AdminWorkoutsGroup)
  .prefix(ADMIN_API_PREFIX)
  .annotateMerge(OpenApi.annotations({ title: "Chalk Admin API", version: "0.0.0" })) {}
