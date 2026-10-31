# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One athlete: the owner (Jan), training CrossFit. Logs sessions and strength sets, then reviews
progress at a desk after training. No coach or other members read the app; a future coaching
agent reads the data through an MCP server, not the charts.

## Product Purpose

Track CrossFit workouts and strength numbers, and see progress per movement over time. Success:
the athlete can tell at a glance whether a lift is getting stronger, even in weeks without a true
max attempt, and trust where each number comes from.

## Positioning

Personal, structured logging over a movement catalog. Strength numbers are derived, not typed:
rep maxes come from logged sets, implied maxes are marked, estimated 1RM is computed and labeled
as an estimate.

## Operating Context

- Sets logged per movement and day (reps × kg). Rep maxes tracked for 1, 2, 3, 5 and 10 reps.
- Progress review happens on desktop, sitting down, after training.
- Single-athlete data volume: hundreds of sets per lift at most.

## Capabilities and Constraints

- Loads stored in kg; lb display is later.
- Rep max for N = heaviest load lifted for at least N reps; implied maxes marked with `*`.
- Estimated 1RM: Epley (`load × (1 + reps / 30)`) is the headline number; the spread across
  Epley, Brzycki and Lombardi is shown as uncertainty: none for a single, widest at high reps
  (not strictly monotonic; the formulas cross near 5 reps).
- Planned (roadmap phase 2): per-movement page with a weekly e1RM chart, RPE per set,
  percentage helper, true max-attempt marker.
- Charts: visx 4 (SVG primitives), chosen for custom marks.
- Stack fixed by the repo: React 19 + React Compiler, TanStack Router, Tailwind 4, Base UI
  components in `packages/ui`.

## Evidence on Hand

No real progress data in the repo. Mockups use synthetic, clearly labeled data.

## Product Principles

1. Every number shows its source: tested, implied, or estimated.
2. Honest uncertainty over false precision.
3. Progress readable in seconds; detail on demand.
