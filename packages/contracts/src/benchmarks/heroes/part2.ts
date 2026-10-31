import type { Benchmark } from "../model.ts";
import {
  amrap,
  ball,
  bb,
  block,
  cal,
  db,
  forTime,
  hero,
  intervals,
  kb,
  km,
  ladder,
  meters,
  miles,
  mv,
  plate,
  reps,
  rest,
  rounds,
  yards,
} from "../dsl.ts";

/** Hero workouts, part 2 of the official list in posting order. */
export const HEROES_2: ReadonlyArray<Benchmark> = [
  hero({
    name: "Bradley",
    firstPosted: "2011-08-17",
    posted: `10 rounds for time of:
Sprint 100 meters
10 pull-ups
Sprint 100 meters
10 burpees
Rest 30 seconds`,
    blocks: [
      rounds(
        10,
        [
          mv("run", meters(100), { note: "sprint" }),
          mv("pull-up", reps(10)),
          mv("run", meters(100), { note: "sprint" }),
          mv("burpee", reps(10)),
        ],
        { restSeconds: 30, intents: ["Rest 30 seconds after each round."] },
      ),
    ],
  }),
  hero({
    name: "Meadows",
    firstPosted: "2010-09-05",
    posted: `For time:
20 muscle-ups
25 lowers from an inverted hang on the rings, slowly, with straight body and arms
30 ring handstand push-ups
35 ring rows
40 ring push-ups`,
    blocks: [
      forTime([
        mv("ring-muscle-up", reps(20)),
        mv("ring-lower", reps(25), { note: "slowly, straight body and arms" }),
        mv("ring-handstand-push-up", reps(30)),
        mv("ring-row", reps(35)),
        mv("ring-push-up", reps(40)),
      ]),
    ],
  }),
  hero({
    name: "Santiago",
    firstPosted: "2011-09-24",
    posted: `7 rounds for time of:
18 dumbbell hang squat cleans
18 pull-ups
10 power cleans
10 handstand push-ups
♀ 20-lb dumbbells, 95-lb barbell
♂ 35-lb dumbbells, 135-lb barbell`,
    blocks: [
      rounds(7, [
        mv("dumbbell-hang-squat-clean", reps(18), db(35, 20)),
        mv("pull-up", reps(18)),
        mv("power-clean", reps(10), bb(135, 95)),
        mv("handstand-push-up", reps(10)),
      ]),
    ],
  }),
  hero({
    name: "Carse",
    firstPosted: "2011-10-02",
    posted: `21-18-15-12-9-6-3 reps for time of:
Squat cleans
Double-unders
Deadlifts
Box jumps
Begin each round with a 50-meter bear crawl.
♀ 95-lb squat clean, 125-lb deadlift, 20-inch box
♂ 135-lb squat clean, 185-lb deadlift, 24-inch box`,
    blocks: [
      ladder(
        [21, 18, 15, 12, 9, 6, 3],
        [
          mv("bear-crawl", meters(50), { note: "start of each round" }),
          mv("clean", bb(135, 95)),
          mv("double-under"),
          mv("deadlift", bb(185, 125)),
          mv("box-jump", { note: "24/20-inch box" }),
        ],
        { intents: ["Begin each round with a 50-meter bear crawl."] },
      ),
    ],
  }),
  hero({
    name: "Bradshaw",
    firstPosted: "2011-10-23",
    posted: `10 rounds for time of:
3 handstand push-ups
6 deadlifts
12 pull-ups
24 double-unders
♀ 155 lb
♂ 225 lb`,
    blocks: [
      rounds(10, [
        mv("handstand-push-up", reps(3)),
        mv("deadlift", reps(6), bb(225, 155)),
        mv("pull-up", reps(12)),
        mv("double-under", reps(24)),
      ]),
    ],
  }),
  hero({
    name: "White",
    firstPosted: "2011-11-08",
    posted: `5 rounds for time of:
3 rope climbs to 15 feet
10 toes-to-bars
21 overhead walking lunges
400-meter run
♀ 25-lb plate
♂ 45-lb plate`,
    blocks: [
      rounds(5, [
        mv("rope-climb", reps(3), { note: "to 15 feet" }),
        mv("toes-to-bar", reps(10)),
        mv("overhead-walking-lunge", reps(21), plate(45, 25)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Santora",
    firstPosted: "2011-11-24",
    scoring: "reps",
    posted: `3 rounds for reps of:
1 minute of squat cleans
1 minute of 20-foot shuttle sprints (20 feet forward + 20 feet backward = 1 rep)
1 minute of deadlifts
1 minute of burpees
1 minute of jerks
Rest 1 minute between rounds.
On the shuttle sprints, 20 feet forward and 20 feet backward is 1 rep.
♀ 105-lb squat cleans, 165-lb deadlifts, 105-lb jerks
♂ 155-lb squat cleans, 245-lb deadlifts, 155-lb jerk`,
    blocks: [
      intervals(
        { workSeconds: 60, rounds: 3 },
        [
          mv("clean", bb(155, 105)),
          mv("shuttle-run", { note: "20 ft forward + 20 ft back = 1 rep" }),
          mv("deadlift", bb(245, 165)),
          mv("burpee"),
          mv("jerk", bb(155, 105)),
        ],
        {
          title: "3 rounds for reps, 1 min per station",
          restSeconds: 60,
          intents: [
            "Rest 1 minute between rounds.",
            "On the shuttle sprints, 20 feet forward and 20 feet backward is 1 rep.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Wood",
    firstPosted: "2011-12-07",
    posted: `5 rounds for time of:
400-meter run
10 burpee box jumps
10 sumo deadlift high pulls
10 thrusters
Rest 1 minute
♀ 20-inch box, 65-lb barbell
♂ 24-inch box, 95-lb barbell`,
    blocks: [
      rounds(
        5,
        [
          mv("run", meters(400)),
          mv("burpee-box-jump", reps(10), { note: "24/20-inch box" }),
          mv("sumo-deadlift-high-pull", reps(10), bb(95, 65)),
          mv("thruster", reps(10), bb(95, 65)),
        ],
        { restSeconds: 60, intents: ["Rest 1 minute after each round."] },
      ),
    ],
  }),
  hero({
    name: "Hidalgo",
    firstPosted: "2011-12-29",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
Run 2 miles
Rest 2 minutes
20 squat cleans
20 box jumps
20 overhead walking lunges
20 box jumps
20 squat cleans
Rest 2 minutes
Run 2 miles
♀ 95-lb barbell, 20-inch box, 25-lb plate
♂ 35-lb barbell, 24-inch box, 45-lb plate
If you’ve got a 20-lb vest or body armor, wear it.`,
    blocks: [
      forTime([mv("run", miles(2))], {
        intents: ["If you’ve got a 20-lb vest or body armor, wear it."],
      }),
      rest(120),
      forTime([
        mv("clean", reps(20), bb(135, 95)),
        mv("box-jump", reps(20), { note: "24/20-inch box" }),
        mv("overhead-walking-lunge", reps(20), plate(45, 25)),
        mv("box-jump", reps(20), { note: "24/20-inch box" }),
        mv("clean", reps(20), bb(135, 95)),
      ]),
      rest(120),
      forTime([mv("run", miles(2))]),
    ],
  }),
  hero({
    name: "Ricky",
    firstPosted: "2011-12-30",
    posted: `Complete as many rounds as possible in 20 minutes of:
10 pull-ups
5 dumbbell deadlifts
8 push presses
♀ 50-lb dumbbells, 95-lb barbell
♂ 75-lb dumbbells, 135-lb barbell`,
    blocks: [
      amrap(20, [
        mv("pull-up", reps(10)),
        mv("dumbbell-deadlift", reps(5), db(75, 50)),
        mv("push-press", reps(8), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "Dae Han",
    firstPosted: "2011-12-31",
    posted: `3 rounds for time of:
Run 800 meters with an empty barbell
3 rope climbs
12 thrusters
♀ 15-foot rope climb, 95-lb thrusters
♂ 15-foot rope climb, 135-lb thrusters`,
    blocks: [
      rounds(3, [
        mv("run", meters(800), { note: "carrying an empty barbell" }),
        mv("rope-climb", reps(3), { note: "to 15 feet" }),
        mv("thruster", reps(12), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "Desforges",
    firstPosted: "2012-01-28",
    posted: `5 rounds for time of:
12 deadlifts
20 pull-ups
12 clean and jerks
20 knees-to-elbows
♀ 155-lb deadlifts, 95-lb clean and jerks
♂ 225-lb deadlifts, 135-lb clean and jerks`,
    blocks: [
      rounds(5, [
        mv("deadlift", reps(12), bb(225, 155)),
        mv("pull-up", reps(20)),
        mv("clean-and-jerk", reps(12), bb(135, 95)),
        mv("knees-to-elbows", reps(20)),
      ]),
    ],
  }),
  hero({
    name: "Rahoi",
    firstPosted: "2012-02-04",
    posted: `Complete as many rounds as possible in 12 minutes of:
12 box jumps
6 thrusters
6 bar-facing burpees
♀ 20-inch box, 65-lb thrusters
♂ 24-inch box, 95-lb thrusters`,
    blocks: [
      amrap(12, [
        mv("box-jump", reps(12), { note: "24/20-inch box" }),
        mv("thruster", reps(6), bb(95, 65)),
        mv("bar-facing-burpee", reps(6)),
      ]),
    ],
  }),
  hero({
    name: "Zimmerman",
    firstPosted: "2012-02-25",
    posted: `Complete as many rounds and reps as possible in 25 minutes of:
11 chest-to-bar pull-ups
2 deadlifts
10 handstand push-ups
♀ 205 lb
♂ 315 lb`,
    blocks: [
      amrap(25, [
        mv("chest-to-bar-pull-up", reps(11)),
        mv("deadlift", reps(2), bb(315, 205)),
        mv("handstand-push-up", reps(10)),
      ]),
    ],
  }),
  hero({
    name: "Klepto",
    firstPosted: "2012-03-06",
    posted: `4 rounds for time of:
27 box jumps
20 burpees
11 squat cleans
♀ 20-inch box, 95-lb cleans
♂ 24-inch box, 145-lb cleans`,
    blocks: [
      rounds(4, [
        mv("box-jump", reps(27), { note: "24/20-inch box" }),
        mv("burpee", reps(20)),
        mv("clean", reps(11), bb(145, 95)),
      ]),
    ],
  }),
  hero({
    name: "Del",
    firstPosted: "2012-03-27",
    posted: `For time:
25 burpees
Run 400 meters with a medicine ball
25 weighted pull-ups with a dumbbell
Run 400 meters with a medicine ball
25 handstand push-ups
Run 400 meters with a medicine ball
25 chest-to-bar pull-ups
Run 400 meters with a medicine ball
25 burpees
♀ 14-lb medicine ball, 15-lb dumbbell
♂ 20-lb medicine ball, 20-lb dumbbell`,
    blocks: [
      forTime([
        mv("burpee", reps(25)),
        mv("run", meters(400), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("weighted-pull-up", reps(25), db(20, 15)),
        mv("run", meters(400), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("handstand-push-up", reps(25)),
        mv("run", meters(400), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("chest-to-bar-pull-up", reps(25)),
        mv("run", meters(400), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("burpee", reps(25)),
      ]),
    ],
  }),
  hero({
    name: "Pheezy",
    firstPosted: "2012-04-07",
    posted: `3 rounds for time of:
5 front squats
18 pull-ups
5 deadlifts
18 toes-to-bars
5 push jerks
18 hand-release push-ups
♀ 115-lb front squats, 155-lb deadlifts, 115-lb push jerks
♂ 165-lb front squats, 225-lb deadlifts, 165-lb push jerks`,
    blocks: [
      rounds(3, [
        mv("front-squat", reps(5), bb(165, 115)),
        mv("pull-up", reps(18)),
        mv("deadlift", reps(5), bb(225, 155)),
        mv("toes-to-bar", reps(18)),
        mv("push-jerk", reps(5), bb(165, 115)),
        mv("hand-release-push-up", reps(18)),
      ]),
    ],
  }),
  hero({
    name: "J.J.",
    firstPosted: "2012-04-25",
    posted: `For time:
1 squat clean
10 parallette handstand push-ups
2 squat cleans
9 parallette handstand push-ups
3 squat cleans
8 parallette handstand push-ups
4 squat cleans
7 parallette handstand push-ups
5 squat cleans
6 parallette handstand push-ups
6 squat cleans
5 parallette handstand push-ups
7 squat cleans
4 parallette handstand push-ups
8 squat cleans
3 parallette handstand push-ups
9 squat cleans
2 parallette handstand push-ups
10 squat cleans
1 parallette handstand push-up
♀ 125 lb
♂ 185 lb`,
    blocks: [
      forTime(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((count) => [
          mv("clean", reps(count), bb(185, 125)),
          mv("parallette-handstand-push-up", reps(11 - count)),
        ]),
      ),
    ],
  }),
  hero({
    name: "Jag 28",
    firstPosted: "2012-05-13",
    posted: `For time:
Run 800 meters
28 kettlebell swings
28 strict pull-ups
28 kettlebell clean and jerks
28 strict pull-ups
Run 800 meters
♀ 53 lb
♂ 70 lb`,
    blocks: [
      forTime([
        mv("run", meters(800)),
        mv("kettlebell-swing", reps(28), kb(70, 53)),
        mv("strict-pull-up", reps(28)),
        mv("kettlebell-clean-and-jerk", reps(28), kb(70, 53)),
        mv("strict-pull-up", reps(28)),
        mv("run", meters(800)),
      ]),
    ],
  }),
  hero({
    name: "Brian",
    firstPosted: "2012-05-15",
    posted: `3 rounds for time of:
5 rope climbs to 15 feet
25 back squats
♀ 125 lb
♂ 185 lb`,
    blocks: [
      rounds(3, [
        mv("rope-climb", reps(5), { note: "to 15 feet" }),
        mv("back-squat", reps(25), bb(185, 125)),
      ]),
    ],
  }),
  hero({
    name: "Nick",
    firstPosted: "2012-06-19",
    posted: `12 rounds for time of:
10 dumbbell hang squat cleans
6 handstand push-ups on dumbbells
♀ 30 lb
♂ 45 lb`,
    blocks: [
      rounds(12, [
        mv("dumbbell-hang-squat-clean", reps(10), db(45, 30)),
        mv("parallette-handstand-push-up", reps(6), { note: "on dumbbells" }),
      ]),
    ],
  }),
  hero({
    name: "Strange",
    firstPosted: "2012-06-24",
    posted: `8 rounds for time of:
600-meter run
11 weighted pull-ups
11 walking lunges with two kettlebells
11 kettlebell thrusters
♀ 35 lb
♂ 53 lb`,
    blocks: [
      rounds(8, [
        mv("run", meters(600)),
        mv("weighted-pull-up", reps(11), kb(53, 35)),
        mv("front-rack-lunge", reps(11), kb(53, 35), { note: "two kettlebells" }),
        mv("kettlebell-thruster", reps(11), kb(53, 35)),
      ]),
    ],
  }),
  hero({
    name: "Tumilson",
    firstPosted: "2012-07-04",
    posted: `8 rounds for time of:
Run 200 meters
11 dumbbell burpee deadlifts
♀ 45-lb dumbbells
♂ 60-lb dumbbells`,
    blocks: [
      rounds(8, [mv("run", meters(200)), mv("dumbbell-burpee-deadlift", reps(11), db(60, 45))]),
    ],
  }),
  hero({
    name: "Ship",
    firstPosted: "2012-07-24",
    posted: `9 rounds for time of:
7 squat cleans
8 burpee box jumps
♀ 125-lb cleans, 30-inch box
♂ 185-lb cleans, 36-inch box`,
    blocks: [
      rounds(9, [
        mv("clean", reps(7), bb(185, 125)),
        mv("burpee-box-jump", reps(8), { note: "36/30-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "Jared",
    firstPosted: "2012-08-09",
    posted: `4 rounds for time of:
Run 800 meters
40 pull-ups
70 push-ups`,
    blocks: [rounds(4, [mv("run", meters(800)), mv("pull-up", reps(40)), mv("push-up", reps(70))])],
  }),
  hero({
    name: "Tully",
    firstPosted: "2012-08-23",
    posted: `4 rounds for time of:
Swim 200 meters
23 dumbbell squat cleans
♀ 30-lb dumbbells
♂ 40-lb dumbbells`,
    blocks: [
      rounds(4, [mv("swim", meters(200)), mv("dumbbell-squat-clean", reps(23), db(40, 30))]),
    ],
  }),
  hero({
    name: "Holleyman",
    firstPosted: "2012-08-30",
    posted: `30 rounds for time of:
5 wall-ball shots
3 handstand push-ups
1 power clean
♀ 14-lb medicine ball to 9 feet, 155-lb cleans
♂ 20-lb medicine ball to 10 feet, 225-lb cleans`,
    blocks: [
      rounds(30, [
        mv("wall-ball", reps(5), ball(20, 14), { note: "to 10/9 ft" }),
        mv("handstand-push-up", reps(3)),
        mv("power-clean", reps(1), bb(225, 155)),
      ]),
    ],
  }),
  hero({
    name: "Adrian",
    firstPosted: "2012-09-23",
    posted: `7 rounds for time of:
3 forward rolls
5 wall climbs
7 toes-to-bars
9 box jumps
♀ 24-inch box
♂ 30-inch box`,
    blocks: [
      rounds(7, [
        mv("forward-roll", reps(3)),
        mv("wall-walk", reps(5)),
        mv("toes-to-bar", reps(7)),
        mv("box-jump", reps(9), { note: "30/24-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "Glen",
    firstPosted: "2012-10-12",
    posted: `For time:
30 clean and jerks
Run 1 mile
10 rope climbs to 15 feet
Run 1 mile
100 burpees
♀ 95-lb clean and jerks
♂ 135-lb clean and jerks`,
    blocks: [
      forTime([
        mv("clean-and-jerk", reps(30), bb(135, 95)),
        mv("run", miles(1)),
        mv("rope-climb", reps(10), { note: "to 15 feet" }),
        mv("run", miles(1)),
        mv("burpee", reps(100)),
      ]),
    ],
  }),
  hero({
    name: "Tom",
    firstPosted: "2012-10-14",
    posted: `Complete as many rounds as possible in 25 minutes of:
7 muscle-ups
11 thrusters
14 toes-to-bars
♀ 105 lb
♂ 155 lb`,
    blocks: [
      amrap(25, [
        mv("ring-muscle-up", reps(7)),
        mv("thruster", reps(11), bb(155, 105)),
        mv("toes-to-bar", reps(14)),
      ]),
    ],
  }),
  hero({
    name: "Ralph",
    firstPosted: "2012-11-09",
    posted: `4 rounds for time of:
8 deadlifts
16 burpees
3 rope climbs to 15 feet
Run 600 meters
♀ 175-lb deadlifts
♂ 250-lb deadlift`,
    blocks: [
      rounds(4, [
        mv("deadlift", reps(8), bb(250, 175)),
        mv("burpee", reps(16)),
        mv("rope-climb", reps(3), { note: "to 15 feet" }),
        mv("run", meters(600)),
      ]),
    ],
  }),
  hero({
    name: "Clovis",
    firstPosted: "2012-11-11",
    posted: `For time:
Run 10 miles
150 burpee pull-ups
Partition the run and burpee pull-ups as needed.`,
    blocks: [
      forTime([mv("run", miles(10)), mv("burpee-pull-up", reps(150))], {
        intents: ["Partition the run and burpee pull-ups as needed."],
      }),
    ],
  }),
  hero({
    name: "Weston",
    firstPosted: "2012-11-21",
    posted: `5 rounds for time of:
Row 1,000 meters
200-meter farmers carry
50-meter dumbbell waiters walk, right arm
50-meter dumbbell waiters walk, left arm
♀ 30-lb dumbbells
♂ 45-lb dumbbells`,
    blocks: [
      rounds(5, [
        mv("row", meters(1000)),
        mv("farmers-carry", meters(200), db(45, 30)),
        mv("waiter-walk", meters(50), db(45, 30), { note: "right arm" }),
        mv("waiter-walk", meters(50), db(45, 30), { note: "left arm" }),
      ]),
    ],
  }),
  hero({
    name: "Loredo",
    firstPosted: "2012-12-31",
    posted: `6 rounds for time of:
24 squats
24 push-ups
24 walking lunge steps
Run 400 meters`,
    blocks: [
      rounds(6, [
        mv("air-squat", reps(24)),
        mv("push-up", reps(24)),
        mv("walking-lunge", reps(24)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Sean",
    firstPosted: "2013-01-22",
    posted: `10 rounds for time of:
11 chest-to-bar pull-ups
22 front squats
♀ 55 lb
♂ 75 lb`,
    blocks: [
      rounds(10, [mv("chest-to-bar-pull-up", reps(11)), mv("front-squat", reps(22), bb(75, 55))]),
    ],
  }),
  hero({
    name: "Hortman",
    firstPosted: "2013-02-13",
    posted: `Complete as many rounds as possible in 45 minutes of:
Run 800 meters
80 squats
8 muscle-ups`,
    blocks: [
      amrap(45, [mv("run", meters(800)), mv("air-squat", reps(80)), mv("ring-muscle-up", reps(8))]),
    ],
  }),
  hero({
    name: "Hamilton",
    firstPosted: "2013-02-22",
    posted: `3 rounds for time of:
Row 1,000 meters
50 push-ups
Run 1,000 meters
50 pull-ups`,
    blocks: [
      rounds(3, [
        mv("row", meters(1000)),
        mv("push-up", reps(50)),
        mv("run", meters(1000)),
        mv("pull-up", reps(50)),
      ]),
    ],
  }),
  hero({
    name: "Zeus",
    firstPosted: "2013-02-26",
    posted: `3 rounds for time of:
30 wall-ball shots
30 sumo deadlift high pulls
30 box jumps
30 push presses
30-calorie row
30 push-ups
10 back squats
♀ 14-lb medicine ball to a 9-foot target, 55-lb barbell, 20-inch box, bodyweight back squat
♂ 20-lb medicine ball to a 10-foot target, 75-lb barbell, 24-inch box, bodyweight back squat`,
    blocks: [
      rounds(3, [
        mv("wall-ball", reps(30), ball(20, 14), { note: "to 10/9 ft" }),
        mv("sumo-deadlift-high-pull", reps(30), bb(75, 55)),
        mv("box-jump", reps(30), { note: "24/20-inch box" }),
        mv("push-press", reps(30), bb(75, 55)),
        mv("row", cal(30)),
        mv("push-up", reps(30)),
        mv("back-squat", reps(10), { note: "bodyweight" }),
      ]),
    ],
  }),
  hero({
    name: "Barraza",
    firstPosted: "2013-03-17",
    posted: `Complete as many rounds and reps as possible in 18 minutes of:
Run 200 meters
9 deadlifts
6 burpee bar muscle-ups
♀ 185 lb
♂ 275 lb`,
    blocks: [
      amrap(18, [
        mv("run", meters(200)),
        mv("deadlift", reps(9), bb(275, 185)),
        mv("burpee-bar-muscle-up", reps(6)),
      ]),
    ],
  }),
  hero({
    name: "Cameron",
    firstPosted: "2013-03-26",
    posted: `For time:
50 walking lunge steps
25 chest-to-bar pull-ups
50 box jumps
25 triple-unders
50 back extensions
25 ring dips
50 knees-to-elbows
25 wall-ball shot “two-for-ones”
50 sit-ups
5 rope climbs to 15 feet
♀ 20-inch box, 14-lb medicine ball to a 9-foot target
♂ 24-inch box, 20-lb medicine ball to a 10-foot target`,
    blocks: [
      forTime([
        mv("walking-lunge", reps(50)),
        mv("chest-to-bar-pull-up", reps(25)),
        mv("box-jump", reps(50), { note: "24/20-inch box" }),
        mv("triple-under", reps(25)),
        mv("back-extension", reps(50)),
        mv("ring-dip", reps(25)),
        mv("knees-to-elbows", reps(50)),
        mv("wall-ball", reps(25), ball(20, 14), { note: "two-for-ones, to 10/9 ft" }),
        mv("sit-up", reps(50)),
        mv("rope-climb", reps(5), { note: "to 15 feet" }),
      ]),
    ],
  }),
  hero({
    name: "Jorge",
    firstPosted: "2013-04-07",
    posted: `For time:
30 GHD sit-ups
15 squat cleans
24 GHD sit-ups
12 squat cleans
18 GHD sit-ups
9 squat cleans
12 GHD sit-ups
6 squat cleans
6 GHD sit-ups
3 squat cleans
♀ 105 lb
♂ 155 lb`,
    blocks: [
      forTime([
        mv("ghd-sit-up", reps(30)),
        mv("clean", reps(15), bb(155, 105)),
        mv("ghd-sit-up", reps(24)),
        mv("clean", reps(12), bb(155, 105)),
        mv("ghd-sit-up", reps(18)),
        mv("clean", reps(9), bb(155, 105)),
        mv("ghd-sit-up", reps(12)),
        mv("clean", reps(6), bb(155, 105)),
        mv("ghd-sit-up", reps(6)),
        mv("clean", reps(3), bb(155, 105)),
      ]),
    ],
  }),
  hero({
    name: "Schmalls",
    firstPosted: "2013-04-23",
    posted: `For time:
Run 800 meters
Then,
2 rounds of:
50 burpees
40 pull-ups
30 single-leg squats
20 kettlebell swings
10 handstand push-ups
Then,
Run 800 meters
♀ 35-lb kettlebell
♂ 53-lb kettlebell`,
    blocks: [
      forTime([mv("run", meters(800))]),
      rounds(2, [
        mv("burpee", reps(50)),
        mv("pull-up", reps(40)),
        mv("pistol", reps(30)),
        mv("kettlebell-swing", reps(20), kb(53, 35)),
        mv("handstand-push-up", reps(10)),
      ]),
      forTime([mv("run", meters(800))]),
    ],
  }),
  hero({
    name: "Brehm",
    firstPosted: "2013-05-14",
    posted: `For time:
10 rope climbs to 15 feet
20 back squats
30 handstand push-ups
40-calorie row
♀ 155 lb
♂ 225 lb`,
    blocks: [
      forTime([
        mv("rope-climb", reps(10), { note: "to 15 feet" }),
        mv("back-squat", reps(20), bb(225, 155)),
        mv("handstand-push-up", reps(30)),
        mv("row", cal(40)),
      ]),
    ],
  }),
  hero({
    name: "Omar",
    firstPosted: "2013-05-21",
    posted: `For time:
10 thrusters
15 bar-facing burpees
20 thrusters
25 bar-facing burpees
30 thrusters
35 bar-facing burpees
♀ 65 lb
♂ 95 lb`,
    blocks: [
      forTime([
        mv("thruster", reps(10), bb(95, 65)),
        mv("bar-facing-burpee", reps(15)),
        mv("thruster", reps(20), bb(95, 65)),
        mv("bar-facing-burpee", reps(25)),
        mv("thruster", reps(30), bb(95, 65)),
        mv("bar-facing-burpee", reps(35)),
      ]),
    ],
  }),
  hero({
    name: "Gallant",
    firstPosted: "2013-06-13",
    posted: `For time:
1-mile run with a medicine ball
60 burpee pull-ups
800-meter run with a medicine ball
30 burpee pull-ups
400-meter run with a medicine ball
15 burpee pull-ups
♀ 14-lb medicine ball
♂ 20-lb medicine ball`,
    blocks: [
      forTime([
        mv("run", miles(1), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("burpee-pull-up", reps(60)),
        mv("run", meters(800), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("burpee-pull-up", reps(30)),
        mv("run", meters(400), ball(20, 14), { note: "carrying a medicine ball" }),
        mv("burpee-pull-up", reps(15)),
      ]),
    ],
  }),
  hero({
    name: "Bruck",
    firstPosted: "2013-06-26",
    posted: `4 rounds for time of:
400-meter run
24 back squats
24 jerks
♀ 125-lb back squat, 95-lb jerk
♂ 185-lb back squat, 135-lb jerk`,
    blocks: [
      rounds(4, [
        mv("run", meters(400)),
        mv("back-squat", reps(24), bb(185, 125)),
        mv("jerk", reps(24), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "Smykowski",
    firstPosted: "2013-07-04",
    posted: `For time:
Run 6K
60 burpee pull-ups`,
    blocks: [forTime([mv("run", km(6)), mv("burpee-pull-up", reps(60))])],
  }),
  hero({
    name: "Falkel",
    firstPosted: "2013-08-20",
    posted: `Complete as many rounds and reps as possible in 25 minutes of:
8 handstand push-ups
8 box jumps
1 rope climb to 15 feet
♀ 24-inch box
♂ 30-inch box`,
    blocks: [
      amrap(25, [
        mv("handstand-push-up", reps(8)),
        mv("box-jump", reps(8), { note: "30/24-inch box" }),
        mv("rope-climb", reps(1), { note: "to 15 feet" }),
      ]),
    ],
  }),
  hero({
    name: "Donny",
    firstPosted: "2013-08-21",
    posted: `21-15-9-9-15-21 reps for time of:
Deadlifts
Burpees
♀ 155 lb
♂ 225 lb`,
    blocks: [ladder([21, 15, 9, 9, 15, 21], [mv("deadlift", bb(225, 155)), mv("burpee")])],
  }),
  hero({
    name: "Dobogai",
    firstPosted: "2013-08-22",
    posted: `7 rounds for time of:
8 muscle-ups
22-yard farmers carry
♀ 35-lb dumbbells
♂ 50-lb dumbbells`,
    blocks: [
      rounds(7, [mv("ring-muscle-up", reps(8)), mv("farmers-carry", yards(22), db(50, 35))]),
    ],
  }),
  hero({
    name: "Hotshots 19",
    firstPosted: "2013-08-31",
    posted: `6 rounds for time of:
30 squats
19 power cleans
7 strict pull-ups
400-meter run
♀ 95-lb barbell
♂ 135-lb barbell`,
    blocks: [
      rounds(6, [
        mv("air-squat", reps(30)),
        mv("power-clean", reps(19), bb(135, 95)),
        mv("strict-pull-up", reps(7)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Roney",
    firstPosted: "2013-09-03",
    posted: `4 rounds for time of:
200-meter run
11 thrusters
200-meter run
11 push presses
200-meter run
11 bench presses
♀ 95-lb barbell
♂ 135-lb barbell`,
    blocks: [
      rounds(4, [
        mv("run", meters(200)),
        mv("thruster", reps(11), bb(135, 95)),
        mv("run", meters(200)),
        mv("push-press", reps(11), bb(135, 95)),
        mv("run", meters(200)),
        mv("bench-press", reps(11), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "The Don",
    aliases: ["Don"],
    firstPosted: "2013-09-11",
    posted: `For time:
66 deadlifts
66 box jump
66 kettlebell swings
66 knees-to-elbows
66 sit-ups
66 pull-ups
66 thrusters
66 wall-ball shots
66 burpees
66 double-unders
♀ 70-lb deadlift, 20-inch box, 35-lb kettlebell, 35-lb thruster, 14-lb medicine ball to a 9-foot target
♂ 110-lb deadlift, 24-inch box, 53-lb kettlebell, 55-lb thruster, 20-lb medicine ball to a 10-foot target`,
    blocks: [
      forTime([
        mv("deadlift", reps(66), bb(110, 70)),
        mv("box-jump", reps(66), { note: "24/20-inch box" }),
        mv("kettlebell-swing", reps(66), kb(53, 35)),
        mv("knees-to-elbows", reps(66)),
        mv("sit-up", reps(66)),
        mv("pull-up", reps(66)),
        mv("thruster", reps(66), bb(55, 35)),
        mv("wall-ball", reps(66), ball(20, 14), { note: "to 10/9 ft" }),
        mv("burpee", reps(66)),
        mv("double-under", reps(66)),
      ]),
    ],
  }),
  hero({
    name: "Dragon",
    firstPosted: "2013-10-05",
    posted: `For time:
Run 5K
4 minutes to find 4-rep-max deadlift
Run 5K
4 minutes to find 4-rep-max push jerk`,
    blocks: [
      forTime([mv("run", km(5))]),
      block("strength", { durationSeconds: 240 }, "4 minutes to find 4-rep-max deadlift", [
        mv("deadlift", reps(4)),
      ]),
      forTime([mv("run", km(5))]),
      block("strength", { durationSeconds: 240 }, "4 minutes to find 4-rep-max push jerk", [
        mv("push-jerk", reps(4)),
      ]),
    ],
  }),
  hero({
    name: "Walsh",
    firstPosted: "2013-10-20",
    posted: `4 rounds for time of:
22 burpee pull-ups
22 back squats
200-meter run with a plate overhead
♀ 125-lb barbell, 25-lb plate
♂ 185-lb barbell, 45-lb plate`,
    blocks: [
      rounds(4, [
        mv("burpee-pull-up", reps(22)),
        mv("back-squat", reps(22), bb(185, 125)),
        mv("run", meters(200), plate(45, 25), { note: "plate overhead" }),
      ]),
    ],
  }),
  hero({
    name: "Lee",
    firstPosted: "2013-11-16",
    posted: `5 rounds for time of:
400-meter run
1 deadlift
3 squat cleans
5 push jerks
3 muscle-ups
1 rope climb to 15 feet
♀ 225-lb deadlift, 125-lb squat clean, 125-lb push jerk
♂ 345-lb deadlift, 185-lb squat clean, 185-lb push jerk`,
    blocks: [
      rounds(5, [
        mv("run", meters(400)),
        mv("deadlift", reps(1), bb(345, 225)),
        mv("clean", reps(3), bb(185, 125)),
        mv("push-jerk", reps(5), bb(185, 125)),
        mv("ring-muscle-up", reps(3)),
        mv("rope-climb", reps(1), { note: "to 15 feet" }),
      ]),
    ],
  }),
  hero({
    name: "Willy",
    firstPosted: "2013-11-22",
    posted: `3 rounds for time of:
800-meter run
5 front squats
200-meter run
11 chest-to-bar pull-ups
400-meter run
12 kettlebell swings
♀ 155-lb barbell, 53-lb kettlebell
♂ 225-lb barbell, 70-lb kettlebell`,
    blocks: [
      rounds(3, [
        mv("run", meters(800)),
        mv("front-squat", reps(5), bb(225, 155)),
        mv("run", meters(200)),
        mv("chest-to-bar-pull-up", reps(11)),
        mv("run", meters(400)),
        mv("kettlebell-swing", reps(12), kb(70, 53)),
      ]),
    ],
  }),
  hero({
    name: "Coffey",
    firstPosted: "2013-12-11",
    posted: `For time:
800-meter run
50 back squats
50 bench presses
800-meter run
35 back squats
35 bench presses
800-meter run
20 back squats
20 bench presses
800-meter run
1 muscle-up
♀ 95 lb
♂ 135 lb`,
    blocks: [
      forTime([
        mv("run", meters(800)),
        mv("back-squat", reps(50), bb(135, 95)),
        mv("bench-press", reps(50), bb(135, 95)),
        mv("run", meters(800)),
        mv("back-squat", reps(35), bb(135, 95)),
        mv("bench-press", reps(35), bb(135, 95)),
        mv("run", meters(800)),
        mv("back-squat", reps(20), bb(135, 95)),
        mv("bench-press", reps(20), bb(135, 95)),
        mv("run", meters(800)),
        mv("ring-muscle-up", reps(1)),
      ]),
    ],
  }),
  hero({
    name: "DG",
    firstPosted: "2013-12-26",
    posted: `Complete as many rounds and reps as possible in 10 minutes of:
8 toes-to-bars
8 dumbbell thrusters
12 dumbbell walking lunges
♀ 20-lb dumbbells
♂ 35-lb dumbbells`,
    blocks: [
      amrap(10, [
        mv("toes-to-bar", reps(8)),
        mv("dumbbell-thruster", reps(8), db(35, 20)),
        mv("dumbbell-walking-lunge", reps(12), db(35, 20)),
      ]),
    ],
  }),
  hero({
    name: "TK",
    firstPosted: "2013-12-28",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
8 strict pull-ups
8 box jumps
12 kettlebell swings
♀ 30-inch box, 53-lb kettlebell
♂ 36-inch box, 70-lb kettlebell`,
    blocks: [
      amrap(20, [
        mv("strict-pull-up", reps(8)),
        mv("box-jump", reps(8), { note: "36/30-inch box" }),
        mv("kettlebell-swing", reps(12), kb(70, 53)),
      ]),
    ],
  }),
  hero({
    name: "Taylor",
    firstPosted: "2014-04-06",
    vest: { lb: [20, 14], optional: true },
    posted: `4 rounds for time of:
400-meter run
5 burpee muscle-ups
If you’ve got a weighted vest or body armor, wear it.
♀ 14-lb vest
♂ 20-lb vest`,
    blocks: [
      rounds(4, [mv("run", meters(400)), mv("burpee-muscle-up", reps(5))], {
        intents: ["If you’ve got a weighted vest or body armor, wear it."],
      }),
    ],
  }),
];
