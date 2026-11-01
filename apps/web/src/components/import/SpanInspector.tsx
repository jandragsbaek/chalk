import {
  BENCHMARK_CATEGORY_NAMES,
  BENCHMARKS,
  benchmarkById,
  BenchmarkId,
  BlockFormat,
  formatQuantity,
  LEVEL_NAMES,
  LEVELS,
  levelIndex,
  Measure,
  parseQuantities,
  tiersFromRange,
  withTiers,
  type Amount,
  type BlockParams,
  type CatalogMovement,
  type DerivedItem,
  type ItemGrade,
  type Level,
  type LiftResult,
  type MovementId,
  type QuantityTier,
  type Span,
  type SpanId,
  type SpanOf,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, NativeSelect } from "@chalk/ui/components/field.tsx";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { Fragment } from "react";

import { parseAmount, toNumber } from "../../lib/amount.ts";
import { BLOCK_FORMAT_LABELS, MEASURE_LABELS } from "../../lib/blockLabels.ts";
import type { PickMode } from "../../lib/importEditor.ts";
import type { ResultDefaults } from "../../lib/resultDraft.ts";
import { CoreMovementField } from "./CoreMovementField.tsx";
import { MovementLevelsField } from "./MovementLevelsField.tsx";
import { MovementPicker } from "./MovementPicker.tsx";
import { PerformanceEditor } from "./PerformanceEditor.tsx";
import { ResultEditor, type ComplexAction } from "./ResultEditor.tsx";

const TAG_TITLES: Record<Span["_tag"], string> = {
  movement: "Movement",
  quantity: "Quantity",
  block: "Block",
  part: "Part",
  notes: "Notes start",
  intent: "Intent",
  comment: "Comment",
  date: "Date",
  session: "Session number",
  score: "Score",
  benchmark: "Benchmark",
};

/** A whole line from the coach: an instruction for the block, or just a comment on it. */
const LINE_KINDS = [
  { tag: "intent", label: "Intent" },
  { tag: "comment", label: "Comment" },
] as const;

const BENCHMARK_GROUPS = (["girl", "hero", "notable"] as const).map((category) => ({
  category,
  benchmarks: BENCHMARKS.filter((benchmark) => benchmark.category === category),
}));

function NumberField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number | undefined;
  readonly onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="form-label text-muted-foreground">{label}</span>
      <Input
        inputMode="decimal"
        defaultValue={value === undefined ? "" : String(value)}
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    </label>
  );
}

const showAmount = (amount: Amount | undefined) =>
  amount === undefined
    ? ""
    : amount.min === amount.max
      ? `${amount.min}`
      : `${amount.min}-${amount.max}`;

function AmountField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: Amount | undefined;
  readonly onChange: (value: Amount | undefined) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="form-label text-muted-foreground">{label}</span>
      <Input
        defaultValue={showAmount(value)}
        placeholder="12 or 8-10"
        onChange={(event) => onChange(parseAmount(event.target.value))}
      />
    </label>
  );
}

/** Counts a board can ask per level; loads and intensities are graded on the level sheet. */
const TIERABLE: ReadonlySet<Measure> = new Set(["reps", "calories", "distance_m"]);

/**
 * Targets by level ("18-15/15-12 cal": 18/15 at Elite, 15/12 at RX), hardest first. Each row is
 * a level with its male and female number; the quantity's range follows them.
 */
function TiersField({
  span,
  onUpdate,
}: {
  readonly span: SpanOf<"quantity">;
  readonly onUpdate: (span: Span) => void;
}) {
  const tiers = span.tiers ?? [];
  const setTiers = (next: ReadonlyArray<QuantityTier>) => onUpdate(withTiers(span, next));
  const setTier = (index: number, tier: QuantityTier) =>
    setTiers(tiers.map((candidate, at) => (at === index ? tier : candidate)));
  const easier = (level: Level) => LEVELS[Math.max(0, levelIndex(level) - 1)]!;
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="form-label text-muted-foreground">Targets by level</span>
        <Button variant="ghost" size="sm" onClick={() => setTiers([])}>
          Read as a range
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_2rem] items-center gap-2">
        <span className="form-label text-muted-foreground">Level</span>
        <span className="form-label text-muted-foreground">Male</span>
        <span className="form-label text-muted-foreground">Female</span>
        <span aria-hidden />
        {tiers.map((tier, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- a row is its position; remounts when rows are removed
          <Fragment key={`${index}-${tiers.length}`}>
            <NativeSelect
              aria-label={`Level ${index + 1}`}
              value={tier.level}
              onChange={(event) => setTier(index, { ...tier, level: event.target.value as Level })}
            >
              {LEVELS.toReversed().map((level) => (
                <option key={level} value={level}>
                  {LEVEL_NAMES[level]}
                </option>
              ))}
            </NativeSelect>
            <Input
              aria-label={`Level ${index + 1} male`}
              defaultValue={showAmount(tier.amount)}
              onChange={(event) => {
                const amount = parseAmount(event.target.value);
                if (amount !== undefined) setTier(index, { ...tier, amount });
              }}
            />
            <Input
              aria-label={`Level ${index + 1} female`}
              defaultValue={showAmount(tier.female)}
              onChange={(event) => {
                const { female: _old, ...rest } = tier;
                const female = parseAmount(event.target.value);
                setTier(index, female === undefined ? rest : { ...rest, female });
              }}
            />
            <Button
              variant="ghost-destructive"
              size="icon"
              aria-label={`Remove level ${index + 1}`}
              onClick={() => setTiers(tiers.filter((_, at) => at !== index))}
            >
              <X />
            </Button>
          </Fragment>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          const last = tiers.at(-1)!;
          setTiers([...tiers, { ...last, level: easier(last.level) }]);
        }}
      >
        <Plus />
        Add level
      </Button>
      <p className="text-xs text-muted-foreground">
        The board asks each level its own number. What you did each round is set on the movement.
      </p>
    </div>
  );
}

function LinkRow({
  label,
  target,
  picking,
  onPick,
  onClear,
}: {
  readonly label: string;
  readonly target: string | undefined;
  readonly picking: boolean;
  readonly onPick: () => void;
  readonly onClear: () => void;
}) {
  return (
    <div className="grid gap-1.5 border-t pt-3">
      <span className="form-label text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {target === undefined ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <span data-empty aria-hidden />
            nothing
          </span>
        ) : (
          <span className="font-semibold">{target}</span>
        )}
        <Button variant={picking ? "default" : "outline"} size="sm" onClick={onPick}>
          <Link2 />
          {picking ? "Click a mark in the text" : "Pick"}
          <kbd data-key>a</kbd>
        </Button>
        {target !== undefined ? (
          <Button variant="ghost" size="icon" aria-label={`Clear ${label}`} onClick={onClear}>
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function withAmount<S extends SpanOf<"quantity">>(
  span: S,
  key: "amount" | "female",
  amount: Amount | undefined,
): S {
  if (key === "amount") return amount === undefined ? span : { ...span, amount };
  const { female: _old, ...rest } = span;
  return (amount === undefined ? rest : { ...rest, female: amount }) as S;
}

function withParam<K extends keyof BlockParams>(
  params: BlockParams,
  key: K,
  value: BlockParams[K] | undefined,
): BlockParams {
  const { [key]: _old, ...rest } = params;
  return value === undefined ? rest : { ...rest, [key]: value };
}

/** A programmed movement's item, and the station it is one way to do. */
export interface ProgrammedMovement {
  readonly item: DerivedItem;
  readonly defaults: ResultDefaults;
  readonly grade: ItemGrade | undefined;
  /** The station's options, the item first: "60 DU or 90 SU" has two. */
  readonly station: ReadonlyArray<DerivedItem>;
  /** The option a plan (or what was done) picked, if one was. */
  readonly chosen: SpanId | undefined;
  readonly complex: ComplexAction | undefined;
}

export function SpanInspector({
  span,
  text,
  spans,
  catalog,
  picking,
  programmed,
  onUpdate,
  onRemove,
  onPick,
  onMovementPicked,
  onChooseOption,
  mode = "log",
  outcomeFirst = false,
  onAsPlanned,
}: {
  readonly span: Span;
  readonly text: string;
  readonly spans: ReadonlyArray<Span>;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly picking: PickMode | undefined;
  /** The derived item of a programmed movement (not one in the notes), which can take a result. */
  readonly programmed: ProgrammedMovement | undefined;
  readonly onUpdate: (span: Span) => void;
  readonly onRemove: (id: SpanId) => void;
  readonly onPick: (mode: PickMode | undefined) => void;
  readonly onMovementPicked: (
    span: SpanOf<"movement">,
    movementId: MovementId,
    learned: boolean,
  ) => void;
  /** Planning: the movement takes a planned scaling, not what was done or lifted. */
  readonly mode?: "log" | "plan";
  /**
   * Planning or logging a plan: the plan (or how it was done) leads, and a resolved movement's
   * catalog fields fold away under "Movement".
   */
  readonly outcomeFirst?: boolean;
  /** Logging a plan: take the movement's planned scaling as done. */
  readonly onAsPlanned?: ((span: SpanOf<"movement">) => void) | undefined;
  /** Do the station by this option, and not by the others. */
  readonly onChooseOption?: (id: SpanId) => void;
}) {
  const phrase = text.slice(span.start, span.end);
  const picked =
    span._tag === "movement" && span.movementId !== undefined
      ? catalog.find((movement) => movement.id === span.movementId)
      : undefined;
  const textOf = (id: SpanId | undefined) => {
    const target = spans.find((candidate) => candidate.id === id);
    if (!target) return undefined;
    const name =
      target._tag === "movement" && target.movementId
        ? catalog.find((movement) => movement.id === target.movementId)?.name
        : target._tag === "benchmark" && target.benchmarkId
          ? benchmarkById(target.benchmarkId)?.name
          : undefined;
    return name ?? text.slice(target.start, target.end);
  };

  return (
    <section aria-label="Selected mark" className="grid content-start gap-4 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="grid gap-1.5">
          <span className="form-label text-muted-foreground">{TAG_TITLES[span._tag]}</span>
          <mark
            data-tag={span._tag}
            data-measure={span._tag === "quantity" ? span.measure : undefined}
            className="w-fit font-mono text-lg font-bold"
          >
            {phrase}
          </mark>
        </div>
        <Button
          variant="ghost-destructive"
          size="icon"
          aria-label="Remove highlight (Delete)"
          onClick={() => onRemove(span.id)}
        >
          <Trash2 />
        </Button>
      </header>

      {span._tag === "movement" ? (
        <MovementMark
          span={span}
          phrase={phrase}
          catalog={catalog}
          picked={picked}
          picking={picking}
          programmed={programmed}
          mode={mode}
          outcomeFirst={outcomeFirst}
          alternativeOfText={textOf(span.alternativeOf)}
          onUpdate={onUpdate}
          onPick={onPick}
          onMovementPicked={onMovementPicked}
          onAsPlanned={onAsPlanned}
          onChooseOption={onChooseOption}
        />
      ) : null}

      {span._tag === "quantity" ? (
        <div key={span.id} className="grid gap-3">
          <label className="grid gap-1">
            <span className="form-label text-muted-foreground">Measure</span>
            <NativeSelect
              value={span.measure}
              onChange={(event) => onUpdate({ ...span, measure: event.target.value as Measure })}
            >
              {Measure.literals.map((measure) => (
                <option key={measure} value={measure}>
                  {MEASURE_LABELS[measure]}
                </option>
              ))}
            </NativeSelect>
          </label>
          {span.tiers !== undefined && span.tiers.length > 0 ? (
            <TiersField span={span} onUpdate={onUpdate} />
          ) : (
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <AmountField
                  label="Amount"
                  value={span.amount}
                  onChange={(amount) => onUpdate(withAmount(span, "amount", amount))}
                />
                <AmountField
                  label="Female (optional)"
                  value={span.female}
                  onChange={(amount) => onUpdate(withAmount(span, "female", amount))}
                />
              </div>
              {TIERABLE.has(span.measure) && tiersFromRange(span) !== undefined ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => onUpdate(withTiers(span, tiersFromRange(span)))}
                >
                  Ends are levels
                </Button>
              ) : null}
            </div>
          )}
          {span.scheme ? (
            <p className="text-sm">
              <span className="form-label text-muted-foreground">Scheme</span>{" "}
              {span.scheme.join("-")}
            </p>
          ) : null}
          <LinkRow
            label="Attached to"
            target={textOf(span.attachedTo)}
            picking={picking === "attach"}
            onPick={() => onPick(picking === "attach" ? undefined : "attach")}
            onClear={() => {
              const { attachedTo: _old, ...rest } = span;
              onUpdate(rest);
            }}
          />
        </div>
      ) : null}

      {span._tag === "score" ? (
        <LinkRow
          label="Scores"
          target={textOf(span.attachedTo)}
          picking={picking === "attach"}
          onPick={() => onPick(picking === "attach" ? undefined : "attach")}
          onClear={() => {
            const { attachedTo: _old, ...rest } = span;
            onUpdate(rest);
          }}
        />
      ) : null}

      {span._tag === "block" ? (
        <div key={span.id} className="grid gap-3">
          <label className="grid gap-1">
            <span className="form-label text-muted-foreground">Format</span>
            <NativeSelect
              value={span.format}
              onChange={(event) => onUpdate({ ...span, format: event.target.value as BlockFormat })}
            >
              {BlockFormat.literals.map((format) => (
                <option key={format} value={format}>
                  {BLOCK_FORMAT_LABELS[format]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Duration (min)"
              value={
                span.params.durationSeconds === undefined
                  ? undefined
                  : span.params.durationSeconds / 60
              }
              onChange={(minutes) =>
                onUpdate({
                  ...span,
                  params: withParam(
                    span.params,
                    "durationSeconds",
                    minutes === undefined ? undefined : minutes * 60,
                  ),
                })
              }
            />
            <NumberField
              label="Interval (sec)"
              value={span.params.intervalSeconds}
              onChange={(seconds) =>
                onUpdate({ ...span, params: withParam(span.params, "intervalSeconds", seconds) })
              }
            />
            <AmountField
              label="Rounds"
              value={span.params.rounds}
              onChange={(rounds) =>
                onUpdate({ ...span, params: withParam(span.params, "rounds", rounds) })
              }
            />
            <NumberField
              label="Work (sec)"
              value={span.params.workSeconds}
              onChange={(seconds) =>
                onUpdate({ ...span, params: withParam(span.params, "workSeconds", seconds) })
              }
            />
            <NumberField
              label="Rest (sec)"
              value={span.params.restSeconds}
              onChange={(seconds) =>
                onUpdate({ ...span, params: withParam(span.params, "restSeconds", seconds) })
              }
            />
          </div>
        </div>
      ) : null}

      {span._tag === "date" ? (
        <label className="grid gap-1">
          <span className="form-label text-muted-foreground">Performed on</span>
          <Input
            type="date"
            value={span.date}
            onChange={(event) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value))
                onUpdate({ ...span, date: event.target.value });
            }}
          />
        </label>
      ) : null}

      {span._tag === "session" ? (
        <NumberField
          key={span.id}
          label="Session number"
          value={span.number}
          onChange={(number) => {
            if (number !== undefined && Number.isInteger(number)) onUpdate({ ...span, number });
          }}
        />
      ) : null}

      {span._tag === "intent" || span._tag === "comment" ? (
        <div className="grid gap-2 text-sm">
          <div role="radiogroup" aria-label="What the line is" className="grid grid-cols-2 gap-1">
            {LINE_KINDS.map(({ tag, label }) => (
              <Button
                key={tag}
                role="radio"
                aria-checked={span._tag === tag}
                variant={span._tag === tag ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (span._tag !== tag)
                    onUpdate({ _tag: tag, id: span.id, start: span.start, end: span.end });
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          {span._tag === "intent" ? (
            <>
              <p className="text-muted-foreground">
                The coach's instruction for the block it sits in: how heavy, how hard, what to focus
                on. Saved with the block; intensity in it is read below.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {parseQuantities(phrase, 0, { bareReps: false }).map((match) => (
                  <span
                    key={match.start}
                    data-chip
                    data-measure={match.quantity.measure}
                    className="px-1.5 text-sm font-medium leading-6 tabular-nums"
                  >
                    {formatQuantity(match.quantity)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              An aside kept with the block it sits in: where the workout came from, a remark. Shown
              on the sheet as written; nothing in it is read as programming or intensity.
            </p>
          )}
        </div>
      ) : null}

      {span._tag === "benchmark" ? (
        <BenchmarkField key={span.id} span={span} catalog={catalog} onUpdate={onUpdate} />
      ) : null}

      {span._tag === "part" || span._tag === "notes" ? (
        <p className="text-sm text-muted-foreground">
          {span._tag === "part"
            ? "Starts a new part. Blocks and movements below it belong to it."
            : "Everything below, up to the next part, is notes. Movements with a load there become lift sets."}
        </p>
      ) : null}
    </section>
  );
}

/** Which named workout the mark is, and what the part gets from it. */
function BenchmarkField({
  span,
  catalog,
  onUpdate,
}: {
  readonly span: SpanOf<"benchmark">;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly onUpdate: (span: Span) => void;
}) {
  const benchmark = span.benchmarkId === undefined ? undefined : benchmarkById(span.benchmarkId);
  const nameOf = (id: MovementId) => catalog.find((movement) => movement.id === id)?.name ?? id;
  return (
    <div className="grid gap-3 text-sm">
      <label className="grid gap-1">
        <span className="form-label text-muted-foreground">Workout</span>
        <NativeSelect
          value={span.benchmarkId ?? ""}
          onChange={(event) => {
            const { benchmarkId: _old, ...rest } = span;
            const picked = benchmarkById(event.target.value);
            onUpdate(picked ? { ...rest, benchmarkId: BenchmarkId.make(picked.id) } : rest);
          }}
        >
          <option value="">Pick a benchmark</option>
          {BENCHMARK_GROUPS.map((group) => (
            <optgroup key={group.category} label={BENCHMARK_CATEGORY_NAMES[group.category]}>
              {group.benchmarks.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </label>
      {benchmark ? (
        <div className="grid gap-1">
          {benchmark.blocks
            .map((block, index) => ({ ...block, key: `${benchmark.id}-${index}` }))
            .map((block) => (
              <p key={block.key}>
                <span className="font-semibold">{block.title}</span>
                {block.items.length > 0 ? ": " : ""}
                {block.items
                  .map((item) =>
                    [nameOf(item.movementId), ...item.quantities.map(formatQuantity)].join(" "),
                  )
                  .join(", ")}
              </p>
            ))}
        </div>
      ) : null}
      <p className="text-muted-foreground">
        The part it sits in is this benchmark. Without movements of its own, the part gets the
        benchmark's blocks and movements; attach a score to it to count the attempt.
      </p>
    </div>
  );
}

/** A movement mark: which catalog movement it is, and what was planned, done or lifted. */
function MovementMark({
  span,
  phrase,
  catalog,
  picked,
  picking,
  programmed,
  mode,
  outcomeFirst,
  alternativeOfText,
  onUpdate,
  onPick,
  onMovementPicked,
  onAsPlanned,
  onChooseOption,
}: {
  readonly span: SpanOf<"movement">;
  readonly phrase: string;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly picked: CatalogMovement | undefined;
  readonly picking: PickMode | undefined;
  readonly programmed: ProgrammedMovement | undefined;
  readonly mode: "log" | "plan";
  readonly outcomeFirst: boolean;
  readonly alternativeOfText: string | undefined;
  readonly onUpdate: (span: Span) => void;
  readonly onPick: (mode: PickMode | undefined) => void;
  readonly onMovementPicked: (
    span: SpanOf<"movement">,
    movementId: MovementId,
    learned: boolean,
  ) => void;
  readonly onAsPlanned: ((span: SpanOf<"movement">) => void) | undefined;
  readonly onChooseOption: ((id: SpanId) => void) | undefined;
}) {
  const nameOf = (id: MovementId) => catalog.find((movement) => movement.id === id)?.name;
  const choice =
    programmed !== undefined && programmed.station.length > 1 && onChooseOption ? (
      <div className="grid gap-1.5 border-t pt-3">
        <span className="form-label text-muted-foreground">
          {mode === "plan" ? "Will do" : "Did"}
        </span>
        <div className="grid gap-1" role="group" aria-label="Station options">
          {programmed.station.map((option) => {
            const amounts = option.sets
              .flatMap((set) => set.quantities)
              .map((quantity) => formatQuantity(quantity))
              .join(", ");
            return (
              <Button
                key={option.spanId}
                size="sm"
                variant={programmed.chosen === option.spanId ? "default" : "outline"}
                aria-pressed={programmed.chosen === option.spanId}
                className="justify-between"
                onClick={() => onChooseOption(option.spanId)}
              >
                <span className="truncate">
                  {(option.movementId === undefined ? undefined : nameOf(option.movementId)) ??
                    option.text}
                </span>
                {amounts === "" ? null : <span className="tabular-nums">{amounts}</span>}
              </Button>
            );
          })}
        </div>
      </div>
    ) : null;
  const identity = (
    <>
      <MovementPicker
        key={span.id}
        phrase={phrase}
        catalog={catalog}
        value={span.movementId}
        onPick={(movementId, learned) => onMovementPicked(span, movementId, learned)}
      />
      {picked ? <CoreMovementField movement={picked} catalog={catalog} /> : null}
      {picked ? <MovementLevelsField movement={picked} /> : null}
      <LinkRow
        label="Alternative of"
        target={alternativeOfText}
        picking={picking === "alternative"}
        onPick={() => onPick(picking === "alternative" ? undefined : "alternative")}
        onClear={() => {
          const { alternativeOf: _old, ...rest } = span;
          onUpdate(rest);
        }}
      />
    </>
  );
  const outcome = programmed ? (
    <>
      {choice}
      {mode === "plan" ? (
        <PerformanceEditor
          mode="plan"
          performance={span.plan}
          item={programmed.item}
          grade={programmed.grade}
          catalog={catalog}
          onChange={(plan) => {
            const { plan: _old, ...rest } = span;
            onUpdate(plan === undefined ? rest : { ...rest, plan });
          }}
        />
      ) : (
        <>
          <PerformanceEditor
            performance={span.performance}
            planned={span.plan}
            onAsPlanned={onAsPlanned === undefined ? undefined : () => onAsPlanned(span)}
            item={programmed.item}
            grade={programmed.grade}
            catalog={catalog}
            onChange={(performance) => {
              const { performance: _old, ...rest } = span;
              onUpdate(performance === undefined ? rest : { ...rest, performance });
            }}
          />
          <ResultEditor
            result={span.result}
            item={programmed.item}
            defaults={programmed.defaults}
            complex={programmed.complex}
            onChange={(result: LiftResult | undefined) => {
              const { result: _old, ...rest } = span;
              onUpdate(result === undefined ? rest : { ...rest, result });
            }}
          />
        </>
      )}
    </>
  ) : null;

  // An unresolved movement has to be picked before anything else counts.
  if (!outcomeFirst || picked === undefined)
    return (
      <>
        {identity}
        {outcome}
      </>
    );
  return (
    <>
      {outcome}
      <details data-disclosure className="group border-t pt-3">
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2">
          <span className="form-label text-muted-foreground">Movement</span>
          <span className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <span className="truncate font-medium">{picked.name}</span>
            <span aria-hidden className="text-xs text-muted-foreground group-open:hidden">
              Change
            </span>
          </span>
        </summary>
        <div className="grid gap-4 pt-3">{identity}</div>
      </details>
    </>
  );
}
