import type * as React from "react";

import { nextMilestone, type PlaceTally as Tally } from "../../lib/places.ts";

const monthYear = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });

/**
 * The count the athlete keeps for fun: sessions at the box in display numerals, with the next
 * round number ahead, then home and away beside it, and since when Chalk has counted. Printed
 * as one strip of protocol field boxes over the year.
 */
export function PlaceTally({ tally }: { readonly tally: Tally }) {
  if (tally.since === undefined) return null;
  const milestone = nextMilestone(tally.box);
  return (
    <section aria-label="Sessions by place">
      <dl className="flex border bg-card">
        <div className="grid min-w-64 content-start border-r-2 border-r-foreground px-4 pt-2.5 pb-3">
          <dt className="form-label">At the box</dt>
          <dd className="flex items-baseline gap-3">
            <span className="protocol-title text-6xl tabular-nums">{tally.box}</span>
            <span className="text-xs text-muted-foreground">
              {tally.box === 1 ? "session" : "sessions"} · {milestone - tally.box} to No.{" "}
              {milestone}
            </span>
          </dd>
        </div>
        <Count label="Home" count={tally.home} />
        <Count
          label={tally.awayPlaces > 1 ? `Away · ${tally.awayPlaces} boxes` : "Away"}
          count={tally.away}
        />
        <div className="grid flex-1 content-start px-4 pt-2.5 pb-3">
          <dt className="form-label text-muted-foreground">Counted since</dt>
          <dd className="mt-3 text-lg font-semibold leading-7 font-stretch-semi-condensed">
            {monthYear.format(new Date(`${tally.since}T00:00:00`))}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Count({ label, count }: { readonly label: React.ReactNode; readonly count: number }) {
  return (
    <div className="grid min-w-36 content-start border-r px-4 pt-2.5 pb-3">
      <dt className="form-label text-muted-foreground">{label}</dt>
      <dd className="flex h-14 items-end">
        {count === 0 ? (
          <span data-empty aria-label="None yet" className="mb-3" />
        ) : (
          <span className="protocol-title text-4xl tabular-nums">{count}</span>
        )}
      </dd>
    </div>
  );
}
