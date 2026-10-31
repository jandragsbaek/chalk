import { REP_MAX_TARGETS } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { formatKg, useMovementNames } from "../lib/strength.ts";
import { formatDay } from "../lib/utils.ts";
import { liftRecordsAtom } from "../state/strength.ts";

export function RepMaxTable() {
  const result = useAtomValue(liftRecordsAtom);
  const names = useMovementNames();

  return AsyncResult.match(result, {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading rep maxes...</p>,
    onFailure: () => <p className="text-sm text-destructive">Could not load your rep maxes.</p>,
    onSuccess: ({ value: records }) =>
      records.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No sets yet. Log one and your rep maxes show up here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Movement</th>
                {REP_MAX_TARGETS.map((reps) => (
                  <th key={reps} className="px-3 py-2 text-right font-medium">
                    {reps}RM
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records
                .map((record) => ({
                  ...record,
                  name: names.get(record.movementId) ?? record.movementId,
                }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((record) => (
                  <tr key={record.movementId} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{record.name}</td>
                    {REP_MAX_TARGETS.map((reps) => {
                      const repMax = record.repMaxes.find((max) => max.reps === reps);
                      if (!repMax) {
                        return (
                          <td key={reps} className="px-3 py-2 text-right text-muted-foreground">
                            -
                          </td>
                        );
                      }
                      const source =
                        repMax.fromReps === reps ? "" : `, from a set of ${repMax.fromReps}`;
                      return (
                        <td
                          key={reps}
                          className="px-3 py-2 text-right tabular-nums"
                          title={`${formatDay(repMax.performedOn)}${source}`}
                        >
                          {formatKg(repMax.loadKg)}
                          {repMax.fromReps === reps ? null : (
                            <span className="text-muted-foreground">*</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            * Implied by a set with more reps. Hover a load for its date.
          </p>
        </div>
      ),
  });
}
