import * as Schema from "effect/Schema";

import { IsoDate, IsoDateTime, MovementId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { LoadKg } from "./strength.ts";

/**
 * Programmed training: blocks (a strength cycle, a run of prehab) of sessions on future days,
 * several at once. The coach drafts, the athlete puts the draft in the calendar and moves single
 * sessions. A session is a prescription: it counts nowhere until the athlete logs what was done.
 */

const makeId = <Brand extends string>(brand: Parameters<typeof Schema.brand<Brand>>[0]) =>
  TrimmedNonEmptyString.pipe(Schema.brand<Brand>(brand));

export const BlockId = makeId("BlockId");
export type BlockId = typeof BlockId.Type;

export const ProgrammedSessionId = makeId("ProgrammedSessionId");
export type ProgrammedSessionId = typeof ProgrammedSessionId.Type;

/** A draft is the coach's proposal: on the calendar only as dashed, until the athlete puts it there. */
export const BlockStatus = Schema.Literals(["draft", "scheduled"]);
export type BlockStatus = typeof BlockStatus.Type;

/** Who wrote the block. */
export const BlockSource = Schema.Literals(["athlete", "coach"]);
export type BlockSource = typeof BlockSource.Type;

/** The load a block's percentages are taken from, per lift. */
export const TrainingMax = Schema.Struct({
  movementId: MovementId,
  kg: LoadKg,
}).annotate({ identifier: "TrainingMax" });
export type TrainingMax = typeof TrainingMax.Type;

const Count = (maximum: number) => Schema.Int.check(Schema.isBetween({ minimum: 1, maximum }));

/**
 * One prescribed line: a movement (from the catalog, or named freely for prehab the catalog
 * lacks) with sets of reps or of seconds, and its load as a percent of the block's training
 * max, a fixed kg, or words ("light band"). Everything but the name is optional.
 */
export const ProgrammedLine = Schema.Struct({
  movementId: Schema.optionalKey(MovementId),
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(80)),
  sets: Schema.optionalKey(Count(50)),
  reps: Schema.optionalKey(Count(100)),
  /** A hold or a piece of work per set, in seconds. */
  seconds: Schema.optionalKey(Count(3600)),
  /** Reps or seconds per side. */
  each: Schema.optionalKey(Schema.Boolean),
  /** Percent of the block's training max for `movementId`. */
  percent: Schema.optionalKey(
    Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(120)),
  ),
  loadKg: Schema.optionalKey(LoadKg),
  /** A load said in words: "light band", "bodyweight", "RPE 7". */
  load: Schema.optionalKey(TrimmedNonEmptyString.check(Schema.isMaxLength(40))),
  note: Schema.optionalKey(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
}).annotate({ identifier: "ProgrammedLine" });
export type ProgrammedLine = typeof ProgrammedLine.Type;

export const ProgrammedSession = Schema.Struct({
  id: ProgrammedSessionId,
  blockId: BlockId,
  day: IsoDate,
  /** "Week 1 · Day 2", "Prehab A". */
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(80)),
  /** When in the day or how long: "before class", "15 min". */
  note: Schema.optionalKey(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
  lines: Schema.Array(ProgrammedLine),
  /** Lines the athlete ticked done, by index into `lines`. */
  ticked: Schema.Array(Schema.Int),
}).annotate({ identifier: "ProgrammedSession" });
export type ProgrammedSession = typeof ProgrammedSession.Type;

export const TrainingBlock = Schema.Struct({
  id: BlockId,
  name: TrimmedNonEmptyString,
  /** Why this block, in a sentence or two: what it builds and how it fits the box classes. */
  goal: Schema.String,
  status: BlockStatus,
  source: BlockSource,
  trainingMaxes: Schema.Array(TrainingMax),
  /** By day, then in the order written. */
  sessions: Schema.Array(ProgrammedSession),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}).annotate({ identifier: "TrainingBlock" });
export type TrainingBlock = typeof TrainingBlock.Type;

export const DraftSessionInput = Schema.Struct({
  day: IsoDate,
  title: ProgrammedSession.fields.title,
  note: ProgrammedSession.fields.note,
  lines: Schema.Array(ProgrammedLine).check(Schema.isMinLength(1), Schema.isMaxLength(20)),
});
export type DraftSessionInput = typeof DraftSessionInput.Type;

/** A whole block as written, by the coach or the athlete. */
export const DraftBlockInput = Schema.Struct({
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(80)),
  goal: Schema.String.check(Schema.isMaxLength(600)),
  trainingMaxes: Schema.Array(TrainingMax),
  sessions: Schema.Array(DraftSessionInput).check(Schema.isMinLength(1), Schema.isMaxLength(60)),
});
export type DraftBlockInput = typeof DraftBlockInput.Type;

export class BlockNotFoundError extends Schema.TaggedError<BlockNotFoundError>()(
  "BlockNotFoundError",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `No training block ${this.id}.`;
  }
}

export class ProgrammedSessionNotFoundError extends Schema.TaggedError<ProgrammedSessionNotFoundError>()(
  "ProgrammedSessionNotFoundError",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `No programmed session ${this.id}.`;
  }
}

/** A block that does not hold together: a percent with no training max, an unknown movement. */
export class BlockInvalidError extends Schema.TaggedError<BlockInvalidError>()(
  "BlockInvalidError",
  { problems: Schema.Array(Schema.String) },
  { httpApiStatus: 400 },
) {
  override get message(): string {
    return this.problems.join(" ");
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class TrainingStorageError extends Schema.TaggedError<TrainingStorageError>()(
  "TrainingStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}

/** Loads round to what the plates make: 2.5 kg steps. */
export const PLATE_STEP_KG = 2.5;

export const roundToPlates = (kg: number): number => Math.round(kg / PLATE_STEP_KG) * PLATE_STEP_KG;

/**
 * A line's load in kg: its fixed load, or its percent of the training max rounded to the
 * plates. Undefined for a line loaded in words, or a percent with no training max.
 */
export const lineLoadKg = (
  line: ProgrammedLine,
  trainingMaxes: ReadonlyArray<TrainingMax>,
): number | undefined => {
  if (line.loadKg !== undefined) return line.loadKg;
  if (line.percent === undefined || line.movementId === undefined) return undefined;
  const max = trainingMaxes.find((entry) => entry.movementId === line.movementId);
  return max === undefined ? undefined : roundToPlates((max.kg * line.percent) / 100);
};

/** A line Chalk can see done in the log: a catalog movement under a bar or a fixed load. */
export const isLoggedLift = (line: ProgrammedLine): boolean =>
  line.movementId !== undefined && (line.percent !== undefined || line.loadKg !== undefined);

/** "6 × 6", "3 × 12 each", "2 × 90 s", "1 × 5" as "5", or nothing. */
export const lineVolume = (line: ProgrammedLine): string | undefined => {
  const per =
    line.reps !== undefined
      ? `${line.reps}`
      : line.seconds !== undefined
        ? line.seconds % 60 === 0 && line.seconds >= 120
          ? `${line.seconds / 60} min`
          : `${line.seconds} s`
        : undefined;
  if (per === undefined) return line.sets === undefined ? undefined : `${line.sets} sets`;
  const each = line.each === true ? " each" : "";
  return line.sets === undefined || line.sets === 1
    ? `${per}${each}`
    : `${line.sets} × ${per}${each}`;
};

/** The problems that keep a written block from being saved; empty when it holds together. */
export const blockProblems = (
  input: DraftBlockInput,
  movementName: (id: MovementId) => string | undefined,
): ReadonlyArray<string> => {
  const problems: Array<string> = [];
  const maxed = new Set(input.trainingMaxes.map((max) => max.movementId));
  for (const max of input.trainingMaxes)
    if (movementName(max.movementId) === undefined)
      problems.push(`Training max for unknown movement '${max.movementId}'.`);
  input.sessions.forEach((session, index) => {
    session.lines.forEach((line) => {
      const where = `Session ${index + 1} (${session.day}), ${line.name}:`;
      if (line.movementId !== undefined && movementName(line.movementId) === undefined)
        problems.push(`${where} unknown movement '${line.movementId}'.`);
      if (line.percent !== undefined && line.movementId === undefined)
        problems.push(`${where} a percent needs a catalog movement.`);
      if (
        line.percent !== undefined &&
        line.movementId !== undefined &&
        !maxed.has(line.movementId)
      )
        problems.push(`${where} a percent needs a training max for ${line.movementId}.`);
      if (line.percent !== undefined && line.loadKg !== undefined)
        problems.push(`${where} give a percent or a kg load, not both.`);
    });
  });
  return problems;
};

const kgText = (kg: number) => `${Math.round(kg * 10) / 10} kg`;

/**
 * A line in words: "Back squat 6 × 6 @ 70 % · 105 kg", "Band pull-apart 3 × 20 · light band".
 * The percent is kept beside the kg it comes to, so either can be checked.
 */
export const lineText = (line: ProgrammedLine, trainingMaxes: ReadonlyArray<TrainingMax>) => {
  const volume = lineVolume(line);
  const kg = lineLoadKg(line, trainingMaxes);
  const load = [
    ...(line.percent === undefined ? [] : [`@ ${line.percent} %`]),
    ...(kg === undefined ? [] : [kgText(kg)]),
    ...(line.load === undefined ? [] : [line.load]),
  ];
  const head = volume === undefined ? line.name : `${line.name} ${volume}`;
  const withPercent = line.percent === undefined ? head : `${head} ${load.shift()}`;
  return load.length === 0 ? withPercent : `${withPercent} · ${load.join(" · ")}`;
};
