import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as OpenApi from "effect/http-api/OpenApi";
import * as Schema from "effect/Schema";

import { MovementId, PlanId, WorkoutId } from "./baseSchemas.ts";
import { PlanNotFoundError, SavePlanInput, SessionPlan } from "./plan.ts";
import { SessionEntry } from "./session.ts";
import { PlanSimilarity, SimilarParts, SimilarToPlanInput } from "./similarity.ts";
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
  SetMovementLevelsInput,
  SetMovementScalingsInput,
  SetVariationOfInput,
  StoredImport,
  VariationInvalidError,
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
    /** Every session, newest day first: workouts and strength-only days, with their movements. */
    HttpApiEndpoint.get("sessions", "/sessions", {
      success: Schema.Array(SessionEntry),
      error: WorkoutStorageError,
    }),
    /** Every saved part's repeats and look-alikes in other sessions. */
    HttpApiEndpoint.get("similar", "/similar", {
      success: SimilarParts,
      error: WorkoutStorageError,
    }),
    /** A plan's parts against the saved ones: what it repeats or resembles, and how it went. */
    HttpApiEndpoint.post("similarToPlan", "/similar", {
      payload: SimilarToPlanInput,
      success: PlanSimilarity,
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
      error: [
        MovementExistsError,
        AliasTakenError,
        CatalogNotFoundError,
        VariationInvalidError,
        ImportStorageError,
      ],
    }),
    HttpApiEndpoint.post("addAlias", "/:id/aliases", {
      params: { id: MovementId },
      payload: AddAliasInput,
      success: CatalogMovement,
      error: [CatalogNotFoundError, AliasTakenError, ImportStorageError],
    }),
    HttpApiEndpoint.put("setVariationOf", "/:id/variation-of", {
      params: { id: MovementId },
      payload: SetVariationOfInput,
      success: CatalogMovement,
      error: [CatalogNotFoundError, VariationInvalidError, ImportStorageError],
    }),
    HttpApiEndpoint.put("setLevels", "/:id/levels", {
      params: { id: MovementId },
      payload: SetMovementLevelsInput,
      success: CatalogMovement,
      error: [CatalogNotFoundError, ImportStorageError],
    }),
    HttpApiEndpoint.put("setScalings", "/:id/scalings", {
      params: { id: MovementId },
      payload: SetMovementScalingsInput,
      success: CatalogMovement,
      error: [CatalogNotFoundError, ImportStorageError],
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

/**
 * Planned sessions: a posted workout entered in the morning with the scaling planned, logged
 * later from the importer. Oldest day first; plans are removed once logged.
 */
export const AdminPlansGroup = HttpApiGroup.make("plans")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(SessionPlan),
      error: ImportStorageError,
    }),
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: PlanId },
      success: SessionPlan,
      error: [PlanNotFoundError, ImportStorageError],
    }),
    HttpApiEndpoint.post("save", "/", {
      payload: SavePlanInput,
      success: SessionPlan,
      error: [ImportInvalidError, PlanNotFoundError, ImportStorageError],
    }),
    HttpApiEndpoint.delete("remove", "/:id", {
      params: { id: PlanId },
      error: [PlanNotFoundError, ImportStorageError],
    }),
  )
  .prefix("/plans");

/** Mount point of the admin API, next to `RPC_PATH` on the same origin. */
export const ADMIN_API_PREFIX = "/api/admin";

/** Request/response API for the desk pages (workout search, import). Served next to the RPC. */
export class ChalkAdminApi extends HttpApi.make("chalk-admin")
  .add(AdminWorkoutsGroup)
  .add(AdminMovementsGroup)
  .add(AdminImportsGroup)
  .add(AdminPlansGroup)
  .prefix(ADMIN_API_PREFIX)
  .annotateMerge(OpenApi.annotations({ title: "Chalk Admin API", version: "0.0.0" })) {}
