import { describeDifference, partLabel, type MovementId, type PartRef } from "@chalk/contracts";
import { Badge } from "@chalk/ui/components/badge.tsx";

import { formatKg } from "../../lib/blockLabels.ts";
import type { Echo, PartEchoGroup } from "../../lib/similar.ts";
import { formatDay } from "../../lib/utils.ts";
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

function EchoRow({
  part,
  echo,
  nameOf,
  onOpen,
}: {
  readonly part: PartRef;
  readonly echo: Echo;
  readonly nameOf: (id: MovementId) => string;
  readonly onOpen: (workoutId: string) => void;
}) {
  const { match, other } = echo;
  const when = other.performedOn <= part.performedOn ? "then" : "later";
  const differences = match.differences.map((difference) =>
    describeDifference(difference, nameOf, when),
  );
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
          {match.kind === "repeat" ? (
            <Badge>Repeat</Badge>
          ) : (
            <Badge variant="muted">{Math.round(match.score * 100)} % alike</Badge>
          )}
        </span>
        <span className={match.kind === "repeat" ? "text-muted-foreground" : undefined}>
          {match.kind === "repeat" ? "Same workout" : differences.join(" · ")}
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
  const all = groups.flatMap((group) => group.echoes);
  const repeats = all.filter((echo) => echo.match.kind === "repeat").length;
  const similar = all.length - repeats;
  const meta = [
    repeats > 0 ? plural(repeats, "repeat", "repeats") : "",
    similar > 0 ? `${similar} similar` : "",
  ]
    .filter((text) => text !== "")
    .join(" · ");
  return (
    <section aria-label="Similar sessions">
      <SectionHeader title="Similar sessions" meta={meta} />
      {groups.map((group) => (
        <div key={group.part.id} className="border-b">
          <div className="flex items-baseline justify-between gap-3 border-b px-4 pb-1.5 pt-3 text-sm">
            <h4 className="font-semibold">{partLabel(group.part)}</h4>
            <span className="flex items-baseline gap-2">
              <span className="form-label text-muted-foreground">Here</span>
              <PartResult part={group.part} />
            </span>
          </div>
          <ul className="divide-y">
            {group.echoes.map((echo) => (
              <EchoRow
                key={echo.other.id}
                part={group.part}
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
