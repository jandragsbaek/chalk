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
  type MovementId,
  type Performance,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, NativeSelect } from "@chalk/ui/components/field.tsx";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { parseAmount, toNumber } from "../../lib/amount.ts";
import { MEASURE_LABELS } from "../../lib/blockLabels.ts";
import { convertTyped, readKg, showLoad, type LoadUnit } from "../../lib/loadUnit.ts";
import { describePlan, describeReach, roundTarget } from "../../lib/plan.ts";
import { useAthleteSex } from "../../lib/profile.ts";
import { LevelVerdict } from "./LevelVerdict.tsx";
import { LoadUnitToggle, useLoadUnit } from "./LoadUnitToggle.tsx";

interface Draft {
  readonly recorded: boolean;
  /** Chosen "as written" on purpose; an empty plan from "Scale it" is no plan yet. */
  readonly asWritten: boolean;
  /** Typed in `unit`. */
  readonly load: string;
  readonly unit: LoadUnit;
  readonly implements: 1 | 2;
  readonly rows: ReadonlyArray<{ readonly movementId: string; readonly reps: string }>;
  readonly unbroken: string;
  /** Reached each round, "7-8" or "12". */
  readonly perRound: string;
}

export const draftFromPerformance = (
  performance: Performance | undefined,
  unit: LoadUnit = "kg",
): Draft => ({
  recorded: performance !== undefined,
  asWritten: performance !== undefined && Object.keys(performance).length === 0,
  load: showLoad(performance?.loadKg, unit),
  unit,
  implements: performance?.implements ?? 1,
  rows: (performance?.variants ?? []).map((entry) => ({
    movementId: entry.movementId,
    reps: String(entry.reps),
  })),
  unbroken: performance?.unbroken === undefined ? "" : String(performance.unbroken),
  perRound: performance?.perRound === undefined ? "" : formatAmount(performance.perRound),
});

/**
 * The draft as a performance: blank fields are left out, half-filled variation rows too. While
 * planning, an empty draft counts only when it was chosen as written.
 */
export const performanceFromDraft = (draft: Draft, planning = false): Performance | undefined => {
  if (!draft.recorded) return undefined;
  const loadKg = readKg(draft.load, draft.unit);
  const unbroken = toNumber(draft.unbroken);
  const perRound = parseAmount(draft.perRound);
  const variants = draft.rows.flatMap((row) => {
    const reps = toNumber(row.reps);
    return row.movementId === "" || reps === undefined || !Number.isInteger(reps)
      ? []
      : [{ movementId: row.movementId as MovementId, reps }];
  });
  const performance: Performance = {
    ...(loadKg === undefined ? {} : { loadKg }),
    ...(draft.implements === 2 ? { implements: 2 as const } : {}),
    ...(variants.length === 0 ? {} : { variants }),
    ...(unbroken === undefined || !Number.isInteger(unbroken) ? {} : { unbroken }),
    ...(perRound === undefined ? {} : { perRound }),
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
}) {
  const sex = useAthleteSex();
  const { unit } = useLoadUnit();
  const [typed, setDraft] = useState(() => draftFromPerformance(performance, unit));
  // Flipping the unit converts the typed load; the performance stays the same.
  const draft =
    typed.unit === unit
      ? typed
      : { ...typed, unit, load: convertTyped(typed.load, typed.unit, unit) };
  const family = grade?.family;
  const nameOf = (id: MovementId) => catalog.find((movement) => movement.id === id)?.name;
  const written = prescribedLoad(item.sets, sex);
  const asksLoad = family === undefined || family.kind === "load" || written !== undefined;
  const showImplements = family?.group === "kb_db";
  const planning = mode === "plan";
  const target = roundTarget(item);
  const perRound = parseAmount(draft.perRound);
  const reach = perRound === undefined ? undefined : describeReach(perRound, target, sex);
  const complex = complexGrades !== undefined;
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

      {draft.recorded ? null : (
        <>
          <p className="text-sm text-muted-foreground">
            {planning
              ? "Say how you mean to scale it; the plan is graded against the level sheet."
              : complex
                ? "Say how it went, and the movements are graded against the level sheet."
                : "Say how it went, and the movement is graded against the level sheet."}
          </p>
          <div
            className={
              planned !== undefined && !planning
                ? "grid grid-cols-3 gap-1"
                : "grid grid-cols-2 gap-1"
            }
          >
            {planned !== undefined && !planning ? (
              <Button
                size="sm"
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
              variant={planned !== undefined && !planning ? "outline" : "default"}
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
          <ScaleTo options={scalings} rows={undefined} onPick={scaleTo} />
        </>
      )}

      {draft.recorded ? (
        <>
          {asksLoad ? (
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

          {target === undefined ? null : (
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
