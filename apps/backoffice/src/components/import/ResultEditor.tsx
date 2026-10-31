import { formatPerformed, tonnageOf, type DerivedItem, type LiftResult } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { formatKg } from "../../lib/blockLabels.ts";
import {
  draftFromResult,
  resultFromDraft,
  switchMode,
  type ResultDefaults,
  type ResultDraft,
  type ResultMode,
} from "../../lib/resultDraft.ts";

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
 * What was lifted for a programmed movement: every set at one load, a ramp by a fixed step, or
 * set by set. A complete form is the movement's result; the protocol and the total follow it.
 */
export function ResultEditor({
  result,
  item,
  defaults,
  onChange,
}: {
  readonly result: LiftResult | undefined;
  /** The derived item, for what will be saved (empty when the result has a problem). */
  readonly item: DerivedItem;
  readonly defaults: ResultDefaults;
  readonly onChange: (result: LiftResult | undefined) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromResult(result, defaults));

  function edit(next: ResultDraft) {
    setDraft(next);
    const nextResult = next.mode === undefined ? undefined : resultFromDraft(next);
    if (JSON.stringify(nextResult) !== JSON.stringify(result)) onChange(nextResult);
  }

  const setRow = (index: number, key: "reps" | "load", value: string) =>
    edit({
      ...draft,
      rows: draft.rows.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
    });

  const complete = draft.mode !== undefined && resultFromDraft(draft) !== undefined;

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
            onClick={() => edit(switchMode(draft, mode))}
          >
            {label}
          </Button>
        ))}
      </div>

      {draft.mode === undefined ? (
        <p className="text-sm text-muted-foreground">
          Did the sets at one load, ramped by a step, or set by set? The sets become lift sets and
          count toward the session's total.
        </p>
      ) : null}

      {draft.mode === "fixed" ? (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets" value={draft.sets} onChange={(sets) => edit({ ...draft, sets })} />
          <Field label="Reps" value={draft.reps} onChange={(reps) => edit({ ...draft, reps })} />
          <Field label="Load kg" value={draft.load} onChange={(load) => edit({ ...draft, load })} />
        </div>
      ) : null}

      {draft.mode === "ramp" ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sets" value={draft.sets} onChange={(sets) => edit({ ...draft, sets })} />
          <Field label="Reps" value={draft.reps} onChange={(reps) => edit({ ...draft, reps })} />
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
                  inputMode="numeric"
                  aria-label={`Set ${index + 1} reps`}
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
        </div>
      ) : null}

      {draft.mode === undefined ? null : item.performed.length > 0 ? (
        <div data-result-box className="grid gap-0.5 bg-background px-2.5 py-1.5">
          <span className="text-sm tabular-nums">{formatPerformed(item.performed)}</span>
          <span className="flex items-baseline justify-between gap-2">
            <span className="form-label text-muted-foreground">Lifted in total</span>
            <span className="text-lg font-semibold tabular-nums font-stretch-semi-condensed">
              {formatKg(tonnageOf(item.performed))}
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
