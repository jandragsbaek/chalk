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
- Training blocks (done): the coach drafts a strength cycle or a prehab block as dated
  sessions of structured lines (movement, sets × reps or seconds, % of a training max → kg in
  2.5 kg steps, kg, or words); `/calendar` is the Sunday desk: this week reviewed beside next
  week to plan, the season as block lanes above, drafts below to put in the calendar, single
  sessions dragged between days. Lifts count done from logged sets that day, other lines by
  tick. Blocks stack. Migration `017_TrainingBlocks`; RPCs `blocks.*`, `sessions.*`.

## Later, unordered

- Custom movements and aliases (done through the importer; no catalog screen yet).
- kg / lb display preference.
- Athlete profile (done): sex (M/F, picks the side of every M/F load; male until set), height,
  optional arm and inseam lengths, bodyweight over time, on `/settings`. A plain settings page,
  not a setup wizard. RPCs: `profile.get`, `profile.update`, `bodyweights.log`,
  `bodyweights.delete`; migration `013_AthleteProfile`.
- Work and power (done): estimated work per session and block and average power, from the
  athlete's body and what each session asked (see domain.md). Session sheet, benchmark
  attempts, `/power` trend. RPC `power.sessions`. Later: % of 1RM loads from the estimated 1RM,
  box height and vest per attempt, how a scaled benchmark was done.
- Desk pages: catalog management (movements, scaling options, templates).
- Import pasted session text (done: the Import page, see domain.md). Whiteboard photos later.
