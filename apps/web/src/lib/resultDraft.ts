import {
  resultSets,
  type Amount,
  type DerivedBlock,
  type DerivedItem,
  type LiftResult,
  type Quantity,
} from "@chalk/contracts";

import { readNumber } from "./amount.ts";
import { convertTyped, readKg, showLoad, type LoadUnit } from "./loadUnit.ts";

/**
 * The result form of a programmed movement as typed: strings, so a half-typed "62," survives.
 * A complete draft becomes a `LiftResult` on the movement span; an incomplete one becomes none.
 * A complex ("1 power clean + 2 hang power clean", one bar) is one draft for all its movements:
 * the loads are typed once (in `unit`) and the reps as written, "1 + 2", one per movement.
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
  /** The unit `load`, `step` and the rows' loads are typed in. */
  readonly unit: LoadUnit;
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
  unit: LoadUnit = "kg",
): ResultDraft => {
  const load = (kg: number | undefined) => showLoad(kg, unit);
  if (result === undefined)
    return {
      mode: undefined,
      sets: show(defaults.sets),
      reps: show(defaults.reps),
      load: load(defaults.loadKg),
      step: "",
      rows: (defaults.rows ?? []).map((reps) => ({ reps: show(reps), load: "" })),
      unit,
    };
  switch (result._tag) {
    case "fixed":
      return {
        mode: "fixed",
        sets: show(result.sets),
        reps: show(result.reps),
        load: load(result.loadKg),
        step: "",
        rows: [],
        unit,
      };
    case "ramp":
      return {
        mode: "ramp",
        sets: show(result.sets),
        reps: show(result.reps),
        load: load(result.startKg),
        step: load(result.stepKg),
        rows: [],
        unit,
      };
    case "each":
      return {
        mode: "each",
        sets: show(result.sets.length),
        reps: show(result.sets[0]?.reps),
        load: load(result.sets[0]?.loadKg),
        step: "",
        rows: result.sets.map((set) => ({ reps: show(set.reps), load: load(set.loadKg) })),
        unit,
      };
  }
};

const readCount = (raw: string) => {
  const value = readNumber(raw);
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
};

/**
 * The result a draft stands for, or `undefined` while a field is blank or not a number. Ranges
 * (reps 1 to 100, loads above 0) are `deriveSession`'s to report.
 */
export const resultFromDraft = (draft: ResultDraft): LiftResult | undefined => {
  if (draft.mode === "each") {
    const sets = draft.rows.map((row) => ({
      reps: readCount(row.reps),
      loadKg: readKg(row.load, draft.unit),
    }));
    if (sets.length === 0) return undefined;
    if (sets.some((set) => set.reps === undefined || set.loadKg === undefined)) return undefined;
    return { _tag: "each", sets: sets as Array<{ reps: number; loadKg: number }> };
  }
  const sets = readCount(draft.sets);
  const reps = readCount(draft.reps);
  const load = readKg(draft.load, draft.unit);
  if (draft.mode === undefined || sets === undefined || reps === undefined || load === undefined)
    return undefined;
  if (draft.mode === "fixed") return { _tag: "fixed", sets, reps, loadKg: load };
  const step = readKg(draft.step, draft.unit, true);
  return step === undefined ? undefined : { _tag: "ramp", sets, reps, startKg: load, stepKg: step };
};

/** "1 + 2" into one count per movement; `undefined` unless there is one for each. */
const splitReps = (raw: string, count: number): ReadonlyArray<string> | undefined => {
  const parts = raw.split("+").map((part) => part.trim());
  return parts.length === count ? parts : undefined;
};

/** One count per movement as typed in a complex; blank while any of them is unknown. */
const joinReps = (reps: ReadonlyArray<string>): string =>
  reps.some((value) => value === "") ? "" : reps.join(" + ");

/** The draft of the `index`-th of `count` movements sharing it. */
const memberDraft = (draft: ResultDraft, index: number, count: number): ResultDraft => {
  const repsAt = (raw: string) => splitReps(raw, count)?.[index] ?? "";
  return {
    ...draft,
    reps: repsAt(draft.reps),
    rows: draft.rows.map((row) => ({ ...row, reps: repsAt(row.reps) })),
  };
};

/**
 * One result per movement sharing the draft, in order; each `undefined` while incomplete. Every
 * movement gets the same sets and loads, and its own reps.
 */
export const resultsFromDraft = (
  draft: ResultDraft,
  count: number,
): ReadonlyArray<LiftResult | undefined> =>
  Array.from({ length: count }, (_, index) =>
    draft.mode === undefined ? undefined : resultFromDraft(memberDraft(draft, index, count)),
  );

/**
 * The draft for movements that share their loads: the first one's mode and loads, everyone's
 * reps joined set by set ("1 + 2", or "1 + 1" for a missed rep).
 */
export const draftFromResults = (
  results: ReadonlyArray<LiftResult | undefined>,
  defaults: ReadonlyArray<ResultDefaults>,
  unit: LoadUnit = "kg",
): ResultDraft => {
  const drafts = results.map((result, index) =>
    draftFromResult(result, defaults[index] ?? defaults[0]!, unit),
  );
  const [lead] = drafts;
  if (lead === undefined) return draftFromResult(undefined, defaults[0]!, unit);
  return {
    ...lead,
    reps: joinReps(drafts.map((draft) => draft.reps)),
    rows: lead.rows.map((row, at) => ({
      ...row,
      reps: joinReps(drafts.map((draft) => draft.rows[at]?.reps ?? draft.reps)),
    })),
  };
};

const blankRows = (draft: ResultDraft): ReadonlyArray<DraftRow> =>
  Array.from({ length: Math.min(readCount(draft.sets) ?? 1, 100) || 1 }, () => ({
    reps: draft.reps,
    load: draft.load,
  }));

/**
 * Moves what is typed over to another mode: a ramp opened set by set lists its loads. `count` is
 * how many movements share the draft (a complex).
 */
export const switchMode = (draft: ResultDraft, mode: ResultMode, count = 1): ResultDraft => {
  if (mode === draft.mode) return draft;
  if (mode === "each") {
    const current = resultsFromDraft(draft, count);
    const [lead] = current;
    const rows =
      lead !== undefined && current.every((result) => result !== undefined)
        ? resultSets(lead).map((set, at) => ({
            reps: joinReps(current.map((result) => show(result && resultSets(result)[at]?.reps))),
            load: showLoad(set.loadKg, draft.unit),
          }))
        : draft.rows.length > 0
          ? draft.rows
          : blankRows(draft);
    return { ...draft, mode, rows };
  }
  if (draft.mode !== "each" || draft.rows.length === 0) return { ...draft, mode };
  const [first, second] = draft.rows;
  const firstLoad = readKg(first?.load ?? "", "kg");
  const secondLoad = readKg(second?.load ?? "", "kg");
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

/** The draft typed in another unit: every load and the step, converted. */
export const switchUnit = (draft: ResultDraft, unit: LoadUnit): ResultDraft => {
  const convert = (raw: string, signed = false) => convertTyped(raw, draft.unit, unit, signed);
  return {
    ...draft,
    unit,
    load: convert(draft.load),
    step: convert(draft.step, true),
    rows: draft.rows.map((row) => ({ ...row, load: convert(row.load) })),
  };
};
