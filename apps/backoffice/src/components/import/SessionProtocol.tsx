import {
  formatPerformed,
  formatQuantity,
  tonnageOf,
  type DerivedBlock,
  type DerivedItem,
  type DerivedSession,
  type ImportIssue,
  type ItemGrade,
  type MovementId,
  type SpanId,
} from "@chalk/contracts";

import { describeBlock, formatKg } from "../../lib/blockLabels.ts";
import { LevelLine } from "./LevelVerdict.tsx";

export interface ProtocolHandlers {
  readonly nameOf: (id: MovementId) => string | undefined;
  /** Name of the core movement when `id` is a variation ("Snatch" for a power snatch). */
  readonly coreOf: (id: MovementId) => string | undefined;
  /** The movement graded against the level sheet; none when it is on no row of it. */
  readonly gradeOf: (id: SpanId) => ItemGrade | undefined;
  readonly selectedId: SpanId | undefined;
  readonly linked: ReadonlySet<SpanId>;
  readonly onSelect: (id: SpanId) => void;
  readonly onHover: (id: SpanId | undefined) => void;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const countItems = (items: ReadonlyArray<DerivedItem>): number =>
  items.reduce((total, item) => total + 1 + countItems(item.alternatives), 0);

const blockItems = (blocks: ReadonlyArray<DerivedBlock>) =>
  countItems(blocks.flatMap((block) => block.items));

function ItemRow({
  item,
  handlers,
  alternative,
}: {
  readonly item: DerivedItem;
  readonly handlers: ProtocolHandlers;
  readonly alternative?: boolean;
}) {
  const name = item.movementId === undefined ? undefined : handlers.nameOf(item.movementId);
  const core = item.movementId === undefined ? undefined : handlers.coreOf(item.movementId);
  // Re-keyed when the row's content changes, so an edit lights the rows it touched.
  const signature = JSON.stringify([item.movementId, item.sets, item.performed, item.performance]);
  const grade = handlers.gradeOf(item.spanId);
  return (
    <li>
      <button
        type="button"
        data-protocol-row
        data-open={name === undefined ? "" : undefined}
        data-selected={handlers.selectedId === item.spanId ? "" : undefined}
        data-linked={handlers.linked.has(item.spanId) ? "" : undefined}
        className="relative grid w-full grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-start gap-4 px-4 py-1 text-left"
        onClick={() => handlers.onSelect(item.spanId)}
        onMouseEnter={() => handlers.onHover(item.spanId)}
        onMouseLeave={() => handlers.onHover(undefined)}
      >
        <span key={signature} data-flash aria-hidden />
        <span
          className={
            alternative
              ? "relative flex min-w-0 items-baseline gap-2 pl-5 leading-7"
              : "relative flex min-w-0 items-baseline gap-2 leading-7"
          }
        >
          {alternative ? <span className="form-label text-muted-foreground">or</span> : null}
          {name === undefined ? (
            <span className="grid min-w-0 leading-5">
              <span className="truncate font-mono font-bold">{item.text}</span>
              <span className="form-label whitespace-nowrap text-destructive">Pick a movement</span>
            </span>
          ) : (
            <span className="grid min-w-0 leading-5">
              <span className="truncate font-semibold">{name}</span>
              {core === undefined ? null : (
                <span className="form-label truncate text-muted-foreground">{core} variation</span>
              )}
            </span>
          )}
        </span>
        <span className="relative flex flex-wrap gap-1.5">
          {item.sets.length === 0 ? (
            <span className="flex h-7 items-center gap-2 text-xs text-muted-foreground">
              <span data-empty aria-hidden />
              no numbers
            </span>
          ) : (
            item.sets.map((set) => (
              <span key={set.line} data-attempt className="inline-flex gap-0.5 p-0.5">
                {set.quantities.map((quantity) => (
                  <span
                    key={`${quantity.measure}-${quantity.amount.min}-${quantity.amount.max}`}
                    data-chip
                    data-measure={quantity.measure}
                    className="px-1.5 text-sm font-medium leading-6 tabular-nums"
                  >
                    {formatQuantity(quantity)}
                  </span>
                ))}
              </span>
            ))
          )}
          {item.performed.length > 0 ? (
            <span
              data-result-box
              className="flex basis-full flex-wrap items-baseline gap-x-2 bg-card px-1.5 text-sm leading-6"
            >
              <span className="form-label text-muted-foreground">Lifted</span>
              <span className="tabular-nums">{formatPerformed(item.performed)}</span>
              <span className="ml-auto font-semibold tabular-nums">
                {formatKg(tonnageOf(item.performed))}
              </span>
            </span>
          ) : null}
          {grade ? <LevelLine grade={grade} nameOf={handlers.nameOf} /> : null}
        </span>
      </button>
      {item.alternatives.length > 0 ? (
        <ul>
          {item.alternatives.map((alternativeItem) => (
            <ItemRow
              key={alternativeItem.spanId}
              item={alternativeItem}
              handlers={handlers}
              alternative
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SectionHeader({ title, meta }: { readonly title: string; readonly meta: string }) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b-2 border-foreground px-4 pb-1 pt-5">
      <h3 className="protocol-title text-xl">{title}</h3>
      <span className="form-label text-muted-foreground">{meta}</span>
    </header>
  );
}

function Issues({
  issues,
  lineOf,
  onSelect,
}: {
  readonly issues: ReadonlyArray<ImportIssue>;
  readonly lineOf: (id: SpanId) => number | undefined;
  readonly onSelect: (id: SpanId) => void;
}) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return (
    <section aria-label="Issues" className="border-b bg-card">
      <header className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
        <h3 className="protocol-title text-base">To fix</h3>
        <span className="form-label text-muted-foreground">
          {errors.length === 0
            ? "Nothing blocks saving"
            : `${plural(errors.length, "issue blocks", "issues block")} saving`}
          {warnings.length > 0 ? `, ${warnings.length} left out` : ""}
        </span>
      </header>
      <ul className="pb-2">
        {[...errors, ...warnings].map((issue) => {
          const line = issue.spanId === undefined ? undefined : lineOf(issue.spanId);
          return (
            <li key={`${issue.severity}-${issue.spanId ?? ""}-${issue.message}`}>
              <button
                type="button"
                disabled={issue.spanId === undefined}
                className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-1 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => (issue.spanId ? onSelect(issue.spanId) : undefined)}
              >
                <span data-issue-mark={issue.severity} aria-hidden />
                <span className="w-7 shrink-0 font-mono text-xs leading-5 text-muted-foreground">
                  {line === undefined ? "" : `L${line}`}
                </span>
                <span
                  className={
                    issue.severity === "error" ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {issue.message}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The session as it will be saved, set like a meet protocol: parts, their blocks, one row per
 * movement with its sets in boxes and what was lifted, and the lift sets read from the notes.
 */
export function SessionProtocol({
  session,
  lineOf,
  handlers,
}: {
  readonly session: DerivedSession;
  readonly lineOf: (id: SpanId) => number | undefined;
  readonly handlers: ProtocolHandlers;
}) {
  return (
    <div className="grid content-start">
      {session.issues.length > 0 ? (
        <Issues issues={session.issues} lineOf={lineOf} onSelect={handlers.onSelect} />
      ) : null}

      {session.parts.length === 0 && session.liftSets.length === 0 ? (
        <p className="px-4 py-10 text-sm text-muted-foreground">
          Nothing in the protocol yet. Select a movement in the text and press M, or Re-suggest to
          let Chalk try again.
        </p>
      ) : null}

      {session.parts.map((part) => (
        <section key={part.spanId ?? "implicit"} aria-label={part.title}>
          <SectionHeader
            title={part.title}
            meta={`${plural(part.blocks.length, "block", "blocks")}, ${plural(blockItems(part.blocks), "movement", "movements")}`}
          />
          <div
            aria-hidden
            className="form-label grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-4 border-b px-4 py-1 text-muted-foreground"
          >
            <span>Movement</span>
            <span>Prescription, one box per set</span>
          </div>
          {part.blocks.map((block, index) => (
            <div key={block.spanId ?? `implicit-${index}`} className="border-b">
              <div className="flex min-h-8 items-center justify-between gap-3 bg-muted px-4">
                <button
                  type="button"
                  disabled={block.spanId === undefined}
                  className="cursor-pointer text-sm font-bold uppercase tracking-wide font-stretch-condensed hover:underline disabled:cursor-default disabled:no-underline"
                  onClick={() => (block.spanId ? handlers.onSelect(block.spanId) : undefined)}
                >
                  {describeBlock(block.format, block.params)}
                </button>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {block.scores.map((score) => (
                    <span
                      key={score}
                      data-result-box
                      className="flex items-baseline gap-1.5 bg-card px-1.5 text-sm font-semibold leading-6"
                    >
                      <span className="form-label text-muted-foreground">Score</span>
                      {score}
                    </span>
                  ))}
                  {block.tonnageKg > 0 ? (
                    <span
                      data-result-box
                      className="flex items-baseline gap-1.5 bg-card px-1.5 text-sm font-semibold leading-6 tabular-nums"
                    >
                      <span className="form-label text-muted-foreground">Lifted</span>
                      {formatKg(block.tonnageKg)}
                    </span>
                  ) : null}
                </span>
              </div>
              {block.intents.length > 0 ? (
                <ul className="divide-y border-b">
                  {block.intents.map((intent) => (
                    <li key={intent.spanId}>
                      <button
                        type="button"
                        data-protocol-row
                        data-intent
                        data-selected={handlers.selectedId === intent.spanId ? "" : undefined}
                        className="grid w-full grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-start gap-4 px-4 py-1 text-left"
                        onClick={() => handlers.onSelect(intent.spanId)}
                      >
                        <span className="form-label leading-7 text-muted-foreground">Intent</span>
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-7">
                          <span className="font-mono">{intent.text}</span>
                          {intent.quantities.map((quantity) => (
                            <span
                              key={`${quantity.measure}-${quantity.amount.min}-${quantity.amount.max}`}
                              data-chip
                              data-measure={quantity.measure}
                              className="px-1.5 text-sm font-medium leading-6 tabular-nums"
                            >
                              {formatQuantity(quantity)}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {block.items.length === 0 ? (
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  No movements in this block.
                </p>
              ) : (
                <ul className="divide-y">
                  {block.items.map((item) => (
                    <ItemRow key={item.spanId} item={item} handlers={handlers} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}

      {session.liftSets.length > 0 ? (
        <section aria-label="Lift sets from the notes">
          <SectionHeader
            title="Results"
            meta={`${plural(session.liftSets.length, "lift set", "lift sets")} from the notes`}
          />
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="form-label text-left text-muted-foreground">
                <th className="px-4 py-1.5 font-semibold">Movement</th>
                <th className="px-4 py-1.5 text-right font-semibold">Sets</th>
                <th className="px-4 py-1.5 text-right font-semibold">Reps</th>
                <th className="px-4 py-1.5 text-right font-semibold">Load</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {session.liftSets.map((set) => (
                <tr
                  key={`${set.movementSpanId}-${set.reps}-${set.loadKg}`}
                  data-protocol-row
                  data-selected={handlers.selectedId === set.movementSpanId ? "" : undefined}
                  data-linked={handlers.linked.has(set.movementSpanId) ? "" : undefined}
                  onMouseEnter={() => handlers.onHover(set.movementSpanId)}
                  onMouseLeave={() => handlers.onHover(undefined)}
                >
                  <td className="px-4 py-1.5">
                    <button
                      type="button"
                      className="cursor-pointer font-semibold hover:underline"
                      onClick={() => handlers.onSelect(set.movementSpanId)}
                    >
                      {handlers.nameOf(set.movementId)}
                    </button>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{set.count}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{set.reps}</td>
                  <td className="px-4 py-1.5 text-right font-semibold tabular-nums">
                    {set.loadKg} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
