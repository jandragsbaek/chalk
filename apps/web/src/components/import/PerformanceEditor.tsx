import {
  formatAmount,
  LEVELS,
  prescribedLoad,
  prescribedReps,
  scalingOptions,
  type CatalogMovement,
  type DerivedItem,
  type ItemGrade,
  type LevelFamily,
  type Amount,
  type MovementId,
  type Performance,
  type Sex,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, NativeSelect } from "@chalk/ui/components/field.tsx";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { parseAmount, toNumber } from "../../lib/amount.ts";
import { MEASURE_LABELS } from "../../lib/blockLabels.ts";
import { convertTyped, readKg, showLoad, type LoadUnit } from "../../lib/loadUnit.ts";
import { describePlan, describeReach, roundTarget, roundUnit } from "../../lib/plan.ts";
import { onAim, roundsOnAim, spanOfRounds } from "../../lib/rounds.ts";
import { useAthleteSex } from "../../lib/profile.ts";
import { LevelVerdict } from "./LevelVerdict.tsx";
import { LoadUnitToggle, useLoadUnit } from "./LoadUnitToggle.tsx";

interface Draft {
  readonly recorded: boolean;
  /** Chosen "as written" on purpose; an empty plan from "Scale it" is no plan yet. */
  readonly asWritten: boolean;
  /** Typed in `unit`. */
  readonly load: string;
  /** The load each round, typed in `unit` in order: "20, 25, 30, 35". */
  readonly roundLoads: string;
  readonly unit: LoadUnit;
  readonly implements: 1 | 2;
  readonly rows: ReadonlyArray<{ readonly movementId: string; readonly reps: string }>;
  readonly unbroken: string;
  /** Reached each round, "7-8" or "12". */
  readonly perRound: string;
  /** Reached in each round in order, as typed; counts once every round is in. */
  readonly rounds: ReadonlyArray<string>;
}

export const draftFromPerformance = (
  performance: Performance | undefined,
  unit: LoadUnit = "kg",
): Draft => ({
  recorded: performance !== undefined,
  asWritten: performance !== undefined && Object.keys(performance).length === 0,
  load: showLoad(performance?.loadKg, unit),
  roundLoads: (performance?.roundLoadsKg ?? []).map((kg) => showLoad(kg, unit)).join(", "),
  unit,
  implements: performance?.implements ?? 1,
  rows: (performance?.variants ?? []).map((entry) => ({
    movementId: entry.movementId,
    reps: String(entry.reps),
  })),
  unbroken: performance?.unbroken === undefined ? "" : String(performance.unbroken),
  perRound: performance?.perRound === undefined ? "" : formatAmount(performance.perRound),
  rounds: (performance?.rounds ?? []).map(String),
});

/** Every load of "20, 25, 30, 35" (or "20/25/30/35"), or `undefined` while one is not a load. */
const typedRoundLoads = (raw: string, unit: LoadUnit): ReadonlyArray<number> | undefined => {
  const typed = raw.split(/[\s,;/]+/).filter((part) => part !== "");
  if (typed.length === 0) return undefined;
  const loads = typed.map((part) => readKg(part, unit));
  return loads.every((kg): kg is number => kg !== undefined) ? loads : undefined;
};

/** Every round typed as a whole count, or `undefined` while one is blank or not a count. */
const countedRounds = (rounds: ReadonlyArray<string>): ReadonlyArray<number> | undefined => {
  if (rounds.length === 0) return undefined;
  const counts = rounds.map((raw) => toNumber(raw));
  return counts.every(
    (count): count is number => count !== undefined && Number.isInteger(count) && count >= 0,
  )
    ? counts
    : undefined;
};

/**
 * The draft as a performance: blank fields are left out, half-filled variation rows too. While
 * planning, an empty draft counts only when it was chosen as written.
 */
export const performanceFromDraft = (draft: Draft, planning = false): Performance | undefined => {
  if (!draft.recorded) return undefined;
  // A load each round stands in for one load.
  const roundLoadsKg = typedRoundLoads(draft.roundLoads, draft.unit);
  const loadKg = roundLoadsKg === undefined ? readKg(draft.load, draft.unit) : undefined;
  const unbroken = toNumber(draft.unbroken);
  const rounds = countedRounds(draft.rounds);
  // Round by round, the range each round is what the rounds span.
  const perRound = rounds === undefined ? parseAmount(draft.perRound) : spanOfRounds(rounds);
  const variants = draft.rows.flatMap((row) => {
    const reps = toNumber(row.reps);
    return row.movementId === "" || reps === undefined || !Number.isInteger(reps)
      ? []
      : [{ movementId: row.movementId as MovementId, reps }];
  });
  const performance: Performance = {
    ...(loadKg === undefined ? {} : { loadKg }),
    ...(roundLoadsKg === undefined ? {} : { roundLoadsKg }),
    ...(draft.implements === 2 ? { implements: 2 as const } : {}),
    ...(variants.length === 0 ? {} : { variants }),
    ...(unbroken === undefined || !Number.isInteger(unbroken) ? {} : { unbroken }),
    ...(perRound === undefined ? {} : { perRound }),
    ...(rounds === undefined ? {} : { rounds }),
  };
  return planning && !draft.asWritten && Object.keys(performance).length === 0
    ? undefined
    : performance;
};

/**
 * The family's own variations first, easiest first, and the movement's scalings, then the rest
 * of the catalog.
 */
const variationOptions = (
  family: LevelFamily | undefined,
  scalings: ReadonlyArray<CatalogMovement>,
  catalog: ReadonlyArray<CatalogMovement>,
) => {
  const fromFamily =
    family?.kind === "variant"
      ? [...family.below, ...LEVELS.flatMap((level) => family.rungs[level]?.introduces ?? [])]
      : family === undefined
        ? []
        : catalog
            .filter((movement) => movement.levelFamily === family.id)
            .map((movement) => movement.id);
  const own = [...new Set([...fromFamily, ...scalings.map((movement) => movement.id)])];
  const known = own.flatMap((id) => {
    const movement = catalog.find((candidate) => candidate.id === id);
    return movement ? [movement] : [];
  });
  const rest = catalog
    .filter((movement) => !own.includes(movement.id))
    .toSorted((left, right) => left.name.localeCompare(right.name));
  return { known, rest };
};

/**
 * One click to the usual scaling: every rep done as the picked movement (ring rows for
 * pull-ups). Pressed while the reps are all that movement.
 */
function ScaleTo({
  options,
  rows,
  onPick,
}: {
  readonly options: ReadonlyArray<CatalogMovement>;
  readonly rows: Draft["rows"] | undefined;
  readonly onPick: (movementId: MovementId) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="grid gap-1">
      <span className="form-label text-muted-foreground">Scale to</span>
      <div role="group" aria-label="Scale to" className="flex flex-wrap gap-1">
        {options.map((option) => {
          const on = rows?.length === 1 && rows[0]?.movementId === option.id;
          return (
            <Button
              key={option.id}
              size="sm"
              variant={on ? "default" : "outline"}
              aria-pressed={on}
              onClick={() => onPick(option.id)}
            >
              {option.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The board's loads each round, one line per level ("Level 3: M: 20/25/30/35 - W: …"), on the
 * athlete's side.
 */
const roundLoadLines = (item: DerivedItem, sex: Sex) =>
  item.sets.flatMap((set) => {
    const load = set.quantities.find(
      (quantity) => quantity.measure === "load_kg" && quantity.scheme !== undefined,
    );
    if (load?.scheme === undefined) return [];
    const loads = sex === "f" && load.femaleScheme !== undefined ? load.femaleScheme : load.scheme;
    return [{ line: set.line, label: set.label ?? `L${set.line + 1}`, loads }];
  });

/** One press to a level's loads each round. Pressed while those are the loads typed. */
function RoundLoadPicker({
  lines,
  typed,
  unit,
  planning,
  onPick,
}: {
  readonly lines: ReturnType<typeof roundLoadLines>;
  readonly typed: string;
  readonly unit: LoadUnit;
  readonly planning: boolean;
  readonly onPick: (loads: ReadonlyArray<number>) => void;
}) {
  if (lines.length === 0) return null;
  const shown = (loads: ReadonlyArray<number>) => loads.map((kg) => showLoad(kg, unit)).join(", ");
  const current = typedRoundLoads(typed, unit);
  const label = planning ? "Plan at" : "Done at";
  return (
    <div className="grid gap-1">
      <span className="form-label text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {lines.map((line) => {
          const on = current !== undefined && shown(current) === shown(line.loads);
          return (
            <Button
              key={line.line}
              size="sm"
              variant={on ? "default" : "outline"}
              aria-pressed={on}
              onClick={() => onPick(line.loads)}
            >
              {line.label}
              <span className="font-normal tabular-nums opacity-70">
                {line.loads.map((kg) => showLoad(kg, unit)).join("-")}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="form-label text-muted-foreground">{label}</span>
      <Input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/**
 * An EMOM station round by round: what was reached each time it came up, against the athlete's
 * own aim ("7-8"), each round marked on aim or short of it. The aim is the plan's count each
 * round, so a plan made beforehand fills it.
 */
function RoundByRound({
  count,
  rounds,
  unit,
  aim,
  onAim: setAim,
  onChange,
}: {
  readonly count: number;
  readonly rounds: ReadonlyArray<string>;
  readonly unit: string | undefined;
  readonly aim: Amount | undefined;
  readonly onAim: ((aim: Amount | undefined) => void) | undefined;
  readonly onChange: (rounds: ReadonlyArray<string>) => void;
}) {
  const [aimTyped, setAimTyped] = useState(() => (aim === undefined ? "" : formatAmount(aim)));
  const shown = Array.from({ length: count }, (_, at) => rounds[at] ?? "");
  const counts = shown.map((raw) => {
    const value = toNumber(raw);
    return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
  });
  const done = counts.filter((value): value is number => value !== undefined);
  const complete = done.length === shown.length;
  const first = done[0];
  const setRound = (index: number, value: string) =>
    onChange(shown.map((raw, at) => (at === index ? value : raw)));
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="form-label text-muted-foreground">
          Round by round{unit === undefined ? "" : `, ${unit}`}
        </span>
        {aim !== undefined && done.length > 0 ? (
          <span className="text-sm font-semibold tabular-nums">
            {roundsOnAim(done, aim)} of {done.length} on aim
          </span>
        ) : null}
      </div>
      {setAim === undefined ? null : (
        <label className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
          <span className="text-sm text-muted-foreground">Your aim each round</span>
          <Input
            inputMode="decimal"
            aria-label="Aim each round"
            placeholder="7-8"
            value={aimTyped}
            onChange={(event) => {
              setAimTyped(event.target.value);
              const next = parseAmount(event.target.value);
              if (event.target.value.trim() === "" || next !== undefined) setAim(next);
            }}
          />
        </label>
      )}
      <ol className="grid grid-cols-4 gap-1.5">
        {shown.map((raw, index) => {
          const value = counts[index];
          const mark = aim === undefined || value === undefined ? undefined : onAim(value, aim);
          return (
            <li
              // oxlint-disable-next-line react/no-array-index-key -- a cell is its round; inputs are controlled
              key={index}
              className="grid gap-0.5"
            >
              <Input
                inputMode="numeric"
                aria-label={`Round ${index + 1}`}
                placeholder={`R${index + 1}`}
                value={raw}
                onChange={(event) => setRound(index, event.target.value)}
              />
              <span
                data-round-mark={mark === undefined ? undefined : mark ? "hit" : "miss"}
                className="form-label h-4 px-1 tabular-nums"
              >
                {mark === undefined ? "" : mark ? "On aim" : "Short"}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {complete
            ? `${done.length} rounds, ${done.reduce((total, value) => total + value, 0)}${unit === undefined ? "" : ` ${unit}`} in all.`
            : done.length === 0
              ? "What you reached each time it came round."
              : "Fill every round to count it."}
        </p>
        {first !== undefined && !complete ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(shown.map((raw) => (raw.trim() === "" ? String(first) : raw)))}
          >
            Fill the rest with {first}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * How a programmed movement was done (or, in `plan` mode, will be scaled): as prescribed, at
 * another load, or reps by variation, with the biggest unbroken set; graded live. Logging a plan
 * shows it and can take it over. A complex asks only the bar's load, graded for every movement.
 */
export function PerformanceEditor({
  performance,
  item,
  grade,
  catalog,
  onChange,
  mode = "done",
  planned,
  onAsPlanned,
  complexGrades,
  roundCount,
  loadRounds,
  onAim: setAim,
}: {
  readonly performance: Performance | undefined;
  readonly item: DerivedItem;
  readonly grade: ItemGrade | undefined;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly onChange: (performance: Performance | undefined) => void;
  readonly mode?: "done" | "plan";
  /** The scaling planned for it, when logging a planned session. */
  readonly planned?: Performance | undefined;
  /** Takes the plan as done; the workbench may fill the lift result from it too. */
  readonly onAsPlanned?: (() => void) | undefined;
  /** A complex: the grade of each of its movements, which share this load. */
  readonly complexGrades?: ReadonlyArray<ItemGrade | undefined> | undefined;
  /** An EMOM station: the rounds it came up in, logged one by one. */
  readonly roundCount?: number | undefined;
  /** In a block scored as a whole with more than one round: a load can rise round by round. */
  readonly loadRounds?: number | undefined;
  /** Sets the athlete's own aim each round, kept as the plan's count each round. */
  readonly onAim?: ((aim: Amount | undefined) => void) | undefined;
}) {
  const sex = useAthleteSex();
  const { unit } = useLoadUnit();
  const [typed, setDraft] = useState(() => draftFromPerformance(performance, unit));
  // Flipping the unit converts the typed load; the performance stays the same.
  const draft =
    typed.unit === unit
      ? typed
      : {
          ...typed,
          unit,
          load: convertTyped(typed.load, typed.unit, unit),
          roundLoads: typed.roundLoads
            .split(/\s*,\s*/)
            .map((part) => convertTyped(part, typed.unit, unit))
            .join(", "),
        };
  const family = grade?.family;
  const nameOf = (id: MovementId) => catalog.find((movement) => movement.id === id)?.name;
  const written = prescribedLoad(item.sets, sex);
  const asksLoad = family === undefined || family.kind === "load" || written !== undefined;
  const levelLoads = asksLoad && !(complexGrades !== undefined) ? roundLoadLines(item, sex) : [];
  const asksRoundLoads = asksLoad && (levelLoads.length > 0 || (loadRounds ?? 0) > 1);
  const pickRoundLoads = (loads: ReadonlyArray<number>) =>
    edit({
      ...draft,
      recorded: true,
      asWritten: false,
      load: "",
      roundLoads: loads.map((kg) => showLoad(kg, unit)).join(", "),
    });
  const showImplements = family?.group === "kb_db";
  const planning = mode === "plan";
  // Nothing said, but the block is scored: it counts as planned, or as prescribed, until the
  // athlete says otherwise. That choice shows open (dashed), so one press makes it theirs.
  const assumed = !planning && !draft.recorded && item.assumed === true;
  const logPlanned = planned !== undefined && !planning;
  const target = roundTarget(item);
  const perRound = parseAmount(draft.perRound);
  const reach = perRound === undefined ? undefined : describeReach(perRound, target, sex);
  const complex = complexGrades !== undefined;
  const byRound = !planning && !complex && target !== undefined && roundCount !== undefined;
  // One verdict per level-sheet row: a power clean and a hang power clean grade on the same one.
  const verdicts = complex
    ? complexGrades.filter(
        (entry, at): entry is ItemGrade =>
          entry !== undefined &&
          complexGrades.findIndex((other) => other?.family.id === entry.family.id) === at,
      )
    : grade === undefined
      ? []
      : [grade];
  const scalings =
    complex || item.movementId === undefined ? [] : scalingOptions(item.movementId, catalog);
  // Every prescribed rep, or one for an item counted in metres or calories: a blank count would
  // drop the row and read as done as prescribed.
  const { known, rest } = variationOptions(family, scalings, catalog);
  const allReps = String(Math.max(1, Math.round(prescribedReps(item.sets))));
  const scaleTo = (movementId: MovementId) =>
    edit({ ...draft, recorded: true, asWritten: false, rows: [{ movementId, reps: allReps }] });
  const scaleRows = () =>
    family?.kind === "variant" && item.movementId !== undefined
      ? [{ movementId: item.movementId, reps: "" }]
      : draft.rows;

  function edit(next: Draft) {
    setDraft(next);
    const nextPerformance = performanceFromDraft(next, planning);
    if (JSON.stringify(nextPerformance) !== JSON.stringify(performance)) onChange(nextPerformance);
  }

  const setRow = (index: number, key: "movementId" | "reps", value: string) =>
    edit({
      ...draft,
      rows: draft.rows.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
    });

  return (
    <div className="grid gap-3 border-t pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="form-label text-muted-foreground">{planning ? "Plan" : "Done as"}</span>
        {draft.recorded ? (
          <span className="flex items-center gap-2">
            {asksLoad ? <LoadUnitToggle /> : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => edit(draftFromPerformance(undefined, unit))}
            >
              Clear
            </Button>
          </span>
        ) : null}
      </div>

      {planned !== undefined && !planning ? (
        <p data-plan-box className="flex items-baseline gap-2 px-2.5 py-1.5 text-sm">
          <span className="form-label shrink-0 text-muted-foreground">Planned</span>
          <span className="min-w-0">{describePlan(planned, nameOf, sex, item)}</span>
        </p>
      ) : null}

      {byRound ? (
        <RoundByRound
          key={item.spanId}
          count={roundCount}
          rounds={draft.rounds}
          unit={roundUnit(item)}
          aim={planned?.perRound}
          onAim={setAim}
          onChange={(rounds) =>
            // A count typed per round replaces a range typed for every round.
            edit({ ...draft, recorded: true, perRound: "", rounds })
          }
        />
      ) : null}

      {draft.recorded ? null : (
        <>
          <p className="text-sm text-muted-foreground">
            {planning
              ? "Say how you mean to scale it; the plan is graded against the level sheet."
              : assumed
                ? `The block is scored, so ${complex ? "they count" : "it counts"} as ${logPlanned ? "planned" : "prescribed"}. ${logPlanned ? "Did it another way" : "Scaled it"}? Say how.`
                : complex
                  ? "Say how it went, and the movements are graded against the level sheet."
                  : "Say how it went, and the movement is graded against the level sheet."}
          </p>
          <div className={logPlanned ? "grid grid-cols-3 gap-1" : "grid grid-cols-2 gap-1"}>
            {logPlanned ? (
              <Button
                size="sm"
                variant={assumed ? "outline" : "default"}
                data-assumed={assumed ? "" : undefined}
                aria-keyshortcuts="p"
                onClick={() => {
                  setDraft(draftFromPerformance(planned, unit));
                  if (onAsPlanned) onAsPlanned();
                  else onChange(planned);
                }}
              >
                As planned
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={logPlanned || assumed ? "outline" : "default"}
              data-assumed={assumed && !logPlanned ? "" : undefined}
              onClick={() => edit({ ...draft, recorded: true, asWritten: true })}
            >
              {planning ? "As written" : "As prescribed"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                edit({ ...draft, recorded: true, asWritten: false, rows: scaleRows() })
              }
            >
              {planning ? "Scale it" : "Scaled it"}
            </Button>
          </div>
          <RoundLoadPicker
            lines={levelLoads}
            typed={draft.roundLoads}
            unit={unit}
            planning={planning}
            onPick={pickRoundLoads}
          />
          <ScaleTo options={scalings} rows={undefined} onPick={scaleTo} />
          {assumed
            ? verdicts.map((verdict) => (
                <LevelVerdict key={verdict.family.id} grade={verdict} nameOf={nameOf} assumed />
              ))
            : null}
        </>
      )}

      {draft.recorded ? (
        <>
          {asksRoundLoads ? (
            <>
              <RoundLoadPicker
                lines={levelLoads}
                typed={draft.roundLoads}
                unit={unit}
                planning={planning}
                onPick={pickRoundLoads}
              />
              <Field
                label={`${planning ? "Planned load" : "Load"} each round, ${unit}`}
                value={draft.roundLoads}
                placeholder={levelLoads[0]?.loads.map((kg) => showLoad(kg, unit)).join(", ") ?? ""}
                onChange={(roundLoads) => edit({ ...draft, roundLoads })}
              />
            </>
          ) : null}
          {asksLoad && draft.roundLoads.trim() === "" ? (
            <div className={showImplements ? "grid grid-cols-2 items-end gap-2" : "grid gap-2"}>
              <Field
                label={planning ? `Planned load, ${unit}` : `Load used, ${unit}`}
                value={draft.load}
                placeholder={written === undefined ? "" : `${showLoad(written, unit)} as written`}
                onChange={(load) => edit({ ...draft, load })}
              />
              {showImplements ? (
                <div role="radiogroup" aria-label="Implements" className="grid grid-cols-2 gap-1">
                  {([1, 2] as const).map((count) => (
                    <Button
                      key={count}
                      role="radio"
                      aria-checked={draft.implements === count}
                      variant={draft.implements === count ? "default" : "outline"}
                      onClick={() => edit({ ...draft, implements: count })}
                    >
                      {count === 1 ? "Single" : "Dual"}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <ScaleTo options={scalings} rows={draft.rows} onPick={scaleTo} />

          {complex ? null : (
            <div className="grid gap-1">
              <span className="form-label text-muted-foreground">Reps by variation</span>
              {draft.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {planning ? "All reps as written until you split them." : "All reps as written."}
                </p>
              ) : (
                <ol className="grid gap-1">
                  {draft.rows.map((row, index) => (
                    <li
                      // oxlint-disable-next-line react/no-array-index-key -- a row is its position; inputs are controlled
                      key={index}
                      className="grid grid-cols-[minmax(0,1fr)_4.5rem_2rem] items-center gap-2"
                    >
                      <NativeSelect
                        aria-label={`Variation ${index + 1}`}
                        value={row.movementId}
                        onChange={(event) => setRow(index, "movementId", event.target.value)}
                      >
                        <option value="">Pick a variation</option>
                        {known.length > 0 ? (
                          <optgroup label={family?.name ?? "This movement"}>
                            {known.map((movement) => (
                              <option key={movement.id} value={movement.id}>
                                {movement.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        <optgroup label="Other movements">
                          {rest.map((movement) => (
                            <option key={movement.id} value={movement.id}>
                              {movement.name}
                            </option>
                          ))}
                        </optgroup>
                      </NativeSelect>
                      <Input
                        inputMode="numeric"
                        aria-label={`Variation ${index + 1} reps`}
                        placeholder="reps"
                        value={row.reps}
                        onChange={(event) => setRow(index, "reps", event.target.value)}
                      />
                      <Button
                        variant="ghost-destructive"
                        size="icon"
                        aria-label={`Remove variation ${index + 1}`}
                        onClick={() =>
                          edit({ ...draft, rows: draft.rows.filter((_, at) => at !== index) })
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  edit({
                    ...draft,
                    rows: [
                      ...draft.rows,
                      {
                        movementId:
                          draft.rows.length === 0 && item.movementId !== undefined
                            ? item.movementId
                            : "",
                        reps: "",
                      },
                    ],
                  })
                }
              >
                <Plus />
                Add variation
              </Button>
            </div>
          )}

          {target === undefined || byRound ? null : (
            <div className="grid gap-1">
              <Field
                label={`${planning ? "Aim each round" : "Each round"}, ${MEASURE_LABELS[target.measure].toLowerCase()}`}
                value={draft.perRound}
                placeholder="7-8 or 12"
                onChange={(next) => edit({ ...draft, perRound: next })}
              />
              {reach === undefined ? null : (
                <p className="text-xs text-muted-foreground">
                  {perRound === undefined ? "" : `${formatAmount(perRound)} each round: `}
                  {reach}
                </p>
              )}
            </div>
          )}

          {planning || complex ? null : (
            <Field
              label="Biggest unbroken set (hardest variation)"
              value={draft.unbroken}
              onChange={(unbroken) => edit({ ...draft, unbroken })}
            />
          )}

          {verdicts.map((verdict) => (
            <LevelVerdict
              key={verdict.family.id}
              grade={verdict}
              nameOf={nameOf}
              side={planning ? "planned" : "done"}
            />
          ))}
        </>
      ) : null}

      {verdicts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {complex
            ? "These movements are on no row of the level sheet. Set their row under Levels to grade them."
            : "This movement is on no row of the level sheet. Set its row under Levels to grade it."}
        </p>
      ) : null}
    </div>
  );
}
