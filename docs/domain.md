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

**Substitutions (built).** `movements.scalings` (JSON `[movementId]`, first offered first) lists
what a movement is done as instead: ring rows and jumping pull-ups for pull-ups, walk-outs for
wall walks. `scalingOptions` offers those, then the core movement's, then for a movement on a
variant level row the easier rungs of that row (closest first) and the row's `below`. The
importer shows them as one-click "Scale to" options under Plan / Done as; one sets every
prescribed rep to that movement in `variants`, so grading and power count the swap. The list is
edited per movement in the importer ("Scales to") and on the Movements page (`/movements`),
which lists the catalog with each movement's scalings, how often it was programmed and done
scaled (from the levels overview), what scales to it, its aliases, core and level row. Migration `021_Scalings` adds the Walk-out
movement and seeds the usual swaps for gymnastics, skipping rope, box jumps and running.

Modifications (and a ranked progression of substitutions) are still the target: catalog
entries (`ScalingOption { id, movementId, name, kind, rank }`); `rank` orders them from most to
least scaled, so "banded (green) → banded (purple) → kipping → Rx" is a progression Chalk can
chart. Load and volume scaling fall out of comparing
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
  skipped. Loads use the athlete's side of M/F (`AthleteProfile.sex`, see Athlete profile);
  every grading helper takes `sex` explicitly, so nothing grades on a silent default.
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
- **Shuttles and blocks of distance**: a shuttle run rep is one length of the box's shuttle,
  7.5 m unless the board writes it ("10 shuttle runs 10 m", "10 shuttle runs (7,5 m)"); reps
  written with a distance count reps × that distance in metres for power, and "4 x 10 m KB
  walking lunges" reads as 4 sets of 10 m. A distance alone in brackets is the one bracketed
  aside the importer reads.
- Not graded: wall walks (hand distance not recorded), D-ball and sandbag, endurance. Box
  height is not recorded, so box jumps stop at Scaled.

Later: standards from Competition Corner divisions (national and international) as more
sources next to GymDanmark's.

### Athlete profile (built)

Who is training, on `/settings`. `AthleteProfile` (contracts, `profile.ts`) is the whole thing in
one read (`profile.get`):

| Field         | Notes                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| `sex`         | `m` or `f`: which side of an M/F load applies. `DEFAULT_SEX` (`m`) until set.    |
| `heightCm`    | Standing height, 100 to 250, or null. One value, no history.                     |
| `armLengthCm` | Optional: acromion (shoulder tip) to the knuckles of a closed fist, arm hanging. |
| `legLengthCm` | Optional: inseam, floor to crotch, barefoot.                                     |
| `bodyweights` | Every weigh-in `{ performedOn, kg, source, measuredAt }`, oldest first; one/day. |

- **Storage**: migration `013_AthleteProfile`. `athlete_profile` is one row (`id = 1`), absent
  until the first save, so the store reads `EMPTY_ATHLETE_PROFILE` (male, nulls) before then.
  `bodyweights` is keyed by `performed_on`; logging a day again replaces its reading
  (`bodyweights.log`), `bodyweights.delete` removes a day. Centimetres and kilograms.
  `source` is `manual` (typed) or `garmin` (the scale, with its local `measuredAt` "HH:MM";
  migration `018_Garmin`). A Garmin read only writes days that are not `manual`, so a typed
  weigh-in always wins; typing over a scale day makes it `manual`.
- **Bodyweight on a day**: `bodyweightOn(profile, date)` is the latest weigh-in on or before
  `date`, else the earliest weigh-in (a session before the first weigh-in uses it), else null.
  Estimates that need the athlete's mass at a session (work and power) read it through this.
- **Sex in the app**: the web reads it with `useAthleteSex()` and passes it to every level,
  benchmark and tier helper (`gradeItem`, `gradeLoad`, `prescribedLoad`, `familyStops`,
  `reachOfTiers`, ...). Switching it regrades everything client-side; nothing stored changes.
- Limb lengths are optional because they can be estimated from height; whoever needs them
  estimates when they are null.
- Web: `/settings` (sex, height, limbs with how to measure; bodyweight trend, the day's log, every
  weigh-in with its change, source and delete). The chart draws the 7-day trailing mean as its
  line, scale readings as faint marks under it and typed weigh-ins as solid squares, with 90 days,
  1 year and All once the history is longer than 90 days. `/settings/connections` holds the
  bookingboard and Garmin logins.

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
  Plain text reads the same without stars or bullets: a line starting "Session 167" or a date,
  and "Notes" or "Workout" on its own, head like their org twins; in the workout, a label on
  top of a paragraph ("Workout #1", "Strength": first line or after a blank one, more lines
  under it, no movement, format, number or benchmark, no sentence) opens a part. Bullets are
  `-`, `+` or `•`.
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
  Set by set, a set of 0 reps is one missed at its load: kept in the result, lifting nothing.
- **Complexes (built).** Barbell movements written on one line of a block ("1 Power clean + 2
  hang power clean") are done on one bar, so the editor enters their plan, load and result once
  (web, `lib/complexes.ts`; read from the text, not stored). Reps are typed as written, "1 + 2",
  and a missed rep as what was made, "1 + 1". Each movement still gets its own `result`, `plan`
  and `performance` on its span, so rep maxes, tonnage and the coach stay per movement.
  `separateLoad` on the spans ("Separate loads") gives each movement its own load again.
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

## Similar sessions (built)

The box re-runs workouts ("retest from July") and programs ones close to earlier ones. Chalk
compares every saved **part** with every other session's parts (`findSimilarParts` in
contracts, `GET /workouts/similar`), from the stored blocks and items; nothing is stored.

- **Repeat**: same blocks (rest blocks ignored), same format and parameters, same movements
  with the same prescription, in any order; or the same benchmark.
- **Similar**: a score of at least 0.6. Each block pairs with its closest block; within it,
  format 15 %, parameters 15 % (half for the same format with other numbers), movements 45 %
  (a variation of the same core counts 0.6) and identical prescriptions 25 %. The part's
  score weighs blocks by their movements. What differs is listed: format, swapped variation,
  movement only on one side, other numbers.
- A part with one movement only reports repeats; its look-alikes are that lift's history.
- Each part shows its result (block scores, or the session's for a one-part session) or its
  heaviest lift set, so a repeat reads as then versus now.
- Web: the session sheet's "Similar sessions" (up to five per part, repeats first), and a
  repeat mark on register rows that repeat an earlier session. The wording (`partLabel`,
  `describeDifference`) lives in contracts, shared with the coach's `find_similar_sessions`.
- **Plans** compare too, to plan the scaling from last time: the client sends the plan's
  derived parts (`plannedPart`, what logging would store) to `POST /workouts/similar`; the
  server runs the same matcher over them and the saved parts (planned parts never meet each
  other). `/plan`'s workbench shows "Similar sessions" under the protocol (a row opens in a
  new tab); Today's plan lists up to three per part under "Done before".

## Work and power

An estimate of the mechanical work a session took and the power behind it, in the spirit of
CrossFit's "work = force × distance": the same workout done faster, or with more load, shows as
more watts. Absolute numbers are rough; a workout compared with itself over time is the point.
Pure functions in `packages/contracts/src/power/`, computed wherever the session is derived.

- **Body** (`bodyOf`): segment lengths from height after Drillis and Contini (as tabled in
  Winter, _Biomechanics and Motor Control of Human Movement_), segment masses from bodyweight
  after de Leva (1996), male or female. A measured arm (acromion to the knuckles of a fist) or
  inseam rescales that limb. Bodyweight is the weigh-in on or before the session's day.
- **Work per unit** (`WORK_MODELS`, by catalog id; a variation without one uses its core's):
  the moving segments and the load, raised by distances read off the body. A pull-up lifts all
  but the hands and forearms by the arm's length; a squat lifts all but shanks and feet by the
  thigh's; a thruster is a front squat plus a press; a clean adds the bar from the floor to the
  shoulders, and the squat when caught low; a wall ball raises the ball from the bottom of the
  squat to the 10 or 9 ft target. Boxes are 24/20 in (box height is not recorded). Concentric
  only, and sideways travel does none: carries and holds count as zero work, not left out.
- **Machines and running**: a calorie (rower, ski, bike) is 750 J, the mechanical work behind
  one Concept2 calorie at 150–300 W (the display adds 300 kcal/h of resting burn); a rower or
  ski metre 48.6 J (2:00/500 m, from watts = 2.8 / pace³), a BikeErg metre half that; running
  1 J per kg per metre (Cavagna's external work of running). A sled is friction (μ 0.3 × load).
  Swimming and the VersaClimber have no model.
- **Counting a block** (`estimateBlockWork`): reps per round from the item's lines (the
  athlete's side of an M/F split, the middle of a range, `perRound` when given), times rounds;
  a "21-15-9" block's scheme is its items' reps. An AMRAP counts full rounds plus the partial
  round from its score, in item order; without a score it is skipped. An EMOM or every-X with
  numbered lines ("1) … 4) Rest") rotates through them (`DerivedBlock.rotation`), so each line
  is done once per that many intervals. Lift results count set by set at their loads; reps
  split by variation count each variation's work. An "or" counts the option that was done.
  Load: the performance's, else the prescription's; a percentage of 1RM is not read yet.
- **Time and power**: a for-time block's score, an AMRAP's or EMOM's length, rounds × interval,
  or rounds × (work + rest). Power is work over that time; the session's is the work of its
  timed blocks over their time. Lift sets from the notes add work, not time.
- **Left out, said so**: a movement without a model, without reps or without a load is listed
  with its reason, never dropped silently.
- **Benchmarks** (`estimateBenchmarkWork`): the Rx prescription over the attempt's time, or a
  single AMRAP's rounds; a "two dumbbells" note lifts two. Shown for attempts logged Rx; an
  import is estimated on its session sheet from what was done. Scores in reps (Fight Gone Bad)
  are not split over movements.

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

## Bookingboard (built)

The box (Box 7100) runs bookings on bookingboard.io, and its classes carry the day's program.
Chalk reads it so the plan and the importer start from what the box posted, not a paste.
Read-only: GET requests only, never booking or check-in.

- **Connection**: on `/settings/connections`, the athlete pastes the site's `jwt` cookie (a 30-day JWT) and
  their participant id (the token does not carry it). `bookingboard.connect` checks the token
  has an `exp`, reads bookingboard once with it, then keeps it in `bookingboard_connection`
  (one row, migration `014_Bookingboard`). The browser only ever gets `BookingboardStatus`
  (participant id, expiry), never the token. A 401/403, or a stored token past its `exp`, is
  `BookingboardTokenExpiredError`: paste a new one.
- **A day** (`bookingboard.day`): `GET /participations?from=<day before>` returns every
  member's bookings from that day on (`to` is ignored; a day long ago downloads tens of MB).
  The server keeps only the athlete's, not opted out, whose start is on the day in
  Europe/Copenhagen (bookingboard mixes `+00:00` and local offsets), and discards the rest
  without storing or logging it. Each class's `GET /classes/{id}` gives `program.workouts`
  (HTML `text`, else `description`); classes without one (open gym) are left out, and only
  set `openGym` on the day.
- **Program text** (`program.ts`): the workouts as plain text, not org: each title on a line
  of its own, the coach's lines under it as typed, a blank line between workouts. `suggestSpans`
  reads the titles as parts and marks the rest like a pasted session; a leading `*` is a coach
  comment, read as intent.
- Web: "Pull from bookingboard" on `/plan` (today) and on `/import` (a picked day, yesterday by
  default). It fills the text box; several classes on a day ask which one. On `/import` the
  draft takes the picked day as its date, since board text has no date line.
- **Attendance copy** (`bookingboard.attendance`, migration `018_BookingboardLedger`): the
  athlete's own bookings (not opted out or cancelled, not wait-listed) kept in
  `bookingboard_bookings`, with what they cover in `bookingboard_ledger` (from the first class,
  read when, for which participant). Read from the web API's
  `GET https://box7100.bookingboard.io/api/account/{participantId}/classes?from&to&page&pageSize`
  (what the site's "My classes" page calls): only the athlete's classes, newest first, 100 a
  page, about 400 bytes each (it also carries their name and email, which are not read). The
  first read takes the whole history (Aug 2025 to Oct 2026: 178 bookings, two pages, 72 KB);
  later reads go from 3 days before the last (check-ins land after the class), only when the
  copy is 30 minutes old (`ifStale`, on page load) or 1 minute old (`now`, "Check now"); one read
  at a time, and a failed read is not retried for a minute. A failed read (expired token,
  bookingboard down) still answers from the copy with `checkFailed`. Attended is `OnTime` or
  `TooLate`. Disconnecting forgets the copy; a connection for another participant replaces it.
- **A day** reads the same endpoint for the box-local day (`from` noon UTC the day before, `to`
  the day's end in UTC), or the copy when it holds that day and the day was over when it was
  read; the gym-wide `/participations` is no longer read.
- **Connect** reads `GET /api/account` on the web API: the token's account id is the
  participant id, so a mistyped one is put right.
- **Class cache** (`bookingboard_classes`): a past class's program, title and coach, read once
  from the mobile API's `/classes/{id}`, so pulling a past day usually costs one request or none.
- **Import rail** (web `/import`, "Class days"): every class day oldest first, against the
  sessions logged (any workout that day counts, imported or `/log`), matched in the browser so a
  save shows at once. Head counts (to log, logged of all) and the oldest day to log with Pull; a
  month tally; tabs To log / All / Skipped; the register by month. Enter or a click pulls a day
  into the paste box (its date and coach go on the draft); S or Skip
  (`bookingboard.skipDay`, `bookingboard_skipped_days`) takes it off the list until put back. A
  day picked from the rail moves on when saved: the next day to log after it is pulled and the
  text focused. Ctrl+Enter in the text suggests marks. A day with only open gym puts the typed
  session on that day, solo.
- **Coached by** (`Coaching`: `coached { coach }` or `solo`; absent = not recorded): who ran a
  session, or that the athlete trained alone. The coach is the class's `instructors[].name`
  ("Rikke L."), joined if several; checked against the live API (Sep to Oct 2026), every class
  with a program names exactly one and the program text never does, so the text is not read
  for it. Open gym classes have no instructor and no program. A pulled class puts its coach on
  the draft (`ImportDocument.coaching`), a plan keeps it for the session logged from it, and the
  workbench header edits it ("Solo" typed or picked is alone; earlier sessions' coaches are
  offered). Its look-up reads the day (`dayCoaching`): one class with a program, its coach;
  none (only open gym, or nothing booked), solo; several, the athlete picks. Stored on
  `workouts.coach` / `workouts.solo` (migration `016_SessionCoaching`), written from the
  document on save; `/log` takes it too. Shown on the session sheet and register, searchable
  ("rikke", "solo"), and in the AI coach's `list_workouts`.
- **Session type** (`SessionType`: `wod`, `strength` or `solo`; absent = not recorded): a WOD
  class, a strength class, or trained alone. Solo is the coaching's, so only the class is its
  own field (`ClassType`, on `ImportDocument.classType` and `workouts.class_type`, migration
  `019_SessionClassType`) and a session is never a class and solo at once (`sessionTypeOf`).
  A pulled class gives it by name (`classTypeOf`: "WOD" the WOD class, "Power" a strength
  class), as does the coach look-up. The workbench header's Session picker replaces the derived
  workout kind there; picking Solo fills Coached by, a class over Solo empties it, and a coach
  named over Solo makes it the WOD class (`withSessionType`, `withCoaching`). `/log` takes it;
  shown on the session sheet and register ("WOD class with Rikke L."), searchable ("wod
  class"), and in the AI coach's `list_workouts`.

## Garmin Connect (built)

The athlete's Garmin Index scale puts a weigh-in in Garmin Connect each morning; Chalk reads them
into bodyweight so the trend and every work estimate use real numbers. Read-only.

- **No personal API**: Garmin's developer program only takes companies, and since March 2026 its
  SSO login sits behind Cloudflare TLS fingerprinting, so a Node `fetch` cannot log in. The data
  API (`connectapi.garmin.com`) and the token renewal (`diauth.garmin.com`) still answer `fetch`
  (checked 2026-11-01). Unofficial and against Garmin's terms; it can break when Garmin changes.
- **Login, once, on the athlete's machine**: `pnpm garmin:login` runs `scripts/garmin-login.py`
  with uv (python-garminconnect 0.3, curl_cffi for a browser's TLS handshake, the MFA prompt)
  and prints its token file `{ di_token, di_refresh_token, di_client_id }`. The password never
  reaches Chalk.
- **Connection**: on `/settings/connections`, the athlete pastes the file and picks the first
  day to read (defaulting to the first logged session: weigh-ins before CrossFit stay in
  Garmin). `garmin.connect` renews the tokens once (a refused renewal keeps nothing), keeps them
  in `garmin_connection` (one row, migration `018_Garmin`) and imports from that day. The
  browser only gets `GarminStatus` (import day, scale weigh-in count, last read and its error).
- **Renewal**: `POST diauth.../oauth/token` with `grant_type=refresh_token`, Basic auth on the
  client id, the Android app's headers. Each renewal may turn the refresh token over, so the new
  pair is saved at once and reads are serialised (one at a time). The access token is renewed
  five minutes before its `exp`, and once on a 401.
- **A read** (`garmin.sync`, every 6 hours while the server runs, a minute after start, and
  "Sync now"): `GET /weight-service/weight/range/{from}/{to}?includeAll=true` in 120-day
  windows, from three days before the last read (the import day the first time) to tomorrow.
  `weighIns.ts` keeps each calendar day's first reading (`date`, local clock as epoch ms),
  grams to kg, skips readings without a weight or outside 25 to 300 kg. A failed read keeps
  what was imported and stores its message (`last_error`): the strip turns its lamp red.
- A scale day the athlete deletes comes back only if a later read still covers it (the three
  overlap days, or connecting again).

## Rest days (built)

Rest is a choice, never inferred. A **rest day** (`rest_days`, `RestDay { day, kind, source }`)
is a day the athlete marked; a day with nothing logged and no mark reads "Nothing logged", not
rest.

- One mark per local day; `kind` is why: `rest`, `sick`, `injured` or `travel`. Marking a day
  again replaces it. `source` is who marked it: `athlete` or `coach`.
- Marked on Today: from a week row (past, today or planned ahead) or by clicking a day in the
  year grid, where the readout under the grid holds that day. Only a day with nothing logged
  offers the mark; a session logged on a marked day shows the session.
- The coach can suggest rest and, when the athlete asks or agrees, put it in the calendar
  (`mark_rest_day`, see [coaching.md](coaching.md)): today or later only, never over a logged
  session or a day the athlete marked.
- Rest days count nowhere: a week of only rest still breaks "Weeks in a row".
- RPCs: `restDays.list`, `restDays.mark`, `restDays.clear`.

- Load: kilograms everywhere in storage and contracts.
- Dates: `performedOn` is the athlete's local calendar day (`IsoDate`); `createdAt` is an instant.
- Durations: seconds as integers.
