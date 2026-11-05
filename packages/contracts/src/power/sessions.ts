import type { IsoDate, WorkoutId } from "../baseSchemas.ts";
import { benchmarkById } from "../benchmarks/index.ts";
import { bodyweightOn, type AthleteProfile } from "../profile.ts";
import type { CatalogMovement } from "../sessionImport.ts";
import { deriveSession } from "../sessionImport/derive.ts";
import { bodyOf, type Body } from "./body.ts";
import {
  countsForPower,
  estimateBenchmarkWork,
  estimateSessionWork,
  workModelsFor,
  type SessionWork,
} from "./estimate.ts";
import type { PowerSession } from "./history.ts";

/**
 * The athlete's body on `day`: height and limbs from Settings, the weigh-in on or before that
 * day. `undefined` without a height or any weigh-in, since the estimate needs both.
 */
export const bodyOn = (profile: AthleteProfile | undefined, day: IsoDate): Body | undefined => {
  if (profile?.heightCm == null) return undefined;
  const bodyweightKg = bodyweightOn(profile, day);
  if (bodyweightKg === null) return undefined;
  return bodyOf({
    sex: profile.sex,
    heightCm: profile.heightCm,
    bodyweightKg,
    armLengthCm: profile.armLengthCm,
    legLengthCm: profile.legLengthCm,
  });
};

/** A block a session's power is over: "Workout #2 · For time", 15:00. */
export interface PowerBlock {
  readonly title: string;
  readonly seconds: number;
}

/** "Workout #2 · For time"; a block with no title of its own goes by its part's. */
export const blockLabel = (partTitle: string, blockTitle: string) =>
  blockTitle === "" ? partTitle : partTitle === "" ? blockTitle : `${partTitle} · ${blockTitle}`;

/** The blocks a session's power is over, in order. */
export const powerBlocksOf = (work: SessionWork): ReadonlyArray<PowerBlock> =>
  work.parts.flatMap((part) =>
    part.blocks.filter(countsForPower).map((block) => ({
      title: blockLabel(part.title, block.title),
      seconds: block.work.seconds ?? 0,
    })),
  );

/**
 * One session on the power page: its work, and its power when it has a timed conditioning
 * block. Work is the whole session's; power is over `counted` only.
 */
export interface SessionPowerRow {
  readonly workoutId: WorkoutId;
  readonly performedOn: IsoDate;
  readonly name: string;
  /** A benchmark logged Rx: the same workout every time, so its watts compare cleanly. */
  readonly benchmark: boolean;
  readonly joules: number;
  /** The time power is over. */
  readonly seconds: number;
  readonly watts: number | undefined;
  /** The blocks power is over; empty for a benchmark, which is counted whole. */
  readonly counted: ReadonlyArray<PowerBlock>;
  /** Timed strength blocks left out of power. */
  readonly strengthBlocks: number;
}

/** Each session estimated for the body on its day; sessions without one are left out. */
export const sessionPowerRows = (
  sessions: ReadonlyArray<PowerSession>,
  profile: AthleteProfile | undefined,
  catalog: ReadonlyArray<CatalogMovement>,
): ReadonlyArray<SessionPowerRow> => {
  const modelOf = workModelsFor(catalog);
  const nameById = new Map(catalog.map((movement) => [movement.id, movement.name]));
  return sessions.flatMap((session): ReadonlyArray<SessionPowerRow> => {
    const body = bodyOn(profile, session.performedOn);
    if (body === undefined) return [];
    const base = {
      workoutId: session.workoutId,
      performedOn: session.performedOn,
      name: session.name,
    };
    if (session._tag === "logged") {
      const benchmark = benchmarkById(session.benchmarkId);
      const work =
        benchmark === undefined
          ? undefined
          : estimateBenchmarkWork(benchmark, session.score, body, modelOf);
      return work === undefined
        ? []
        : [
            {
              ...base,
              benchmark: true,
              joules: work.joules,
              seconds: work.seconds,
              watts: work.watts,
              counted: [],
              strengthBlocks: 0,
            },
          ];
    }
    const work = estimateSessionWork(
      deriveSession(session.document, (id) => nameById.get(id), { sex: body.sex }),
      body,
      modelOf,
    );
    if (work.joules <= 0) return [];
    return [
      {
        ...base,
        benchmark: false,
        joules: work.joules,
        seconds: work.conditioningSeconds,
        watts: work.watts,
        counted: powerBlocksOf(work),
        strengthBlocks: work.strengthBlocks,
      },
    ];
  });
};
