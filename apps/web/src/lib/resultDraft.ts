import {
  performedSets,
  type Amount,
  type DerivedBlock,
  type DerivedItem,
  type LiftResult,
  type Quantity,
} from "@chalk/contracts";

/**
 * The result form of a programmed movement as typed: strings, so a half-typed "62," survives.
 * A complete draft becomes a `LiftResult` on the movement span; an incomplete one becomes none.
 */
export type ResultMode = LiftResult["_tag"];

export interface DraftRow {
  readonly reps: string;
  readonly load: string;
}

export interface ResultDraft {
  /** `undefined` while the movement has no result. */
  readonly mode: ResultMode | undefined;
  readonly sets: string;
  readonly reps: string;
  /** The load of every set (`fixed`) or of the first one (`ramp`). */
  readonly load: string;
  readonly step: string;
  readonly rows: ReadonlyArray<DraftRow>;
}

/** What the prescription already says, to prefill the form. */
export interface ResultDefaults {
  readonly sets: number | undefined;
  readonly reps: number | undefined;
  readonly loadKg: number | undefined;
  /** Reps per line when the prescription has one line per set (a build-up). */
  readonly rows: ReadonlyArray<number | undefined> | undefined;
}

const exact = (amount: Amount | undefined) =>
  amount !== undefined && amount.min === amount.max ? amount.min : undefined;

const exactOf = (quantities: ReadonlyArray<Quantity>, measure: Quantity["measure"]) => {
  const quantity = quantities.find((candidate) => candidate.measure === measure);
  return quantity === undefined || quantity.female !== undefined
    ? undefined
    : exact(quantity.amount);
};

/** "Every 90 sec x 6 / 2 snatches": 6 sets of 2. A build-up of written lines: one set per line. */
export const resultDefaults = (
  item: DerivedItem,
  block: DerivedBlock | undefined,
): ResultDefaults => {
  if (item.sets.length > 1)
    return {
      sets: item.sets.length,
      reps: undefined,
      loadKg: undefined,
      rows: item.sets.map((set) => exactOf(set.quantities, "reps")),
    };
  const quantities = item.sets[0]?.quantities ?? [];
  return {
    sets: exactOf(quantities, "sets") ?? exact(block?.params.rounds),
    reps: exactOf(quantities, "reps"),
    loadKg: exactOf(quantities, "load_kg"),
    rows: undefined,
  };
};

const show = (value: number | undefined) => (value === undefined ? "" : String(value));

export const draftFromResult = (
  result: LiftResult | undefined,
  defaults: ResultDefaults,
): ResultDraft => {
  if (result === undefined)
    return {
      mode: undefined,
      sets: show(defaults.sets),
      reps: show(defaults.reps),
      load: show(defaults.loadKg),
      step: "",
      rows: (defaults.rows ?? []).map((reps) => ({ reps: show(reps), load: "" })),
    };
  switch (result._tag) {
    case "fixed":
      return {
        mode: "fixed",
        sets: show(result.sets),
        reps: show(result.reps),
        load: show(result.loadKg),
        step: "",
        rows: [],
      };
    case "ramp":
      return {
        mode: "ramp",
        sets: show(result.sets),
        reps: show(result.reps),
        load: show(result.startKg),
        step: show(result.stepKg),
        rows: [],
      };
    case "each":
      return {
        mode: "each",
        sets: show(result.sets.length),
        reps: show(result.sets[0]?.reps),
        load: show(result.sets[0]?.loadKg),
        step: "",
        rows: result.sets.map((set) => ({ reps: show(set.reps), load: show(set.loadKg) })),
      };
  }
};

/** A typed number, "," as decimal point; `undefined` when blank or not a number. */
export const readNumber = (raw: string): number | undefined => {
  const value = Number(raw.trim().replace(",", "."));
  return raw.trim() === "" || !Number.isFinite(value) ? undefined : value;
};

const readCount = (raw: string) => {
  const value = readNumber(raw);
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
};

const readLoad = (raw: string) => {
  const value = readNumber(raw);
  return value !== undefined && value >= 0 ? value : undefined;
};

/**
 * The result a draft stands for, or `undefined` while a field is blank or not a number. Ranges
 * (reps 1 to 100, loads above 0) are `deriveSession`'s to report.
 */
export const resultFromDraft = (draft: ResultDraft): LiftResult | undefined => {
  if (draft.mode === "each") {
    const sets = draft.rows.map((row) => ({
      reps: readCount(row.reps),
      loadKg: readLoad(row.load),
    }));
    if (sets.length === 0) return undefined;
    if (sets.some((set) => set.reps === undefined || set.loadKg === undefined)) return undefined;
    return { _tag: "each", sets: sets as Array<{ reps: number; loadKg: number }> };
  }
  const sets = readCount(draft.sets);
  const reps = readCount(draft.reps);
  const load = readLoad(draft.load);
  if (draft.mode === undefined || sets === undefined || reps === undefined || load === undefined)
    return undefined;
  if (draft.mode === "fixed") return { _tag: "fixed", sets, reps, loadKg: load };
  const step = readNumber(draft.step);
  return step === undefined ? undefined : { _tag: "ramp", sets, reps, startKg: load, stepKg: step };
};

const blankRows = (draft: ResultDraft): ReadonlyArray<DraftRow> =>
  Array.from({ length: Math.min(readCount(draft.sets) ?? 1, 100) || 1 }, () => ({
    reps: draft.reps,
    load: draft.load,
  }));

/** Moves what is typed over to another mode: a ramp opened set by set lists its loads. */
export const switchMode = (draft: ResultDraft, mode: ResultMode): ResultDraft => {
  if (mode === draft.mode) return draft;
  if (mode === "each") {
    const current = resultFromDraft(draft);
    const rows =
      current !== undefined
        ? performedSets(current).map((set) => ({ reps: show(set.reps), load: show(set.loadKg) }))
        : draft.rows.length > 0
          ? draft.rows
          : blankRows(draft);
    return { ...draft, mode, rows };
  }
  if (draft.mode !== "each" || draft.rows.length === 0) return { ...draft, mode };
  const [first, second] = draft.rows;
  const firstLoad = readLoad(first?.load ?? "");
  const secondLoad = readLoad(second?.load ?? "");
  return {
    ...draft,
    mode,
    sets: String(draft.rows.length),
    reps: first?.reps ?? draft.reps,
    load: first?.load ?? draft.load,
    step:
      mode === "ramp" && firstLoad !== undefined && secondLoad !== undefined
        ? String(Math.round((secondLoad - firstLoad) * 100) / 100)
        : draft.step,
  };
};
