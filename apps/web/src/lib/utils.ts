/** The browser's local calendar day, which is what an athlete means by "today". */
export function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "Thu, Oct 29, 2026" for an IsoDate, read as a local calendar day. */
export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Entries grouped by their `performedOn` day, keeping input order. */
export function groupByDay<T extends { readonly performedOn: string }>(
  entries: ReadonlyArray<T>,
): Array<[day: string, entries: T[]]> {
  const days = new Map<string, T[]>();
  for (const entry of entries) {
    const day = days.get(entry.performedOn);
    if (day) day.push(entry);
    else days.set(entry.performedOn, [entry]);
  }
  return [...days];
}

/** A key press meant for a field being typed in, not for the page's shortcuts. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
