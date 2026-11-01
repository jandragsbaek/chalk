import type { BlockWork, MovementId, SessionWork } from "@chalk/contracts";
import { Link } from "@tanstack/react-router";

import { formatClock, formatKj, formatWatts, leftOutLines } from "../../lib/power.ts";
import { SectionHeader } from "../import/SessionProtocol.tsx";

const Empty = ({ label }: { readonly label: string }) => <span data-empty aria-label={label} />;

function BlockRow({ title, work }: { readonly title: string; readonly work: BlockWork }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-1.5 text-left font-semibold">
        {title}
        {work.skipped ? (
          <span className="ml-2 font-normal text-muted-foreground">{work.skipped}</span>
        ) : null}
      </th>
      <td className="px-4 py-1.5 text-right tabular-nums">
        {work.skipped ? <Empty label="No work" /> : formatKj(work.joules)}
      </td>
      <td className="px-4 py-1.5 text-right tabular-nums">
        {work.skipped || work.seconds === undefined ? (
          <Empty label="No time" />
        ) : (
          formatClock(work.seconds)
        )}
      </td>
      <td className="px-4 py-1.5 text-right font-semibold tabular-nums">
        {work.watts === undefined ? <Empty label="No power" /> : formatWatts(work.watts)}
      </td>
    </tr>
  );
}

/**
 * The session's estimated work and power, block by block, with what could not be counted. Asks
 * for height and a weigh-in when the profile has neither, since the estimate needs both.
 */
export function WorkSection({
  work,
  bodyLabel,
  nameOf,
}: {
  /** `undefined` while the profile lacks height or bodyweight. */
  readonly work: SessionWork | undefined;
  /** "180 cm · 85 kg on that day". */
  readonly bodyLabel: string;
  readonly nameOf: (id: MovementId) => string;
}) {
  if (work === undefined)
    return (
      <section aria-label="Work and power">
        <SectionHeader title="Work and power" meta="Estimated" />
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Set your height and log a bodyweight in{" "}
          <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
            Settings
          </Link>{" "}
          to estimate the work this session took.
        </p>
      </section>
    );
  const blocks = work.parts.flatMap((part) =>
    part.blocks.map((block) => ({
      key: `${part.title}/${block.title}`,
      title: block.title === "" ? part.title : `${part.title} · ${block.title}`,
      work: block.work,
    })),
  );
  if (blocks.length === 0 && work.notesJoules === 0) return null;
  const leftOut = leftOutLines(
    work.parts.flatMap((part) => part.blocks.flatMap((block) => block.work.leftOut)),
    nameOf,
  );
  return (
    <section aria-label="Work and power">
      <SectionHeader title="Work and power" meta={`Estimated for ${bodyLabel}`} />
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="form-label text-left text-muted-foreground">
            <th className="px-4 py-1.5 font-semibold">Block</th>
            <th className="w-28 px-4 py-1.5 text-right font-semibold">Work</th>
            <th className="w-24 px-4 py-1.5 text-right font-semibold">Time</th>
            <th className="w-24 px-4 py-1.5 text-right font-semibold">Power</th>
          </tr>
        </thead>
        <tbody className="divide-y border-b">
          {blocks.map((block) => (
            <BlockRow key={block.key} title={block.title} work={block.work} />
          ))}
          {work.notesJoules > 0 ? (
            <tr>
              <th scope="row" className="px-4 py-1.5 text-left font-semibold">
                Lifts in the notes
              </th>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatKj(work.notesJoules)}</td>
              <td className="px-4 py-1.5 text-right">
                <Empty label="No time" />
              </td>
              <td className="px-4 py-1.5 text-right">
                <Empty label="No power" />
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot className="border-b-2 border-foreground">
          <tr>
            <th scope="row" className="px-4 py-1.5 text-left font-semibold">
              Session
            </th>
            <td className="px-4 py-1.5 text-right font-semibold tabular-nums">
              {formatKj(work.joules)}
            </td>
            <td className="px-4 py-1.5 text-right tabular-nums">
              {work.timedSeconds > 0 ? formatClock(work.timedSeconds) : <Empty label="No time" />}
            </td>
            <td className="px-4 py-1.5 text-right text-lg font-bold tabular-nums font-stretch-semi-condensed">
              {work.watts === undefined ? <Empty label="No power" /> : formatWatts(work.watts)}
            </td>
          </tr>
        </tfoot>
      </table>
      {leftOut.length > 0 ? (
        <div className="grid gap-0.5 px-4 py-2 text-xs text-muted-foreground">
          <span className="form-label">Not counted</span>
          {leftOut.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
