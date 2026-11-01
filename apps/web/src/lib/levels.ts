import {
  ATHLETE_SEX,
  Complement as ComplementSchema,
  COMPLEMENT_PATTERNS,
  definedLevels,
  epley,
  gradeItem,
  gradeLoad,
  LEVEL_FAMILIES,
  LEVEL_NAMES,
  levelIndex,
  majorityLevel,
  MAX_ESTIMATE_REPS,
  nextLevel,
  prescribedLoad,
  rungLabel,
  rungThreshold,
  sumShares,
  type CatalogMovement,
  type Complement,
  type Grade,
  type Level,
  type LevelFamily,
  type LevelFamilyId,
  type LevelItem,
  type LevelShare,
  type LiftSet,
  type MovementId,
} from "@chalk/contracts";

export const LEVEL_WINDOWS = [
  { id: "90d", label: "90 days", days: 90 },
  { id: "1y", label: "12 months", days: 365 },
  { id: "all", label: "All time", days: null },
] as const;
export type LevelWindow = (typeof LEVEL_WINDOWS)[number]["id"];

/** First day inside the window, or `undefined` for all time. */
export function windowStart(window: LevelWindow, today: Date): string | undefined {
  const days = LEVEL_WINDOWS.find((option) => option.id === window)?.days ?? null;
  if (days === null) return undefined;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${start.getFullYear()}-${month}-${day}`;
}

/** What the athlete can do on a family: the hardest variation, or the best estimated 1RM. */
export interface Capability {
  readonly position: number;
  readonly level: Level | undefined;
  readonly movementId?: MovementId;
  readonly unbroken?: number;
  readonly estimateKg?: number;
}

export interface FamilySummary {
  readonly family: LevelFamily;
  /** Sessions in the window where the athlete recorded how they did a movement of this family. */
  readonly sessions: number;
  /** Load: the heaviest workout load. Variants: the level most reps reached. */
  readonly performed:
    | (Grade & { readonly loadKg?: number; readonly implements?: 1 | 2 })
    | undefined;
  /** Variants: reps per level over the window. */
  readonly shares: ReadonlyArray<LevelShare>;
  readonly capability: Capability | undefined;
  /** The easiest and hardest prescription of the family in the window (alternatives aside). */
  readonly programmed: { readonly from: number; readonly to: number } | undefined;
  /** Sessions in the window that programmed the family. */
  readonly programmedSessions: number;
}

const inWindow = (since: string | undefined) => (entry: { readonly performedOn: string }) =>
  since === undefined || entry.performedOn >= since;

/** Movement lookup for grading, from the catalog the server sent. */
export const movementsById = (movements: ReadonlyArray<CatalogMovement>) =>
  new Map(movements.map((movement) => [movement.id, movement]));

/**
 * Every family of the sheet, summarized over the items and lift sets in the window: where the
 * workouts put the athlete, what they can do, and what the box asked for.
 */
export function summarizeFamilies(
  movements: ReadonlyArray<CatalogMovement>,
  items: ReadonlyArray<LevelItem>,
  liftSets: ReadonlyArray<LiftSet>,
  since: string | undefined,
): ReadonlyMap<LevelFamilyId, FamilySummary> {
  const byId = movementsById(movements);
  const current = items.filter(inWindow(since));

  interface Acc {
    performedSessions: Set<string>;
    programmedSessions: Set<string>;
    best: (Grade & { loadKg?: number; implements?: 1 | 2 }) | undefined;
    shares: Array<LevelShare>;
    capability: Capability | undefined;
    from: number | undefined;
    to: number | undefined;
  }
  const accs = new Map<LevelFamilyId, Acc>(
    LEVEL_FAMILIES.map((family) => [
      family.id,
      {
        performedSessions: new Set(),
        programmedSessions: new Set(),
        best: undefined,
        shares: [],
        capability: undefined,
        from: undefined,
        to: undefined,
      },
    ]),
  );

  for (const item of current) {
    const grade = gradeItem(item, byId);
    if (grade === undefined) continue;
    if (!item.alternative && grade.prescribed !== undefined) {
      const acc = accs.get(grade.family.id)!;
      acc.programmedSessions.add(item.workoutId);
      acc.from = Math.min(acc.from ?? Infinity, grade.prescribed.position);
      acc.to = Math.max(acc.to ?? -Infinity, grade.prescribed.position);
    }
    const performed = grade.performed;
    if (performed === undefined) continue;
    const acc = accs.get(performed.family.id)!;
    acc.performedSessions.add(item.workoutId);
    if (performed.family.kind === "load") {
      if (acc.best === undefined || performed.position > acc.best.position)
        acc.best = {
          level: performed.level,
          position: performed.position,
          ...(performed.loadKg === undefined ? {} : { loadKg: performed.loadKg }),
          implements: item.performance?.implements ?? 1,
        };
    } else {
      acc.shares.push(...performed.shares);
      const can = performed.capability;
      if (can !== undefined) {
        const known = acc.capability;
        if (known === undefined || can.position > known.position)
          acc.capability = {
            position: can.position,
            level: can.level,
            movementId: can.movementId,
            ...(can.unbroken === undefined ? {} : { unbroken: can.unbroken }),
          };
        else if (
          can.position === known.position &&
          can.unbroken !== undefined &&
          can.unbroken > (known.unbroken ?? 0)
        )
          acc.capability = { ...known, unbroken: can.unbroken };
      }
    }
  }

  // Estimated 1RM from lift sets of any movement graded on a load family.
  const estimates = new Map<LevelFamilyId, number>();
  for (const set of liftSets.filter(inWindow(since))) {
    const familyId = byId.get(set.movementId)?.levelFamily;
    if (familyId === undefined || set.reps > MAX_ESTIMATE_REPS) continue;
    const estimate = epley(set.loadKg, set.reps);
    estimates.set(familyId, Math.max(estimates.get(familyId) ?? 0, estimate));
  }

  const summaries = new Map<LevelFamilyId, FamilySummary>();
  for (const family of LEVEL_FAMILIES) {
    const acc = accs.get(family.id)!;
    const estimateKg = estimates.get(family.id);
    let capability = acc.capability;
    let performed: FamilySummary["performed"] = acc.best;
    let shares: ReadonlyArray<LevelShare> = [];
    if (family.kind === "variant") {
      shares = sumShares(acc.shares);
      const level = majorityLevel(shares);
      const floor = levelIndex(definedLevels(family)[0] ?? "fundamentals");
      performed =
        shares.length === 0
          ? undefined
          : { level, position: level === undefined ? floor - 0.5 : levelIndex(level) };
    } else if (estimateKg !== undefined) {
      const graded = gradeLoad(family, estimateKg);
      capability = { position: graded.position, level: graded.level, estimateKg };
    }
    summaries.set(family.id, {
      family,
      sessions: acc.performedSessions.size,
      performed,
      shares,
      capability,
      programmed:
        acc.from === undefined || acc.to === undefined ? undefined : { from: acc.from, to: acc.to },
      programmedSessions: acc.programmedSessions.size,
    });
  }
  return summaries;
}

const formatKgNumber = (kg: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(kg);

/** The verdict in the right column: a heading and one sentence. */
export interface Verdict {
  readonly heading: string;
  readonly detail: string;
  readonly quiet?: boolean;
}

/**
 * What stands between the athlete and the next rung. Load: the kilograms to it, and how heavy
 * it is next to the estimated 1RM. Variants: Volume when the next rung's variation has been
 * done, Skill when it has not, Skill + strength under the sheet.
 */
export function verdictOf(summary: FamilySummary, nameOf: (id: MovementId) => string): Verdict {
  const { family, performed, capability } = summary;
  if (performed === undefined)
    return summary.programmedSessions > 0
      ? {
          heading: "Not recorded",
          detail: `Programmed in ${summary.programmedSessions} ${summary.programmedSessions === 1 ? "session" : "sessions"}; say how you did it in the importer.`,
          quiet: true,
        }
      : { heading: "No workouts", detail: "Nothing in this window.", quiet: true };

  const next = nextLevel(family, performed.level);
  if (next === undefined)
    return {
      heading: "Top of the sheet",
      detail: `${LEVEL_NAMES[performed.level ?? "rx"]} is as far as it goes.`,
    };

  if (family.kind === "load") {
    const implementCount = performed.implements ?? 1;
    const threshold = rungThreshold(family.rungs[next]!, implementCount, ATHLETE_SEX);
    const gap =
      threshold === undefined || performed.loadKg === undefined
        ? undefined
        : threshold - performed.loadKg;
    const heading = gap === undefined ? LEVEL_NAMES[next] : `+${formatKgNumber(gap)} kg`;
    const toNext = `to ${LEVEL_NAMES[next]} (${implementCount === 2 ? "2 × " : ""}${threshold} kg)`;
    if (capability?.estimateKg !== undefined && threshold !== undefined) {
      const share = Math.round((threshold / capability.estimateKg) * 100);
      return {
        heading,
        detail:
          share <= 70
            ? `${toNext}. That is ${share} % of your estimated 1RM: the strength is there.`
            : `${toNext}. That is ${share} % of your estimated 1RM.`,
      };
    }
    return { heading, detail: `${toNext}.` };
  }

  const nextLabel = rungLabel(family, next) ?? LEVEL_NAMES[next];
  if (performed.level === undefined) {
    return {
      heading: "Skill + strength",
      detail: `Under the sheet. ${nextLabel} is the first rung.`,
    };
  }
  if (capability !== undefined && capability.position >= levelIndex(next)) {
    const hardest = capability.movementId === undefined ? nextLabel : nameOf(capability.movementId);
    const unbroken = capability.unbroken === undefined ? "" : `, ${capability.unbroken} unbroken`;
    return {
      heading: "Volume",
      detail: `The skill is there (${hardest.toLowerCase()}${unbroken}); most reps are still ${LEVEL_NAMES[performed.level]}.`,
    };
  }
  return { heading: "Skill", detail: `No ${nextLabel} in a workout yet.` };
}

/** One accessory over the window: what it trains, what it is graded as, how the load moved. */
export interface AccessorySummary {
  readonly movement: CatalogMovement;
  readonly group: Complement | undefined;
  readonly sessions: number;
  readonly firstKg: number | undefined;
  readonly latestKg: number | undefined;
  readonly dual: boolean;
  readonly graded: Grade | undefined;
}

/** Patterns first, then muscles, untagged last. */
const groupOrder = (group: Complement | undefined) =>
  group === undefined ? Infinity : ComplementSchema.literals.indexOf(group);

/** Accessories with their load from the first to the latest session in the window. */
export function summarizeAccessories(
  movements: ReadonlyArray<CatalogMovement>,
  items: ReadonlyArray<LevelItem>,
  liftSets: ReadonlyArray<LiftSet>,
  since: string | undefined,
): ReadonlyArray<AccessorySummary> {
  const byId = movementsById(movements);
  const current = items.filter(inWindow(since));
  return movements
    .filter((movement) => movement.accessory === true)
    .map((movement) => {
      const own = current.filter((item) => item.movementId === movement.id);
      const loads = [
        ...own.flatMap((item) => {
          const kg = item.performance?.loadKg ?? item.liftedKg ?? prescribedLoad(item.sets);
          return kg === undefined ? [] : [{ day: item.performedOn, kg }];
        }),
        ...liftSets
          .filter(inWindow(since))
          .filter((set) => set.movementId === movement.id)
          .map((set) => ({ day: set.performedOn, kg: set.loadKg })),
      ].sort((left, right) => left.day.localeCompare(right.day));
      const graded = own
        .map((item) => gradeItem(item, byId)?.performed)
        .filter((grade) => grade !== undefined)
        .reduce<Grade | undefined>(
          (best, grade) => (best === undefined || grade.position > best.position ? grade : best),
          undefined,
        );
      const complements = movement.complements ?? [];
      return {
        movement,
        group:
          COMPLEMENT_PATTERNS.find((pattern) => complements.includes(pattern)) ?? complements[0],
        sessions: new Set(own.map((item) => item.workoutId)).size,
        firstKg: loads[0]?.kg,
        latestKg: loads.at(-1)?.kg,
        dual: own.some((item) => item.performance?.implements === 2),
        graded,
      };
    })
    .sort(
      (left, right) =>
        groupOrder(left.group) - groupOrder(right.group) ||
        left.movement.name.localeCompare(right.movement.name),
    );
}
