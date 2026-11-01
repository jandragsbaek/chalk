import { ArrowRight } from "lucide-react";
import type * as React from "react";

/** A protocol section heading: condensed heavy caps on a 2px ink rule, meta on the right. */
export function SectionHead({
  id,
  title,
  meta,
  size = "md",
}: {
  readonly id: string;
  readonly title: React.ReactNode;
  readonly meta?: React.ReactNode;
  readonly size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-2 border-foreground pb-1.5">
      <h2 id={id} className={size === "lg" ? "protocol-title text-3xl" : "protocol-title text-xl"}>
        {title}
      </h2>
      {meta ? <div className="form-label text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

/** The meta link to a section's full page: "All workouts" and an arrow. */
export function MoreLink({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 hover:text-foreground">
      {children}
      <ArrowRight aria-hidden className="size-3" />
    </span>
  );
}

const shortDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const weekdayDay = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "Oct 26" for an IsoDate. */
export const formatShort = (iso: string) => shortDay.format(new Date(`${iso}T00:00:00`));
/** "Mon, Oct 26" for an IsoDate. */
export const formatWeekday = (iso: string) => weekdayDay.format(new Date(`${iso}T00:00:00`));
