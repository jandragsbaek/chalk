import {
  formatAmount,
  LEVELS,
  prescribedLoad,
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
import { describePlan, describeReach, roundTarget } from "../../lib/plan.ts";
import { LevelVerdict } from "./LevelVerdict.tsx";

interface Draft {
  readonly recorded: boolean;
  /** Chosen "as written" on purpose; an empty plan from "Scale it" is no plan yet. */
  readonly asWritten: boolean;
  readonly load: string;
  readonly implements: 1 | 2;
  readonly rows: ReadonlyArray<{ readonly movementId: string; readonly reps: string }>;
  readonly unbroken: string;
  /** Reached each round, "7-8" or "12". */
  readonly perRound: string;
}

export const draftFromPerformance = (performance: Performance | undefined): Draft => ({
  recorded: performance !== undefined,
  asWritten: performance !== undefined && Object.keys(performance).length === 0,
  load: performance?.loadKg === undefined ? "" : String(performance.loadKg),
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
  const loadKg = toNumber(draft.load);
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

/** The family's own variations first, easiest first, then the rest of the catalog. */
const variationOptions = (
  family: LevelFamily | undefined,
  catalog: ReadonlyArray<CatalogMovement>,
) => {
  const own =
    family?.kind === "variant"
      ? [...family.below, ...LEVELS.flatMap((level) => family.rungs[level]?.introduces ?? [])]
      : family === undefined
        ? []
        : catalog
            .filter((movement) => movement.levelFamily === family.id)
            .map((movement) => movement.id);
  const known = own.flatMap((id) => {
    const movement = catalog.find((candidate) => candidate.id === id);
    return movement ? [movement] : [];
  });
  const rest = catalog
    .filter((movement) => !own.includes(movement.id))
    .toSorted((left, right) => left.name.localeCompare(right.name));
  return { known, rest };
};

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
 * How a programmed movement was done: as prescribed, at another load, or rep by variation
 * ("6 kipping, 44 jumping"), with the biggest unbroken set. Graded live against the level sheet.
 * In `plan` mode the same fields say how the athlete means to scale it, before the session; in
 * `done` mode a planned scaling is shown and can be taken over as it was.
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
}) {
  const [draft, setDraft] = useState(() => draftFromPerformance(performance));
  const family = grade?.family;
  const { known, rest } = variationOptions(family, catalog);
  const nameOf = (id: MovementId) => catalog.find((movement) => movement.id === id)?.name;
  const written = prescribedLoad(item.sets);
  const showLoad = family === undefined || family.kind === "load" || written !== undefined;
  const showImplements = family?.group === "kb_db";
  const planning = mode === "plan";
  const target = roundTarget(item);
  const perRound = parseAmount(draft.perRound);
  const reach = perRound === undefined ? undefined : describeReach(perRound, target);
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => edit({ ...draftFromPerformance(undefined) })}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {planned !== undefined && !planning ? (
        <p data-plan-box className="flex items-baseline gap-2 px-2.5 py-1.5 text-sm">
          <span className="form-label shrink-0 text-muted-foreground">Planned</span>
          <span className="min-w-0">{describePlan(planned, nameOf, item)}</span>
        </p>
      ) : null}

      {draft.recorded ? null : (
        <>
          <p className="text-sm text-muted-foreground">
            {planning
              ? "Say how you mean to scale it; the plan is graded against the level sheet."
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
                  setDraft(draftFromPerformance(planned));
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
        </>
      )}

      {draft.recorded ? (
        <>
          {showLoad ? (
            <div className={showImplements ? "grid grid-cols-2 items-end gap-2" : "grid gap-2"}>
              <Field
                label={planning ? "Planned load, kg" : "Load used, kg"}
                value={draft.load}
                placeholder={written === undefined ? "" : `${written} as written`}
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

          {planning ? null : (
            <Field
              label="Biggest unbroken set (hardest variation)"
              value={draft.unbroken}
              onChange={(unbroken) => edit({ ...draft, unbroken })}
            />
          )}

          {grade ? (
            <LevelVerdict grade={grade} nameOf={nameOf} side={planning ? "planned" : "done"} />
          ) : null}
        </>
      ) : null}

      {grade === undefined ? (
        <p className="text-xs text-muted-foreground">
          This movement is on no row of the level sheet. Set its row under Levels to grade it.
        </p>
      ) : null}
    </div>
  );
}
