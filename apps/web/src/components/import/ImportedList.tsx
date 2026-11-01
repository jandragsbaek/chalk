import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { formatKg } from "../../lib/blockLabels.ts";
import { importsAtom } from "../../state/imports.ts";

type ImportsResult = ReturnType<typeof useImports>;

function useImports() {
  return useAtomValue(importsAtom);
}

/** What is in already: progress through the backlog, and a way back into each session. */
export function ImportedList() {
  const result = useImports();

  return (
    <section aria-labelledby="imported-heading" className="grid content-start gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-foreground pb-3">
        <h2 id="imported-heading" className="protocol-title text-2xl">
          Imported
        </h2>
        {AsyncResult.isSuccess(result) ? (
          <span className="text-sm tabular-nums text-muted-foreground">
            {result.value.length} {result.value.length === 1 ? "session" : "sessions"}
          </span>
        ) : null}
      </div>
      <ImportedTable result={result} />
    </section>
  );
}

function ImportedTable({ result }: { readonly result: ImportsResult }) {
  return AsyncResult.match(result, {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading imported sessions...</p>,
    onFailure: () => <p className="text-sm text-destructive">Could not load imported sessions.</p>,
    onSuccess: ({ value: imports }) =>
      imports.length === 0 ? (
        <p className="border border-dashed bg-card px-4 py-8 text-sm text-muted-foreground">
          Nothing imported yet. Each session you save lands here, newest first, with a way back in
          to fix it.
        </p>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-foreground">
              <tr className="form-label text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Session</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Parts</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Moves</th>
                <th className="px-3 py-2 text-right font-semibold">Lifts</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Lifted</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {imports.map((summary) => (
                <tr key={summary.workoutId} className="hover:bg-muted">
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">
                    {summary.performedOn}
                  </td>
                  <td className="px-3 py-1.5 font-semibold">{summary.name}</td>
                  <td className="hidden px-3 py-1.5 text-right tabular-nums sm:table-cell">
                    {summary.partCount}
                  </td>
                  <td className="hidden px-3 py-1.5 text-right tabular-nums sm:table-cell">
                    {summary.itemCount}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{summary.liftSetCount}</td>
                  <td className="hidden whitespace-nowrap px-3 py-1.5 text-right tabular-nums sm:table-cell">
                    {summary.tonnageKg > 0 ? formatKg(summary.tonnageKg) : ""}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link to="/import" search={{ workout: summary.workoutId }} />}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
  });
}
