import type { LiftSetId } from "@chalk/contracts";
import { Badge } from "@chalk/ui/components/badge.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Trash2 } from "lucide-react";

import { formatKg, useMovementNames } from "../lib/strength.ts";
import { formatDay, groupByDay } from "../lib/utils.ts";
import {
  deleteLiftSetAtom,
  LIFTS_REACTIVITY_KEY,
  liftRecordsAtom,
  liftSetsAtom,
} from "../state/strength.ts";

export function LiftSetHistory() {
  const result = useAtomValue(liftSetsAtom);
  const records = AsyncResult.getOrElse(useAtomValue(liftRecordsAtom), () => []);
  const names = useMovementNames();
  const deleteLiftSet = useAtomSet(deleteLiftSetAtom, { mode: "promiseExit" });
  const recordSetIds = new Set(
    records.flatMap((record) => record.repMaxes.map((repMax) => repMax.liftSetId)),
  );

  function handleDelete(id: LiftSetId) {
    void deleteLiftSet({ payload: { id }, reactivityKeys: [LIFTS_REACTIVITY_KEY] });
  }

  return AsyncResult.match(result, {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading sets...</p>,
    onFailure: () => (
      <p className="text-sm text-destructive">Could not load your sets. Is the server running?</p>
    ),
    onSuccess: ({ value: sets }) =>
      sets.length === 0 ? null : (
        <div className="grid gap-6">
          {groupByDay(sets).map(([day, daySets]) => (
            <section key={day} className="grid gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatDay(day)}
              </h3>
              <ul className="grid gap-2">
                {daySets.map((set) => {
                  const name = names.get(set.movementId) ?? set.movementId;
                  return (
                    <li
                      key={set.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{name}</span>
                          <span className="tabular-nums">
                            {set.reps} × {formatKg(set.loadKg)}
                          </span>
                          {recordSetIds.has(set.id) ? <Badge>PR</Badge> : null}
                        </div>
                        {set.notes ? (
                          <p className="text-sm text-muted-foreground">{set.notes}</p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost-destructive"
                        size="icon"
                        aria-label={`Delete ${name} ${set.reps} × ${formatKg(set.loadKg)}`}
                        onClick={() => handleDelete(set.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ),
  });
}
