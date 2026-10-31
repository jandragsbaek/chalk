import type { Workout } from "@chalk/contracts";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@chalk/ui/components/alert-dialog.tsx";
import { Badge } from "@chalk/ui/components/badge.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Trash2 } from "lucide-react";

import { WORKOUT_KIND_LABELS } from "../lib/workoutKinds.ts";
import {
  removeWorkoutAtom,
  WORKOUTS_REACTIVITY_KEY,
  workoutSearchAtom,
} from "../state/workouts.ts";

function RemoveWorkoutButton({ workout }: { readonly workout: Workout }) {
  const removeWorkout = useAtomSet(removeWorkoutAtom, { mode: "promiseExit" });

  function handleConfirm() {
    void removeWorkout({
      params: { id: workout.id },
      reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost-destructive" size="icon" aria-label={`Delete ${workout.name}`} />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete {workout.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          Logged on {workout.performedOn} with score {workout.score}. This cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
          <AlertDialogClose render={<Button variant="destructive" />} onClick={handleConfirm}>
            Delete
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WorkoutTable({ query }: { readonly query: string }) {
  const result = useAtomValue(workoutSearchAtom(query));

  return AsyncResult.match(result, {
    onInitial: () => <p className="py-6 text-sm text-muted-foreground">Loading workouts...</p>,
    onFailure: () => <p className="text-sm text-destructive">Could not load workouts.</p>,
    onSuccess: ({ value: workouts }) =>
      workouts.length === 0 ? (
        <p className="border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {query === ""
            ? "No workouts logged yet. Log one in the app, or import past sessions under Import."
            : `No workouts match "${query}". Search looks at names, scores and notes.`}
        </p>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-foreground text-left">
              <tr className="form-label text-muted-foreground">
                <th className="w-32 px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Kind</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {workouts.map((workout) => (
                <tr key={workout.id} className="border-b last:border-b-0 hover:bg-muted">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {workout.performedOn}
                  </td>
                  <td className="px-3 py-2 font-medium">{workout.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Badge variant="muted">{WORKOUT_KIND_LABELS[workout.kind]}</Badge>
                      {workout.rx ? <Badge>Rx</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{workout.score}</td>
                  <td className="px-3 py-1 text-right">
                    <RemoveWorkoutButton workout={workout} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
  });
}
