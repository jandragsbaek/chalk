import { LogWorkoutInput } from "@chalk/contracts";
import { useAtomSet } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { useState } from "react";

import { localIsoDate } from "../lib/utils.ts";
import { SCORE_PLACEHOLDERS, WORKOUT_KIND_LABELS, WORKOUT_KINDS } from "../lib/workoutKinds.ts";
import { logWorkoutAtom, WORKOUTS_REACTIVITY_KEY } from "../state/workouts.ts";
import { Button } from "./ui/button.tsx";
import { Input, Label, NativeSelect, Textarea } from "./ui/field.tsx";
import { Switch } from "./ui/switch.tsx";

const decodeLogWorkoutInput = Schema.decodeUnknownOption(LogWorkoutInput);

const BENCHMARK_WORKOUTS = [
  "Fran", "Grace", "Helen", "Diane", "Elizabeth", "Isabel", "Karen", "Annie",
  "Cindy", "Mary", "Jackie", "Nancy", "Murph", "DT", "Filthy Fifty", "Fight Gone Bad",
];

type SubmitStatus =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "error"; readonly message: string };

export function LogWorkoutForm() {
  const logWorkout = useAtomSet(logWorkoutAtom, { mode: "promiseExit" });
  const [performedOn, setPerformedOn] = useState(() => localIsoDate(new Date()));
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LogWorkoutInput["kind"]>("for_time");
  const [score, setScore] = useState("");
  const [rx, setRx] = useState(true);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SubmitStatus>({ type: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = decodeLogWorkoutInput({
      performedOn,
      name: name.trim(),
      kind,
      score: score.trim(),
      rx,
      notes: notes.trim(),
    });
    if (Option.isNone(input)) {
      setStatus({ type: "error", message: "Add a date, a workout name and a score." });
      return;
    }

    setStatus({ type: "saving" });
    const exit = await logWorkout({
      payload: input.value,
      reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) {
      setStatus({ type: "error", message: "Could not save the workout. Try again." });
      return;
    }
    setName("");
    setScore("");
    setNotes("");
    setStatus({ type: "idle" });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="workout-name">Workout</Label>
        <Input
          id="workout-name"
          list="benchmark-workouts"
          placeholder="Fran, Back squat, Today's WOD..."
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <datalist id="benchmark-workouts">
          {BENCHMARK_WORKOUTS.map((workout) => (
            <option key={workout} value={workout} />
          ))}
        </datalist>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="workout-kind">Type</Label>
        <NativeSelect
          id="workout-kind"
          value={kind}
          onChange={(event) =>
            setKind(WORKOUT_KINDS.find((option) => option === event.target.value) ?? "other")
          }
        >
          {WORKOUT_KINDS.map((option) => (
            <option key={option} value={option}>
              {WORKOUT_KIND_LABELS[option]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="workout-date">Date</Label>
        <Input
          id="workout-date"
          type="date"
          value={performedOn}
          onChange={(event) => setPerformedOn(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="workout-score">Score</Label>
        <Input
          id="workout-score"
          placeholder={SCORE_PLACEHOLDERS[kind]}
          autoComplete="off"
          value={score}
          onChange={(event) => setScore(event.target.value)}
        />
      </div>

      <div className="flex items-end">
        <Label className="flex h-10 cursor-pointer items-center gap-3">
          <Switch checked={rx} onCheckedChange={setRx} />
          {rx ? "Rx" : "Scaled"}
        </Label>
      </div>

      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="workout-notes">Notes</Label>
        <Textarea
          id="workout-notes"
          placeholder="How did it feel? Splits, weights, what to change next time."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p role="status" className="text-sm text-destructive">
          {status.type === "error" ? status.message : null}
        </p>
        <Button type="submit" disabled={status.type === "saving"}>
          {status.type === "saving" ? "Saving..." : "Log workout"}
        </Button>
      </div>
    </form>
  );
}
