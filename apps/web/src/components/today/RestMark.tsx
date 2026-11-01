import { REST_DAY_KINDS, REST_DAY_LABELS, type RestDay, type RestDayKind } from "@chalk/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chalk/ui/components/select.tsx";
import { useAtomSet } from "@effect/atom-react";

import {
  clearRestDayAtom,
  markRestDayAtom,
  REST_DAYS_REACTIVITY_KEY,
} from "../../state/restDays.ts";
import { formatWeekday } from "./SectionHead.tsx";

/** The pick that takes a day's mark off. */
const CLEAR = "clear";

const items = [
  ...REST_DAY_KINDS.map((kind) => ({ value: kind, label: REST_DAY_LABELS[kind] })),
  { value: CLEAR, label: "Not resting" },
];

/** How a marked day reads: "Rest day", or "Sick" and the like, and who put it there. */
export function RestLabel({ rest }: { readonly rest: RestDay }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-sm font-medium">{REST_DAY_LABELS[rest.kind]}</span>
      {rest.source === "coach" ? (
        <span className="form-label shrink-0 text-muted-foreground">By coach</span>
      ) : null}
    </span>
  );
}

/**
 * Marks a day as rest on purpose (or sick, injured, travel), changes why, or takes the mark
 * off. Rest is never inferred: only a day marked here, or by the coach, is a rest day.
 */
export function RestMark({
  iso,
  rest,
}: {
  readonly iso: string;
  readonly rest: RestDay | undefined;
}) {
  const mark = useAtomSet(markRestDayAtom, { mode: "promiseExit" });
  const clear = useAtomSet(clearRestDayAtom, { mode: "promiseExit" });

  function handleChange(value: string | null) {
    if (value === null || value === rest?.kind) return;
    if (value === CLEAR)
      void clear({ payload: { day: iso }, reactivityKeys: [REST_DAYS_REACTIVITY_KEY] });
    else
      void mark({
        payload: { day: iso, kind: value as RestDayKind },
        reactivityKeys: [REST_DAYS_REACTIVITY_KEY],
      });
  }

  const options = rest === undefined ? items.filter((item) => item.value !== CLEAR) : items;
  return (
    <span data-rest-control className="shrink-0">
      <Select items={options} value={rest?.kind ?? null} onValueChange={handleChange}>
        <SelectTrigger
          size="sm"
          aria-label={`${rest === undefined ? "Mark" : "Change"} rest day, ${formatWeekday(iso)}`}
        >
          <SelectValue>{() => (rest === undefined ? "Mark rest" : "Change")}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}
