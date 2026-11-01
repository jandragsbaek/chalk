import {
  benchmarkById,
  bodyOf,
  bodyweightOn,
  deriveSession,
  estimateBenchmarkWork,
  estimateSessionWork,
  workModelsFor,
  type AthleteProfile,
  type Body,
  type CatalogMovement,
  type IsoDate,
  type LeftOut,
  type MovementId,
  type PowerSession,
  type WorkoutId,
} from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { profileAtom } from "../state/profile.ts";

const kjFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** 52345 J → "52.3 kJ". */
export const formatKj = (joules: number) => `${kjFormat.format(joules / 1000)} kJ`;

/** Whole watts; a decimal would be false precision. */
export const formatWatts = (watts: number) => `${Math.round(watts)} W`;

/** 905 → "15:05". */
export const formatClock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Movements left out, one line per reason: "Farmers carry, Swim: no work model yet." */
export const leftOutLines = (
  leftOut: ReadonlyArray<LeftOut>,
  nameOf: (id: MovementId) => string,
): ReadonlyArray<string> => {
  const byReason = new Map<string, Set<string>>();
  for (const left of leftOut) {
    const name = left.movementId === undefined ? left.text : nameOf(left.movementId);
    const names = byReason.get(left.reason) ?? new Set<string>();
    names.add(name);
    byReason.set(left.reason, names);
  }
  return Array.from(byReason, ([reason, names]) => `${[...names].join(", ")}: ${reason}`);
};

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

/** "180 cm · 85 kg". */
export const describeBody = (body: Body) =>
  `${Math.round(body.heightM * 100)} cm · ${kjFormat.format(body.massKg)} kg`;

/** The profile, or `undefined` while it loads or fails: estimates then ask for Settings. */
export function useProfile(): AthleteProfile | undefined {
  return AsyncResult.getOrElse(useAtomValue(profileAtom), () => undefined);
}

/** One session on the power page: its work, and its power when it has a time. */
export interface SessionPowerRow {
  readonly workoutId: WorkoutId;
  readonly performedOn: IsoDate;
  readonly name: string;
  /** A benchmark logged Rx: the same workout every time, so its watts compare cleanly. */
  readonly benchmark: boolean;
  readonly joules: number;
  readonly seconds: number;
  readonly watts: number | undefined;
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
            },
          ];
    }
    const work = estimateSessionWork(
      deriveSession(session.document, (id) => nameById.get(id)),
      body,
      modelOf,
    );
    if (work.joules <= 0) return [];
    return [
      {
        ...base,
        benchmark: false,
        joules: work.joules,
        seconds: work.timedSeconds,
        watts: work.watts,
      },
    ];
  });
};

/** The median of each value and the `window - 1` before it: a trend one hard day cannot move. */
export const rollingMedian = (values: ReadonlyArray<number>, window: number): number[] =>
  values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - window + 1), index + 1)
      .toSorted((a, b) => a - b);
    const middle = Math.floor(slice.length / 2);
    return slice.length % 2 === 1 ? slice[middle]! : (slice[middle - 1]! + slice[middle]!) / 2;
  });
