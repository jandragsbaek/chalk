import type {
  CatalogMovement,
  IsoDate,
  MovementCategory,
  MovementId,
  MovementMeasure,
  VolumeEntry,
  VolumeLeftOut,
  VolumeWeek,
} from "@chalk/contracts";

import { addDays, isoWeek, weekStart } from "./dashboard.ts";
import { MOVEMENT_CATEGORY_LABELS } from "./movementCategories.ts";
import { localIsoDate } from "./utils.ts";

/** Reps (or metres, calories, seconds) by the movement's measure, or reps × load. */
export type VolumeView = "volume" | "tonnage";
/** Credit work to the movement done, or to the one the board wrote. */
export type VolumeBasis = "done" | "written";
export type VolumeRange = "12" | "26" | "all";

export const VOLUME_RANGES: ReadonlyArray<{ readonly id: VolumeRange; readonly label: string }> = [
  { id: "12", label: "12 weeks" },
  { id: "26", label: "26 weeks" },
  { id: "all", label: "All" },
];

export interface Amounts {
  readonly reps: number;
  readonly metres: number;
  readonly calories: number;
  readonly seconds: number;
  readonly tonnageKg: number;
}

type AmountField = keyof Amounts;

const ZERO: Amounts = { reps: 0, metres: 0, calories: 0, seconds: 0, tonnageKg: 0 };

const add = (left: Amounts, right: Amounts): Amounts => ({
  reps: left.reps + right.reps,
  metres: left.metres + right.metres,
  calories: left.calories + right.calories,
  seconds: left.seconds + right.seconds,
  tonnageKg: left.tonnageKg + right.tonnageKg,
});

const MEASURE_FIELDS: Record<MovementMeasure, AmountField> = {
  reps: "reps",
  distance_m: "metres",
  calories: "calories",
  seconds: "seconds",
};

/** Unit after a number: "45 cal", "3,400 m"; reps print bare. */
const UNIT_SUFFIX: Record<AmountField, string> = {
  reps: "",
  metres: " m",
  calories: " cal",
  seconds: " s",
  tonnageKg: " kg",
};

/** The unit printed beside a row's name: what its cells count. */
const UNIT_LABEL: Record<AmountField, string> = {
  reps: "reps",
  metres: "m",
  calories: "cal",
  seconds: "s",
  tonnageKg: "kg",
};

const COUNT_FIELDS: ReadonlyArray<AmountField> = ["reps", "metres", "calories", "seconds"];

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const tenth = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** 1284.4 → "1,284". */
export const formatCount = (value: number) => whole.format(Math.round(value));

/** 14820 → "14.8 t"; under a tonne stays kilograms ("640 kg"). */
export const formatTonnage = (kg: number) =>
  kg >= 1000 ? `${tenth.format(kg / 1000)} t` : `${formatCount(kg)} kg`;

/** "3,400 m", "45 cal", "63". */
export const formatAmount = (field: AmountField, value: number) =>
  field === "tonnageKg" ? formatTonnage(value) : `${formatCount(value)}${UNIT_SUFFIX[field]}`;

/** Every unit with anything in it, headline first: "3,400 m · 45 cal". */
export const describeAmounts = (amounts: Amounts, first?: AmountField): string =>
  [...(first === undefined ? [] : [first]), ...COUNT_FIELDS.filter((field) => field !== first)]
    .filter((field) => amounts[field] > 0)
    .map((field) => formatAmount(field, amounts[field]))
    .join(" · ");

export interface VolumeColumn {
  readonly weekStart: IsoDate;
  /** ISO week number: "W44". */
  readonly week: number;
  /** The Monday's month and day: "Oct 26". */
  readonly label: string;
  /** The year, printed on the first column and where a new year starts. */
  readonly year: number | undefined;
  readonly current: boolean;
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const dateOf = (iso: IsoDate) => new Date(`${iso}T00:00:00`);

/** The week columns in view, oldest first, ending with the week of `today`. */
export function volumeColumns(
  weeks: ReadonlyArray<VolumeWeek>,
  range: VolumeRange,
  today: Date,
): ReadonlyArray<VolumeColumn> {
  const current = weekStart(today);
  const first = weeks[0]?.weekStart;
  const count =
    range === "all"
      ? first === undefined
        ? 1
        : Math.max(1, Math.round((current.getTime() - dateOf(first).getTime()) / 6048e5) + 1)
      : Number(range);
  const columns: Array<VolumeColumn> = [];
  for (let index = 0; index < count; index++) {
    const mondayDate = addDays(current, (index - count + 1) * 7);
    const previous = columns.at(-1);
    const year = mondayDate.getFullYear();
    columns.push({
      weekStart: localIsoDate(mondayDate),
      week: isoWeek(mondayDate),
      label: monthDay.format(mondayDate),
      year:
        previous === undefined || dateOf(previous.weekStart).getFullYear() !== year
          ? year
          : undefined,
      current: index === count - 1,
    });
  }
  return columns;
}

/** Row shade, 0 for nothing to 4 for the movement's best weeks in view. */
export type Heat = 0 | 1 | 2 | 3 | 4;

const heatOf = (value: number, best: number): Heat => {
  if (value <= 0 || best <= 0) return 0;
  const share = value / best;
  return share < 0.35 ? 1 : share < 0.6 ? 2 : share < 0.85 ? 3 : 4;
};

export interface VolumeCell {
  readonly amounts: Amounts;
  /** What the cell prints: its row's unit, or another unit when only that one has anything. */
  readonly text: string | undefined;
  /** Counted in another unit too ("+ 45 cal"), told in the readout. */
  readonly more: boolean;
  readonly heat: Heat;
}

export interface VolumeRow {
  readonly movementId: MovementId;
  readonly name: string;
  readonly field: AmountField;
  readonly unit: string;
  readonly cells: ReadonlyArray<VolumeCell>;
  readonly total: Amounts;
  readonly totalText: string;
}

export interface VolumeGroup {
  readonly category: MovementCategory;
  readonly label: string;
  readonly rows: ReadonlyArray<VolumeRow>;
}

export interface VolumeGrid {
  readonly columns: ReadonlyArray<VolumeColumn>;
  readonly groups: ReadonlyArray<VolumeGroup>;
  /** Every movement together, per column. */
  readonly totals: ReadonlyArray<Amounts>;
  /** Sessions per column: each workout once, and a day of strength sets logged on their own. */
  readonly sessions: ReadonlyArray<number>;
}

const CATEGORY_ORDER: ReadonlyArray<MovementCategory> = [
  "barbell",
  "dumbbell_kettlebell",
  "gymnastics",
  "monostructural",
  "other",
];

const keyOf = (entry: VolumeEntry, basis: VolumeBasis) =>
  basis === "done" ? entry.movementId : entry.writtenAs;

const sessionKey = (entry: { readonly workoutId: string | null; readonly performedOn: IsoDate }) =>
  entry.workoutId ?? `day ${entry.performedOn}`;

const amountsOf = (entry: VolumeEntry): Amounts => ({
  reps: entry.reps,
  metres: entry.metres,
  calories: entry.calories,
  seconds: entry.seconds,
  tonnageKg: entry.tonnageKg,
});

/**
 * The ledger: one row per movement with anything in view (in tonnage, anything lifted), by
 * category then name; one column per ISO week; each cell shaded against its row's best week.
 */
export function volumeGrid(
  weeks: ReadonlyArray<VolumeWeek>,
  catalog: ReadonlyArray<CatalogMovement>,
  options: {
    readonly view: VolumeView;
    readonly basis: VolumeBasis;
    readonly columns: ReadonlyArray<VolumeColumn>;
  },
): VolumeGrid {
  const { view, basis, columns } = options;
  const columnOf = new Map(columns.map((column, index) => [column.weekStart, index]));
  const byMovement = new Map<MovementId, Array<Amounts>>();
  const totals = columns.map(() => ZERO);
  const sessions = columns.map(() => new Set<string>());

  for (const week of weeks) {
    const index = columnOf.get(week.weekStart);
    if (index === undefined) continue;
    for (const entry of week.entries) {
      const id = keyOf(entry, basis);
      const cells = byMovement.get(id) ?? columns.map(() => ZERO);
      cells[index] = add(cells[index]!, amountsOf(entry));
      byMovement.set(id, cells);
      totals[index] = add(totals[index]!, amountsOf(entry));
      sessions[index]!.add(sessionKey(entry));
    }
  }

  const movementOf = new Map(catalog.map((movement) => [movement.id, movement]));
  const rows: Array<VolumeRow & { readonly category: MovementCategory }> = [];
  for (const [movementId, cells] of byMovement) {
    const movement = movementOf.get(movementId);
    const field: AmountField =
      view === "tonnage" ? "tonnageKg" : MEASURE_FIELDS[movement?.measure ?? "reps"];
    const total = cells.reduce(add, ZERO);
    if (view === "tonnage" && total.tonnageKg <= 0) continue;
    const best = Math.max(...cells.map((cell) => cell[field]));
    rows.push({
      movementId,
      name: movement?.name ?? movementId,
      category: movement?.category ?? "other",
      field,
      unit: UNIT_LABEL[field],
      cells: cells.map((amounts) => {
        const headline = amounts[field];
        const others = COUNT_FIELDS.filter((other) => other !== field && amounts[other] > 0);
        const text =
          headline > 0
            ? formatCount(headline)
            : view === "volume" && others[0] !== undefined
              ? formatAmount(others[0], amounts[others[0]])
              : undefined;
        return {
          amounts,
          text,
          more: view === "volume" && others.length > (headline > 0 ? 0 : 1),
          heat: heatOf(headline, best),
        };
      }),
      total,
      totalText:
        view === "tonnage" ? formatTonnage(total.tonnageKg) : describeAmounts(total, field),
    });
  }

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    label: MOVEMENT_CATEGORY_LABELS[category],
    rows: rows
      .filter((row) => row.category === category)
      .toSorted((left, right) => left.name.localeCompare(right.name)),
  })).filter((group) => group.rows.length > 0);

  return { columns, groups, totals, sessions: sessions.map((set) => set.size) };
}

/** One session's share of a cell, for the readout. */
export interface CellSource {
  readonly workoutId: string | null;
  readonly performedOn: IsoDate;
  readonly amounts: Amounts;
  /**
   * The other side of a swap: in Done, the movement the board wrote ("in place of Pull-up");
   * in As written, the movement done ("done as Ring row").
   */
  readonly swappedWith: MovementId | undefined;
}

/** Where a cell's numbers come from: each session of the week, oldest first. */
export function cellSources(
  week: VolumeWeek | undefined,
  movementId: MovementId,
  basis: VolumeBasis,
): ReadonlyArray<CellSource> {
  if (week === undefined) return [];
  return week.entries
    .filter((entry) => keyOf(entry, basis) === movementId)
    .map((entry) => {
      const other = basis === "done" ? entry.writtenAs : entry.movementId;
      return {
        workoutId: entry.workoutId,
        performedOn: entry.performedOn,
        amounts: amountsOf(entry),
        swappedWith: other === movementId ? undefined : other,
      };
    });
}

/** "Swim: No reps." lines, one per reason and movement, for a week's foot. */
export function leftOutSummary(
  leftOut: ReadonlyArray<VolumeLeftOut>,
  nameOf: (id: MovementId) => string,
): ReadonlyArray<string> {
  const lines = new Set<string>();
  for (const line of leftOut) {
    const what = line.movementId === undefined ? line.text : nameOf(line.movementId);
    lines.add(`${what}: ${line.reason.replace(/\.$/, "")}`);
  }
  return [...lines];
}
