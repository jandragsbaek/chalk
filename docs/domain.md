# Domain model

What Chalk tracks and how the pieces relate. **Built** marks what exists in code today; the rest
is the target model the [roadmap](roadmap.md) works toward.

## Goals

1. Log CrossFit sessions as compositions of known movements, not free text.
2. See progress per movement: how much of it, how heavy, and which scaling was used.
3. Track strength numbers over time (1RM, 3RM, 5RM, ...) per lift.
4. Aggregate volume: reps per movement per week, as a grid.
5. Give a coach (human or [agent](coaching.md)) structured data to reason over.

## Concepts

```
Movement ──< ScalingOption
   │
   ├──< LiftSet                      (built: strength sets → rep maxes)
   │
   └──< WorkoutItem >── WorkoutPart >── Workout (session)
          prescribed vs performed
```

### Movement (built)

One entry in the catalog. Everything else points at a movement id.

| Field      | Notes                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `id`       | Stable slug, e.g. `back-squat`. Never renamed once referenced.             |
| `name`     | Display name.                                                              |
| `category` | `barbell`, `dumbbell_kettlebell`, `gymnastics`, `monostructural`, `other`. |

Seeded by migration `002_Strength`. Catalog changes are new migrations, never edits to old ones.

Later fields:

- `measure`: what one unit of the movement is: `reps`, `distance_m`, `calories`, `seconds`.
  Rows and runs are counted in meters or calories, not reps; the volume grid needs this.
- `loadable`: whether a load makes sense (thruster yes, burpee no).
- `custom`: user-defined movement (box step-over with a sandbag, etc).
- `aliases`: "T2B", "HSPU", "C2B" for search and for parsing whiteboard text.

### Scaling option

Named, per-movement ways to make a movement easier. Four kinds:

| Kind           | Example                             | Recorded as                                    |
| -------------- | ----------------------------------- | ---------------------------------------------- |
| `substitution` | Ring rows instead of pull-ups       | Performed movement differs from prescribed one |
| `modification` | Banded pull-up, box pistol, step-up | Scaling option id on the performed item        |
| `load`         | 30 kg thrusters instead of 43 kg    | Performed load is below prescribed load        |
| `volume`       | 15-12-9 instead of 21-15-9          | Performed reps are below prescribed reps       |

Substitutions and modifications are catalog entries (`ScalingOption { id, movementId, name, kind,
rank }`); `rank` orders them from most to least scaled, so "banded (green) → banded (purple) →
kipping → Rx" is a progression Chalk can chart. Load and volume scaling fall out of comparing
numbers, so they need no catalog entry.

**Rx is derived**, not a checkbox: a part is Rx when every performed item matches its prescription
(same movement, no scaling option, load and reps at or above prescribed). The current
`workouts.rx` column stays for workouts logged before parts existed.

### Workout, parts and items

A **workout** is one session on one day. It has ordered **parts** ("A. Back squat 5x5",
"B. Fran"). A part has:

- `format`: `for_time`, `amrap`, `emom`, `strength`, `intervals`, `other`.
- Format parameters: time cap, duration, interval length, rounds, rep scheme (`21-15-9`).
- A **structured score** plus its display string: seconds for `for_time`, rounds + reps for
  `amrap`, load for `strength`, or `dnf` with reps completed under the cap.
- Ordered **items**, one per movement in the part.

A **workout item** holds both sides:

| Prescribed                   | Performed                                       |
| ---------------------------- | ----------------------------------------------- |
| Movement                     | Movement (differs on substitution)              |
| Reps per round or scheme     | Total reps actually done (derived, overridable) |
| Load (kg, can differ by sex) | Load used                                       |
|                              | Scaling option ids                              |

Total reps per item are derived from the part: a 21-15-9 for-time item done in full is 45 reps;
an AMRAP item is `rounds × reps per round` plus the partial round; an EMOM item is
`minutes × reps per minute`. Storing the derived total keeps the volume grid a plain `SUM`.

**Templates.** Benchmarks (Fran, Grace, Murph, ...) and box programming are templates: a part
with prescribed items and no performance. Logging Fran copies the template and asks only for
what differs. The free-text datalist in the log form today is a placeholder for this.

Existing `workouts` rows migrate as a session with one part and no items; their free-form score
and `rx` flag stay as they are.

### Lift set and rep maxes (built)

`LiftSet { movementId, performedOn, reps, loadKg, notes }`: one working set. Loads are stored in
kilograms; pounds are a display concern for later.

**Rep max** for N reps = the heaviest load lifted for **at least** N reps. A set of 5 at 100 kg
proves a 3RM of at least 100 kg, so `RepMax.fromReps` records which set a number comes from, and
the UI marks implied maxes with `*`. On equal loads, the earliest set wins (that is when the
record was set). Chalk tracks 1, 2, 3, 5 and 10RM (`REP_MAX_TARGETS`); computed in
`apps/server/src/strength/repMaxes.ts` from all sets, which is cheap at one athlete's scale.

**Estimated 1RM** (built, web only): each set scores `load × (1 + reps / 30)` (Epley); a
single is its own load. The spread across Epley, Brzycki and Lombardi is shown as uncertainty:
none for a single, widest at high reps. Sets over 12 reps are left out. The `/strength` chart
plots each session's best estimate and the best estimate to date, which moves even in weeks
without a max attempt. Computed client-side in `apps/web/src/lib/progress.ts` from all sets.

Later:

- Link sets to a strength part (`workout_part_id`, nullable), so "5x5 back squat" logged as a
  workout also feeds rep maxes, instead of logging twice.
- RPE / RIR per set, to discount estimates from sets left far from failure.
- Percentage helper: programs say "5x3 @ 80%"; Chalk knows the 1RM.
- Bodyweight movements with load (weighted pull-up) use the same table with `loadKg` as the
  added weight.

### Weekly volume grid

Rows: movements. Columns: ISO weeks. Cell: total reps (or meters, calories, seconds, per the
movement's `measure`), with tonnage (`reps × load`) for loaded movements as a second view.

Sources are performed workout items and lift sets not linked to a part (linked ones are already
counted through their item). The query groups by `movement_id` and
`strftime('%G-%V', performed_on)` (ISO year and week; the SQLite bundled with Node 24 is 3.53,
which supports both).

Substituted items count toward the movement actually performed, and the grid can toggle to show
prescribed movements instead, which answers "how many pull-ups were programmed vs done".

## Units and time

- Load: kilograms everywhere in storage and contracts.
- Dates: `performedOn` is the athlete's local calendar day (`IsoDate`); `createdAt` is an instant.
- Durations: seconds as integers.
