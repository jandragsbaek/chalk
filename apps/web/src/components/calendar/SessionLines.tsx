import { lineLoadKg, lineVolume, type ProgrammedLine, type TrainingMax } from "@chalk/contracts";

const kgFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

export const kgText = (kg: number) => `${kgFormat.format(kg)} kg`;

/**
 * A line's prescription as carbon chips: sets × reps in green, the percent in canary, then the
 * load it comes to (or the load in words). The movement name is the caller's.
 */
export function LineDose({
  line,
  maxes,
  compact = false,
}: {
  readonly line: ProgrammedLine;
  readonly maxes: ReadonlyArray<TrainingMax>;
  readonly compact?: boolean;
}) {
  const volume = lineVolume({ ...line, each: false });
  const kg = lineLoadKg(line, maxes);
  const chip = compact
    ? "px-1 text-xs leading-5 font-semibold whitespace-nowrap"
    : "px-1.5 leading-6 font-semibold whitespace-nowrap";
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {volume === undefined ? null : (
        <span data-chip data-measure="reps" className={chip}>
          {volume}
        </span>
      )}
      {line.each === true ? (
        <span className={compact ? "text-xs text-muted-foreground" : "text-muted-foreground"}>
          each
        </span>
      ) : null}
      {line.percent === undefined || compact ? null : (
        <span data-chip data-measure="percent_1rm" className={chip}>
          {line.percent} %
        </span>
      )}
      {kg === undefined ? null : (
        <span className={compact ? "text-xs font-semibold whitespace-nowrap" : "font-semibold"}>
          {kgText(kg)}
        </span>
      )}
      {line.load === undefined || compact ? null : (
        <span className="text-muted-foreground">{line.load}</span>
      )}
    </span>
  );
}
