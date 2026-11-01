import type { Workout } from "@chalk/contracts";
import { Badge } from "@chalk/ui/components/badge.tsx";
import { Link } from "@tanstack/react-router";

import { WORKOUT_KIND_LABELS } from "../../lib/workoutKinds.ts";
import { formatWeekday, MoreLink, SectionHead } from "./SectionHead.tsx";

/** The newest workouts, one row each, with the way to the full list. */
export function LatestSessions({ workouts }: { readonly workouts: ReadonlyArray<Workout> }) {
  return (
    <section aria-labelledby="sessions-title" className="grid grid-cols-1 content-start">
      <SectionHead
        id="sessions-title"
        title="Latest sessions"
        meta={
          <Link to="/workouts">
            <MoreLink>All workouts</MoreLink>
          </Link>
        }
      />
      {workouts.length === 0 ? (
        <p className="border-b bg-card px-3 py-4 text-sm text-muted-foreground">
          No sessions yet.{" "}
          <Link to="/log" className="underline">
            Log one
          </Link>{" "}
          or{" "}
          <Link to="/import" className="underline">
            import your old log
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-card text-sm">
            <tbody>
              {workouts.map((workout) => (
                <tr key={workout.id} className="border-b">
                  <td className="w-32 whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">
                    <time dateTime={workout.performedOn}>{formatWeekday(workout.performedOn)}</time>
                  </td>
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {workout.benchmarkId ? (
                      <Link
                        to="/benchmarks/$benchmarkId"
                        params={{ benchmarkId: workout.benchmarkId }}
                        className="underline decoration-input hover:decoration-foreground"
                      >
                        {workout.name}
                      </Link>
                    ) : (
                      workout.name
                    )}
                  </th>
                  <td className="form-label w-24 px-3 py-1.5 text-muted-foreground">
                    {WORKOUT_KIND_LABELS[workout.kind]}
                  </td>
                  <td className="w-36 whitespace-nowrap px-3 py-1.5 text-right">
                    {workout.score === "" ? (
                      <span data-empty aria-label="No score" />
                    ) : (
                      <span data-tag="score" data-chip className="px-1.5 font-semibold">
                        {workout.score}
                      </span>
                    )}
                  </td>
                  <td className="w-20 px-3 py-1.5 text-right">
                    <Badge variant={workout.rx ? "default" : "muted"}>
                      {workout.rx ? "Rx" : "Scaled"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
