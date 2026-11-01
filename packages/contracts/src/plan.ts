import * as Schema from "effect/Schema";

import { IsoDate, IsoDateTime, PlanId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ImportDocument } from "./sessionImport.ts";

/**
 * A posted workout entered before it is done, with each movement's planned scaling (`plan` on
 * its span). Not a workout, so it counts nowhere until logged; logging removes it, and the
 * import document keeps the plan beside what was done.
 */
export const SessionPlan = Schema.Struct({
  id: PlanId,
  plannedOn: IsoDate,
  name: TrimmedNonEmptyString,
  document: ImportDocument,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}).annotate({ identifier: "SessionPlan" });
export type SessionPlan = typeof SessionPlan.Type;

export const SavePlanInput = Schema.Struct({
  document: ImportDocument,
  /** The plan this save rewrites; absent for a new one. */
  id: Schema.optionalKey(PlanId),
});
export type SavePlanInput = typeof SavePlanInput.Type;

export class PlanNotFoundError extends Schema.TaggedError<PlanNotFoundError>()(
  "PlanNotFoundError",
  { id: PlanId },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `No planned session ${this.id}.`;
  }
}
