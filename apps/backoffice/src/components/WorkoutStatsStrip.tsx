import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { WORKOUT_KIND_LABELS } from "../lib/workoutKinds.ts";
import { workoutStatsAtom } from "../state/workouts.ts";
import { FieldBox } from "./FieldBox.tsx";

export function WorkoutStatsStrip() {
  const result = useAtomValue(workoutStatsAtom);

  return AsyncResult.match(result, {
    onInitial: () => <div aria-hidden className="h-14 border border-dashed bg-card" />,
    onFailure: () => (
      <p className="text-sm text-destructive">Could not load stats. Is the admin server running?</p>
    ),
    onSuccess: ({ value: stats }) => (
      <dl
        aria-label="Workout stats"
        className="flex w-fit max-w-full flex-wrap divide-x border bg-card"
      >
        <FieldBox wide label="Workouts">
          {stats.total}
        </FieldBox>
        <FieldBox wide label="Rx">
          {stats.total === 0 ? (
            <span data-empty aria-label="none" />
          ) : (
            `${Math.round((stats.rxCount / stats.total) * 100)}%`
          )}
        </FieldBox>
        {stats.byKind.slice(0, 2).map(({ kind, count }) => (
          <FieldBox key={kind} label={WORKOUT_KIND_LABELS[kind]}>
            {count}
          </FieldBox>
        ))}
      </dl>
    ),
  });
}
