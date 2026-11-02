import {
  describeBlock,
  formatBlockResult,
  benchmarkById,
  type BlockResult,
  formatPerformed,
  formatQuantity,
  tonnageOf,
  type DerivedBlock,
  type DerivedItem,
  type DerivedSession,
  type ImportIssue,
  type ItemGrade,
  levelKey,
  levelName,
  scoresMovements,
  type MovementId,
  type Sex,
  type SpanId,
} from "@chalk/contracts";
import { LevelBadge } from "@chalk/ui/components/level-ruler.tsx";
import { Plus } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { formatKg } from "../../lib/blockLabels.ts";
import { formatComplex, type Complex } from "../../lib/complexes.ts";
import { describePlan } from "../../lib/plan.ts";
import { useAthleteSex } from "../../lib/profile.ts";
import {
  boardTonnageOf,
  isStruck,
  loadChangeOf,
  loadSide,
  shareOfBoard,
} from "../../lib/scaledLoad.ts";
import { chosenOption } from "../../lib/station.ts";
import { BlockResultEditor } from "./BlockResultEditor.tsx";
import { LevelLine, type GradeSide, type LevelLead } from "./LevelVerdict.tsx";

export interface ProtocolNames {
  readonly nameOf: (id: MovementId) => string | undefined;
  /** Name of the core movement when `id` is a variation ("Snatch" for a power snatch). */
  readonly coreOf: (id: MovementId) => string | undefined;
  /** The movement graded against the level sheet; none when it is on no row of it. */
  readonly gradeOf: (id: SpanId) => ItemGrade | undefined;
  /** Whose level `gradeOf` grades: what was done, or the plan while planning. */
  readonly gradeSide?: GradeSide;
  /** The complex a movement is part of (one bar, loads entered once); none for most. */
  readonly complexOf?: (id: SpanId) => Complex | undefined;
}

/**
 * The importer's side of the protocol: rows select their mark in the text and light up with it,
 * and the issues list points at line numbers. Without it the protocol only reads.
 */
export interface ProtocolEditor {
  readonly selectedId: SpanId | undefined;
  readonly linked: ReadonlySet<SpanId>;
  readonly onSelect: (id: SpanId) => void;
  readonly onHover: (id: SpanId | undefined) => void;
  readonly lineOf: (id: SpanId) => number | undefined;
  /** Only the selected row draws its level ruler, and a row with nothing to say has no level line. */
  readonly rulerOnSelectedOnly?: boolean;
  /** Words left after the row's mark that may name a variation ("o. line"). */
  readonly tailOf?: (id: SpanId) => string | undefined;
  /** Enters a block's result on the span holding it; absent while planning. */
  readonly onResult?: (spanId: SpanId, result: BlockResult | undefined) => void;
  /** The result saved on `spanId`, even one that no longer fits its block. */
  readonly storedResultOf?: (spanId: SpanId) => BlockResult | undefined;
  /** Sets the time cap of the block span `spanId`. */
  readonly onCap?: (spanId: SpanId, seconds: number | undefined) => void;
}

/** Row state the editor reads: selected, lit by a hovered mark. */
const rowState = (editor: ProtocolEditor | undefined, id: SpanId) => ({
  "data-selected": editor?.selectedId === id ? "" : undefined,
  "data-linked": editor?.linked.has(id) ? "" : undefined,
});

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Stations of the blocks: "60 DU or 90 SU" is one, done one way. */
const stationCount = (blocks: ReadonlyArray<DerivedBlock>) =>
  blocks.reduce((total, block) => total + block.items.length, 0);

/**
 * What the row's level line leads with. Planning: the plan. Logging a plan: what was done once
 * it is recorded (the plan noted when it differs), else the plan still waiting. Without a plan,
 * a count reached each round ("7-8 cal each round") is the one thing the row shows as done.
 */
const leadOf = (item: DerivedItem, names: ProtocolNames, sex: Sex): LevelLead | undefined => {
  const plan =
    item.plan === undefined ? undefined : describePlan(item.plan, names.nameOf, sex, item);
  if (names.gradeSide === "planned" || item.performance === undefined)
    return plan === undefined ? undefined : { label: "Planned", text: plan };
  const done = describePlan(item.performance, names.nameOf, sex, item);
  if (plan === undefined)
    return item.performance.perRound === undefined ? undefined : { label: "Done", text: done };
  return done === plan
    ? { label: "Done", text: done, note: "as planned" }
    : { label: "Done", text: done, note: `planned ${plan}` };
};

/**
 * One way to do a station. The option the station is done (or planned) by gets the full row with
 * its level line; another option is one compact "or" line with the level the board asks of it,
 * dimmed once a different option was picked.
 */
function OptionRow({
  item,
  names,
  editor,
  alternative,
  full,
  passed,
  inComplex = false,
  scored = false,
}: {
  readonly item: DerivedItem;
  readonly names: ProtocolNames;
  readonly editor: ProtocolEditor | undefined;
  readonly alternative: boolean;
  readonly full: boolean;
  /** Another option of the station was picked. */
  readonly passed: boolean;
  /** In a complex sharing one bar, which prints what was lifted once for all its rows. */
  readonly inComplex?: boolean;
  /**
   * In a block scored as a whole: what it lifted follows from how it was done, which the row
   * already prints, and the block header totals it.
   */
  readonly scored?: boolean;
}) {
  const sex = useAthleteSex();
  const name = item.movementId === undefined ? undefined : names.nameOf(item.movementId);
  const core = item.movementId === undefined ? undefined : names.coreOf(item.movementId);
  // Re-keyed when the row's content changes, so an edit lights the rows it touched.
  const signature = JSON.stringify([
    item.movementId,
    item.sets,
    item.performed,
    item.performance,
    item.plan,
  ]);
  const grade = names.gradeOf(item.spanId);
  const tail = editor?.tailOf?.(item.spanId);
  const lead = full ? leadOf(item, names, sex) : undefined;
  // Planning, a load is meant rather than used: the plan line says it, nothing is struck.
  const change = names.gradeSide === "planned" ? undefined : loadChangeOf(item, sex);
  const selected = editor?.selectedId === item.spanId;
  // Quiet rows: only the selected one, and one with something done or planned, print a level.
  const levelLine =
    full &&
    grade !== undefined &&
    (!editor?.rulerOnSelectedOnly ||
      selected ||
      lead !== undefined ||
      grade.performed !== undefined);
  const content = (
    <>
      {editor ? <span key={signature} data-flash aria-hidden /> : null}
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
            {tail !== undefined ? (
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span data-tail className="truncate font-mono text-xs font-bold">
                  {tail}
                </span>
                <span className="form-label shrink-0 text-muted-foreground">variation?</span>
              </span>
            ) : core === undefined ? null : (
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
              {set.quantities.map((quantity) => {
                const key = `${quantity.measure}-${quantity.amount.min}-${quantity.amount.max}`;
                if (change === undefined || !isStruck(quantity, change, sex))
                  return (
                    <span
                      key={key}
                      data-chip
                      data-measure={quantity.measure}
                      className="px-1.5 text-sm font-medium leading-6 tabular-nums"
                    >
                      {formatQuantity(quantity)}
                    </span>
                  );
                // A changed attempt: the board's load struck, the one used written beside it.
                const board = formatQuantity({
                  measure: quantity.measure,
                  amount: loadSide(quantity, sex),
                });
                return (
                  <Fragment key={key}>
                    <del
                      data-chip
                      data-measure={quantity.measure}
                      data-struck
                      title={`The board wrote ${board}`}
                      className="px-1.5 text-sm font-medium leading-6 tabular-nums"
                    >
                      {board}
                    </del>
                    <ins
                      data-chip
                      data-measure={quantity.measure}
                      title={`Done at ${formatKg(change.doneKg)}`}
                      className="px-1.5 text-sm font-medium leading-6 tabular-nums no-underline"
                    >
                      {formatKg(change.doneKg)}
                    </ins>
                  </Fragment>
                );
              })}
            </span>
          ))
        )}
        {change === undefined ? null : (
          <span className="flex h-7 items-center text-xs text-muted-foreground tabular-nums">
            {shareOfBoard(change.doneKg, change.boardKg)} % of board
          </span>
        )}
        {!full && grade?.prescribed !== undefined ? (
          <span className="flex h-7 items-center">
            <LevelBadge
              level={levelKey(grade.prescribed.level)}
              open
              title={`The board asks ${levelName(grade.prescribed.level)} of this option`}
            >
              {levelName(grade.prescribed.level)}
            </LevelBadge>
          </span>
        ) : null}
        {item.performed.length > 0 && !inComplex && !scored ? (
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
        {lead !== undefined && grade === undefined ? (
          <span
            data-plan-box={lead.label === "Planned" ? "" : undefined}
            data-done-box={lead.label === "Done" ? "" : undefined}
            className="flex basis-full flex-wrap items-baseline gap-x-2 px-1.5 text-sm leading-6"
          >
            <span className="form-label text-muted-foreground">{lead.label}</span>
            <span className="font-medium">{lead.text}</span>
            {lead.note === undefined ? null : (
              <span className="text-xs text-muted-foreground">{lead.note}</span>
            )}
          </span>
        ) : null}
        {levelLine && grade ? (
          <LevelLine
            grade={grade}
            nameOf={names.nameOf}
            side={names.gradeSide ?? "done"}
            lead={lead}
            ruler={!editor?.rulerOnSelectedOnly || selected}
            compact={!selected}
          />
        ) : null}
      </span>
    </>
  );
  const rowClass = `relative grid w-full grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-start gap-4 px-4 text-left ${
    alternative ? "pb-1" : "py-1"
  } ${passed ? "opacity-55" : ""}`;
  return editor ? (
    <button
      type="button"
      data-protocol-row
      data-open={name === undefined ? "" : undefined}
      data-passed={passed ? "" : undefined}
      {...rowState(editor, item.spanId)}
      className={rowClass}
      onClick={() => editor.onSelect(item.spanId)}
      onMouseEnter={() => editor.onHover(item.spanId)}
      onMouseLeave={() => editor.onHover(undefined)}
    >
      {content}
    </button>
  ) : (
    <div className={rowClass} data-passed={passed ? "" : undefined}>
      {content}
    </div>
  );
}

/**
 * One station of a block: the item, and below it any alternative ("or 90 Single-unders") as a
 * way to do the same station. The option picked by a plan (or by what was done) carries the
 * level line; until one is picked, the item does.
 */
function StationRow({
  item,
  names,
  editor,
  scored,
}: {
  readonly item: DerivedItem;
  readonly names: ProtocolNames;
  readonly editor: ProtocolEditor | undefined;
  readonly scored: boolean;
}) {
  const picked = chosenOption(item, names.gradeSide ?? "done");
  const leading = picked ?? item;
  return (
    <li>
      {[item, ...item.alternatives].map((option, index) => (
        <OptionRow
          key={option.spanId}
          item={option}
          names={names}
          editor={editor}
          alternative={index > 0}
          full={option === leading}
          passed={picked !== undefined && option !== picked}
          scored={scored}
        />
      ))}
    </li>
  );
}

/** A protocol section title on its 2px ink rule, meta on the right. */
/** A whole line from the coach on a block: an intent, or a comment. */
function LineRow({
  id,
  label,
  editor,
  children,
}: {
  readonly id: SpanId;
  readonly label: string;
  readonly editor: ProtocolEditor | undefined;
  readonly children: ReactNode;
}) {
  const rowClass =
    "grid w-full grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-start gap-4 px-4 py-1 text-left";
  const content = (
    <>
      <span className="form-label leading-7 text-muted-foreground">{label}</span>
      {children}
    </>
  );
  return (
    <li>
      {editor ? (
        <button
          type="button"
          data-protocol-row
          data-intent
          data-selected={editor.selectedId === id ? "" : undefined}
          className={rowClass}
          onClick={() => editor.onSelect(id)}
        >
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}

export function SectionHeader({ title, meta }: { readonly title: string; readonly meta: string }) {
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

/** A block's rows: single movements, and the movements of a complex sharing one bar together. */
const rowsOf = (
  items: ReadonlyArray<DerivedItem>,
  names: ProtocolNames,
): ReadonlyArray<
  | { readonly item: DerivedItem; readonly complex?: undefined }
  | { readonly item?: undefined; readonly complex: ReadonlyArray<DerivedItem> }
> => {
  const rows: Array<{ item: DerivedItem } | { complex: Array<DerivedItem> }> = [];
  for (const item of items) {
    const complex = names.complexOf?.(item.spanId);
    const last = rows.at(-1);
    if (complex?.shared !== true) rows.push({ item });
    else if (last && "complex" in last && names.complexOf?.(last.complex[0]!.spanId) === complex)
      last.complex.push(item);
    else rows.push({ complex: [item] });
  }
  return rows;
};

/**
 * A complex ("1 power clean + 2 hang power clean"): its rows joined by a bracket, and what was
 * lifted on the one bar printed once under them.
 */
function ComplexRows({
  items,
  names,
  editor,
}: {
  readonly items: ReadonlyArray<DerivedItem>;
  readonly names: ProtocolNames;
  readonly editor: ProtocolEditor | undefined;
}) {
  const lifted = items.every((item) => item.performed.length > 0);
  const performed = items.flatMap((item) => item.performed);
  return (
    <li data-complex className="pb-1">
      <ul>
        {items.map((item) => (
          <li key={item.spanId}>
            <OptionRow
              item={item}
              names={names}
              editor={editor}
              alternative={false}
              full
              passed={false}
              inComplex
            />
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-4 px-4">
        <span className="form-label self-center text-muted-foreground">One bar</span>
        {lifted ? (
          <span
            data-result-box
            className="flex flex-wrap items-baseline gap-x-2 bg-card px-1.5 text-sm leading-6"
          >
            <span className="form-label text-muted-foreground">Lifted</span>
            <span className="tabular-nums">{formatComplex(items.map((item) => item.listed))}</span>
            <span className="ml-auto font-semibold tabular-nums">
              {formatKg(tonnageOf(performed))}
            </span>
          </span>
        ) : (
          <span className="flex h-6 items-center gap-2 text-xs text-muted-foreground">
            <span data-empty aria-hidden />
            loads entered once for the complex
          </span>
        )}
      </div>
    </li>
  );
}

/** A score box on the header strip: the entered result, or one marked in the text. */
function ScoreBox({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <span
      data-result-box
      className="flex items-baseline gap-1.5 bg-card px-1.5 text-sm font-semibold leading-6 tabular-nums"
    >
      <span className="form-label text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

/**
 * A block's header strip: its format, its scores and what it lifted. In the editor a block that
 * takes a result offers it here, in the box the score prints in, and opens its fields below.
 */
function BlockHeader({
  block,
  names,
  editor,
}: {
  readonly block: DerivedBlock;
  readonly names: ProtocolNames;
  readonly editor: ProtocolEditor | undefined;
}) {
  const sex = useAthleteSex();
  const [open, setOpen] = useState(false);
  const resultSpanId = block.resultSpanId;
  const onResult = editor?.onResult;
  const entering = onResult !== undefined && resultSpanId !== undefined;
  const stored = resultSpanId === undefined ? undefined : editor?.storedResultOf?.(resultSpanId);
  // Saved but no longer fitting: shown open, with its words, until it is entered again.
  const unfit = block.result === undefined && stored !== undefined;
  // The entered result is the first score; the editor prints it in its own box.
  const marked = block.result === undefined ? block.scores : block.scores.slice(1);
  const title = describeBlock(block.format, block.params);
  // Planning, nothing is lifted yet, so there is no share of the board to give.
  const boardKg = names.gradeSide === "planned" ? undefined : boardTonnageOf(block.items, sex);
  return (
    <>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 bg-muted px-4 py-1">
        {editor ? (
          <button
            type="button"
            disabled={block.spanId === undefined}
            className="cursor-pointer text-sm font-bold uppercase tracking-wide font-stretch-condensed hover:underline disabled:cursor-default disabled:no-underline"
            onClick={() => (block.spanId ? editor.onSelect(block.spanId) : undefined)}
          >
            {title}
          </button>
        ) : (
          <span className="text-sm font-bold uppercase tracking-wide font-stretch-condensed">
            {title}
          </span>
        )}
        {/* The score sits by the title it belongs to, where the whiteboard writes it. */}
        {entering ? (
          <button
            type="button"
            aria-expanded={open}
            data-result-box={block.result === undefined ? undefined : ""}
            data-open-box={block.result === undefined ? "" : undefined}
            title={unfit ? "No longer fits the block: enter it again" : undefined}
            className="flex h-7 cursor-pointer items-center gap-1.5 bg-card px-2 text-sm font-semibold tabular-nums transition-colors duration-150 hover:bg-background"
            onClick={() => setOpen(!open)}
          >
            <span className="form-label text-muted-foreground">Score</span>
            {block.result !== undefined ? (
              block.scores[0]
            ) : unfit ? (
              <span className="text-destructive">{formatBlockResult(stored)}</span>
            ) : (
              <Plus aria-hidden className="size-3.5" />
            )}
          </button>
        ) : block.result === undefined ? null : (
          <ScoreBox label="Score">{block.scores[0]}</ScoreBox>
        )}
        <span className="ml-auto flex flex-wrap justify-end gap-1.5">
          {marked.map((score) => (
            <ScoreBox key={score} label="Score">
              {score}
            </ScoreBox>
          ))}
          {block.tonnageKg > 0 ? (
            <ScoreBox label="Lifted">
              {formatKg(block.tonnageKg)}
              {boardKg === undefined ? null : (
                <span
                  title={`At the board's loads, for the same reps: ${formatKg(boardKg)}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  {shareOfBoard(block.tonnageKg, boardKg)} % of board
                </span>
              )}
            </ScoreBox>
          ) : null}
        </span>
      </div>
      {entering && open ? (
        <BlockResultEditor
          // A new format takes other result fields: start its draft over.
          key={block.format ?? "none"}
          block={block}
          stored={stored}
          nameOf={names.nameOf}
          sex={sex}
          onResult={(result) => onResult(resultSpanId, result)}
          onCap={
            editor?.onCap && block.spanId !== undefined && block.spanId === resultSpanId
              ? (seconds) => editor.onCap?.(resultSpanId, seconds)
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The session set like a meet protocol: parts, their blocks, one row per movement with its sets
 * in boxes and what was lifted, and the lift sets read from the notes. With an `editor` it is the
 * importer's protocol, as it will be saved; without one it reads a stored session back.
 */
export function SessionProtocol({
  session,
  names,
  editor,
}: {
  readonly session: DerivedSession;
  readonly names: ProtocolNames;
  readonly editor?: ProtocolEditor;
}) {
  return (
    <div className="grid content-start">
      {editor && session.issues.length > 0 ? (
        <Issues issues={session.issues} lineOf={editor.lineOf} onSelect={editor.onSelect} />
      ) : null}

      {session.parts.length === 0 && session.liftSets.length === 0 ? (
        <p className="px-4 py-10 text-sm text-muted-foreground">
          {editor
            ? "Nothing in the protocol yet. Select a movement in the text and press M, or Re-suggest to let Chalk try again."
            : "No parts or lift sets in this session."}
        </p>
      ) : null}

      {session.parts.map((part, partIndex) => (
        <section key={part.spanId ?? `implicit-${partIndex}`} aria-label={part.title}>
          <SectionHeader
            title={part.title}
            meta={`${part.benchmarkId === undefined ? "" : `${benchmarkById(part.benchmarkId)?.name ?? part.benchmarkId}, `}${plural(part.blocks.length, "block", "blocks")}, ${plural(stationCount(part.blocks), "movement", "movements")}`}
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
              <BlockHeader block={block} names={names} editor={editor} />
              {block.intents.length > 0 || block.comments.length > 0 ? (
                <ul className="divide-y border-b">
                  {block.intents.map((intent) => (
                    <LineRow key={intent.spanId} id={intent.spanId} label="Intent" editor={editor}>
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
                    </LineRow>
                  ))}
                  {block.comments.map((comment) => (
                    <LineRow
                      key={comment.spanId}
                      id={comment.spanId}
                      label="Comment"
                      editor={editor}
                    >
                      <span className="text-sm leading-7 text-muted-foreground">
                        {comment.text}
                      </span>
                    </LineRow>
                  ))}
                </ul>
              ) : null}
              {block.items.length === 0 ? (
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  No movements in this block.
                </p>
              ) : (
                <ul className="divide-y">
                  {rowsOf(block.items, names).map((row) =>
                    row.complex === undefined ? (
                      <StationRow
                        key={row.item.spanId}
                        item={row.item}
                        names={names}
                        editor={editor}
                        scored={scoresMovements(block.format)}
                      />
                    ) : (
                      <ComplexRows
                        key={row.complex[0]?.spanId}
                        items={row.complex}
                        names={names}
                        editor={editor}
                      />
                    ),
                  )}
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
                  data-protocol-row={editor ? "" : undefined}
                  {...rowState(editor, set.movementSpanId)}
                  onMouseEnter={editor ? () => editor.onHover(set.movementSpanId) : undefined}
                  onMouseLeave={editor ? () => editor.onHover(undefined) : undefined}
                >
                  <td className="px-4 py-1.5">
                    {editor ? (
                      <button
                        type="button"
                        className="cursor-pointer font-semibold hover:underline"
                        onClick={() => editor.onSelect(set.movementSpanId)}
                      >
                        {names.nameOf(set.movementId)}
                      </button>
                    ) : (
                      <span className="font-semibold">{names.nameOf(set.movementId)}</span>
                    )}
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
