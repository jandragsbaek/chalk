import type { MonthGroup } from "../../lib/sessions.ts";

const shortMonth = new Intl.DateTimeFormat(undefined, { month: "short" });

/** "2026-10" → "Oct". */
const monthLabel = (month: string) => shortMonth.format(new Date(`${month}-01T00:00:00`));

/** The register section a month tab jumps to. */
export const monthSectionId = (month: string) => `sessions-${month}`;

/** Each session adds a step of height, up to a cap, so busy and quiet stretches read at a glance. */
const tabHeight = (count: number) => `${1.75 + Math.min(count, 24) * 0.125}rem`;

/**
 * The month index down the edge of the register: years, then their months with a count each.
 * The month the register is reading is inked; a tab jumps the register to its month.
 */
export function SessionRail({
  groups,
  activeMonth,
  onJump,
}: {
  readonly groups: ReadonlyArray<MonthGroup>;
  readonly activeMonth: string | undefined;
  readonly onJump: (month: string) => void;
}) {
  const years: Array<[year: string, months: Array<MonthGroup>]> = [];
  for (const group of groups) {
    const year = group.month.slice(0, 4);
    const last = years.at(-1);
    if (last?.[0] === year) last[1].push(group);
    else years.push([year, [group]]);
  }

  return (
    <nav aria-label="Months" className="min-h-0 overflow-y-auto border-r bg-background">
      {years.map(([year, months]) => (
        <div key={year} className="pb-3">
          <h2 className="protocol-title px-4 pb-1.5 pt-4 text-lg">{year}</h2>
          <ul className="border-b">
            {months.map((group) => {
              const active = group.month === activeMonth;
              return (
                <li key={group.month} className="border-t">
                  <button
                    type="button"
                    data-rail-month={group.month}
                    aria-current={active ? "true" : undefined}
                    style={{ minHeight: tabHeight(group.entries.length) }}
                    className={
                      active
                        ? "form-label flex w-full cursor-pointer items-center justify-between bg-foreground pl-4 pr-3 text-background"
                        : "form-label flex w-full cursor-pointer items-center justify-between pl-4 pr-3 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                    }
                    onClick={() => onJump(group.month)}
                  >
                    <span>{monthLabel(group.month)}</span>
                    <span className="tabular-nums">{group.entries.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
