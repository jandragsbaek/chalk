import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as OpenApi from "effect/http-api/OpenApi";
import * as Schema from "effect/Schema";

import { MovementId, WorkoutId } from "./baseSchemas.ts";
import {
  AddAliasInput,
  AliasTakenError,
  CatalogMovement,
  CatalogNotFoundError,
  CreateMovementInput,
  ImportConflictError,
  ImportInvalidError,
  ImportNotFoundError,
  ImportStorageError,
  ImportSummary,
  MovementExistsError,
  SaveImportInput,
  StoredImport,
} from "./sessionImport.ts";
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

/** The movement catalog with aliases; the importer extends it while matching pasted text. */
export const AdminMovementsGroup = HttpApiGroup.make("movements")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(CatalogMovement),
      error: ImportStorageError,
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: CreateMovementInput,
      success: CatalogMovement,
      error: [MovementExistsError, AliasTakenError, ImportStorageError],
    }),
    HttpApiEndpoint.post("addAlias", "/:id/aliases", {
      params: { id: MovementId },
      payload: AddAliasInput,
      success: CatalogMovement,
      error: [CatalogNotFoundError, AliasTakenError, ImportStorageError],
    }),
  )
  .prefix("/movements");

/** Sessions imported from pasted text; each one is a workout plus its source document. */
export const AdminImportsGroup = HttpApiGroup.make("imports")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(ImportSummary),
      error: ImportStorageError,
    }),
    HttpApiEndpoint.get("get", "/:workoutId", {
      params: { workoutId: WorkoutId },
      success: StoredImport,
      error: [ImportNotFoundError, ImportStorageError],
    }),
    HttpApiEndpoint.post("save", "/", {
      payload: SaveImportInput,
      success: ImportSummary,
      error: [ImportInvalidError, ImportConflictError, ImportStorageError],
    }),
  )
  .prefix("/imports");

/** Mount point of the admin API on the admin host, and the backoffice dev proxy. */
export const ADMIN_API_PREFIX = "/api/admin";

/** Request/response API for the backoffice. Served only by the server's `admin` mode. */
export class ChalkAdminApi extends HttpApi.make("chalk-admin")
  .add(AdminWorkoutsGroup)
  .add(AdminMovementsGroup)
  .add(AdminImportsGroup)
  .prefix(ADMIN_API_PREFIX)
  .annotateMerge(OpenApi.annotations({ title: "Chalk Admin API", version: "0.0.0" })) {}
