import {
  classCoaching,
  dayCoaching,
  describeCoaching,
  parseCoaching,
  SOLO_LABEL,
  type BookingboardClass,
  type Coaching,
  type IsoDate,
} from "@chalk/contracts";
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@chalk/ui/components/autocomplete.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { CalendarArrowDown } from "lucide-react";
import { useState } from "react";

import { knownCoaches } from "../../lib/sessions.ts";
import { formatDay } from "../../lib/utils.ts";
import { bookingboardDayAtom, bookingboardStatusAtom } from "../../state/bookingboard.ts";
import { sessionsAtom } from "../../state/sessions.ts";

type Lookup =
  | { readonly type: "idle" }
  | { readonly type: "looking" }
  | { readonly type: "note"; readonly tone: "muted" | "error"; readonly text: string }
  | { readonly type: "choose"; readonly classes: ReadonlyArray<BookingboardClass> };

const classLabel = (entry: BookingboardClass) => `${entry.startsAt} ${entry.title}`;

/**
 * "Coached by" in the workbench header: a coach's name, or Solo for a session done alone. Offers
 * the coaches of earlier sessions as you type, and looks the day up on bookingboard: its class's
 * coach, or Solo when only open gym (or nothing) was booked.
 */
export function CoachingField({
  id,
  coaching,
  date,
  onChange,
}: {
  /** For a form's `<Label htmlFor>`; the header field labels itself. */
  readonly id?: string;
  readonly coaching: Coaching | undefined;
  /** The session's day; without one there is nothing to look up. */
  readonly date: IsoDate | undefined;
  readonly onChange: (coaching: Coaching | undefined) => void;
}) {
  const sessions = AsyncResult.getOrElse(useAtomValue(sessionsAtom), () => []);
  const status = useAtomValue(bookingboardStatusAtom);
  const pullDay = useAtomSet(bookingboardDayAtom, { mode: "promiseExit" });
  // As typed, so a space mid-name survives; the document gets it parsed.
  const [text, setText] = useState(() => (coaching ? describeCoaching(coaching) : ""));
  const [lookup, setLookup] = useState<Lookup>({ type: "idle" });
  const connected = AsyncResult.isSuccess(status) && status.value._tag === "connected";
  const options = [SOLO_LABEL, ...knownCoaches(sessions)];

  function type(value: string) {
    setText(value);
    setLookup({ type: "idle" });
    onChange(parseCoaching(value));
  }

  function apply(next: Coaching, note: string) {
    setText(describeCoaching(next));
    onChange(next);
    setLookup({ type: "note", tone: "muted", text: note });
  }

  function pick(entry: BookingboardClass) {
    const next = classCoaching(entry);
    if (next) apply(next, classLabel(entry));
    else setLookup({ type: "note", tone: "muted", text: `${classLabel(entry)} names no coach.` });
  }

  async function handleLookup() {
    if (date === undefined) return;
    setLookup({ type: "looking" });
    const exit = await pullDay({ payload: { date } });
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      setLookup({
        type: "note",
        tone: "error",
        text: Option.isSome(failure)
          ? failure.value.message
          : "Could not reach the server. Is it running?",
      });
      return;
    }
    const day = exit.value;
    const [only, ...rest] = day.classes;
    if (only !== undefined && rest.length > 0) {
      setLookup({ type: "choose", classes: day.classes });
      return;
    }
    if (only !== undefined) {
      pick(only);
      return;
    }
    const solo = dayCoaching(day);
    if (solo) apply(solo, day.openGym ? "Open gym that day" : "No class booked that day");
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <Autocomplete items={options} value={text} onValueChange={type} openOnInputClick>
          <AutocompleteInput
            {...(id === undefined ? { "aria-label": "Coached by" } : { id })}
            placeholder="Coach or Solo"
            autoComplete="off"
            className={id === undefined ? "w-36" : undefined}
          />
          <AutocompletePopup>
            <AutocompleteList className="max-h-[min(16rem,var(--available-height))]">
              {(option: string) => (
                <AutocompleteItem key={option} value={option}>
                  <span className="font-semibold">{option}</span>
                  {option === SOLO_LABEL ? (
                    <span className="text-xs text-muted-foreground">On your own</span>
                  ) : null}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompletePopup>
        </Autocomplete>
        {connected ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Look up who coached on bookingboard"
            title={
              date === undefined
                ? "Set the date to look it up on bookingboard"
                : `Look up ${formatDay(date)} on bookingboard`
            }
            disabled={date === undefined || lookup.type === "looking"}
            onClick={() => void handleLookup()}
          >
            <CalendarArrowDown />
          </Button>
        ) : null}
      </div>
      {lookup.type === "looking" ? (
        <span role="status" className="text-xs font-normal text-muted-foreground">
          Reading bookingboard...
        </span>
      ) : lookup.type === "note" ? (
        <span
          role={lookup.tone === "error" ? "alert" : "status"}
          className={
            lookup.tone === "error"
              ? "max-w-56 text-xs font-normal text-destructive"
              : "max-w-56 text-xs font-normal text-muted-foreground"
          }
        >
          {lookup.text}
        </span>
      ) : lookup.type === "choose" ? (
        <div role="group" aria-label="Classes that day" className="grid gap-1">
          <span className="text-xs font-normal text-muted-foreground">
            {lookup.classes.length} classes that day. Which one?
          </span>
          <div className="flex flex-wrap gap-1">
            {lookup.classes.map((entry) => (
              <Button
                key={entry.classId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pick(entry)}
              >
                {classLabel(entry)}
                {entry.coach === null ? "" : `, ${entry.coach}`}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
