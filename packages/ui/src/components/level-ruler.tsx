import type * as React from "react";

/** A rung of the level sheet, Fundamentals to Elite; `level` names it for the colour ramp. */
export interface RulerStop {
  readonly level: "fundamentals" | "scaled" | "intermediate" | "rx" | "elite";
  readonly short: string;
  /** "42.5", "Pull-up"; absent when the sheet leaves the rung out. */
  readonly label?: string | undefined;
  /** Written by Chalk rather than the official sheet: a dashed tick. */
  readonly chalk?: boolean;
}

export interface RulerMarker {
  /** Rung i sits at i; -0.5 to 4.5 is the whole ruler. */
  readonly position: number;
  /** `performed`: an ink square. `capability`: a green diamond. `estimate`: a canary diamond. */
  readonly kind: "performed" | "capability" | "estimate";
  /** Printed under the marker ("50"). */
  readonly label?: string;
  /** Read by assistive tech and shown on hover. */
  readonly title: string;
}

const at = (position: number, span?: number) =>
  ({
    "--at": Math.min(4.5, Math.max(-0.5, position)),
    ...(span === undefined ? {} : { "--span": span }),
  }) as React.CSSProperties;

/**
 * One family's row of the level sheet as a ruler: five rungs at equal steps, the ink ramp
 * between them, and markers for what was done, what the athlete can do, and the range the
 * box programmed.
 */
function LevelRuler({
  stops,
  markers,
  range,
  size = "md",
  label,
}: {
  readonly stops: ReadonlyArray<RulerStop>;
  readonly markers: ReadonlyArray<RulerMarker>;
  /** Positions of the easiest and hardest prescription: a dashed bracket. */
  readonly range?: { readonly from: number; readonly to: number } | undefined;
  readonly size?: "sm" | "md";
  /** Whole-ruler summary for screen readers. */
  readonly label: string;
}) {
  // A labelled marker on a rung prints its own number there instead of the rung's.
  const covered = new Set(
    markers
      .filter((marker) => marker.label !== undefined && size === "md")
      .flatMap((marker) => {
        const nearest = Math.round(marker.position);
        return Math.abs(marker.position - nearest) < 0.3 ? [nearest] : [];
      }),
  );
  return (
    <div data-ruler data-size={size} role="img" aria-label={label}>
      {stops.map((stop, index) => (
        <span
          key={stop.level}
          data-at
          data-zone
          data-level={stop.level}
          data-undefined={stop.label === undefined ? "" : undefined}
          style={at(index, index === stops.length - 1 ? 0.5 : 1)}
        />
      ))}
      <span data-baseline />
      {stops.map((stop, index) => (
        <span
          key={stop.level}
          data-at
          data-tick
          data-chalk={stop.chalk ? "" : undefined}
          data-undefined={stop.label === undefined ? "" : undefined}
          style={at(index)}
        >
          <span data-tick-short>{stop.short}</span>
          {stop.label === undefined || covered.has(index) ? null : (
            <span data-tick-label>{stop.label}</span>
          )}
        </span>
      ))}
      {range ? (
        <span
          data-at
          data-range
          title="What the box programmed"
          style={at(range.from, range.to - range.from)}
        />
      ) : null}
      {markers.map((marker) => (
        <span key={`${marker.kind}-${marker.position}`}>
          <span
            data-at
            data-marker={marker.kind}
            title={marker.title}
            style={at(marker.position)}
          />
          {marker.label === undefined || size === "sm" ? null : (
            <span data-at data-marker-label style={at(marker.position)}>
              {marker.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * A level as a printed badge: solid when done, dashed when it is what was asked for. `assumed`
 * keeps a done level's fill on a dashed edge: counted as done, though nobody said so.
 */
function LevelBadge({
  level,
  open,
  assumed,
  children,
  title,
}: {
  readonly level: RulerStop["level"] | "below";
  readonly open?: boolean;
  readonly assumed?: boolean;
  readonly children: React.ReactNode;
  readonly title?: string;
}) {
  return (
    <span
      data-level-badge
      data-level={level}
      data-open={open ? "" : undefined}
      data-assumed={assumed ? "" : undefined}
      title={title}
    >
      {children}
    </span>
  );
}

export interface ShareSegment {
  readonly level: RulerStop["level"] | "below";
  readonly reps: number;
  readonly label: string;
}

/** Reps split by level: "88 % jumping | 12 % kipping", widths by share. */
function LevelShareBar({ segments }: { readonly segments: ReadonlyArray<ShareSegment> }) {
  const total = segments.reduce((sum, segment) => sum + segment.reps, 0);
  if (total === 0) return null;
  return (
    <div data-share-bar>
      {segments.map((segment) => (
        <span
          key={segment.level}
          data-level={segment.level}
          title={`${Math.round((segment.reps / total) * 100)} % ${segment.label} (${segment.reps} reps)`}
          style={{ flexGrow: segment.reps, flexBasis: 0 }}
        >
          {Math.round((segment.reps / total) * 100)} % {segment.label}
        </span>
      ))}
    </div>
  );
}

export { LevelBadge, LevelRuler, LevelShareBar };
