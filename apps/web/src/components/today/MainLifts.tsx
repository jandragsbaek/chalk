import { Link } from "@tanstack/react-router";

import type { LiftSummary } from "../../lib/dashboard.ts";
import { kg, signedKg } from "../chart.tsx";
import { MoreLink, SectionHead } from "./SectionHead.tsx";

const rangeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/**
 * The main barbell lifts: best estimated 1RM to date with its formula spread (or "tested" for a
 * single), how far it moved over the window, and a trace of the window's sessions.
 */
export function MainLifts({
  lifts,
  today,
  windowDays,
}: {
  readonly lifts: ReadonlyArray<LiftSummary>;
  readonly today: Date;
  readonly windowDays: number;
}) {
  const weeks = Math.round(windowDays / 7);
  return (
    <section aria-labelledby="lifts-title" className="grid grid-cols-1 content-start">
      <SectionHead
        id="lifts-title"
        title="Main lifts"
        meta={
          <Link to="/strength">
            <MoreLink>Strength</MoreLink>
          </Link>
        }
      />
      {lifts.length === 0 ? (
        <p className="border-b bg-card px-3 py-4 text-sm text-muted-foreground">
          No barbell sets yet. Log one on Strength, or import a session, and its estimated 1RM shows
          up here.
        </p>
      ) : (
        <table className="w-full bg-card text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="form-label px-3 py-1.5 text-muted-foreground">
                Lift
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                e1RM
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                {weeks} wk
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-muted-foreground">
                <span className="sr-only">Sessions over {weeks} weeks</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lifts.map((lift) => (
              <tr key={lift.movementId} className="h-14 border-b">
                <th scope="row" className="max-w-36 px-3 py-1.5 text-left font-medium">
                  <span
                    data-tag="movement"
                    data-chip
                    className="inline-block max-w-full truncate px-1.5"
                  >
                    {lift.name}
                  </span>
                </th>
                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                  <span className="font-semibold">{kg(lift.e1rm)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {lift.tested
                      ? "tested single"
                      : `${rangeFormat.format(lift.low)}–${rangeFormat.format(lift.high)}`}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                  {lift.change === undefined ? (
                    <span data-empty aria-label="No earlier estimate" />
                  ) : lift.change === 0 ? (
                    <span className="text-muted-foreground">±0</span>
                  ) : (
                    signedKg(lift.change)
                  )}
                </td>
                <td className="w-32 px-3 py-1.5">
                  <Trace lift={lift} today={today} windowDays={windowDays} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const W = 112;
const H = 30;
const PAD = 3;

/** Each session's best estimate as a small square; the best to date as an ink step line. */
function Trace({
  lift,
  today,
  windowDays,
}: {
  readonly lift: LiftSummary;
  readonly today: Date;
  readonly windowDays: number;
}) {
  // Sessions sit at local midnight: the window runs from its first midnight to today's.
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - windowDays,
  ).getTime();
  const values = [...lift.sessions, ...lift.best].map((point) => point.e1rm);
  if (values.length === 0) return <span data-empty aria-label="No sessions in the window" />;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (date: Date) => PAD + ((date.getTime() - start) / (end - start)) * (W - 2 * PAD);
  const y = (value: number) =>
    high === low ? H / 2 : H - PAD - ((value - low) / span) * (H - 2 * PAD);

  let path = "";
  lift.best.forEach((step, index) => {
    path += index === 0 ? `M${x(step.date)},${y(step.e1rm)}` : `H${x(step.date)}V${y(step.e1rm)}`;
  });
  if (lift.best.length > 0) path += `H${W - PAD}`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${lift.sessions.length} sessions in the window`}
      className="block"
    >
      {path ? <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={1.5} /> : null}
      {lift.sessions.map((session) => (
        <rect
          key={session.date.getTime()}
          x={x(session.date) - 2}
          y={y(session.e1rm) - 2}
          width={4}
          height={4}
          fill="var(--muted-foreground)"
        />
      ))}
    </svg>
  );
}
