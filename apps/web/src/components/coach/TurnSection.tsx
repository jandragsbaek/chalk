import { coachModelLabel, type CoachTurn } from "@chalk/contracts";
import type * as React from "react";

import { Fragment } from "react";

import { citeSegments, paragraphs, type LiveRead } from "../../lib/coach.ts";
import { receiptAnchor, Receipts } from "./Receipts.tsx";

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

const STOPPED: Record<"read-limit" | "step-limit", string> = {
  "read-limit": "Stopped reading at the limit for one reply",
  "step-limit": "Stopped at the limit of model calls for one reply",
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * A turn's heading, like a protocol section: its number as an ink part mark, who spoke in
 * condensed caps on a 2px ink rule, meta on the right.
 */
function TurnHead({
  seq,
  who,
  meta,
}: {
  readonly seq: number;
  readonly who: "You" | "Coach";
  readonly meta: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-foreground pb-1.5">
      <h3 className="protocol-title flex items-center gap-2 text-lg">
        <span
          aria-label={`Turn ${seq}`}
          className="inline-flex h-5 min-w-5 items-center justify-center bg-foreground px-1 text-sm text-background tabular-nums"
        >
          {seq}
        </span>
        {who}
      </h3>
      <span className="form-label text-muted-foreground">{meta}</span>
    </div>
  );
}

/** The athlete's message: what they typed, in the typewriter, in a box they wrote in. */
export function AthleteSection({ turn }: { readonly turn: CoachTurn }) {
  return (
    <section aria-label="You" className="grid gap-2.5">
      <TurnHead seq={turn.seq} who="You" meta={clock.format(new Date(turn.createdAt))} />
      <p className="border border-input bg-card px-3 py-2 font-mono text-base leading-7 whitespace-pre-wrap">
        {turn.text}
      </p>
    </section>
  );
}

/**
 * The coach's reply: its reads first, as receipts, then what it wrote. Citations like "(R2)"
 * become links that open the receipt they point at.
 */
export function CoachSection({
  turn,
  open,
  onToggle,
  onCite,
  cited,
}: {
  readonly turn: CoachTurn;
  /** Every receipt number in the thread: a reply may cite a read from an earlier turn. */
  readonly cited: ReadonlySet<number>;
  readonly open: ReadonlySet<number>;
  readonly onToggle: (number: number) => void;
  readonly onCite: (number: number) => void;
}) {
  const reads: ReadonlyArray<LiveRead> = turn.receipts.map((receipt) => ({
    number: receipt.number,
    tool: receipt.tool,
    request: receipt.request,
    receipt,
  }));
  return (
    <section aria-label="Coach" className="grid gap-3">
      <div>
        <TurnHead
          seq={turn.seq}
          who="Coach"
          meta={[
            ...(turn.model === undefined ? [] : [coachModelLabel(turn.model)]),
            plural(turn.receipts.length, "read"),
            clock.format(new Date(turn.createdAt)),
          ].join(" · ")}
        />
        <Receipts reads={reads} open={open} onToggle={onToggle} />
      </div>
      {turn.stopped === "model-error" ? (
        <p
          role="note"
          data-coach-failed
          className="max-w-[65ch] bg-card px-3 py-2 text-sm text-destructive"
        >
          {turn.text}
        </p>
      ) : (
        <div className="grid max-w-[65ch] gap-3 text-base leading-7">
          {paragraphs(turn.text).map((paragraph) => (
            <p key={paragraph.offset} className="whitespace-pre-wrap">
              {citeSegments(paragraph.text).map((segment) =>
                segment.kind === "text" ? (
                  <Fragment key={segment.offset}>{segment.text}</Fragment>
                ) : (
                  <Citation
                    key={segment.offset}
                    number={segment.number}
                    known={cited.has(segment.number)}
                    onCite={onCite}
                  />
                ),
              )}
            </p>
          ))}
        </div>
      )}
      {turn.stopped === undefined || turn.stopped === "model-error" ? null : (
        <p className="w-fit border border-dashed border-input px-2 py-0.5 text-xs text-muted-foreground">
          {STOPPED[turn.stopped]}
        </p>
      )}
    </section>
  );
}

/** A receipt reference in the reply: R2 in the typed face, jumping to its receipt. */
function Citation({
  number,
  known,
  onCite,
}: {
  readonly number: number;
  readonly known: boolean;
  readonly onCite: (number: number) => void;
}) {
  if (!known) return <span className="font-mono text-sm font-bold">R{number}</span>;
  return (
    <a
      href={`#${receiptAnchor(number)}`}
      onClick={(event) => {
        event.preventDefault();
        onCite(number);
      }}
      className="font-mono text-sm font-bold text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
    >
      R{number}
    </a>
  );
}

/** The coach at work: its reads landing one by one, before it has written anything. */
export function ReadingSection({
  seq,
  model,
  reads,
  open,
  onToggle,
}: {
  /** The number the reply will take. */
  readonly seq: number;
  /** The slug answering, when this page sent the message. */
  readonly model: string | null;
  readonly reads: ReadonlyArray<LiveRead>;
  readonly open: ReadonlySet<number>;
  readonly onToggle: (number: number) => void;
}) {
  return (
    <section aria-label="Coach" aria-busy className="grid gap-3">
      <div>
        <TurnHead
          seq={seq}
          who="Coach"
          meta={[
            ...(model === null ? [] : [coachModelLabel(model)]),
            reads.length === 0 ? "Thinking…" : `Reading… ${plural(reads.length, "read")}`,
          ].join(" · ")}
        />
        <Receipts reads={reads} open={open} onToggle={onToggle} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {reads.length === 0
          ? "The coach is deciding what to read."
          : "Writing once the reads are in."}
      </p>
    </section>
  );
}
