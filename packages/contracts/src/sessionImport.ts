import * as Schema from "effect/Schema";

import {
  BenchmarkId,
  IsoDate,
  IsoDateTime,
  MovementId,
  PlanId,
  TrimmedNonEmptyString,
  WorkoutId,
} from "./baseSchemas.ts";
import { ClassType, Coaching } from "./coaching.ts";
import { Debrief } from "./debrief.ts";
import { Complement, Level, LevelFamilyId, Performance } from "./levels.ts";
import { MovementCategory } from "./strength.ts";

/**
 * Session import: the athlete pastes one session as text, Chalk suggests spans over it, the
 * athlete corrects them, and the structure (parts, blocks, items, lift sets) is derived from the
 * spans. The text and the spans are the source of truth; everything else is re-derivable.
 */

/** Client-made id of a span; unique within one document only. */
export const SpanId = TrimmedNonEmptyString;
export type SpanId = typeof SpanId.Type;

/** What one number in the text counts. Loads are kilograms; pounds are converted on parse. */
export const Measure = Schema.Literals([
  "reps",
  "sets",
  "calories",
  "distance_m",
  "seconds",
  "load_kg",
  "percent_1rm",
  /** Rate of perceived exertion, 1 to 10: "@RPE 8", "RPE 7-8". */
  "rpe",
]);
export type Measure = typeof Measure.Type;

const NonNegative = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** `min === max` for an exact number; "8-10" is `{ min: 8, max: 10 }`. */
export const Amount = Schema.Struct({ min: NonNegative, max: NonNegative });
export type Amount = typeof Amount.Type;

/** One level's target where the board writes several: "18-15" of "18-15/15-12 cal" is Elite's. */
export const QuantityTier = Schema.Struct({
  level: Level,
  amount: Amount,
  female: Schema.optionalKey(Amount),
}).annotate({ identifier: "QuantityTier" });
export type QuantityTier = typeof QuantityTier.Type;

export const Quantity = Schema.Struct({
  measure: Measure,
  amount: Amount,
  /** Second number of a male/female split such as "12/10 cal" or "@40/25". */
  female: Schema.optionalKey(Amount),
  /** Reps per round, e.g. 21-15-9; `amount` is then the total. */
  scheme: Schema.optionalKey(Schema.Array(NonNegative)),
  /**
   * Targets by level, hardest first: "18-15/15-12 cal" is 18/15 at Elite and 15/12 at RX.
   * `amount` and `female` then span the tiers (15-18, 12-15), so anything reading one number
   * still reads the board's range.
   */
  tiers: Schema.optionalKey(Schema.Array(QuantityTier)),
}).annotate({ identifier: "Quantity" });
export type Quantity = typeof Quantity.Type;

export const BlockFormat = Schema.Literals([
  "amrap",
  "emom",
  "every",
  "intervals",
  "for_time",
  "strength",
  "rest",
  "other",
]);
export type BlockFormat = typeof BlockFormat.Type;

export const BlockParams = Schema.Struct({
  durationSeconds: Schema.optionalKey(NonNegative),
  intervalSeconds: Schema.optionalKey(NonNegative),
  workSeconds: Schema.optionalKey(NonNegative),
  restSeconds: Schema.optionalKey(NonNegative),
  rounds: Schema.optionalKey(Amount),
  scheme: Schema.optionalKey(Schema.Array(NonNegative)),
});
export type BlockParams = typeof BlockParams.Type;

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** One performed set: `reps` at `loadKg`. */
export const PerformedSet = Schema.Struct({ reps: Count, loadKg: NonNegative });
export type PerformedSet = typeof PerformedSet.Type;

/**
 * What the athlete lifted for one programmed movement, entered after the fact. `fixed`: every
 * set at one load. `ramp`: the first set at `startKg`, each next set `stepKg` heavier. `each`:
 * set by set, where a set of 0 reps is one missed at that load. `deriveSession` checks the
 * ranges, so the editor can report them.
 */
export const LiftResult = Schema.TaggedUnion({
  fixed: { sets: Count, reps: Count, loadKg: NonNegative },
  ramp: { sets: Count, reps: Count, startKg: NonNegative, stepKg: Schema.Finite },
  each: { sets: Schema.Array(PerformedSet) },
});
export type LiftResult = typeof LiftResult.Type;

const spanFields = {
  id: SpanId,
  start: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  end: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
};

/**
 * One highlighted range of the pasted text; spans never overlap. `part`/`block` open a part
 * and a block, `movement` is an item with `quantity` spans hanging off it, `intent` instructs its
 * block, `comment` is an aside kept with its block (a source, a remark; never read for numbers),
 * `benchmark` names the part's workout, and after `notes` movements become lift sets.
 */
export const Span = Schema.TaggedUnion({
  date: { ...spanFields, date: IsoDate },
  session: { ...spanFields, number: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) },
  part: { ...spanFields },
  notes: { ...spanFields },
  intent: { ...spanFields },
  comment: { ...spanFields },
  block: { ...spanFields, format: BlockFormat, params: BlockParams },
  movement: {
    ...spanFields,
    /** Absent until the athlete picks one; saving needs every movement resolved. */
    movementId: Schema.optionalKey(MovementId),
    /** "60 double-unders or 90 single-unders": the single-under span points at the first. */
    alternativeOf: Schema.optionalKey(SpanId),
    /** What was lifted, for a programmed movement (not one in the notes). */
    result: Schema.optionalKey(LiftResult),
    /** How it was done (load, reps by variation, biggest unbroken set); empty = as prescribed. */
    performance: Schema.optionalKey(Performance),
    /** How the athlete means to do it, set when planning; empty = as prescribed. */
    plan: Schema.optionalKey(Performance),
    /**
     * A movement of a complex ("1 power clean + 2 hang power clean": one bar) lifted at its own
     * load instead; the complex's other movements then keep their own too.
     */
    separateLoad: Schema.optionalKey(Schema.Boolean),
  },
  quantity: { ...spanFields, ...Quantity.fields, attachedTo: Schema.optionalKey(SpanId) },
  /** A score as written ("12+5", "8:32"); attached to the block or benchmark it scores. */
  score: { ...spanFields, attachedTo: Schema.optionalKey(SpanId) },
  /** "Fran", "Murph": absent until the athlete picks one; saving needs it resolved. */
  benchmark: { ...spanFields, benchmarkId: Schema.optionalKey(BenchmarkId) },
});
export type Span = typeof Span.Type;
export type SpanTag = Span["_tag"];
export type SpanOf<Tag extends SpanTag> = Extract<Span, { readonly _tag: Tag }>;

export const ImportDocument = Schema.Struct({
  text: Schema.String,
  spans: Schema.Array(Span),
  /** Used only when no `date` span exists (the paste had no session heading). */
  performedOn: Schema.optionalKey(IsoDate),
  /** The athlete's debrief, entered in the editor rather than read from the text. */
  debrief: Schema.optionalKey(Debrief),
  /**
   * Who coached the session, or that it was done alone: filled from the bookingboard class it
   * was pulled from, or entered in the editor. A plan keeps it for the session logged from it.
   */
  coaching: Schema.optionalKey(Coaching),
  /**
   * The class it was (WOD or strength): from the pulled class's name, or picked in the editor.
   * Never set beside solo coaching; see `withSessionType`.
   */
  classType: Schema.optionalKey(ClassType),
}).annotate({ identifier: "ImportDocument" });
export type ImportDocument = typeof ImportDocument.Type;

/**
 * A movement with the phrases that also match it when parsing text ("DU", "Squat snatch").
 * `variationOf` names its core movement: "Hang power snatch" is a variation of "Snatch". One
 * level only: a core is never itself a variation.
 */
export const CatalogMovement = Schema.Struct({
  id: MovementId,
  name: TrimmedNonEmptyString,
  category: MovementCategory,
  aliases: Schema.Array(Schema.String),
  variationOf: Schema.optionalKey(MovementId),
  /** The row of the level sheet it is graded on ("bb-clean" for a power clean). */
  levelFamily: Schema.optionalKey(LevelFamilyId),
  /** Programmed by the coach to support the main movements (Bulgarian split squats). */
  accessory: Schema.optionalKey(Schema.Boolean),
  /** Patterns and muscles an accessory trains. */
  complements: Schema.optionalKey(Schema.Array(Complement)),
  /** Level families an accessory builds toward (gorilla rows for pull-ups). */
  supports: Schema.optionalKey(Schema.Array(LevelFamilyId)),
  /**
   * Movements done instead when it is scaled, first offered first: ring rows and jumping
   * pull-ups for pull-ups, walk-outs for wall walks. See `scalingOptions`.
   */
  scalings: Schema.optionalKey(Schema.Array(MovementId)),
}).annotate({ identifier: "CatalogMovement" });
export type CatalogMovement = typeof CatalogMovement.Type;

export const CreateMovementInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  category: MovementCategory,
  aliases: Schema.Array(TrimmedNonEmptyString),
  variationOf: Schema.optionalKey(MovementId),
});
export type CreateMovementInput = typeof CreateMovementInput.Type;

/** `null` makes the movement a core movement again. */
export const SetVariationOfInput = Schema.Struct({ variationOf: Schema.NullOr(MovementId) });
export type SetVariationOfInput = typeof SetVariationOfInput.Type;

/** How a movement is graded and, for an accessory, what it complements. */
export const SetMovementLevelsInput = Schema.Struct({
  levelFamily: Schema.NullOr(LevelFamilyId),
  accessory: Schema.Boolean,
  complements: Schema.Array(Complement),
  supports: Schema.Array(LevelFamilyId),
});
export type SetMovementLevelsInput = typeof SetMovementLevelsInput.Type;

/** The movements a movement scales to, first offered first; empty clears them. */
export const SetMovementScalingsInput = Schema.Struct({ scalings: Schema.Array(MovementId) });
export type SetMovementScalingsInput = typeof SetMovementScalingsInput.Type;

export const AddAliasInput = Schema.Struct({ alias: TrimmedNonEmptyString });
export type AddAliasInput = typeof AddAliasInput.Type;

export const SaveImportInput = Schema.Struct({
  document: ImportDocument,
  /** The imported session this save replaces (re-import or conflict resolution). */
  replace: Schema.optionalKey(WorkoutId),
  /** The plan this session was logged from; the save removes it. */
  fromPlan: Schema.optionalKey(PlanId),
});
export type SaveImportInput = typeof SaveImportInput.Type;

export const ImportSummary = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  sessionNumber: Schema.NullOr(Schema.Int),
  name: TrimmedNonEmptyString,
  partCount: Schema.Int,
  itemCount: Schema.Int,
  liftSetCount: Schema.Int,
  /** Sum of reps × load over the session's lift sets. */
  tonnageKg: Schema.Finite,
  importedAt: IsoDateTime,
}).annotate({ identifier: "ImportSummary" });
export type ImportSummary = typeof ImportSummary.Type;

export const StoredImport = Schema.Struct({
  summary: ImportSummary,
  document: ImportDocument,
}).annotate({ identifier: "StoredImport" });
export type StoredImport = typeof StoredImport.Type;

export class MovementExistsError extends Schema.TaggedError<MovementExistsError>()(
  "MovementExistsError",
  { id: MovementId, name: Schema.String },
  { httpApiStatus: 409 },
) {
  override get message(): string {
    return `A movement named ${this.name} already exists.`;
  }
}

export class AliasTakenError extends Schema.TaggedError<AliasTakenError>()(
  "AliasTakenError",
  { alias: Schema.String, movementId: MovementId },
  { httpApiStatus: 409 },
) {
  override get message(): string {
    return `"${this.alias}" already means ${this.movementId}.`;
  }
}

/** The core named in `variationOf` cannot take this movement as a variation. */
export class VariationInvalidError extends Schema.TaggedError<VariationInvalidError>()(
  "VariationInvalidError",
  {
    id: MovementId,
    variationOf: MovementId,
    reason: Schema.Literals(["self", "core-is-variation", "has-variations"]),
  },
  { httpApiStatus: 400 },
) {
  override get message(): string {
    switch (this.reason) {
      case "self":
        return `${this.id} cannot be a variation of itself.`;
      case "core-is-variation":
        return `${this.variationOf} is itself a variation; pick its core movement.`;
      case "has-variations":
        return `${this.id} has variations of its own, so it stays a core movement.`;
    }
  }
}

export class CatalogNotFoundError extends Schema.TaggedError<CatalogNotFoundError>()(
  "CatalogNotFoundError",
  { id: MovementId },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `Movement ${this.id} is not in the catalog.`;
  }
}

/** The document does not derive to a saveable session; `problems` are the blocking issues. */
export class ImportInvalidError extends Schema.TaggedError<ImportInvalidError>()(
  "ImportInvalidError",
  { problems: Schema.Array(Schema.String) },
  { httpApiStatus: 400 },
) {
  override get message(): string {
    return `The session cannot be saved: ${this.problems.join(" ")}`;
  }
}

/** Same session number (or same day, without one) is already imported. */
export class ImportConflictError extends Schema.TaggedError<ImportConflictError>()(
  "ImportConflictError",
  { existing: ImportSummary },
  { httpApiStatus: 409 },
) {
  override get message(): string {
    return `${this.existing.name} on ${this.existing.performedOn} is already imported.`;
  }
}

export class ImportNotFoundError extends Schema.TaggedError<ImportNotFoundError>()(
  "ImportNotFoundError",
  { workoutId: WorkoutId },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `No imported session for workout ${this.workoutId}.`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class ImportStorageError extends Schema.TaggedError<ImportStorageError>()(
  "ImportStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
