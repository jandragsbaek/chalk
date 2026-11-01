import type { CoachReceipt } from "@chalk/contracts";
import { ChevronDown } from "lucide-react";

import type { LiveRead } from "../../lib/coach.ts";

/** Receipt anchors, so a citation in the reply can jump to the read it points at. */
export const receiptAnchor = (number: number) => `coach-receipt-${number}`;

/**
 * The coach's reads for one reply, boxed like protocol rows: the receipt number in the typed
 * gutter, the tool, what it asked for and what came back. Each row opens to the rows the model
 * saw. A read still running is dashed; one that failed is dashed red.
 */
export function Receipts({
  reads,
  open,
  onToggle,
}: {
  readonly reads: ReadonlyArray<LiveRead>;
  readonly open: ReadonlySet<number>;
  readonly onToggle: (number: number) => void;
}) {
  if (reads.length === 0) return null;
  return (
    <ol aria-label="What the coach read" className="border border-t-0 bg-card">
      {reads.map((read) => (
        <ReceiptRow
          key={read.number}
          read={read}
          open={open.has(read.number)}
          onToggle={() => onToggle(read.number)}
        />
      ))}
    </ol>
  );
}

function ReceiptRow({
  read,
  open,
  onToggle,
}: {
  readonly read: LiveRead;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const { receipt } = read;
  const status = receipt === undefined ? "running" : receipt.status;
  const canOpen = receipt !== undefined && receipt.status === "ok" && receipt.columns.length > 0;
  const tableId = `${receiptAnchor(read.number)}-table`;
  const line = (
    <>
      <span className="self-stretch border-r py-1.5 pr-2 text-right font-mono text-xs font-bold text-muted-foreground">
        R{read.number}
      </span>
      <span className="truncate py-1.5 font-semibold">{read.tool}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-1.5 py-1.5">
        {read.request.map((part) =>
          part.tag === "text" ? (
            <span key={part.text}>{part.text}</span>
          ) : (
            <span
              key={part.text}
              data-chip
              data-tag={part.tag === "range" ? "date" : part.tag}
              className="px-1.5 text-sm leading-6 font-medium"
            >
              {part.text}
            </span>
          ),
        )}
      </span>
      <span
        data-receipt-summary
        className={
          status === "failed"
            ? "py-1.5 text-right text-destructive"
            : "py-1.5 text-right text-muted-foreground tabular-nums"
        }
      >
        {receipt === undefined ? "Reading…" : receipt.summary}
      </span>
    </>
  );
  return (
    <li
      id={receiptAnchor(read.number)}
      data-receipt
      data-receipt-status={status}
      className="scroll-mt-24 border-t first:border-t-0"
    >
      {canOpen ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={onToggle}
          className="grid w-full cursor-pointer grid-cols-[2.75rem_10rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3 pr-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          {line}
          <ChevronDown
            aria-hidden
            className={
              open
                ? "size-4 rotate-180 text-foreground transition-transform duration-150"
                : "size-4 text-muted-foreground transition-transform duration-150"
            }
          />
        </button>
      ) : (
        <div className="grid grid-cols-[2.75rem_10rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3 pr-3 text-sm">
          {line}
        </div>
      )}
      {canOpen && open ? <ReceiptTable id={tableId} receipt={receipt} /> : null}
    </li>
  );
}

/** Receipt rows are positional (two equal sets on one day are two rows), so they key by line. */
const numbered = (rows: ReadonlyArray<ReadonlyArray<string>>) =>
  rows.map((row, line) => ({ line, row }));

function ReceiptTable({ id, receipt }: { readonly id: string; readonly receipt: CoachReceipt }) {
  return (
    <div id={id} className="border-t bg-background px-3 pt-2 pb-3 pl-14">
      <div className="max-h-80 overflow-y-auto border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            R{receipt.number}, {receipt.tool}: {receipt.request.map((part) => part.text).join(", ")}
          </caption>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b">
              {receipt.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="form-label px-3 py-1.5 text-left text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numbered(receipt.rows).map(({ line, row }) => (
              <tr key={line} className="border-b last:border-b-0">
                {receipt.columns.map((column, at) => (
                  <td key={column} className="px-3 py-1.5 tabular-nums">
                    {row[at] === undefined || row[at] === "" ? (
                      <span data-empty aria-label="none" />
                    ) : (
                      row[at]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {receipt.rows.some((row) => row.some((cell) => cell.endsWith("*"))) ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          * Implied by a heavier or longer set, not tested.
        </p>
      ) : null}
      {receipt.truncated > 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {receipt.truncated} more rows went to the coach; the first {receipt.rows.length} are kept
          here.
        </p>
      ) : null}
    </div>
  );
}
