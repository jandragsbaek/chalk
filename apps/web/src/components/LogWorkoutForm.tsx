import {
  benchmarkWorkoutKind,
  findBenchmark,
  LogWorkoutInput,
  SCORE_PLACEHOLDERS as BENCHMARK_SCORE_PLACEHOLDERS,
  type Benchmark,
} from "@chalk/contracts";
import { useAtomSet } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { useState } from "react";

import { localIsoDate } from "../lib/utils.ts";
import { SCORE_PLACEHOLDERS, WORKOUT_KIND_LABELS, WORKOUT_KINDS } from "../lib/workoutKinds.ts";
import { LIFTS_REACTIVITY_KEY } from "../state/strength.ts";
import { logWorkoutAtom, WORKOUTS_REACTIVITY_KEY } from "../state/workouts.ts";
import { WorkoutPicker } from "./WorkoutPicker.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, Label, NativeSelect, Textarea } from "@chalk/ui/components/field.tsx";
import { Switch } from "@chalk/ui/components/switch.tsx";

const decodeLogWorkoutInput = Schema.decodeUnknownOption(LogWorkoutInput);

type SubmitStatus =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "error"; readonly message: string };

/**
 * Logs a workout. A name that is a benchmark (or the `benchmark` of its page) logs that
 * benchmark: the session gets its movements and the score counts toward its record.
 */
export function LogWorkoutForm({ benchmark: fixed }: { readonly benchmark?: Benchmark } = {}) {
  const logWorkout = useAtomSet(logWorkoutAtom, { mode: "promiseExit" });
  const [performedOn, setPerformedOn] = useState(() => localIsoDate(new Date()));
  const [name, setName] = useState(fixed?.name ?? "");
  const [kind, setKind] = useState<LogWorkoutInput["kind"]>(
    fixed ? benchmarkWorkoutKind(fixed) : "for_time",
  );
  const [score, setScore] = useState("");
  const [rx, setRx] = useState(true);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SubmitStatus>({ type: "idle" });
  const benchmark = fixed ?? findBenchmark(name);

  function handleNameChange(value: string) {
    setName(value);
    const named = findBenchmark(value);
    if (named) setKind(benchmarkWorkoutKind(named));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = decodeLogWorkoutInput({
      performedOn,
      name: benchmark?.name ?? name.trim(),
      kind,
      score: score.trim(),
      rx,
      notes: notes.trim(),
      ...(benchmark ? { benchmarkId: benchmark.id } : {}),
    });
    if (Option.isNone(input)) {
      setStatus({ type: "error", message: "Add a date, a workout name and a score." });
      return;
    }

    setStatus({ type: "saving" });
    const exit = await logWorkout({
      payload: input.value,
      // A benchmark brings movements, which the levels page grades.
      reactivityKeys: benchmark
        ? [WORKOUTS_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY]
        : [WORKOUTS_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) {
      setStatus({ type: "error", message: "Could not save the workout. Try again." });
      return;
    }
    if (!fixed) setName("");
    setScore("");
    setNotes("");
    setStatus({ type: "idle" });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2"
    >
      {fixed ? null : (
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="workout-name">Workout</Label>
          <WorkoutPicker id="workout-name" value={name} onValueChange={handleNameChange} />
          {benchmark ? (
            <p className="text-xs text-muted-foreground">
              Logs the benchmark: {benchmark.blocks.map((block) => block.title).join(", then ")}.
              Its movements go into the session.
            </p>
          ) : null}
        </div>
      )}

      {fixed ? null : (
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
      )}

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
          placeholder={
            benchmark ? BENCHMARK_SCORE_PLACEHOLDERS[benchmark.scoring] : SCORE_PLACEHOLDERS[kind]
          }
          autoComplete="off"
          value={score}
          onChange={(event) => setScore(event.target.value)}
        />
      </div>

      <div className="flex items-end">
        <Label className="h-10 cursor-pointer">
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
