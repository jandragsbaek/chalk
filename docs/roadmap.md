# Roadmap

Ordered by what unlocks the next step. Each phase ships end to end: contracts, migration, store,
RPC, UI, tests. See [domain.md](domain.md) for the model and [coaching.md](coaching.md) for the
coach.

## 1. Movement catalog and strength sets (done)

- `movements` table with a seeded catalog (40 movements, slug ids).
- `lift_sets`: log reps × kg per movement and day; delete.
- Rep maxes (1/2/3/5/10RM) derived from all sets, with implied maxes marked.
- Web: `/strength` page with set form, rep max table, set history with PR badges.
- RPCs: `movements.list`, `lifts.list`, `lifts.log`, `lifts.delete`, `lifts.records`.

## 2. Strength progress over time

- Estimated 1RM chart on `/strength` (done): per lift, best estimate to date with formula
  spread, every session as a dot, singles marked.
- Per-movement page: every set, rep maxes, and that chart in one place.
- RPE per set (prescribed RPE and block intent are imported; performed RPE is not per set,
  only per session in the debrief);
  percentage helper off the current 1RM.
- Optional "attempt" marker for true max-out days.

## 3. Composed workouts

- `workout_parts` and `workout_items` tables (prescribed vs performed, derived total reps).
- Structured scores per format, with the display string derived.
- Log form builds a workout from parts and catalog movements.
- Benchmarks (done): the Girls, the 244 Heroes and three classics as reference data; logging
  one writes its structure, the importer links parts to them, `/benchmarks` shows attempts,
  records and the Rx level on GymDanmark's sheet. Later: a structured score per format, and
  logging how a scaled attempt was done.
- Strength parts write lift sets, so rep maxes come from workouts too.
- Migrate existing workouts to one part each.

## 4. Scaling

- Levels after GymDanmark's FF sheet (done): every movement graded on a row of the sheet plus
  Chalk's Elite rung; how a movement was done (load, reps by variation, biggest unbroken set)
  recorded in the importer; programmed and performed level per movement and per session;
  accessories tagged with what they complement. Web: `/levels`, a ruler per family.
- Standards from Competition Corner divisions (national, international) as extra sources.
- `scaling_options` catalog per movement, ranked.
- Per-movement scaling timeline ("banded → kipping → Rx").

## 5. Volume grid

- Reps (or meters, calories, seconds) per movement per ISO week; tonnage view.
- Needs `measure` on movements (phase 3 adds it).

## 6. Coach

- Conversations with receipts on `/coach`, through OpenRouter (done).
- Check-ins that fill a workout's debrief; MCP server over the same tools. Details in
  [coaching.md](coaching.md).

## Later, unordered

- Custom movements and aliases (done through the importer; no catalog screen yet).
- kg / lb display preference.
- Athlete sex (M/F) as a setting from a first-run setup wizard; picks which side of M/F loads
  (prescriptions and level standards like GymDanmark's "20/12") applies. Assumed male until then.
- Desk pages: catalog management (movements, scaling options, templates).
- Import pasted session text (done: the Import page, see domain.md). Whiteboard photos later.
