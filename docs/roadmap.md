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
- RPE per set; percentage helper off the current 1RM.
- Optional "attempt" marker for true max-out days.

## 3. Composed workouts

- `workout_parts` and `workout_items` tables (prescribed vs performed, derived total reps).
- Structured scores per format, with the display string derived.
- Log form builds a workout from parts and catalog movements; benchmark templates replace the
  free-text datalist.
- Strength parts write lift sets, so rep maxes come from workouts too.
- Migrate existing workouts to one part each.

## 4. Scaling

- `scaling_options` catalog per movement, ranked.
- Record scaling on performed items; Rx derived.
- Per-movement scaling timeline ("banded → kipping → Rx").

## 5. Volume grid

- Reps (or meters, calories, seconds) per movement per ISO week; tonnage view.
- Needs `measure` on movements (phase 3 adds it).

## 6. Coach

- MCP server over Chalk data; short question loop through OpenRouter. Details in
  [coaching.md](coaching.md).

## Later, unordered

- Custom movements and aliases.
- kg / lb display preference.
- Backoffice: catalog management (movements, scaling options, templates).
- Import from a whiteboard photo or pasted programming text (the coach's tools can parse it).
