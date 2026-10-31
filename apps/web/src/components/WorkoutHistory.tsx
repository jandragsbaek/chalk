import type { WorkoutId } from "@chalk/contracts";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Trash2 } from "lucide-react";

import { formatDay, groupByDay } from "../lib/utils.ts";
import { WORKOUT_KIND_LABELS } from "../lib/workoutKinds.ts";
import { deleteWorkoutAtom, workoutsAtom, WORKOUTS_REACTIVITY_KEY } from "../state/workouts.ts";
import { Badge } from "@chalk/ui/components/badge.tsx";
import { Button } from "@chalk/ui/components/button.tsx";

export function WorkoutHistory() {
  const result = useAtomValue(workoutsAtom);
  const deleteWorkout = useAtomSet(deleteWorkoutAtom, { mode: "promiseExit" });

  function handleDelete(id: WorkoutId) {
    void deleteWorkout({ payload: { id }, reactivityKeys: [WORKOUTS_REACTIVITY_KEY] });
  }

  return AsyncResult.match(result, {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading workouts...</p>,
    onFailure: () => (
      <p className="text-sm text-destructive">
        Could not load your workouts. Is the server running?
      </p>
    ),
    onSuccess: ({ value: workouts }) =>
      workouts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No workouts yet. Log your first one above.
        </p>
      ) : (
        <div className="grid gap-6">
          {groupByDay(workouts).map(([day, dayWorkouts]) => (
            <section key={day} className="grid gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatDay(day)}
              </h3>
              <ul className="grid gap-2">
                {dayWorkouts.map((workout) => (
                  <li
                    key={workout.id}
                    className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="grid min-w-0 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {workout.benchmarkId ? (
                          <Link
                            to="/benchmarks/$benchmarkId"
                            params={{ benchmarkId: workout.benchmarkId }}
                            className="font-medium underline decoration-input hover:decoration-foreground"
                          >
                            {workout.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{workout.name}</span>
                        )}
                        <Badge variant="muted">{WORKOUT_KIND_LABELS[workout.kind]}</Badge>
                        <Badge variant={workout.rx ? "default" : "muted"}>
                          {workout.rx ? "Rx" : "Scaled"}
                        </Badge>
                      </div>
                      <span className="text-lg font-semibold tabular-nums">{workout.score}</span>
                      {workout.notes ? (
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {workout.notes}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost-destructive"
                      size="icon"
                      aria-label={`Delete ${workout.name}`}
                      onClick={() => handleDelete(workout.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ),
  });
}
