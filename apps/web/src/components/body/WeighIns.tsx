import {
  BODY_FAT_PCT_MAX,
  BODY_FAT_PCT_MIN,
  BodyweightEntry,
  MUSCLE_MASS_KG_MAX,
  MUSCLE_MASS_KG_MIN,
  type Bodyweight,
  type IsoDate,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { bodyweightRows, parseMeasure } from "../../lib/bodyweight.ts";
import { formatDay } from "../../lib/utils.ts";
import {
  deleteBodyweightAtom,
  logBodyweightAtom,
  PROFILE_REACTIVITY_KEY,
} from "../../state/profile.ts";
import { kg, pct, signedKg } from "../chart.tsx";
import { sourceLabel } from "./TrendChart.tsx";

const decodeEntry = Schema.decodeUnknownOption(BodyweightEntry);

type Status =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "saved"; readonly message: string }
  | { readonly type: "error"; readonly message: string };

/** The three numbers a weigh-in takes, as typed. */
const FIELDS = [
  { key: "kg", label: "Bodyweight, kg", optional: false },
  { key: "bodyFatPct", label: "Body fat, %", optional: true },
  { key: "muscleMassKg", label: "Muscle mass, kg", optional: true },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

const EMPTY_DRAFT: Record<FieldKey, string> = { kg: "", bodyFatPct: "", muscleMassKg: "" };

/** What a typed value in a field holds, as the field's placeholder: the day's logged reading. */
const loggedText = (entry: Bodyweight | undefined, key: FieldKey) => {
  const value = entry?.[key];
  return value == null ? undefined : String(value);
};

/**
 * The day's weigh-in: a date (today unless changed), the scale's weight and, when it measured
 * them, body fat and muscle mass. Logging a day again replaces all three.
 */
export function WeighInForm({
  entries,
  today,
}: {
  readonly entries: ReadonlyArray<Bodyweight>;
  readonly today: IsoDate;
}) {
  const id = useId();
  const logBodyweight = useAtomSet(logBodyweightAtom, { mode: "promiseExit" });
  const [performedOn, setPerformedOn] = useState(today);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const replaces = entries.find((entry) => entry.performedOn === performedOn);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = decodeEntry({
      performedOn,
      kg: parseMeasure(draft.kg),
      bodyFatPct: parseMeasure(draft.bodyFatPct),
      muscleMassKg: parseMeasure(draft.muscleMassKg),
    });
    if (Option.isNone(entry)) {
      setStatus({
        type: "error",
        message: `Pick a day and a weight from 25 to 300 kg; body fat ${BODY_FAT_PCT_MIN} to ${BODY_FAT_PCT_MAX} % and muscle ${MUSCLE_MASS_KG_MIN} to ${MUSCLE_MASS_KG_MAX} kg, or blank.`,
      });
      return;
    }
    setStatus({ type: "saving" });
    const exit = await logBodyweight({
      payload: entry.value,
      reactivityKeys: [PROFILE_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) {
      setStatus({ type: "error", message: "Could not log the weigh-in. Try again." });
      return;
    }
    setDraft(EMPTY_DRAFT);
    setStatus({
      type: "saved",
      message: `Logged ${kg(entry.value.kg)} on ${formatDay(entry.value.performedOn)}.`,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Log a weigh-in"
      className="grid grid-cols-[10rem_8rem_8rem_8rem_auto_minmax(0,1fr)] items-end gap-3 border-b bg-card px-4 py-3"
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-day`} className="form-label text-muted-foreground">
          Day
        </label>
        <Input
          id={`${id}-day`}
          type="date"
          max={today}
          value={performedOn}
          onChange={(event) => setPerformedOn(event.target.value)}
        />
      </div>
      {FIELDS.map((field) => (
        <div key={field.key} className="grid gap-1.5">
          <label htmlFor={`${id}-${field.key}`} className="form-label text-muted-foreground">
            {field.label}
          </label>
          <Input
            id={`${id}-${field.key}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder={
              loggedText(replaces, field.key) ?? (field.optional ? "Optional" : undefined)
            }
            value={draft[field.key]}
            onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
          />
        </div>
      ))}
      <Button type="submit" disabled={status.type === "saving"}>
        {status.type === "saving" ? "Logging..." : replaces === undefined ? "Log" : "Replace"}
      </Button>
      <p
        role="status"
        className={
          status.type === "error"
            ? "pb-2 text-sm text-destructive"
            : "pb-2 text-sm text-muted-foreground"
        }
      >
        {status.type === "error" || status.type === "saved"
          ? status.message
          : replaces === undefined
            ? null
            : `${kg(replaces.kg)} is logged that day; logging again replaces it, body fat and muscle too.`}
      </p>
    </form>
  );
}

function Measured({ children }: { readonly children: string | null }) {
  return children === null ? <span data-empty aria-label="Not measured" /> : children;
}

/** Every weigh-in, newest first: weight and its change, body fat, muscle, where it came from. */
export function WeighInTable({ entries }: { readonly entries: ReadonlyArray<Bodyweight> }) {
  const deleteBodyweight = useAtomSet(deleteBodyweightAtom, { mode: "promiseExit" });
  const [failed, setFailed] = useState(false);

  async function remove(performedOn: IsoDate) {
    const exit = await deleteBodyweight({
      payload: { performedOn },
      reactivityKeys: [PROFILE_REACTIVITY_KEY],
    });
    setFailed(Exit.isFailure(exit));
  }

  return (
    <div className="grid">
      {failed ? (
        <p className="border-b bg-card px-4 py-2 text-sm text-destructive">
          Could not delete the weigh-in. Try again.
        </p>
      ) : null}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full bg-card text-sm">
          <caption className="sr-only">Weigh-ins, newest first</caption>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b text-left">
              <th scope="col" className="form-label px-4 py-1.5 text-muted-foreground">
                Day
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                Body fat
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                Muscle mass
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                Bodyweight
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                Change
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-left text-muted-foreground">
                Source
              </th>
              <th scope="col" className="w-12">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bodyweightRows(entries).map((row) => (
              <tr key={row.performedOn} className="border-b">
                <td className="px-4 py-1.5">{formatDay(row.performedOn)}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                  <Measured>{row.bodyFatPct === null ? null : pct(row.bodyFatPct)}</Measured>
                </td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                  <Measured>{row.muscleMassKg === null ? null : kg(row.muscleMassKg)}</Measured>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{kg(row.kg)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                  {row.change === undefined ? (
                    <span data-empty aria-label="First weigh-in" />
                  ) : (
                    signedKg(row.change)
                  )}
                </td>
                <td
                  className={
                    row.source === "garmin"
                      ? "form-label px-3 py-1.5 text-muted-foreground"
                      : "form-label px-3 py-1.5"
                  }
                >
                  {sourceLabel(row)}
                </td>
                <td className="px-2 py-0.5 text-right">
                  <Button
                    variant="ghost-destructive"
                    size="icon"
                    aria-label={`Delete the weigh-in on ${formatDay(row.performedOn)}`}
                    onClick={() => void remove(row.performedOn)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
