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

| Field         | Notes                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| `id`          | Stable slug, e.g. `back-squat`. Never renamed once referenced.             |
| `name`        | Display name.                                                              |
| `category`    | `barbell`, `dumbbell_kettlebell`, `gymnastics`, `monostructural`, `other`. |
| `variationOf` | Core movement this is a variation of (`power-snatch` → `snatch`), or none. |

Seeded by migration `002_Strength`. Seeded entries change only through new migrations, never
edits to old ones. The importer can add movements (`user_added = 1`, id = slug of the name) and
aliases from the Import page.

**Aliases (built).** `movement_aliases { key, alias, movementId }`: other phrases for a movement
("DU", "Squat snatch", "Burpees over the rower"). `key` is the normalized phrase
(`normalizeMovementPhrase`: lower case, split on punctuation, trailing plural "s" dropped) and is
unique, so one phrase means one movement. A movement's own name is never stored as an alias.
Migration `003_SessionImports` seeds whiteboard shorthand.

**Variations (built).** `movements.variation_of` points a variation at its **core** movement:
Power snatch, Hang power snatch, High-hang snatch are variations of Snatch. One level only
(`CatalogStore` refuses a core that is itself a variation, and a movement with variations cannot
become one). Variations are full movements, so lift sets and rep maxes stay per variation (a
hang power snatch PR is its own number); the family is a join away for rolling volume up to the
core. Migration `004_VariationsAndIntent` links the seeded power and hang power snatch and clean.
Creating a movement whose name was an alias ("Squat snatch" meant Snatch) moves the phrase to
the new movement.

Later fields:

- `measure`: what one unit of the movement is: `reps`, `distance_m`, `calories`, `seconds`.
  Rows and runs are counted in meters or calories, not reps; the volume grid needs this.
- `loadable`: whether a load makes sense (thruster yes, burpee no).

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

### Levels (built)

Every movement can be graded on a row of GymDanmark's FF level sheet
([Øvelses- og niveauoversigt, March 2026](https://gymdanmark.dk/wp-content/uploads/2026/03/Oevelses-og-niveauoversigt-i-FF-Open-Age-U19-20-U21-22-M30-34-M35-39-M40-44-M45-49.pdf)):
Fundamentals, Scaled, Intermediate, RX, plus an **Elite** rung Chalk writes itself (the sheet
stops at RX; loads are RX plus about 20 %, gymnastics a harder variation such as a strict ring
muscle-up). The sheet is data in `packages/contracts/src/levels.ts` (`LEVEL_FAMILIES`).

- **Family**: one row of the sheet. `kind: "load"` grades by kilograms per implement
  (barbell, KB and DB rows; dual loads for two implements; American swings for RX);
  `kind: "variant"` grades by the variation done (jumping pull-up, pull-up, chest-to-bar, ...).
  The back squat row is the squat row plus the sheet's from-the-rack 10/5 kg (20/10 at RX).
- **Movement**: `movements.level_family` names its row (seeded for the catalog; set in the
  importer for the rest). A movement on no row is not graded.
- **Grading**: a load meets the highest rung at or under it, and sits between rungs on the
  ruler. A variation meets the rung it enters at and every rung above that asks for nothing new
  (toes-to-bar enter at Intermediate and also meet RX). Rungs the sheet leaves out ("-") are
  skipped. Loads use the athlete's side of M/F (`ATHLETE_SEX`, male until the setup wizard).
- **Performance** (on the movement span, stored as `workout_items.performance`): how it was
  done. Empty means as prescribed; `loadKg` per implement and `implements` (1 or 2); `variants`
  splits the reps ("6 pull-ups, 44 jumping"); `unbroken` is the biggest unbroken set of the
  hardest variation; `perRound` is the count reached each round, worst to best ("7-8" cal),
  offered for counted items (not sets × reps) and placed on the item's tiers ("under RX (15)").
  A lift result's heaviest set counts as the load. A swap to another family
  (dumbbell for barbell thrusters) is graded on the family it belongs to.
- **Performed level** of a variant family: the highest rung more than half the reps reached.
  **Capability**: the hardest variation done at all (with its unbroken set), or for loads the
  estimated 1RM. Capability past the next rung means the gap is volume; under it, skill.
- **Division** of a session: the lowest level every graded movement reaches, like a
  competition division; programmed (the board) and performed (what was done) are separate.
  The board's "Rx" is often a GymDanmark Scaled or Fundamentals.
- **Accessory**: `movements.accessory`, with `complements` (a fixed vocabulary of patterns and
  muscles: `horizontal_pull`, `single_leg`, `lats`, ...) and `supports` (the families it builds
  toward). An accessory with a natural row (Bulgarian split squats on DB squats, lunges) is
  graded too. The Levels board lists only accessories trained in the window.
- **Weightlifting accessories**: pulls, deadlifts and drills (snatch and clean pulls and high
  pulls, snatch and clean deadlifts, snatch balance, drop, muscle and tall snatch, jerk dip
  squat) are barbell accessories that support the lift's row, never variations of it: a pull
  has no catch, so its reps are not snatch reps, and its loads run past the snatch 1RM. Not
  graded (no sheet row); rep maxes stay their own. Deficit pulls are variations of the pull.
  Seeded with whiteboard aliases ("SN pull", "SGDL") by migration `012_LiftingAccessories`.
  Later: a `percentOf` movement for "snatch pull @ 110 %" (of the snatch 1RM), since
  `supports` names sheet rows, not movements.
- Not graded: wall walks (hand distance not recorded), D-ball and sandbag, endurance. Box
  height is not recorded, so box jumps stop at Scaled.

Later: standards from Competition Corner divisions (national and international) as more
sources next to GymDanmark's; the athlete's sex from a setup wizard.

### Workout, parts and items

**Built for imports** (`workout_parts`, `workout_blocks`, `workout_items`): a part holds ordered
**blocks**, because one part often has several formats ("Every 90 s x 6, then EMOM 5"; two AMRAP
7s with a rest between). A block has the `format` and its parameters; an item holds the
movement, an optional `alternative_of` item ("60 double-unders or 90 single-unders"), and its
prescription as JSON: one set per written line, each a list of quantities (reps, sets, calories,
meters, seconds, kg, % of 1RM; ranges and male/female splits kept). Performed loads are lift
sets pointing at the item (see Results under Session import); other performed values (reps of
a metcon, scaling) are not modeled yet. The target model below still applies to logging.

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

**Templates.** Benchmarks are built (below); box programming as templates is not.

Existing `workouts` rows migrate as a session with one part and no items; their free-form score
and `rx` flag stay as they are.

### Benchmarks (built)

Named workouts as reference data in `packages/contracts/src/benchmarks/`, like the level sheet:
versioned with the code, never edited in the database. 280 of them: CrossFit's 33 Girls (the
FAQ list, New Girls of 2021 included), the 244 Hero workouts of the official list (revision
20260504R1KW, May 2026), and Filthy Fifty, Fight Gone Bad and Nasty Girls.

- **Shape**: `Benchmark { id (slug), name, aliases, category, scoring, posted, blocks, ... }`.
  `posted` is the prescription as CrossFit wrote it (pounds, inches); `blocks` are the same
  shapes an import derives: format, params, intents, and items with quantities for one set.
  Loads are male/female kg, converted the way a kilo box loads them: barbells to the nearest
  kilo (95/65 lb is 43/29 kg), dumbbells to 2.5 kg, kettlebells, balls and plates to the
  implement that exists. Box heights, targets and "right arm" are an item `note`; bodyweight
  loads are a note too, since Chalk does not know the athlete's weight.
- **Authoring**: `dsl.ts` (`hero({...})`, `mv("thruster", reps(21), bb(95, 65))`, `rounds`,
  `ladder`, `amrap`, ...). `movementIds.ts` types every id a benchmark may use; a server test
  checks each exists after migrations. Migration `008_Benchmarks` adds what the Heroes need
  (burpee and HSPU variations, carries, sled, DB and KB lifts, swim, shuttle runs) with cores,
  sheet rows and whiteboard aliases, and makes push and split jerks variations of Jerk.
- **Scoring**: `time` (lower wins), `rounds_reps`, `reps` or `load`. `parseBenchmarkScore`
  reads "4:32", "18+7", "320", "102 kg"; the best attempt is the record, the earliest on a tie.
- **Link**: `workout_parts.benchmark_id`. Logging a benchmark writes its part, blocks and items
  (performance `{}`, as prescribed, when logged Rx; unknown when scaled), so levels grade it
  like an import. In the importer a `benchmark` span marks a line or heading that names one
  ("Fran", "**** Murph"): right under a part heading it names that part, after movements it
  opens a new part; a part with only the name gets the benchmark's blocks, and "Fran: 4:32" in
  the notes is its score. A workout with no parts whose name is a benchmark (logged before
  this) counts too. `benchmarks.results` lists every attempt.
- **Rx level**: the GymDanmark division of the Rx prescription (the lowest rung every graded
  movement reaches); Fran's 43 kg thrusters are Scaled.
- Web: `/benchmarks` (search by name or movement, Girls / Heroes / Classics / Done, your best)
  and `/benchmarks/$id` (board, as posted, Rx levels, attempts, log form).

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

## Session import (built)

Backfills history from the athlete's own log, one pasted session at a time (the Import
page). The pasted text plus a list of **spans** over it is the source of truth
(`ImportDocument`, stored in `session_imports.document`); everything else is derived and
re-derivable.

- Span kinds: `date`, `session` (number), `part`, `block` (format + params), `movement`
  (catalog id, optional `alternativeOf`), `quantity` (measure, amount, optional female amount and
  scheme, `attachedTo` a movement), `score` (attached to a block), `notes`, `intent` (the coach's
  instruction for the block it sits in), `comment` (an aside on the block, such as where the
  workout came from). Spans never overlap.
- Measures include `rpe` ("@RPE 8", "RPE 7-8", "@8 RPE"), written after its movement like loads.
- **Targets by level.** A count can carry `tiers`, hardest first, each a level with its male and
  female number: "18-15/15-12 cal row" is 18/15 at Elite and 15/12 at RX. The parser reads a
  count as tiers when both dash pairs fall ("8-10/6-8" stays a male and a female range); the
  inspector turns a range into levels ("Ends are levels") and back, and edits each level.
  `amount` and `female` still span the tiers (15-18, 12-15), so everything reading one number
  is unchanged.
- **Intent** marks whole lines ("Build to a heavy single", "70-80% of the above", "RPE 7-8"). It
  belongs to the block it sits in and is stored on `workout_blocks.intent` as JSON
  `[{ text, quantities }]`, with any RPE, % or load in its text read into `quantities`.
- **Comment** marks whole lines too, but nothing in it is read: it shows on its block as
  written and lives only in the document (not on `workout_blocks`). The inspector switches a
  line between intent and comment; the suggester always proposes intent.
- `suggestSpans` (contracts) proposes spans: org headings (`** Session 167 <2026-10-28 on>`,
  `**** Workout #1`, `*** Notes`), format lines, catalog movements and aliases, quantities.
  Quantities attach to the movement in the same `+` / `or` segment of their line; a line of only
  numbers ("5 reps @40%") attaches to the last movement of the part. Coach comments (`- *...`)
  and lines with a % or RPE but no movement become intent; asides in parentheses are skipped.
  Variation words before a known movement ("High-hang", "Pause") widen its mark, and unless
  the catalog knows the whole phrase it is left open: "High-hang power snatch" is never silently
  logged as a hang power snatch.
- `deriveSession` (contracts) turns a document into the session and its issues; both the editor
  preview and the server use it, so the server refuses what the editor would. Errors (no date,
  unresolved movement, a result without reps) block saving; warnings (an unattached number)
  only mean it is left out.
- Movements in the notes region with a load become **lift sets**, linked by
  `lift_sets.workout_id`, so they feed rep maxes. Failed attempts ("Failed 155 kg") are skipped.
- **Results (built).** A programmed movement can carry a `result` on its span, entered in the
  editor rather than read from the text: `fixed` (sets × reps at one load), `ramp` (first load
  plus a step per set: 6 × 2 from 50 by 2.5 ends at 62.5) or `each` (reps and load per set).
  The form is prefilled from the prescription (block rounds, the item's reps, one row per
  build-up line). `performedSets` expands a result; each set becomes a lift set with
  `workout_item_id` and `set_number`, so results feed rep maxes and the item knows what was
  lifted. A result outside 1 to 100 sets or reps, or a load not in (0, 1000] kg, blocks saving.
  A **complex** is the movements on one line ("1 Snatch pull + 1 snatch + 2 overhead squat",
  alternatives excluded): one bar, so the result editor offers "Same for" the others, which
  copies the sets and loads and keeps each movement's own prescribed reps.
- **Tonnage**: reps × load summed, per item, per block and per session (results plus notes lift
  sets; a movement in both is warned about, since it counts twice). `ImportSummary.tonnageKg`
  is the same sum over the workout's lift sets.
- **Debrief (built).** The athlete's side of the session, entered in the editor and stored on
  the document (`ImportDocument.debrief`, schema `Debrief`): the result in their words, minutes, how it felt (1 to 5), how hard they could push today (capacity,
  1 to 5), session RPE (Foster CR-10, 1 to 10), what limited them (engine, muscle endurance,
  strength, skill, grip, mobility, pacing, energy, head, pain, or nothing), where it hurt, what
  to do next time, and free notes. Every field is optional; "not answered" is the absent key.
  Effort under capacity was a choice; capacity under normal was the body. Session load is RPE ×
  minutes. Saving writes one `workout_debriefs` row (typed columns, limiters as JSON) for coach
  queries, and uses the result as `workouts.score` over the block scores. Rx and scaling are
  not part of the debrief; they come from performed items (above).
  `describeDebrief` renders the answers as the sentences a coach reads; the editor shows them.
- One import per session number, or per day without one; saving the same session again needs an
  explicit replace. Deleting the workout deletes its import, structure and lift sets.

## Planned sessions (built)

The box posts the day's workout in the morning; the athlete enters it then and plans the
scaling, and logs it after training. A **plan** (`session_plans`, `SessionPlan`) is an
`ImportDocument` that is not a workout yet: it counts nowhere (history, rep maxes, levels,
the year grid) until logged.

- Entered on `/plan` with the importer's workbench in plan mode: same marks and checks (a day,
  every movement resolved; the day is today unless the text has a date), no results or debrief.
- **Planned scaling** is `plan` on a movement span, the `Performance` shape: a load per
  implement, or reps by variation ("25 jumping, 20 kipping"). Graded live against the level
  sheet like a performance ("Planned at" in place of "Done at").
- Today shows the day's plan with each movement's scaling and a **Log it** button:
  `/import?plan=<id>` opens the plan in the importer, where each movement offers "As planned".
  Saving (`SaveImportInput.fromPlan`) writes the import and deletes the plan in one
  transaction; the stored document keeps `plan` next to `performance`, so planned versus done
  stays readable for a coach.
- Plans never logged stay on `/plan` under "Not logged" until deleted.

- Load: kilograms everywhere in storage and contracts.
- Dates: `performedOn` is the athlete's local calendar day (`IsoDate`); `createdAt` is an instant.
- Durations: seconds as integers.
