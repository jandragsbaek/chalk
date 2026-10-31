import { MovementId } from "../../baseSchemas.ts";
import type { MatchableMovement } from "../movementMatcher.ts";

/** Real pastes from the athlete's log (org-mode), as the importer receives them. */

export const SNATCH_EMOM = `*** Workout
**** Workout #1
- Every 90 sec x 8
- 1 Snatch pull + 1 snatch + 2 overhead squat
- *Byg til en moderat vægt. Teknik frem for vægt.
**** Workout #2
- EMOM 16
- 1) 18-15/15-12 cal row (max 50 sec)
- 2) 12 Burpee over rower
- 3) 3 squat snatch @75% of 1 RM
- 4) Rest
- *Inspiration fra Prepared programning`;

export const SESSION_167 = `** Session 167 <2026-10-28 on>


*** Workout
**** Workout #1
- Every 90 sec x 6
- 1 Power clean + 2 hang power clean
- *Byg til en udfordrende vægt over de 5 sæt.
- Derefter
- EMOM 5
- 1 Power clean + 2 Hang power clean
- *70-80% af ovenstående.
**** Workout #2
- Amrap 15
- 60 Double under or 90 Single unders
- 12 Thrusters @40/25
- 10 Burpee over barbell
- Rest 30 sec b/t rounds.`;

export const SESSION_166 = `** Session 166 <2026-10-26 ma>


*** Workout
**** Workout #1
- Every 3 min x 5
- 5 Front squats @70-80% of 1 RM
- Direkte ind i
- 20m Dual KB front rack carry (heavy)
**** Workout #2
- Amrap 7
- 12/10 Cal row
- 10 Burpee over rower
- 40 Double unders or 60 Single unders
- Rest 2 min
- Amrap 7
- 2 Rope climbs or 8 Pull ups
- 15 Wall balls
- 4 Wall walks`;

export const BENCH_MAX_OUT = `*** Workout
**** Workout #1
- Bench press
- Max out!
- Vi skal bygge op til en tung 1'er. Så tungt som mulighed.
- Brug følgende til at bygge op:
- 10 reps @20-30%
- 5 Reps @40%
- 3 reps @55%
- 2 reps @65%
- 1 rep @75%
- 1 rep @85%
- 1 rep@ 92-95@
- 2-3 forsøg på at slå tidligere max.
**** Workout #2
- Accessories
- Every 90 sec x 8-10
- 1) 10 Single arm DB row each side
- 2) 20-30 sec Support ring hold
- Core
- 40 sec på / 20 sec af x 9
- 1) Atomic sit ups
- 2) Russian twist
- 3) KB planke pass throughs`;

export const SESSION_160 = `** Session 160 <2026-10-13 ti>


*** Workout
**** Workout #1
- Back squat
- Max out!
- Vi skal bygge op til en tung 1'er. Så tungt som mulighed.
- Brug følgende til at bygge op:
- 10 reps @20-30%
- 5 Reps @40%
- 3 reps @55%
- 2 reps @65%
- 1 rep @75%
- 1 rep @85%
- 1 rep@ 92-95@
- 2-3 forsøg på at slå tidligere max.
- Accessories
- Every 90 sec x 8-10
- 1) 10 Dual DB romanian deadlift
- 2) 10 Dual DB reverse lunges
- Core
- 30 sec på/ 15 sec af x 8 (4 af hver)
- 1) Deadbug
- 2) Planke
*** Notes
- Strength class: max-out back squat day.
- Back squat 1RM: 150 kg. Failed 155 kg. Feels close to true max.
- Booking Board: attended OnTime (classId 1551350, Johannes B. P., 17:30, Power).`;

const movement = (id: string, name: string, aliases: ReadonlyArray<string> = []) => ({
  id: MovementId.make(id),
  name,
  aliases,
});

/** A slice of the seeded catalog plus its seeded aliases. */
export const CATALOG: ReadonlyArray<MatchableMovement> = [
  movement("back-squat", "Back squat"),
  movement("front-squat", "Front squat"),
  movement("overhead-squat", "Overhead squat", ["OHS"]),
  movement("deadlift", "Deadlift"),
  movement("bench-press", "Bench press"),
  movement("power-clean", "Power clean"),
  movement("hang-power-clean", "Hang power clean", ["HPC"]),
  movement("snatch", "Snatch", ["Squat snatch"]),
  movement("thruster", "Thruster"),
  movement("wall-ball", "Wall ball"),
  movement("pull-up", "Pull-up"),
  movement("rope-climb", "Rope climb"),
  movement("burpee", "Burpee"),
  movement("sit-up", "Sit-up"),
  movement("double-under", "Double-under", ["DU"]),
  movement("row", "Row"),
];
