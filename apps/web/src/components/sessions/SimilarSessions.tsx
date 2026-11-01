import {
  describeDifference,
  plannedPart,
  type DerivedSession,
  type MovementId,
  type PartRef,
} from "@chalk/contracts";
import { Badge } from "@chalk/ui/components/badge.tsx";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { formatKg } from "../../lib/blockLabels.ts";
import { planEchoGroups, type Echo, type PartEchoGroup } from "../../lib/similar.ts";
import { formatDay } from "../../lib/utils.ts";
import { similarToPlanAtom } from "../../state/sessions.ts";
import { SectionHeader } from "../import/SessionProtocol.tsx";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The part's score as written, else its heaviest set ("5 × 100 kg"). */
function PartResult({ part }: { readonly part: PartRef }) {
  if (part.result !== "")
    return (
      <span data-tag="score" data-chip className="block max-w-40 truncate px-1.5 font-semibold">
        {part.result}
      </span>
    );
  if (part.top !== null)
    return (
      <span className="font-semibold tabular-nums">
        {part.top.reps} × {formatKg(part.top.loadKg)}
      </span>
    );
  return <span data-empty aria-label="No result" />;
}

function MatchBadge({ echo }: { readonly echo: Echo }) {
  return echo.match.kind === "repeat" ? (
    <Badge>Repeat</Badge>
  ) : (
    <Badge variant="muted">{Math.round(echo.match.score * 100)} % alike</Badge>
  );
}

/** What differs, read from `performedOn` toward the other session; "Same workout" for a repeat. */
function echoDetail(echo: Echo, performedOn: string, nameOf: (id: MovementId) => string) {
  if (echo.match.kind === "repeat") return "Same workout";
  const when = echo.other.performedOn <= performedOn ? "then" : "later";
  return echo.match.differences
    .map((difference) => describeDifference(difference, nameOf, when))
    .join(" · ");
}

const summary = (groups: ReadonlyArray<PartEchoGroup>) => {
  const all = groups.flatMap((group) => group.echoes);
  const repeats = all.filter((echo) => echo.match.kind === "repeat").length;
  const similar = all.length - repeats;
  return [
    repeats > 0 ? plural(repeats, "repeat", "repeats") : "",
    similar > 0 ? `${similar} similar` : "",
  ]
    .filter((text) => text !== "")
    .join(" · ");
};

function EchoRow({
  performedOn,
  echo,
  nameOf,
  onOpen,
}: {
  readonly performedOn: string;
  readonly echo: Echo;
  readonly nameOf: (id: MovementId) => string;
  readonly onOpen: (workoutId: string) => void;
}) {
  const { match, other } = echo;
  return (
    <li>
      <button
        type="button"
        className="grid w-full cursor-pointer grid-cols-[9.5rem_5.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted"
        onClick={() => onOpen(other.workoutId)}
      >
        <span className="grid leading-tight">
          <span className="font-semibold tabular-nums">{formatDay(other.performedOn)}</span>
          <span className="text-xs text-muted-foreground">
            {other.sessionNumber === null ? other.workoutName : `No. ${other.sessionNumber}`} ·{" "}
            {other.title}
          </span>
        </span>
        <span>
          <MatchBadge echo={echo} />
        </span>
        <span className={match.kind === "repeat" ? "text-muted-foreground" : undefined}>
          {echoDetail(echo, performedOn, nameOf)}
        </span>
        <span className="justify-self-end">
          <PartResult part={other} />
        </span>
      </button>
    </li>
  );
}

/**
 * Where the session's parts were done before (or again later): repeats first, then the closest
 * look-alikes with what differs. A row opens that session.
 */
export function SimilarSessions({
  groups,
  nameOf,
  onOpen,
}: {
  readonly groups: ReadonlyArray<PartEchoGroup>;
  readonly nameOf: (id: MovementId) => string;
  readonly onOpen: (workoutId: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <section aria-label="Similar sessions">
      <SectionHeader title="Similar sessions" meta={summary(groups)} />
      {groups.map((group) => (
        <div key={group.key} className="border-b">
          <div className="flex items-baseline justify-between gap-3 border-b px-4 pb-1.5 pt-3 text-sm">
            <h4 className="font-semibold">{group.label}</h4>
            {group.part === undefined ? null : (
              <span className="flex items-baseline gap-2">
                <span className="form-label text-muted-foreground">Here</span>
                <PartResult part={group.part} />
              </span>
            )}
          </div>
          <ul className="divide-y">
            {group.echoes.map((echo) => (
              <EchoRow
                key={echo.other.id}
                performedOn={group.performedOn}
                echo={echo}
                nameOf={nameOf}
                onOpen={onOpen}
              />
            ))}
          </ul>
          {group.total > group.echoes.length ? (
            <p className="border-t px-4 py-1.5 text-xs text-muted-foreground">
              {plural(group.total - group.echoes.length, "more session", "more sessions")} like
              this, not shown
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/**
 * A plan's parts against the saved sessions; empty while that loads or if it fails, since the
 * comparison is extra.
 */
export function usePlanEchoes(
  session: DerivedSession,
  plannedOn: string,
): ReadonlyArray<PartEchoGroup> {
  const request = JSON.stringify({ plannedOn, parts: session.parts.map(plannedPart) });
  const similar = AsyncResult.getOrElse(useAtomValue(similarToPlanAtom(request)), () => undefined);
  return similar === undefined ? [] : planEchoGroups(similar, session, plannedOn);
}

/** At most this many sessions per part in the narrow brief. */
const BRIEF_MATCHES = 3;

/**
 * The narrow form for a day's plan: per part, the sessions it repeats or resembles, each with
 * when, how alike, what differs and the result then. A row opens that session.
 */
export function SimilarSessionsBrief({
  groups,
  nameOf,
}: {
  readonly groups: ReadonlyArray<PartEchoGroup>;
  readonly nameOf: (id: MovementId) => string;
}) {
  if (groups.length === 0) return null;
  return (
    <section aria-label="Done before" className="grid gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <h3 className="form-label text-muted-foreground">Done before</h3>
        <span className="text-xs text-muted-foreground">{summary(groups)}</span>
      </span>
      {groups.map((group) => {
        const shown = group.echoes.slice(0, BRIEF_MATCHES);
        return (
          <div key={group.key} className="grid gap-0.5">
            {groups.length > 1 ? (
              <h4 className="truncate text-xs font-semibold">{group.label}</h4>
            ) : null}
            <ul className="grid">
              {shown.map((echo) => (
                <li key={echo.other.id}>
                  <Link
                    to="/workouts"
                    search={{ session: echo.other.workoutId }}
                    className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-2 py-1 text-sm transition-colors duration-150 hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatDay(echo.other.performedOn)}
                      </span>
                      <MatchBadge echo={echo} />
                    </span>
                    <PartResult part={echo.other} />
                    <span className="col-span-2 line-clamp-2 text-xs text-muted-foreground">
                      {echoDetail(echo, group.performedOn, nameOf)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {group.total > shown.length ? (
              <p className="text-xs text-muted-foreground">
                {plural(group.total - shown.length, "more session", "more sessions")} like this
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
