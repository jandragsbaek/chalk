import {
  BlockFormat,
  formatQuantity,
  Measure,
  parseQuantities,
  type Amount,
  type BlockParams,
  type CatalogMovement,
  type DerivedItem,
  type ItemGrade,
  type LiftResult,
  type MovementId,
  type Span,
  type SpanId,
  type SpanOf,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, NativeSelect } from "@chalk/ui/components/field.tsx";
import { Link2, Trash2, X } from "lucide-react";

import { BLOCK_FORMAT_LABELS, MEASURE_LABELS } from "../../lib/blockLabels.ts";
import type { PickMode } from "../../lib/importEditor.ts";
import type { ResultDefaults } from "../../lib/resultDraft.ts";
import { CoreMovementField } from "./CoreMovementField.tsx";
import { MovementLevelsField } from "./MovementLevelsField.tsx";
import { MovementPicker } from "./MovementPicker.tsx";
import { PerformanceEditor } from "./PerformanceEditor.tsx";
import { ResultEditor } from "./ResultEditor.tsx";

const TAG_TITLES: Record<Span["_tag"], string> = {
  movement: "Movement",
  quantity: "Quantity",
  block: "Block",
  part: "Part",
  notes: "Notes start",
  intent: "Intent",
  date: "Date",
  session: "Session number",
  score: "Score",
};

const toNumber = (raw: string) => {
  const value = Number(raw.replace(",", "."));
  return raw.trim() === "" || !Number.isFinite(value) || value < 0 ? undefined : value;
};

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

/** "8-10" or "12" into an amount; anything else is no amount. */
const parseAmount = (raw: string): Amount | undefined => {
  const parts = raw.split("-").map((part) => toNumber(part));
  if (parts.length === 0 || parts.length > 2 || parts.some((part) => part === undefined))
    return undefined;
  const [min = 0, max = min] = parts as Array<number>;
  return { min: Math.min(min, max), max: Math.max(min, max) };
};

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
}: {
  readonly span: Span;
  readonly text: string;
  readonly spans: ReadonlyArray<Span>;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly picking: PickMode | undefined;
  /** The derived item of a programmed movement (not one in the notes), which can take a result. */
  readonly programmed:
    | {
        readonly item: DerivedItem;
        readonly defaults: ResultDefaults;
        readonly grade: ItemGrade | undefined;
      }
    | undefined;
  readonly onUpdate: (span: Span) => void;
  readonly onRemove: (id: SpanId) => void;
  readonly onPick: (mode: PickMode | undefined) => void;
  readonly onMovementPicked: (
    span: SpanOf<"movement">,
    movementId: MovementId,
    learned: boolean,
  ) => void;
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
            target={textOf(span.alternativeOf)}
            picking={picking === "alternative"}
            onPick={() => onPick(picking === "alternative" ? undefined : "alternative")}
            onClear={() => {
              const { alternativeOf: _old, ...rest } = span;
              onUpdate(rest);
            }}
          />
          {programmed ? (
            <PerformanceEditor
              performance={span.performance}
              item={programmed.item}
              grade={programmed.grade}
              catalog={catalog}
              onChange={(performance) => {
                const { performance: _old, ...rest } = span;
                onUpdate(performance === undefined ? rest : { ...rest, performance });
              }}
            />
          ) : null}
          {programmed ? (
            <ResultEditor
              result={span.result}
              item={programmed.item}
              defaults={programmed.defaults}
              onChange={(result: LiftResult | undefined) => {
                const { result: _old, ...rest } = span;
                onUpdate(result === undefined ? rest : { ...rest, result });
              }}
            />
          ) : null}
        </>
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
          label="Scores block"
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

      {span._tag === "intent" ? (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">
            The coach's instruction for the block it sits in: how heavy, how hard, what to focus on.
            Saved with the block; intensity in it is read below.
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
        </div>
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
