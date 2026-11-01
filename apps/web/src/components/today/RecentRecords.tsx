import type { MovementId } from "@chalk/contracts";
import { Link } from "@tanstack/react-router";

import type { PersonalRecord } from "../../lib/dashboard.ts";
import { formatKg } from "../../lib/strength.ts";
import { formatShort, SectionHead } from "./SectionHead.tsx";

/** The newest PRs, lifts and benchmarks together, each with the record it beat. */
export function RecentRecords({
  records,
  names,
}: {
  readonly records: ReadonlyArray<PersonalRecord>;
  readonly names: ReadonlyMap<MovementId, string>;
}) {
  const anyImplied = records.some((record) => record.kind === "lift" && record.implied);
  return (
    <section aria-labelledby="prs-title" className="grid grid-cols-1 content-start">
      <SectionHead
        id="prs-title"
        title="Recent PRs"
        meta={records.length > 0 ? `Latest ${records.length}` : null}
      />
      {records.length === 0 ? (
        <p className="border-b bg-card px-3 py-4 text-sm text-muted-foreground">
          No PRs yet. A set that beats an earlier rep max, or a benchmark that beats your best,
          shows up here.
        </p>
      ) : (
        <div className="bg-card">
          <div
            aria-hidden
            className="form-label grid grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-x-3 border-b px-3 py-1.5 text-muted-foreground"
          >
            <span>Date</span>
            <span>Lift or workout</span>
            <span>Record</span>
          </div>
          <ol>
            {records.map((record) => (
              <li
                key={
                  record.kind === "lift"
                    ? `lift|${record.movementId}|${record.performedOn}`
                    : `benchmark|${record.benchmarkId}|${record.workoutId}`
                }
                className="grid h-14 grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b px-3"
              >
                <time dateTime={record.performedOn} className="text-xs text-muted-foreground">
                  {formatShort(record.performedOn)}
                </time>
                {record.kind === "lift" ? (
                  <LiftRecord
                    record={record}
                    name={names.get(record.movementId) ?? record.movementId}
                  />
                ) : (
                  <BenchmarkRecord record={record} />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {anyImplied ? (
        <p className="pt-1.5 text-xs text-muted-foreground">* Implied by a set with more reps.</p>
      ) : null}
    </section>
  );
}

function LiftRecord({
  record,
  name,
}: {
  readonly record: PersonalRecord & { kind: "lift" };
  readonly name: string;
}) {
  return (
    <>
      <span className="min-w-0 truncate">
        <span className="font-medium">{name}</span>{" "}
        <span className="form-label text-muted-foreground">{record.reps}RM</span>
      </span>
      <span className="grid justify-items-end">
        <span data-measure="load_kg" data-chip className="px-1.5 font-semibold">
          {formatKg(record.loadKg)}
          {record.implied ? "*" : null}
        </span>
        <span className="text-xs text-muted-foreground">was {formatKg(record.previousKg)}</span>
      </span>
    </>
  );
}

function BenchmarkRecord({ record }: { readonly record: PersonalRecord & { kind: "benchmark" } }) {
  return (
    <>
      <span className="min-w-0 truncate">
        <Link
          to="/benchmarks/$benchmarkId"
          params={{ benchmarkId: record.benchmarkId }}
          className="font-medium underline decoration-input hover:decoration-foreground"
        >
          {record.name}
        </Link>{" "}
        <span className="form-label text-muted-foreground">Best</span>
      </span>
      <span className="grid justify-items-end">
        <span data-tag="score" data-chip className="px-1.5 font-semibold">
          {record.score}
        </span>
        <span className="text-xs text-muted-foreground">was {record.previousScore}</span>
      </span>
    </>
  );
}
