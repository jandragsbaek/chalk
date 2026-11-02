import type { CatalogMovement, IsoDate, MovementId, VolumeWeek } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import type * as React from "react";

import {
  cellSources,
  describeAmounts,
  formatAmount,
  formatCount,
  formatTonnage,
  leftOutSummary,
  VOLUME_RANGES,
  volumeColumns,
  volumeGrid,
  type Amounts,
  type VolumeBasis,
  type VolumeColumn,
  type VolumeRange,
  type VolumeView,
} from "../../lib/volume.ts";
import { FieldBox } from "../FieldBox.tsx";
import { formatShort, formatWeekday, MoreLink } from "../today/SectionHead.tsx";

const VIEWS: ReadonlyArray<{ readonly id: VolumeView; readonly label: string }> = [
  { id: "volume", label: "Volume" },
  { id: "tonnage", label: "Tonnage" },
];

const BASES: ReadonlyArray<{ readonly id: VolumeBasis; readonly label: string }> = [
  { id: "done", label: "Done" },
  { id: "written", label: "As written" },
];

/** One joined row of choices, the picked one in ink, like the levels window. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly id: T; readonly label: string }>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const id = `volume-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="grid gap-1">
      <span id={id} className="form-label text-muted-foreground">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex">
        {options.map((option) => (
          <Button
            key={option.id}
            role="radio"
            aria-checked={value === option.id}
            variant={value === option.id ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface Picked {
  readonly weekStart: IsoDate;
  readonly movementId: MovementId | undefined;
}

const FOOT_ROWS: ReadonlyArray<{ readonly field: keyof Amounts; readonly label: string }> = [
  { field: "reps", label: "Reps" },
  { field: "metres", label: "Metres" },
  { field: "calories", label: "Calories" },
  { field: "seconds", label: "Seconds" },
];

/** "W44 · Oct 26 – Nov 1". */
const weekTitle = (column: VolumeColumn) => {
  const sunday = new Date(`${column.weekStart}T00:00:00`);
  sunday.setDate(sunday.getDate() + 6);
  return `W${column.week} · ${column.label} – ${formatShort(sunday.toISOString().slice(0, 10))}`;
};

/**
 * The volume ledger: movements down, ISO weeks across, each cell shaded against that movement's
 * own best week in view. The picked week reads out in the strip above; a picked cell says which
 * sessions it came from.
 */
export function VolumeLedger({
  weeks,
  catalog,
  today,
}: {
  readonly weeks: ReadonlyArray<VolumeWeek>;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly today: Date;
}) {
  const [view, setView] = useState<VolumeView>("volume");
  const [basis, setBasis] = useState<VolumeBasis>("done");
  const [range, setRange] = useState<VolumeRange>("12");
  const columns = volumeColumns(weeks, range, today);
  const grid = volumeGrid(weeks, catalog, { view, basis, columns });
  const rows = grid.groups.flatMap((group) => group.rows);

  // The latest week with anything in it, else this week.
  const latest =
    [...columns].reverse().find((_, index) => grid.sessions[columns.length - 1 - index]! > 0) ??
    columns.at(-1)!;
  const [picked, setPicked] = useState<Picked>({
    weekStart: latest.weekStart,
    movementId: undefined,
  });
  // A week the range no longer shows falls back to the newest.
  const found = columns.findIndex((column) => column.weekStart === picked.weekStart);
  const columnIndex = found === -1 ? columns.length - 1 : found;
  const column = columns[columnIndex]!;
  const week = weeks.find((candidate) => candidate.weekStart === column.weekStart);
  const rowIndex = rows.findIndex((row) => row.movementId === picked.movementId);
  const pickedRow = rowIndex === -1 ? undefined : rows[rowIndex];
  const nameOf = (id: MovementId) => catalog.find((movement) => movement.id === id)?.name ?? id;

  const pick = (next: Picked) => setPicked(next);

  const focusCell = (table: HTMLElement, row: number, col: number) => {
    const target = rows[row];
    const targetColumn = columns[col];
    if (!target || !targetColumn) return;
    pick({ weekStart: targetColumn.weekStart, movementId: target.movementId });
    table.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`)?.focus();
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    const row = rowIndex === -1 ? 0 : rowIndex;
    const moves: Record<string, readonly [number, number]> = {
      ArrowUp: [row - 1, columnIndex],
      ArrowDown: [row + 1, columnIndex],
      ArrowLeft: [row, columnIndex - 1],
      ArrowRight: [row, columnIndex + 1],
      Home: [row, 0],
      End: [row, columns.length - 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      focusCell(event.currentTarget as HTMLElement, move[0], move[1]);
    } else if (event.key === "Escape" && picked.movementId !== undefined) {
      event.preventDefault();
      pick({ weekStart: column.weekStart, movementId: undefined });
    }
  };

  const total = grid.totals[columnIndex]!;
  const sources = pickedRow ? cellSources(week, pickedRow.movementId, basis) : [];
  const leftOut = leftOutSummary(week?.leftOut ?? [], nameOf);
  const footRows =
    view === "tonnage"
      ? []
      : FOOT_ROWS.filter((foot) => grid.totals.some((amounts) => amounts[foot.field] > 0));

  if (weeks.length === 0)
    return (
      <main className="mx-auto grid w-full max-w-3xl content-start gap-4 px-8 pt-8">
        <h1 className="protocol-title border-b-2 border-foreground pb-1.5 text-4xl">Volume</h1>
        <p className="border bg-card px-4 py-6 text-sm">
          Every movement's reps, metres, calories and seconds by week show up here once a session is
          imported or a strength set logged.{" "}
          <Link to="/import" className="font-semibold">
            <MoreLink>Import a session</MoreLink>
          </Link>
        </p>
      </main>
    );

  return (
    <main className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col px-8 pt-6 pb-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-2">
        <h1 className="protocol-title text-4xl">Volume</h1>
        <div className="flex flex-wrap items-end gap-4">
          <Choice label="Show" options={VIEWS} value={view} onChange={setView} />
          <Choice label="Credit to" options={BASES} value={basis} onChange={setBasis} />
          <Choice label="Weeks" options={VOLUME_RANGES} value={range} onChange={setRange} />
        </div>
      </header>

      <dl className="flex divide-x border-x border-b bg-card" aria-live="polite">
        <FieldBox label="Week" wide>
          {weekTitle(column)}
        </FieldBox>
        <FieldBox label="Sessions">{grid.sessions[columnIndex]}</FieldBox>
        {view === "volume" ? (
          FOOT_ROWS.map((foot) => (
            <FieldBox key={foot.field} label={foot.label}>
              {total[foot.field] > 0 ? (
                formatAmount(foot.field, total[foot.field])
              ) : (
                <span data-empty aria-label="None" />
              )}
            </FieldBox>
          ))
        ) : (
          <FieldBox label="Reps lifted">
            {formatCount(rows.reduce((sum, row) => sum + row.cells[columnIndex]!.amounts.reps, 0))}
          </FieldBox>
        )}
        <FieldBox label="Tonnage">
          {total.tonnageKg > 0 ? (
            formatTonnage(total.tonnageKg)
          ) : (
            <span data-empty aria-label="None" />
          )}
        </FieldBox>
        <div className="grid min-w-0 flex-1 content-start px-3 py-1.5">
          {pickedRow ? (
            <>
              <dt className="form-label text-muted-foreground">
                {pickedRow.name} · W{column.week}
              </dt>
              <dd className="truncate text-sm leading-7">
                {sources.length === 0 ? (
                  <span className="text-muted-foreground">Nothing this week.</span>
                ) : (
                  <>
                    <span className="font-semibold">
                      {view === "tonnage"
                        ? formatTonnage(pickedRow.cells[columnIndex]!.amounts.tonnageKg)
                        : describeAmounts(pickedRow.cells[columnIndex]!.amounts, pickedRow.field)}
                    </span>
                    {sources.map((source) => (
                      <span
                        key={`${source.workoutId ?? source.performedOn} ${source.swappedWith ?? ""}`}
                        className="text-muted-foreground"
                      >
                        {" · "}
                        {formatWeekday(source.performedOn)}
                        {sources.length === 1 ? null : (
                          <span className="text-foreground">
                            {" "}
                            {view === "tonnage"
                              ? formatTonnage(source.amounts.tonnageKg)
                              : describeAmounts(source.amounts, pickedRow.field)}
                          </span>
                        )}
                        {source.swappedWith === undefined
                          ? null
                          : basis === "done"
                            ? ` in place of ${nameOf(source.swappedWith)}`
                            : ` done as ${nameOf(source.swappedWith)}`}
                      </span>
                    ))}
                  </>
                )}
              </dd>
            </>
          ) : (
            <>
              <dt className="form-label text-muted-foreground">Not counted</dt>
              <dd className="truncate text-sm leading-7 text-muted-foreground">
                {grid.sessions[columnIndex] === 0
                  ? "Nothing logged this week."
                  : leftOut.length === 0
                    ? "Every line counted."
                    : leftOut.join(" · ")}
              </dd>
            </>
          )}
        </div>
      </dl>

      <EndScroller key={range}>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {view === "tonnage"
              ? "Nothing lifted with a load in these weeks."
              : "Nothing counted in these weeks."}{" "}
            {range === "all" ? null : (
              <button
                type="button"
                className="font-semibold text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground"
                onClick={() => setRange("all")}
              >
                Show all weeks
              </button>
            )}
          </p>
        ) : (
          <table data-volume className="w-full" onKeyDown={onGridKey}>
            <caption className="sr-only">
              {view === "tonnage" ? "Tonnage" : "Volume"} per movement per ISO week
            </caption>
            <thead>
              <tr>
                <th scope="col" data-volume-corner className="form-label text-muted-foreground">
                  Movement
                </th>
                {columns.map((week, index) => (
                  <th
                    key={week.weekStart}
                    scope="col"
                    data-volume-week
                    data-picked={index === columnIndex ? "" : undefined}
                    data-current={week.current ? "" : undefined}
                  >
                    <button
                      type="button"
                      aria-pressed={index === columnIndex}
                      aria-label={`Week ${week.week}, from ${week.label}`}
                      onClick={() => pick({ weekStart: week.weekStart, movementId: undefined })}
                    >
                      <span className="block font-semibold">W{week.week}</span>
                      <span className="block">{week.label}</span>
                      {week.year === undefined ? null : <span className="block">{week.year}</span>}
                    </button>
                  </th>
                ))}
                <th scope="col" data-volume-total className="form-label text-muted-foreground">
                  {range === "all" ? "All weeks" : `${range} weeks`}
                </th>
              </tr>
            </thead>
            {grid.groups.map((group) => (
              <tbody key={group.category}>
                <tr data-volume-group>
                  <th scope="rowgroup" colSpan={columns.length + 2}>
                    <span className="protocol-title text-base">{group.label}</span>
                  </th>
                </tr>
                {group.rows.map((row) => {
                  const flat = rows.indexOf(row);
                  return (
                    <tr key={row.movementId} data-volume-row>
                      <th scope="row" data-volume-name>
                        <span className="font-semibold">{row.name}</span>
                        {row.field === "reps" || row.field === "tonnageKg" ? null : (
                          <span className="form-label text-muted-foreground">{row.unit}</span>
                        )}
                      </th>
                      {row.cells.map((cell, index) => {
                        const isPicked =
                          index === columnIndex && row.movementId === picked.movementId;
                        return (
                          <td
                            key={columns[index]!.weekStart}
                            data-cell={`${flat}-${index}`}
                            data-volume-cell={cell.heat}
                            data-picked-week={index === columnIndex ? "" : undefined}
                            data-picked={isPicked ? "" : undefined}
                            data-more={cell.more ? "" : undefined}
                            tabIndex={
                              isPicked || (rowIndex === -1 && flat === 0 && index === columnIndex)
                                ? 0
                                : -1
                            }
                            aria-label={`${row.name}, week ${columns[index]!.week}: ${
                              cell.text === undefined
                                ? "nothing"
                                : view === "tonnage"
                                  ? formatTonnage(cell.amounts.tonnageKg)
                                  : describeAmounts(cell.amounts, row.field)
                            }`}
                            onClick={() =>
                              pick({
                                weekStart: columns[index]!.weekStart,
                                movementId: row.movementId,
                              })
                            }
                          >
                            {cell.text ?? <span data-empty aria-hidden />}
                          </td>
                        );
                      })}
                      <td data-volume-total>{row.totalText}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
            <tfoot>
              <tr data-volume-foot>
                <th scope="row">Sessions</th>
                {grid.sessions.map((count, index) => (
                  <td
                    key={columns[index]!.weekStart}
                    data-picked-week={index === columnIndex ? "" : undefined}
                  >
                    {count > 0 ? count : <span data-empty aria-label="None" />}
                  </td>
                ))}
                <td data-volume-total>{grid.sessions.reduce((sum, count) => sum + count, 0)}</td>
              </tr>
              {footRows.map((foot) => (
                <tr key={foot.field} data-volume-foot>
                  <th scope="row">{foot.label}</th>
                  {grid.totals.map((amounts, index) => (
                    <td
                      key={columns[index]!.weekStart}
                      data-picked-week={index === columnIndex ? "" : undefined}
                    >
                      {amounts[foot.field] > 0 ? (
                        formatAmount(foot.field, amounts[foot.field])
                      ) : (
                        <span data-empty aria-label="None" />
                      )}
                    </td>
                  ))}
                  <td data-volume-total>
                    {formatAmount(
                      foot.field,
                      grid.totals.reduce((sum, amounts) => sum + amounts[foot.field], 0),
                    )}
                  </td>
                </tr>
              ))}
              <tr data-volume-foot>
                <th scope="row">Tonnage</th>
                {grid.totals.map((amounts, index) => (
                  <td
                    key={columns[index]!.weekStart}
                    data-picked-week={index === columnIndex ? "" : undefined}
                  >
                    {amounts.tonnageKg > 0 ? (
                      formatTonnage(amounts.tonnageKg)
                    ) : (
                      <span data-empty aria-label="None" />
                    )}
                  </td>
                ))}
                <td data-volume-total>
                  {formatTonnage(grid.totals.reduce((sum, amounts) => sum + amounts.tonnageKg, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </EndScroller>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="form-label">Shade</span>
          {([1, 2, 3, 4] as const).map((heat) => (
            <span key={heat} data-volume-swatch={heat} aria-hidden />
          ))}
          <span>against each movement's best week in view</span>
        </span>
        <span>
          {basis === "done"
            ? "Credited to what you did: scaled reps to the scaling, an “or” to the one you picked."
            : "Credited to the movement the board wrote, whatever it was done as."}
        </span>
        {view === "tonnage" ? (
          <span>Reps × the load on the bar or bells; bodyweight adds nothing.</span>
        ) : (
          <span>
            <span data-volume-swatch="more" aria-hidden /> also counted in another unit
          </span>
        )}
      </footer>
    </main>
  );
}

/**
 * The ledger's scroller. Newest weeks sit at the right, so it opens scrolled there; keyed on the
 * range, it opens there again whenever the columns change.
 */
function EndScroller({ children }: { readonly children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line chalk/no-unreasoned-state-sync -- sets the DOM scroll position once on mount, so the newest week is in view
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);
  return (
    <div
      ref={scroller}
      data-volume-scroll
      className="mt-4 min-h-0 flex-1 overflow-auto border bg-card"
    >
      {children}
    </div>
  );
}
