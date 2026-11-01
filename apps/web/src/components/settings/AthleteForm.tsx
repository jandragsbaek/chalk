import { AthleteBody, type AthleteProfile, type Sex } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { useId, useState, type ReactNode } from "react";

import { draftOfBody, parseMeasure, type BodyDraft } from "../../lib/bodyweight.ts";
import { PROFILE_REACTIVITY_KEY, updateProfileAtom } from "../../state/profile.ts";
import { SectionHead } from "../today/SectionHead.tsx";

const decodeBody = Schema.decodeUnknownOption(AthleteBody);

const SEXES: ReadonlyArray<{ readonly value: Sex; readonly text: string }> = [
  { value: "m", text: "Male" },
  { value: "f", text: "Female" },
];

type LengthKey = "heightCm" | "armLengthCm" | "legLengthCm";

/** Each length's field: its label, the range the contract takes, and how to measure it. */
const LENGTHS: ReadonlyArray<{
  readonly key: LengthKey;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly optional: boolean;
  readonly hint: string;
}> = [
  {
    key: "heightCm",
    label: "Height, cm",
    min: 100,
    max: 250,
    optional: false,
    hint: "Standing, barefoot.",
  },
  {
    key: "armLengthCm",
    label: "Arm length, cm",
    min: 30,
    max: 150,
    optional: true,
    hint: "Bony tip of the shoulder (acromion) to the knuckles of a closed fist, arm hanging straight.",
  },
  {
    key: "legLengthCm",
    label: "Inseam, cm",
    min: 30,
    max: 150,
    optional: true,
    hint: "Floor to crotch, standing barefoot.",
  },
];

/** One box of the form: printed label in the corner, the field, a pencil-grey hint under it. */
function Box({
  label,
  htmlFor,
  reading,
  hint,
  children,
}: {
  readonly label: string;
  readonly htmlFor?: string;
  readonly reading?: ReactNode;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5 px-4 pb-3 pt-2">
      <div className="flex min-h-5 items-baseline justify-between gap-3">
        {htmlFor === undefined ? (
          <span className="form-label text-muted-foreground">{label}</span>
        ) : (
          <label htmlFor={htmlFor} className="form-label text-muted-foreground">
            {label}
          </label>
        )}
        {reading}
      </div>
      {children}
      {hint === undefined ? null : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type Status =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "saved" }
  | { readonly type: "error"; readonly message: string };

const sameBody = (left: BodyDraft, right: BodyDraft) =>
  left.sex === right.sex &&
  LENGTHS.every(({ key }) => {
    const a = parseMeasure(left[key]);
    const b = parseMeasure(right[key]);
    return a === b || (Number.isNaN(a) && Number.isNaN(b));
  });

/**
 * Sex, height and the optional limb lengths. Sex picks the side of every M/F load Chalk reads
 * (prescriptions, the level sheet, benchmarks); the lengths feed estimates of work done.
 */
export function AthleteForm({ profile }: { readonly profile: AthleteProfile }) {
  const id = useId();
  const updateProfile = useAtomSet(updateProfileAtom, { mode: "promiseExit" });
  const [draft, setDraft] = useState<BodyDraft>(() => draftOfBody(profile));
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const saved = draftOfBody(profile);
  const dirty = !sameBody(draft, saved);

  const invalid = (key: LengthKey) => {
    const value = parseMeasure(draft[key]);
    const length = LENGTHS.find((entry) => entry.key === key)!;
    return value !== null && (Number.isNaN(value) || value < length.min || value > length.max);
  };

  function edit(next: Partial<BodyDraft>) {
    setDraft({ ...draft, ...next });
    if (status.type !== "saving") setStatus({ type: "idle" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = decodeBody({
      sex: draft.sex,
      heightCm: parseMeasure(draft.heightCm),
      armLengthCm: parseMeasure(draft.armLengthCm),
      legLengthCm: parseMeasure(draft.legLengthCm),
    });
    if (Option.isNone(body)) {
      setStatus({ type: "error", message: "Fix the lengths marked in red." });
      return;
    }
    setStatus({ type: "saving" });
    const exit = await updateProfile({
      payload: body.value,
      reactivityKeys: [PROFILE_REACTIVITY_KEY],
    });
    setStatus(
      Exit.isFailure(exit)
        ? { type: "error", message: "Could not save. Try again." }
        : { type: "saved" },
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <SectionHead id={`${id}-title`} title="Athlete" />
      <form onSubmit={handleSubmit} className="grid divide-y border-b bg-card">
        <Box
          label="Sex"
          hint="Which side of a male/female load applies: whiteboard prescriptions like 43/29 kg, the GymDanmark level sheet and benchmark Rx."
        >
          <div role="radiogroup" aria-label="Sex" data-scale="">
            {SEXES.map((option) => (
              <label key={option.value} data-scale-option>
                <input
                  type="radio"
                  name={`${id}-sex`}
                  className="sr-only"
                  value={option.value}
                  checked={draft.sex === option.value}
                  onChange={() => edit({ sex: option.value })}
                />
                {option.text}
              </label>
            ))}
          </div>
        </Box>
        {LENGTHS.map((length) => {
          const bad = invalid(length.key);
          return (
            <Box
              key={length.key}
              label={length.label}
              htmlFor={`${id}-${length.key}`}
              reading={
                length.optional ? (
                  <span className="form-label text-muted-foreground">Optional</span>
                ) : undefined
              }
              hint={
                bad ? (
                  <span id={`${id}-${length.key}-error`} className="text-destructive">
                    {length.min} to {length.max} cm.
                  </span>
                ) : (
                  length.hint
                )
              }
            >
              <Input
                id={`${id}-${length.key}`}
                inputMode="decimal"
                autoComplete="off"
                value={draft[length.key]}
                aria-invalid={bad}
                aria-describedby={bad ? `${id}-${length.key}-error` : undefined}
                onChange={(event) => edit({ [length.key]: event.target.value })}
              />
            </Box>
          );
        })}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p
            role="status"
            className={
              status.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
            }
          >
            {status.type === "error"
              ? status.message
              : status.type === "saved"
                ? "Saved."
                : dirty
                  ? "Unsaved changes."
                  : null}
          </p>
          <Button type="submit" disabled={!dirty || status.type === "saving"}>
            {status.type === "saving" ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
