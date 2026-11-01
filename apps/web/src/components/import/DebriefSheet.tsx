import {
  CAPACITY_LABELS,
  describeDebrief,
  EFFORT_LABELS,
  FEEL_LABELS,
  LIMITER_LABELS,
  Limiter,
  normalizeDebrief,
  scaleLabel,
  sessionLoad,
  type Debrief,
} from "@chalk/contracts";
import { Input, Textarea } from "@chalk/ui/components/field.tsx";
import { Check } from "lucide-react";
import { useId, useState, type ReactNode, type Ref } from "react";

const FEELS = [1, 2, 3, 4, 5] as const;
const CAPACITIES = [1, 2, 3, 4, 5] as const;
const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Questions the debrief asks; the header counts how many have an answer. */
const ANSWERABLE = [
  "result",
  "minutes",
  "feel",
  "capacity",
  "effort",
  "limiters",
  "nextTime",
  "notes",
] as const satisfies ReadonlyArray<keyof Debrief>;

/** One box of the debrief: printed label in the corner, the answer's reading on the right. */
function Box({
  label,
  htmlFor,
  reading,
  children,
}: {
  readonly label: string;
  /** The control the label names; a group names itself with `aria-label` instead. */
  readonly htmlFor?: string;
  readonly reading?: ReactNode;
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
    </div>
  );
}

/**
 * A row of joined boxes, one per answer, like the attempt row of a protocol. Native radios, so
 * arrow keys move and the group is one tab stop; clicking the chosen box again clears it.
 */
function Scale<Value extends string | number>({
  name,
  label,
  options,
  value,
  ladder,
  onChange,
}: {
  readonly name: string;
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly value: Value; readonly text: string }>;
  readonly value: Value | undefined;
  /** Tint the boxes under the chosen one, so the height of the answer reads at a glance. */
  readonly ladder?: boolean;
  readonly onChange: (value: Value | undefined) => void;
}) {
  const chosenAt = options.findIndex((option) => option.value === value);
  return (
    <div role="radiogroup" aria-label={label} data-scale={ladder ? "ladder" : ""}>
      {options.map((option, index) => (
        <label
          key={option.value}
          data-scale-option
          data-under={ladder && index < chosenAt ? "" : undefined}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            onClick={(event) => {
              // A pointer click on the chosen box clears it; keyboard selection never does.
              if (event.detail > 0 && option.value === value) onChange(undefined);
            }}
          />
          {option.text}
        </label>
      ))}
    </div>
  );
}

function Reading({ children }: { readonly children: ReactNode }) {
  return <span className="text-xs font-semibold font-stretch-semi-condensed">{children}</span>;
}

/**
 * The athlete's side of the session, closing the protocol: the result in their words, how it
 * felt, how hard they went and could have gone, what limited them, and notes for the coach.
 * Nothing here is required.
 */
export function DebriefSheet({
  debrief,
  scores,
  firstFieldRef,
  onChange,
}: {
  readonly debrief: Debrief;
  /** Block scores marked in the text, offered as the result. */
  readonly scores: ReadonlyArray<string>;
  readonly firstFieldRef?: Ref<HTMLInputElement>;
  readonly onChange: (debrief: Debrief) => void;
}) {
  const id = useId();
  const [minutesText, setMinutesText] = useState(
    debrief.minutes === undefined ? "" : String(debrief.minutes),
  );
  const minutesValid = minutesText.trim() === "" || debrief.minutes !== undefined;

  const set = <Key extends keyof Debrief>(key: Key, value: Debrief[Key] | undefined) => {
    const { [key]: _previous, ...rest } = debrief;
    onChange(value === undefined ? rest : { ...rest, [key]: value });
  };

  function editMinutes(text: string) {
    setMinutesText(text);
    const minutes = Number(text.trim());
    set(
      "minutes",
      /^\d+$/.test(text.trim()) && minutes >= 1 && minutes <= 600 ? minutes : undefined,
    );
  }

  const limiters = new Set(debrief.limiters ?? []);
  function toggleLimiter(limiter: Limiter) {
    const next = new Set(limiters);
    // "Nothing" excludes the rest, and picking anything else unpicks it.
    if (next.has(limiter)) next.delete(limiter);
    else if (limiter === "none") {
      next.clear();
      next.add("none");
    } else {
      next.delete("none");
      next.add(limiter);
    }
    set(
      "limiters",
      next.size === 0 ? undefined : Limiter.literals.filter((option) => next.has(option)),
    );
  }

  const normalized = normalizeDebrief(debrief);
  const answered = ANSWERABLE.filter((key) => normalized[key] !== undefined).length;
  const load = sessionLoad(normalized);
  const lines = describeDebrief(debrief);
  const scoreText = scores.join(" · ");

  return (
    <section aria-label="Debrief" className="@container">
      <header className="flex items-baseline justify-between gap-3 border-b-2 border-foreground px-4 pb-1 pt-5">
        <h3 className="protocol-title text-xl">Debrief</h3>
        <span className="form-label text-muted-foreground">
          {answered === 0 ? "For the coach, all optional" : `${answered} of ${ANSWERABLE.length}`}
          {load === undefined ? "" : `, load ${load}`}
        </span>
      </header>

      <div className="grid divide-y border-b @sm:grid-cols-[minmax(0,1fr)_7rem] @sm:divide-x @sm:divide-y-0">
        <Box
          label="Result"
          htmlFor={`${id}-result`}
          reading={
            scoreText !== "" && normalized.result === undefined ? (
              <button
                type="button"
                className="cursor-pointer truncate text-xs font-medium underline decoration-input underline-offset-2 transition-[text-decoration-color] duration-150 hover:decoration-foreground"
                onClick={() => set("result", scoreText)}
              >
                Use {scoreText}
              </button>
            ) : undefined
          }
        >
          <Input
            ref={firstFieldRef}
            id={`${id}-result`}
            value={debrief.result ?? ""}
            maxLength={120}
            placeholder="In your words, like 12+5 or a 150 kg single"
            onChange={(event) => set("result", event.target.value)}
          />
        </Box>
        <Box label="Minutes" htmlFor={`${id}-minutes`}>
          <Input
            id={`${id}-minutes`}
            inputMode="numeric"
            value={minutesText}
            aria-invalid={!minutesValid}
            aria-describedby={minutesValid ? undefined : `${id}-minutes-error`}
            onChange={(event) => editMinutes(event.target.value)}
          />
          {minutesValid ? null : (
            <span id={`${id}-minutes-error`} className="text-xs text-destructive">
              1 to 600
            </span>
          )}
        </Box>
      </div>

      <div className="grid divide-y border-b @xl:grid-cols-2 @xl:divide-x @xl:divide-y-0">
        <Box label="How it felt">
          <Scale
            name={`${id}-feel`}
            label="How it felt"
            options={FEELS.map((feel) => ({ value: feel, text: scaleLabel(FEEL_LABELS, feel) }))}
            value={debrief.feel}
            onChange={(feel) => set("feel", feel)}
          />
        </Box>
        <Box label="Could push">
          <Scale
            name={`${id}-capacity`}
            label="How hard you could push today"
            options={CAPACITIES.map((capacity) => ({
              value: capacity,
              text: scaleLabel(CAPACITY_LABELS, capacity),
            }))}
            value={debrief.capacity}
            onChange={(capacity) => set("capacity", capacity)}
          />
        </Box>
      </div>

      <div className="border-b">
        <Box
          label="Effort, session RPE"
          reading={
            debrief.effort === undefined ? undefined : (
              <Reading>
                RPE {debrief.effort}, {scaleLabel(EFFORT_LABELS, debrief.effort).toLowerCase()}
              </Reading>
            )
          }
        >
          <Scale
            name={`${id}-effort`}
            label="Effort, session RPE from 1 to 10"
            options={EFFORTS.map((effort) => ({ value: effort, text: String(effort) }))}
            value={debrief.effort}
            ladder
            onChange={(effort) => set("effort", effort)}
          />
          <div aria-hidden className="form-label flex justify-between text-muted-foreground">
            <span>Very easy</span>
            <span>Hard</span>
            <span>Maximal</span>
          </div>
        </Box>
      </div>

      <div className="border-b">
        <Box
          label="What limited you"
          reading={
            limiters.size === 0 ? undefined : (
              <Reading>{limiters.has("none") ? "Nothing" : `${limiters.size} picked`}</Reading>
            )
          }
        >
          <ul
            aria-label="What limited you"
            className="-mx-1.5 grid grid-cols-1 @sm:grid-cols-2 @md:grid-cols-3"
          >
            {Limiter.literals.map((limiter) => (
              <li key={limiter}>
                <label data-check>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={limiters.has(limiter)}
                    onChange={() => toggleLimiter(limiter)}
                  />
                  <span data-check-box aria-hidden>
                    <Check />
                  </span>
                  <span className="grid min-w-0 leading-5">
                    <span className="text-sm font-medium">{LIMITER_LABELS[limiter].label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {LIMITER_LABELS[limiter].hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {limiters.has("pain") ? (
            <div className="grid gap-1 border-t pt-2.5">
              <label htmlFor={`${id}-pain`} className="form-label text-muted-foreground">
                Pain: where, how, since when
              </label>
              <Input
                id={`${id}-pain`}
                value={debrief.pain ?? ""}
                maxLength={200}
                placeholder="Left wrist in the front rack, sharp, since Monday"
                onChange={(event) => set("pain", event.target.value)}
              />
            </div>
          ) : null}
        </Box>
      </div>

      <div className="border-b">
        <Box label="Next time" htmlFor={`${id}-next`}>
          <Input
            id={`${id}-next`}
            value={debrief.nextTime ?? ""}
            maxLength={300}
            placeholder="Start the rows slower, break the thrusters 7-5 from round one"
            onChange={(event) => set("nextTime", event.target.value)}
          />
        </Box>
      </div>

      <div className="border-b">
        <Box label="Notes for the coach" htmlFor={`${id}-notes`}>
          <Textarea
            id={`${id}-notes`}
            rows={4}
            value={debrief.notes ?? ""}
            maxLength={4000}
            placeholder="Slept five hours. The bar felt fast up to 140, then the last two singles ground out of the hole."
            onChange={(event) => set("notes", event.target.value)}
          />
        </Box>
      </div>

      <div className="grid gap-1 px-4 pb-2 pt-3">
        <h4 className="form-label text-muted-foreground">What the coach reads</h4>
        {lines.length === 0 && normalized.notes === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span data-empty aria-hidden />
            Nothing yet. Answer any of the above; the rest stays blank.
          </p>
        ) : (
          <div data-coach-reads className="grid max-w-prose gap-1 px-3 py-2 text-sm">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {normalized.notes === undefined ? null : (
              <p className="text-muted-foreground">
                Plus your notes, {wordCount(normalized.notes)}.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const wordCount = (text: string) => {
  const words = text.split(/\s+/).filter((word) => word !== "").length;
  return words === 1 ? "1 word" : `${words} words`;
};
