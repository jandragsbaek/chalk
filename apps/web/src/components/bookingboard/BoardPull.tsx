import type { BookingboardClass } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { CalendarArrowDown } from "lucide-react";
import { useState } from "react";

import { formatDay } from "../../lib/utils.ts";
import { bookingboardDayAtom, bookingboardStatusAtom } from "../../state/bookingboard.ts";

type Pull =
  | { readonly type: "idle" }
  | { readonly type: "pulling" }
  | { readonly type: "pulled"; readonly picked: BookingboardClass }
  | { readonly type: "choose"; readonly classes: ReadonlyArray<BookingboardClass> }
  | { readonly type: "message"; readonly tone: "muted" | "error"; readonly text: string };

const classLabel = (entry: BookingboardClass) =>
  `${entry.startsAt} ${entry.title}${entry.coach === null ? "" : ` with ${entry.coach}`}`;

/**
 * "Pull from bookingboard": the program of the athlete's class on `date`, handed to `onPulled`
 * as plain text. A day with several classes asks which one; without a connection it points to
 * Settings.
 */
export function BoardPull({
  date,
  disabled = false,
  onPulled,
}: {
  readonly date: string;
  readonly disabled?: boolean;
  readonly onPulled: (entry: BookingboardClass) => void;
}) {
  const status = useAtomValue(bookingboardStatusAtom);
  const pullDay = useAtomSet(bookingboardDayAtom, { mode: "promiseExit" });
  const [pull, setPull] = useState<Pull>({ type: "idle" });
  const connected = AsyncResult.isSuccess(status) && status.value._tag === "connected";

  function pick(entry: BookingboardClass) {
    setPull({ type: "pulled", picked: entry });
    onPulled(entry);
  }

  async function handlePull() {
    setPull({ type: "pulling" });
    const exit = await pullDay({ payload: { date } });
    if (Exit.isSuccess(exit)) {
      const [first, ...rest] = exit.value.classes;
      if (first === undefined)
        setPull({
          type: "message",
          tone: "muted",
          text: exit.value.openGym
            ? `Only open gym on ${formatDay(date)}: no program to pull.`
            : `No class with a program on ${formatDay(date)}.`,
        });
      else if (rest.length === 0) pick(first);
      else setPull({ type: "choose", classes: exit.value.classes });
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    setPull({
      type: "message",
      tone: "error",
      text: Option.isSome(failure)
        ? failure.value.message
        : "Could not reach the server. Is it running?",
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !connected || pull.type === "pulling"}
          onClick={() => void handlePull()}
        >
          <CalendarArrowDown />
          {pull.type === "pulling" ? "Pulling..." : "Pull from bookingboard"}
        </Button>
        {AsyncResult.isSuccess(status) && status.value._tag === "disconnected" ? (
          <span className="text-xs text-muted-foreground">
            <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
              Connect bookingboard in Settings
            </Link>{" "}
            to pull the box's program.
          </span>
        ) : pull.type === "pulled" ? (
          <span role="status" className="text-xs text-muted-foreground">
            {/* A coach's initial ("Rikke L.") already ends the sentence. */}
            Pulled {classLabel(pull.picked).replace(/\.$/, "")}.
          </span>
        ) : pull.type === "message" ? (
          <span
            role={pull.tone === "error" ? "alert" : "status"}
            className={
              pull.tone === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {pull.text}
          </span>
        ) : null}
      </div>
      {pull.type === "choose" ? (
        <div role="group" aria-label="Classes that day" className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">
            You were on {pull.classes.length} classes on {formatDay(date)}. Pull which one?
          </span>
          <div className="flex flex-wrap gap-2">
            {pull.classes.map((entry) => (
              <Button
                key={entry.classId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pick(entry)}
              >
                {classLabel(entry)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
