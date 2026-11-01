import { formatPerformed, tonnageOf, type DerivedItem, type LiftResult } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { formatKg } from "../../lib/blockLabels.ts";
import { formatComplex } from "../../lib/complexes.ts";
import {
  draftFromResults,
  resultsFromDraft,
  switchMode,
  type ResultDefaults,
  type ResultDraft,
  type ResultMode,
} from "../../lib/resultDraft.ts";

/** "1 + 1" for a 1 + 2 complex: the last rep of the last movement missed. */
const missedExample = (defaults: ReadonlyArray<ResultDefaults>) => {
  const reps = defaults.map((entry) => entry.reps ?? 1);
  const last = reps.length - 1;
  return reps.map((value, at) => (at === last ? Math.max(0, value - 1) : value)).join(" + ");
};

const MODES: ReadonlyArray<{ readonly mode: ResultMode; readonly label: string }> = [
  { mode: "fixed", label: "Fixed" },
  { mode: "ramp", label: "Ramp" },
  { mode: "each", label: "Each set" },
];

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string | undefined;
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
 * What was lifted for a programmed movement: every set at one load, a ramp by a fixed step, or
 * set by set. A complete form is the movement's result; the protocol and the total follow it.
 * For a complex (one bar, several movements) the loads are typed once and the reps as written,
 * "1 + 2"; a missed rep is what was made, "1 + 1". Every movement keeps its own result.
 */
export function ResultEditor({
  results,
  items,
  defaults,
  onChange,
}: {
  /** One per movement sharing the form, in order: a single movement, or a complex. */
  readonly results: ReadonlyArray<LiftResult | undefined>;
  /** The derived items, for what will be saved (empty when a result has a problem). */
  readonly items: ReadonlyArray<DerivedItem>;
  readonly defaults: ReadonlyArray<ResultDefaults>;
  readonly onChange: (results: ReadonlyArray<LiftResult | undefined>) => void;
}) {
  const count = results.length;
  const complex = count > 1;
  const [draft, setDraft] = useState(() => draftFromResults(results, defaults));

  function edit(next: ResultDraft) {
    setDraft(next);
    const nextResults = resultsFromDraft(next, count);
    if (JSON.stringify(nextResults) !== JSON.stringify(results)) onChange(nextResults);
  }

  const setRow = (index: number, key: "reps" | "load", value: string) =>
    edit({
      ...draft,
      rows: draft.rows.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
    });

  const complete =
    draft.mode !== undefined &&
    resultsFromDraft(draft, count).every((result) => result !== undefined);
  const performed = items.flatMap((item) => item.performed);
  const lifted = items.every((item) => item.performed.length > 0);
  // "1 + 2": the board's reps per movement, as the form wants them typed.
  const repsHint =
    complex && defaults.every((entry) => entry.reps !== undefined)
      ? defaults.map((entry) => entry.reps).join(" + ")
      : undefined;

  return (
    <div className="grid gap-3 border-t pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="form-label text-muted-foreground">Result</span>
        {draft.mode !== undefined ? (
          <Button variant="ghost" size="sm" onClick={() => edit({ ...draft, mode: undefined })}>
            Clear
          </Button>
        ) : null}
      </div>
      <div role="radiogroup" aria-label="How the load moved" className="grid grid-cols-3 gap-1">
        {MODES.map(({ mode, label }) => (
          <Button
            key={mode}
            role="radio"
            aria-checked={draft.mode === mode}
            variant={draft.mode === mode ? "default" : "outline"}
            size="sm"
            onClick={() => edit(switchMode(draft, mode, count))}
          >
            {label}
          </Button>
        ))}
      </div>

      {draft.mode === undefined ? (
        <p className="text-sm text-muted-foreground">
          {complex
            ? "One bar: the loads are typed once for every movement. Did the sets at one load, ramped by a step, or set by set?"
            : "Did the sets at one load, ramped by a step, or set by set? The sets become lift sets and count toward the session's total."}
        </p>
      ) : null}

      {draft.mode === "fixed" ? (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets" value={draft.sets} onChange={(sets) => edit({ ...draft, sets })} />
          <Field
            label="Reps"
            value={draft.reps}
            placeholder={repsHint}
            onChange={(reps) => edit({ ...draft, reps })}
          />
          <Field label="Load kg" value={draft.load} onChange={(load) => edit({ ...draft, load })} />
        </div>
      ) : null}

      {draft.mode === "ramp" ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sets" value={draft.sets} onChange={(sets) => edit({ ...draft, sets })} />
          <Field
            label="Reps"
            value={draft.reps}
            placeholder={repsHint}
            onChange={(reps) => edit({ ...draft, reps })}
          />
          <Field
            label="First set kg"
            value={draft.load}
            onChange={(load) => edit({ ...draft, load })}
          />
          <Field
            label="Step kg"
            value={draft.step}
            placeholder="2.5"
            onChange={(step) => edit({ ...draft, step })}
          />
        </div>
      ) : null}

      {draft.mode === "each" ? (
        <div className="grid gap-1">
          <div
            aria-hidden
            className="form-label grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 text-muted-foreground"
          >
            <span>Set</span>
            <span>Reps</span>
            <span>Load kg</span>
          </div>
          <ol className="grid gap-1">
            {draft.rows.map((row, index) => (
              <li
                // oxlint-disable-next-line react/no-array-index-key -- a row is its set number; inputs are controlled
                key={index}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
              >
                <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                <Input
                  inputMode={complex ? "text" : "numeric"}
                  aria-label={`Set ${index + 1} reps`}
                  placeholder={repsHint}
                  value={row.reps}
                  onChange={(event) => setRow(index, "reps", event.target.value)}
                />
                <Input
                  inputMode="decimal"
                  aria-label={`Set ${index + 1} load in kg`}
                  value={row.load}
                  onChange={(event) => setRow(index, "load", event.target.value)}
                />
                <Button
                  variant="ghost-destructive"
                  size="icon"
                  aria-label={`Remove set ${index + 1}`}
                  onClick={() =>
                    edit({ ...draft, rows: draft.rows.filter((_, at) => at !== index) })
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              edit({
                ...draft,
                rows: [...draft.rows, draft.rows.at(-1) ?? { reps: draft.reps, load: "" }],
              })
            }
          >
            <Plus />
            Add set
          </Button>
          <p className="text-xs text-muted-foreground">
            {complex
              ? `Missed a rep? Type what you made: ${missedExample(defaults)}. A set missed outright is ${defaults.map(() => 0).join(" + ")}.`
              : "A set you missed is 0 reps at its load."}
          </p>
        </div>
      ) : null}

      {draft.mode === undefined ? null : lifted ? (
        <div data-result-box className="grid gap-0.5 bg-background px-2.5 py-1.5">
          <span className="text-sm tabular-nums">
            {complex ? formatComplex(items.map((item) => item.listed)) : formatPerformed(performed)}
          </span>
          <span className="flex items-baseline justify-between gap-2">
            <span className="form-label text-muted-foreground">Lifted in total</span>
            <span className="text-lg font-semibold tabular-nums font-stretch-semi-condensed">
              {formatKg(tonnageOf(performed))}
            </span>
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {complete
            ? "Not counted yet: see To fix in the protocol."
            : "Fill in every field to count it."}
        </p>
      )}
    </div>
  );
}
