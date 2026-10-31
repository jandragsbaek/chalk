import { cn } from "@chalk/ui/lib/utils.ts";
import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";

export const kgFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
export const kg = (value: number) => `${kgFormat.format(value)} kg`;
export const signedKg = (value: number) =>
  `${value >= 0 ? "+" : "−"}${kgFormat.format(Math.abs(value))} kg`;

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
export const formatMonth = (date: Date) => monthFormat.format(date);
const monthYearFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
export const formatMonthYear = (date: Date) => monthYearFormat.format(date);
export const formatShortDay = (date: Date) => dayFormat.format(date);
export const formatFullDay = (date: Date) => fullDayFormat.format(date);

/** Axis and grid styling shared by every mockup: hairline, recessive, muted ink. */
export const AXIS = {
  stroke: "var(--viz-axis)",
  tickStroke: "var(--viz-axis)",
  tickLength: 4,
  tickLabel: {
    fill: "var(--muted-foreground)",
    fontSize: 11,
    fontFamily: "inherit",
  },
} as const;

/** Index of the item whose x is closest to `x`. Items must be sorted by x. */
export function nearestIndex(xs: ReadonlyArray<number>, x: number): number {
  let best = 0;
  let bestDistance = Infinity;
  xs.forEach((value, index) => {
    const distance = Math.abs(value - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** Arrow keys walk an active index; Escape clears it. Mirrors hover for keyboard users. */
export function stepIndexOnKey(
  event: KeyboardEvent,
  current: number | null,
  count: number,
): number | null | undefined {
  if (count === 0) return undefined;
  if (event.key === "ArrowRight") return Math.min(count - 1, (current ?? -1) + 1);
  if (event.key === "ArrowLeft") return Math.max(0, (current ?? count) - 1);
  if (event.key === "Home") return 0;
  if (event.key === "End") return count - 1;
  if (event.key === "Escape") return null;
  return undefined;
}

type LegendMark = "line" | "dot" | "hollow" | "diamond" | "band" | "range";

export function LegendItem({
  mark,
  color,
  label,
}: {
  mark: LegendMark;
  color: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="16" height="12" aria-hidden="true" className="shrink-0">
        {mark === "line" ? (
          <line x1="1" x2="15" y1="6" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
        ) : null}
        {mark === "dot" ? <circle cx="8" cy="6" r="4" fill={color} /> : null}
        {mark === "hollow" ? (
          <circle cx="8" cy="6" r="3.5" fill="var(--card)" stroke={color} strokeWidth="2" />
        ) : null}
        {mark === "diamond" ? (
          <rect x="4" y="2" width="8" height="8" fill={color} transform="rotate(45 8 6)" />
        ) : null}
        {mark === "band" ? (
          <rect x="0" y="1" width="16" height="10" rx="2" fill={color} opacity="0.16" />
        ) : null}
        {mark === "range" ? <rect x="6" y="0" width="4" height="12" rx="2" fill={color} /> : null}
      </svg>
      <span>{label}</span>
    </li>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {children}
    </ul>
  );
}

export interface Column<Row> {
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  readonly numeric?: boolean;
}

export function DataTable<Row>({
  rows,
  rowKey,
  columns,
  caption,
}: {
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  columns: ReadonlyArray<Column<Row>>;
  caption: string;
}) {
  return (
    <div className="max-h-80 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 border-b bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                className={cn("px-3 py-2 font-medium", column.numeric && "text-right")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn("px-3 py-1.5", column.numeric && "text-right tabular-nums")}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A mockup card: title, summary slot, legend, and a Chart / Table switch (the table is the
 * accessible twin of every chart). */
export function ChartFrame({
  id,
  title,
  description,
  summary,
  legend,
  controls,
  table,
  children,
}: {
  id: string;
  title: string;
  description: string;
  summary?: ReactNode;
  legend?: ReactNode;
  controls?: ReactNode;
  table: ReactNode;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <figure
      aria-labelledby={`${id}-title`}
      data-viz
      className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5"
    >
      <header className="grid gap-1">
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${id}-title`} className="text-base font-semibold text-balance">
            {title}
          </h3>
          <Segmented
            label={`${title} view`}
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      </header>
      {controls || summary ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {controls}
          {summary}
        </div>
      ) : null}
      {view === "chart" ? (
        <>
          {children}
          {legend}
        </>
      ) : (
        table
      )}
    </figure>
  );
}

export function Segmented<Value extends string>({
  label,
  value,
  onChange,
  options,
  size = "sm",
}: {
  label: string;
  size?: "sm" | "md";
  value: Value;
  onChange: (value: Value) => void;
  options: ReadonlyArray<{ value: Value; label: string }>;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "cursor-pointer rounded-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-[34px] px-3.5 text-sm",
            option.value === value && "bg-card text-foreground shadow-xs",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Tooltip positioned inside a `relative` chart wrapper; flips to the left of the crosshair
 * past the midpoint so it never leaves the card. */
export function ChartTooltip({
  x,
  width,
  children,
}: {
  x: number;
  width: number;
  children: ReactNode;
}) {
  const flip = x > width / 2;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 grid min-w-44 gap-1 rounded-md border bg-card px-3 py-2 text-xs shadow-md"
      style={flip ? { right: width - x + 12 } : { left: x + 12 }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({
  color,
  mark = "line",
  value,
  label,
}: {
  color?: string;
  mark?: "line" | "dot";
  value: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      {color ? (
        <svg width="12" height="8" aria-hidden="true" className="shrink-0 self-center">
          {mark === "line" ? (
            <line
              x1="1"
              x2="11"
              y1="4"
              y2="4"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <circle cx="6" cy="4" r="3.5" fill={color} />
          )}
        </svg>
      ) : null}
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
