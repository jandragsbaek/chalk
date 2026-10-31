import {
  amrap,
  ball,
  bb,
  block,
  cal,
  db,
  forTime,
  hero,
  kb,
  ladder,
  meters,
  miles,
  minutes,
  mv,
  plate,
  reps,
  rest,
  rounds,
  yards,
} from "../dsl.ts";
import type { Benchmark } from "../model.ts";

/** Hero workouts, part 3 of the official list in posting order. */
export const HEROES_3: ReadonlyArray<Benchmark> = [
  hero({
    name: "Justin",
    firstPosted: "2014-04-10",
    posted: `30-20-10 reps for time of:
Bodyweight back squats
Bodyweight bench presses
Strict pull-ups`,
    blocks: [
      ladder(
        [30, 20, 10],
        [
          mv("back-squat", { note: "bodyweight" }),
          mv("bench-press", { note: "bodyweight" }),
          mv("strict-pull-up"),
        ],
      ),
    ],
  }),
  hero({
    name: "Nukes",
    firstPosted: "2014-04-15",
    scoring: "reps",
    posted: `8 minutes to complete:
1-mile run
Max reps deadlifts
Then, 10 minutes to complete:
1-mile run
Max reps power cleans
Then, 12 minutes to complete:
1-mile run
Max reps overhead squats
Do not rest between rounds.
♀ 205-lb deadlift, 155-lb power clean, 95-lb overhead squat
♂ 315-lb deadlift, 225-lb power clean, 135-lb overhead squat`,
    blocks: [
      block(
        "other",
        { durationSeconds: 480 },
        "8 minutes to complete",
        [mv("run", miles(1)), mv("deadlift", bb(315, 205), { note: "max reps" })],
        { intents: ["Do not rest between rounds."] },
      ),
      block("other", { durationSeconds: 600 }, "10 minutes to complete", [
        mv("run", miles(1)),
        mv("power-clean", bb(225, 155), { note: "max reps" }),
      ]),
      block("other", { durationSeconds: 720 }, "12 minutes to complete", [
        mv("run", miles(1)),
        mv("overhead-squat", bb(135, 95), { note: "max reps" }),
      ]),
    ],
  }),
  hero({
    name: "Zembiec",
    firstPosted: "2014-05-09",
    posted: `5 rounds for time of:
11 back squats
7 strict burpee pull-ups
400-meter run
♀ 125-lb barbell
♂ 185-lb barbell`,
    blocks: [
      rounds(5, [
        mv("back-squat", reps(11), bb(185, 125)),
        mv("burpee-pull-up", reps(7), { note: "strict" }),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Alexander",
    firstPosted: "2014-05-25",
    posted: `5 rounds for time of:
31 back squats
12 power cleans
♀ 95-lb back squat, 125-lb power clean
♂ 135-lb back squat, 185-lb power clean`,
    blocks: [
      rounds(5, [
        mv("back-squat", reps(31), bb(135, 95)),
        mv("power-clean", reps(12), bb(185, 125)),
      ]),
    ],
  }),
  hero({
    name: "Wyk",
    firstPosted: "2014-06-28",
    posted: `5 rounds for time of:
5 front squats
5 rope climbs to 15 feet
400-meter run with a plate
♀ 155-lb barbell, 25-lb plate
♂ 225-lb barbell, 45-lb plate`,
    blocks: [
      rounds(5, [
        mv("front-squat", reps(5), bb(225, 155)),
        mv("rope-climb", reps(5), { note: "to 15 feet" }),
        mv("run", meters(400), plate(45, 25), { note: "carrying a plate" }),
      ]),
    ],
  }),
  hero({
    name: "Bell",
    firstPosted: "2014-07-04",
    posted: `3 rounds for time of:
21 deadlifts
15 pull-ups
9 front squats
♀ 125-lb barbell
♂ 185-lb barbell`,
    blocks: [
      rounds(3, [
        mv("deadlift", reps(21), bb(185, 125)),
        mv("pull-up", reps(15)),
        mv("front-squat", reps(9), bb(185, 125)),
      ]),
    ],
  }),
  hero({
    name: "JBo",
    firstPosted: "2014-08-16",
    posted: `Complete as many rounds and reps as possible in 28 minutes of:
9 overhead squats
1 legless rope climb to 15 feet, beginning from seated
12 bench presses
♀ 75-lb barbell
♂ 115-lb barbell`,
    blocks: [
      amrap(28, [
        mv("overhead-squat", reps(9), bb(115, 75)),
        mv("legless-rope-climb", reps(1), { note: "to 15 feet, beginning from seated" }),
        mv("bench-press", reps(12), bb(115, 75)),
      ]),
    ],
  }),
  hero({
    name: "Kevin",
    firstPosted: "2014-08-24",
    posted: `3 rounds for time of:
32 deadlifts
32 hanging hip touches, alternating arms
800-meter running farmers carry
♀ 125-lb barbell, 10-lb dumbbells
♂ 185-lb barbell, 15-lb dumbbells`,
    blocks: [
      rounds(3, [
        mv("deadlift", reps(32), bb(185, 125)),
        mv("hanging-hip-touch", reps(32), { note: "alternating arms" }),
        mv("farmers-carry", meters(800), db(15, 10), { note: "running" }),
      ]),
    ],
  }),
  hero({
    name: "Rocket",
    firstPosted: "2014-09-06",
    posted: `Complete as many rounds as possible in 30 minutes of:
50-yard swim
10 push-ups
15 squats`,
    blocks: [
      amrap(30, [mv("swim", yards(50)), mv("push-up", reps(10)), mv("air-squat", reps(15))]),
    ],
  }),
  hero({
    name: "Riley",
    firstPosted: "2014-09-28",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
Run 1.5 miles
150 burpees
Run 1.5 miles
If you’ve got a weight vest or body armor, wear it.`,
    blocks: [
      forTime([mv("run", miles(1.5)), mv("burpee", reps(150)), mv("run", miles(1.5))], {
        intents: ["If you’ve got a weight vest or body armor, wear it."],
      }),
    ],
  }),
  hero({
    name: "Feeks",
    firstPosted: "2014-10-03",
    posted: `For time:
2 100-meter shuttle sprints
2 dumbbell squat clean thrusters
4 100-meter shuttle sprints
4 dumbbell squat clean thrusters
6 100-meter shuttle sprints
6 dumbbell squat clean thrusters
8 100-meter shuttle sprints
8 dumbbell squat clean thrusters
10 100-meter shuttle sprints
10 dumbbell squat clean thrusters
12 100-meter shuttle sprints
12 dumbbell squat clean thrusters
14 100-meter shuttle sprints
14 dumbbell squat clean thrusters
16 100-meter shuttle sprints
16 dumbbell squat clean thrusters
♀ 45-lb dumbbells
♂ 65-lb dumbbells`,
    blocks: [
      forTime(
        [2, 4, 6, 8, 10, 12, 14, 16].flatMap((count) => [
          mv("shuttle-run", reps(count), { note: "100-meter sprints" }),
          mv("dumbbell-squat-clean-thruster", reps(count), db(65, 45)),
        ]),
      ),
    ],
  }),
  hero({
    name: "Ned",
    firstPosted: "2014-10-30",
    posted: `7 rounds for time of:
11 bodyweight back squats
1,000-meter row`,
    blocks: [
      rounds(7, [mv("back-squat", reps(11), { note: "bodyweight" }), mv("row", meters(1000))]),
    ],
  }),
  hero({
    name: "Sham",
    firstPosted: "2014-10-31",
    posted: `7 rounds for time of:
11 bodyweight deadlifts
100-meter sprint`,
    blocks: [
      rounds(7, [
        mv("deadlift", reps(11), { note: "bodyweight" }),
        mv("run", meters(100), { note: "sprint" }),
      ]),
    ],
  }),
  hero({
    name: "Ozzy",
    firstPosted: "2014-11-01",
    posted: `7 rounds for time of:
11 deficit handstand push-ups
1,000-meter run`,
    blocks: [rounds(7, [mv("deficit-handstand-push-up", reps(11)), mv("run", meters(1000))])],
  }),
  hero({
    name: "Jenny",
    firstPosted: "2014-11-28",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
20 overhead squats
20 back squats
400-meter run
♀ 35-lb barbell
♂ 45-lb barbell`,
    blocks: [
      amrap(20, [
        mv("overhead-squat", reps(20), bb(45, 35)),
        mv("back-squat", reps(20), bb(45, 35)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Spehar",
    firstPosted: "2014-12-13",
    posted: `For time:
100 thrusters
100 chest-to-bar pull-ups
Run 6 miles
Partition the thrusters, pull-ups, and run as needed.
♀ 95 lb
♂ 135 lb`,
    blocks: [
      forTime(
        [
          mv("thruster", reps(100), bb(135, 95)),
          mv("chest-to-bar-pull-up", reps(100)),
          mv("run", miles(6)),
        ],
        { intents: ["Partition the thrusters, pull-ups, and run as needed."] },
      ),
    ],
  }),
  hero({
    name: "Luke",
    firstPosted: "2014-12-29",
    posted: `For time:
Run 400 meters
15 clean and jerks
Run 400 meters
30 toes-to-bars
Run 400 meters
45 wall-ball shots
Run 400 meters
45 kettlebell swings
Run 400 meters
30 ring dips
Run 400 meters
15 front-rack weighted lunges
Run 400 meters
♀ 105-lb barbell, 14-lb medicine ball to a 9-foot target, 35-lb kettlebell
♂ 155-lb barbell, 20-lb medicine ball to a 10-foot target, 53-lb kettlebell`,
    blocks: [
      forTime([
        mv("run", meters(400)),
        mv("clean-and-jerk", reps(15), bb(155, 105)),
        mv("run", meters(400)),
        mv("toes-to-bar", reps(30)),
        mv("run", meters(400)),
        mv("wall-ball", reps(45), ball(20, 14), { note: "to 10/9 ft" }),
        mv("run", meters(400)),
        mv("kettlebell-swing", reps(45), kb(53, 35)),
        mv("run", meters(400)),
        mv("ring-dip", reps(30)),
        mv("run", meters(400)),
        mv("front-rack-lunge", reps(15), bb(155, 105)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Robbie",
    firstPosted: "2015-01-24",
    posted: `Complete as many rounds as possible in 25 minutes of:
8 freestanding handstand push-ups
1 L-sit rope climb to 15 feet`,
    blocks: [
      amrap(25, [
        mv("freestanding-handstand-push-up", reps(8)),
        mv("l-sit-rope-climb", reps(1), { note: "to 15 feet" }),
      ]),
    ],
  }),
  hero({
    name: "Shawn",
    firstPosted: "2015-02-18",
    posted: `For time:
Run 5 miles
Run in 5-minute intervals, stopping after each to perform 50 squats and 50 push-ups before beginning the next 5-minute run interval.`,
    blocks: [
      forTime(
        [
          mv("run", miles(5), { note: "in 5-minute intervals" }),
          mv("air-squat", reps(50), { note: "after each run interval" }),
          mv("push-up", reps(50), { note: "after each run interval" }),
        ],
        {
          intents: [
            "Run in 5-minute intervals, stopping after each to perform 50 squats and 50 push-ups before beginning the next 5-minute run interval.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Foo",
    firstPosted: "2015-03-01",
    posted: `For time:
13 bench presses
Then, complete as many rounds and reps as possible in 20 minutes of:
7 chest-to-bar pull-ups
77 double-unders
2 squat clean thrusters
28 sit-ups
♀ 110 lb
♂ 170 lb`,
    blocks: [
      forTime([mv("bench-press", reps(13), bb(170, 110))]),
      amrap(20, [
        mv("chest-to-bar-pull-up", reps(7)),
        mv("double-under", reps(77)),
        mv("squat-clean-thruster", reps(2), bb(170, 110)),
        mv("sit-up", reps(28)),
      ]),
    ],
  }),
  hero({
    name: "Bowen",
    firstPosted: "2015-03-08",
    posted: `3 rounds for time of:
800-meter run
7 deadlifts
10 burpee pull-ups
14 single-arm kettlebell thrusters, 7 each arm
20 box jumps
♀ 185-lb barbell, 35-lb kettlebell, 20-inch box
♂ 275-lb barbell, 53-lb kettlebell, 24-inch box`,
    blocks: [
      rounds(3, [
        mv("run", meters(800)),
        mv("deadlift", reps(7), bb(275, 185)),
        mv("burpee-pull-up", reps(10)),
        mv("kettlebell-thruster", reps(14), kb(53, 35), { note: "single-arm, 7 each arm" }),
        mv("box-jump", reps(20), { note: "24/20-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "Gaza",
    firstPosted: "2015-03-15",
    posted: `5 rounds for time of:
35 kettlebell swings
30 push-ups
25 pull-ups
20 box jumps
1-mile run
♀ 35-lb kettlebell, 24-inch box
♂ 53-lb kettlebell, 30-inch box`,
    blocks: [
      rounds(5, [
        mv("kettlebell-swing", reps(35), kb(53, 35)),
        mv("push-up", reps(30)),
        mv("pull-up", reps(25)),
        mv("box-jump", reps(20), { note: "30/24-inch box" }),
        mv("run", miles(1)),
      ]),
    ],
  }),
  hero({
    name: "Crain",
    firstPosted: "2015-03-21",
    posted: `2 rounds for time of:
34 push-ups
50-yard sprint
34 deadlifts
50-yard sprint
34 box jumps
50-yard sprint
34 clean and jerk
50-yard sprint
34 burpees
50-yard sprint
34 wall-ball shots
50-yard sprint
34 pull-ups
50-yard sprint
♀ 95-lb deadlift, 24-inch box, 65-lb clean and jerk, 14-lb medicine ball to a 9-foot target
♂ 135-lb deadlift, 24-inch box, 95-lb clean and jerk, 20-lb medicine ball to a 10-foot target`,
    blocks: [
      rounds(
        2,
        [
          mv("push-up", reps(34)),
          mv("deadlift", reps(34), bb(135, 95)),
          mv("box-jump", reps(34), { note: "24-inch box" }),
          mv("clean-and-jerk", reps(34), bb(95, 65)),
          mv("burpee", reps(34)),
          mv("wall-ball", reps(34), ball(20, 14), { note: "to 10/9 ft" }),
          mv("pull-up", reps(34)),
        ].flatMap((item) => [item, mv("run", yards(50), { note: "sprint" })]),
      ),
    ],
  }),
  hero({
    name: "Capoot",
    firstPosted: "2015-05-20",
    posted: `For time:
100 push-ups
Run 800 meters
75 push-ups
Run 1,200 meters
50 push-ups
Run 1,600 meters
25 push-ups
Run 2,000 meters`,
    blocks: [
      forTime([
        mv("push-up", reps(100)),
        mv("run", meters(800)),
        mv("push-up", reps(75)),
        mv("run", meters(1200)),
        mv("push-up", reps(50)),
        mv("run", meters(1600)),
        mv("push-up", reps(25)),
        mv("run", meters(2000)),
      ]),
    ],
  }),
  hero({
    name: "Hall",
    firstPosted: "2015-06-07",
    posted: `5 rounds for time of:
3 cleans
200-meter sprint
20 kettlebell snatches, 10 each arm
Rest 2 minutes between rounds.
♀ 155-lb barbell, 35-lb kettlebell
♂ 225-lb barbell, 53-lb kettlebell`,
    blocks: [
      rounds(
        5,
        [
          mv("clean", reps(3), bb(225, 155)),
          mv("run", meters(200), { note: "sprint" }),
          mv("kettlebell-snatch", reps(20), kb(53, 35), { note: "10 each arm" }),
        ],
        { restSeconds: 120, intents: ["Rest 2 minutes between rounds."] },
      ),
    ],
  }),
  hero({
    name: "Servais",
    firstPosted: "2015-06-09",
    posted: `For time:
Run 1.5 miles
Then, 8 rounds of:
19 pull-ups
19 push-ups
19 burpees
Then,
400-meter sandbag carry
1-mile farmers carry
♀ Heavy sandbag, 30-lb dumbbells
♂ Heavy sandbag, 45-lb dumbbells`,
    blocks: [
      forTime([mv("run", miles(1.5))]),
      rounds(8, [mv("pull-up", reps(19)), mv("push-up", reps(19)), mv("burpee", reps(19))]),
      forTime([
        mv("sandbag-carry", meters(400), { note: "heavy sandbag" }),
        mv("farmers-carry", miles(1), db(45, 30)),
      ]),
    ],
  }),
  hero({
    name: "PK",
    firstPosted: "2015-07-03",
    posted: `5 rounds for time of:
10 back squats
10 deadlifts
400-meter sprint
Rest 2 minutes between rounds.
♀ 155-lb back squats, 185-lb deadlifts
♂ 225-lb back squats, 275-lb deadlifts`,
    blocks: [
      rounds(
        5,
        [
          mv("back-squat", reps(10), bb(225, 155)),
          mv("deadlift", reps(10), bb(275, 185)),
          mv("run", meters(400), { note: "sprint" }),
        ],
        { restSeconds: 120, intents: ["Rest 2 minutes between rounds."] },
      ),
    ],
  }),
  hero({
    name: "Marco",
    firstPosted: "2015-07-05",
    posted: `3 rounds for time of:
21 pull-ups
15 handstand push-ups
9 thrusters
♀ 95 lb
♂ 135 lb`,
    blocks: [
      rounds(3, [
        mv("pull-up", reps(21)),
        mv("handstand-push-up", reps(15)),
        mv("thruster", reps(9), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "René",
    firstPosted: "2015-08-14",
    vest: { lb: [20, 14], optional: true },
    posted: `7 rounds for time of:
400-meter run
21 walking lunges
15 pull-ups
9 burpees
If you have a weight vest or body armor, wear it.
♀ 14-lb weight vest
♂ 20-lb weight vest`,
    blocks: [
      rounds(
        7,
        [
          mv("run", meters(400)),
          mv("walking-lunge", reps(21)),
          mv("pull-up", reps(15)),
          mv("burpee", reps(9)),
        ],
        { intents: ["If you have a weight vest or body armor, wear it."] },
      ),
    ],
  }),
  hero({
    name: "Pike",
    firstPosted: "2015-08-23",
    posted: `5 rounds for time of:
20 thrusters
10 strict ring dips
20 push-ups
10 strict handstand push-ups
50-meter bear crawl
♀ 55 lb
♂ 75 lb`,
    blocks: [
      rounds(5, [
        mv("thruster", reps(20), bb(75, 55)),
        mv("strict-ring-dip", reps(10)),
        mv("push-up", reps(20)),
        mv("strict-handstand-push-up", reps(10)),
        mv("bear-crawl", meters(50)),
      ]),
    ],
  }),
  hero({
    name: "Kutschbach",
    firstPosted: "2015-09-20",
    posted: `7 rounds for time of:
11 back squats
10 jerks
♀ 125-lb back squat, 95-lb jerk
♂ 185-lb back squat, 135-lb jerk`,
    blocks: [
      rounds(7, [mv("back-squat", reps(11), bb(185, 125)), mv("jerk", reps(10), bb(135, 95))]),
    ],
  }),
  hero({
    name: "Jennifer",
    firstPosted: "2015-09-25",
    posted: `Complete as many rounds and reps as possible in 26 minutes of:
10 pull-ups
15 kettlebell swings
20 box jumps
♀ 35-lb kettlebell, 20-inch box
♂ 53-lb kettlebell, 24-inch box`,
    blocks: [
      amrap(26, [
        mv("pull-up", reps(10)),
        mv("kettlebell-swing", reps(15), kb(53, 35)),
        mv("box-jump", reps(20), { note: "24/20-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "Horton",
    firstPosted: "2015-10-10",
    team: 2,
    posted: `9 rounds for time, with a partner, of:
9 bar muscle-ups
11 clean and jerks, 105/155 lb
50-yard buddy carry
Share the work with your partner however you choose. One person works at a time. If you can’t find a partner, perform 5 reps of each exercise per round and find a heavy sandbag to carry.
♀ 105 lb
♂ 155 lb`,
    blocks: [
      rounds(
        9,
        [
          mv("bar-muscle-up", reps(9)),
          mv("clean-and-jerk", reps(11), bb(155, 105)),
          mv("buddy-carry", yards(50)),
        ],
        {
          intents: [
            "Share the work with your partner however you choose.",
            "One person works at a time.",
            "If you can’t find a partner, perform 5 reps of each exercise per round and find a heavy sandbag to carry.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Scooter",
    firstPosted: "2015-10-15",
    team: 2,
    posted: `On a 35-minute clock with a partner, complete as many rounds and reps as possible in 30 minutes of:
30 double-unders
15 pull-ups
15 push-ups
100-meter sprint
Then, 5 minutes to find a 1-rep-max partner deadlift
For the AMRAP, have one partner work while the other rests, switching after a full round is completed. If you’re performing without a partner, rest 60 seconds between each round, and find a regular 1-rep-max deadlift.`,
    blocks: [
      amrap(
        30,
        [
          mv("double-under", reps(30)),
          mv("pull-up", reps(15)),
          mv("push-up", reps(15)),
          mv("run", meters(100), { note: "sprint" }),
        ],
        {
          intents: [
            "For the AMRAP, have one partner work while the other rests, switching after a full round is completed.",
            "If you’re performing without a partner, rest 60 seconds between each round, and find a regular 1-rep-max deadlift.",
          ],
        },
      ),
      block(
        "strength",
        { durationSeconds: 300 },
        "5 minutes to find a 1-rep-max partner deadlift",
        [mv("deadlift", { note: "1-rep max, partner deadlift" })],
      ),
    ],
  }),
  hero({
    name: "Matt 16",
    firstPosted: "2015-11-11",
    posted: `For time:
16 deadlifts
16 hang power cleans
16 push presses
Run 800 meters
16 deadlifts
16 hang power cleans
16 push presses
Run 800 meters
16 deadlifts
16 hang power cleans
16 push presses
♀ 185-lb deadlift, 125-lb hang power clean, 95-lb push press
♂ 275-lb deadlift, 185-lb hang power clean, 135-lb push press`,
    blocks: [
      forTime([
        mv("deadlift", reps(16), bb(275, 185)),
        mv("hang-power-clean", reps(16), bb(185, 125)),
        mv("push-press", reps(16), bb(135, 95)),
        mv("run", meters(800)),
        mv("deadlift", reps(16), bb(275, 185)),
        mv("hang-power-clean", reps(16), bb(185, 125)),
        mv("push-press", reps(16), bb(135, 95)),
        mv("run", meters(800)),
        mv("deadlift", reps(16), bb(275, 185)),
        mv("hang-power-clean", reps(16), bb(185, 125)),
        mv("push-press", reps(16), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "T.U.P.",
    firstPosted: "2015-12-08",
    posted: `15-12-9-6-3 reps for time of:
Power cleans
Pull-ups
Front squats
Pull-ups
♀ 95 lb
♂ 135 lb`,
    blocks: [
      ladder(
        [15, 12, 9, 6, 3],
        [
          mv("power-clean", bb(135, 95)),
          mv("pull-up"),
          mv("front-squat", bb(135, 95)),
          mv("pull-up"),
        ],
      ),
    ],
  }),
  hero({
    name: "Harper",
    firstPosted: "2015-12-26",
    posted: `Complete as many rounds as possible in 23 minutes of:
9 chest-to-bar pull-ups
15 power cleans
21 squats
400-meter run with a plate
♀ 95-lb barbell, 25-lb plate
♂ 135-lb barbell, 45-lb plate`,
    blocks: [
      amrap(23, [
        mv("chest-to-bar-pull-up", reps(9)),
        mv("power-clean", reps(15), bb(135, 95)),
        mv("air-squat", reps(21)),
        mv("run", meters(400), plate(45, 25), { note: "carrying a plate" }),
      ]),
    ],
  }),
  hero({
    name: "Sisson",
    firstPosted: "2016-01-31",
    vest: { lb: [20, 14], optional: true },
    posted: `Complete as many rounds as possible in 20 minutes of:
1 rope climb to 15 feet
5 burpees
200-meter run
If you’ve got a weight vest or body armor, wear it.
♀ 14-lb weight vest
♂ 20-lb weight vest`,
    blocks: [
      amrap(
        20,
        [
          mv("rope-climb", reps(1), { note: "to 15 feet" }),
          mv("burpee", reps(5)),
          mv("run", meters(200)),
        ],
        { intents: ["If you’ve got a weight vest or body armor, wear it."] },
      ),
    ],
  }),
  hero({
    name: "Terry",
    firstPosted: "2016-02-28",
    posted: `For time:
1-mile run
100 push-ups
100-meter bear crawl
1-mile run
100-meter bear crawl
100 push-ups
1-mile run`,
    blocks: [
      forTime([
        mv("run", miles(1)),
        mv("push-up", reps(100)),
        mv("bear-crawl", meters(100)),
        mv("run", miles(1)),
        mv("bear-crawl", meters(100)),
        mv("push-up", reps(100)),
        mv("run", miles(1)),
      ]),
    ],
  }),
  hero({
    name: "Big Sexy",
    firstPosted: "2016-03-09",
    posted: `5 rounds for time of:
6 deadlifts
6 burpees
5 cleans
5 chest-to-bar pull-ups
4 thrusters
4 muscle-ups
♀ 205-lb deadlift, 155-lb clean, 105-lb thruster
♂ 315-lb deadlift, 225-lb clean, 155-lb thruster`,
    blocks: [
      rounds(5, [
        mv("deadlift", reps(6), bb(315, 205)),
        mv("burpee", reps(6)),
        mv("clean", reps(5), bb(225, 155)),
        mv("chest-to-bar-pull-up", reps(5)),
        mv("thruster", reps(4), bb(155, 105)),
        mv("ring-muscle-up", reps(4)),
      ]),
    ],
  }),
  hero({
    name: "Woehlke",
    firstPosted: "2016-03-29",
    posted: `3 rounds, each for time, of:
4 jerks
5 front squats
6 power cleans
40 pull-ups
50 push-ups
60 sit-ups
Rest 3 minutes between rounds.
♀ 125-lb barbell
♂ 185-lb barbell`,
    blocks: [
      rounds(
        3,
        [
          mv("jerk", reps(4), bb(185, 125)),
          mv("front-squat", reps(5), bb(185, 125)),
          mv("power-clean", reps(6), bb(185, 125)),
          mv("pull-up", reps(40)),
          mv("push-up", reps(50)),
          mv("sit-up", reps(60)),
        ],
        {
          title: "3 rounds, each for time",
          restSeconds: 180,
          intents: ["Rest 3 minutes between rounds."],
        },
      ),
    ],
  }),
  hero({
    name: "Maupin",
    firstPosted: "2016-04-10",
    posted: `4 rounds for time of:
Run 800 meters
49 push-ups
49 sit-ups
49 squats`,
    blocks: [
      rounds(4, [
        mv("run", meters(800)),
        mv("push-up", reps(49)),
        mv("sit-up", reps(49)),
        mv("air-squat", reps(49)),
      ]),
    ],
  }),
  hero({
    name: "Hildy",
    firstPosted: "2016-05-29",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
100-calorie row
75 thrusters
50 pull-ups
75 wall-ball shots
100-calorie row
If you’ve got a weight vest or body armor, wear it.
♀ 35-lb barbell, 14-lb medicine ball to a 9-foot target, 14-lb weight vest
♂ 45-lb barbell, 20-lb medicine ball to a 10-foot target, 20-lb weight vest`,
    blocks: [
      forTime(
        [
          mv("row", cal(100)),
          mv("thruster", reps(75), bb(45, 35)),
          mv("pull-up", reps(50)),
          mv("wall-ball", reps(75), ball(20, 14), { note: "to 10/9 ft" }),
          mv("row", cal(100)),
        ],
        { intents: ["If you’ve got a weight vest or body armor, wear it."] },
      ),
    ],
  }),
  hero({
    name: "T.J.",
    firstPosted: "2016-07-03",
    posted: `For time:
10 bench presses
10 strict pull-ups
Max-set thrusters
Repeat the triplet until you have completed 100 thrusters.
♀ 125-lb bench press, 95-lb thruster
♂ 185-lb bench press, 135-lb thruster`,
    blocks: [
      forTime(
        [
          mv("bench-press", reps(10), bb(185, 125)),
          mv("strict-pull-up", reps(10)),
          mv("thruster", bb(135, 95), { note: "max reps" }),
        ],
        { intents: ["Repeat the triplet until you have completed 100 thrusters."] },
      ),
    ],
  }),
  hero({
    name: "Monti",
    firstPosted: "2016-07-15",
    posted: `5 rounds for time of:
50 barbell step-ups
15 cleans
50 barbell step-ups
10 snatches
♀ 35-lb step-up, 20-inch box, 95-lb clean and snatch
♂ 45-lb step-up, 20-inch box, 135-lb clean and snatch`,
    blocks: [
      rounds(5, [
        mv("barbell-step-up", reps(50), bb(45, 35), { note: "20-inch box" }),
        mv("clean", reps(15), bb(135, 95)),
        mv("barbell-step-up", reps(50), bb(45, 35), { note: "20-inch box" }),
        mv("snatch", reps(10), bb(135, 95)),
      ]),
    ],
  }),
  hero({
    name: "DVB",
    firstPosted: "2016-08-26",
    posted: `For time:
Run 1 mile with a medicine ball
Then, 8 rounds of:
10 wall-ball shots
1 rope climb
Run 800 meters with a medicine ball
Then, 4 rounds of:
10 wall-ball shots
1 rope climb
Run 400 meters with a medicine ball
Then 2 rounds of:
10 wall-ball shots
1 rope climb
♀ 14-lb medicine ball, 9-foot target
♂ 20-lb medicine ball, 10-foot target`,
    blocks: [
      forTime([mv("run", miles(1), ball(20, 14), { note: "carrying a medicine ball" })]),
      rounds(8, [
        mv("wall-ball", reps(10), ball(20, 14), { note: "to 10/9 ft" }),
        mv("rope-climb", reps(1)),
        mv("run", meters(800), ball(20, 14), { note: "carrying a medicine ball" }),
      ]),
      rounds(4, [
        mv("wall-ball", reps(10), ball(20, 14), { note: "to 10/9 ft" }),
        mv("rope-climb", reps(1)),
        mv("run", meters(400), ball(20, 14), { note: "carrying a medicine ball" }),
      ]),
      rounds(2, [
        mv("wall-ball", reps(10), ball(20, 14), { note: "to 10/9 ft" }),
        mv("rope-climb", reps(1)),
      ]),
    ],
  }),
  hero({
    name: "Nickman",
    firstPosted: "2016-09-03",
    posted: `10 rounds for time of:
200-meter farmers carry
10 weighted pull-ups
20 dumbbell alternating power snatches
♀ 40-lb dumbbells for farmers carry and power snatches, 20-lb dumbbells for pull-ups
♂ 55-lb dumbbells for farmers carry and power snatches, 35-lb dumbbells for pull-ups`,
    blocks: [
      rounds(10, [
        mv("farmers-carry", meters(200), db(55, 40)),
        mv("weighted-pull-up", reps(10), db(35, 20)),
        mv("dumbbell-snatch", reps(20), db(55, 40), { note: "alternating, power" }),
      ]),
    ],
  }),
  hero({
    name: "Marston",
    firstPosted: "2016-09-27",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
1 deadlift
10 toes-to-bars
15 bar-facing burpees
♀ 275 lb
♂ 405 lb`,
    blocks: [
      amrap(20, [
        mv("deadlift", reps(1), bb(405, 275)),
        mv("toes-to-bar", reps(10)),
        mv("bar-facing-burpee", reps(15)),
      ]),
    ],
  }),
  hero({
    name: "Artie",
    firstPosted: "2016-10-23",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
5 pull-ups
10 push-ups
15 squats
5 pull-ups
10 thrusters
♀ 65 lb
♂ 95 lb`,
    blocks: [
      amrap(20, [
        mv("pull-up", reps(5)),
        mv("push-up", reps(10)),
        mv("air-squat", reps(15)),
        mv("pull-up", reps(5)),
        mv("thruster", reps(10), bb(95, 65)),
      ]),
    ],
  }),
  hero({
    name: "Hollywood",
    firstPosted: "2016-11-22",
    posted: `For time:
Run 2,000 meters
22 wall-ball shots
22 muscle-ups
22 wall-ball shots
22 power cleans
22 wall-ball shots
Run 2,000 meters
♀ 20-lb medicine ball to a 9-foot target, 125-lb barbell
♂ 30-lb medicine ball to a 10-foot target, 185-lb barbell`,
    blocks: [
      forTime([
        mv("run", meters(2000)),
        mv("wall-ball", reps(22), ball(30, 20), { note: "to 10/9 ft" }),
        mv("ring-muscle-up", reps(22)),
        mv("wall-ball", reps(22), ball(30, 20), { note: "to 10/9 ft" }),
        mv("power-clean", reps(22), bb(185, 125)),
        mv("wall-ball", reps(22), ball(30, 20), { note: "to 10/9 ft" }),
        mv("run", meters(2000)),
      ]),
    ],
  }),
  hero({
    name: "Manuel",
    firstPosted: "2016-12-02",
    scoring: "reps",
    vest: { lb: [20, 14], optional: false },
    posted: `5 rounds of:
3 minutes of rope climbs
2 minutes of squats
2 minutes of push-ups
3 minutes to run 400 meters
Wear a weight vest or body armor. After the run, rest for the remainder of the 3 minutes before beginning the next round.`,
    blocks: [
      block(
        "intervals",
        { rounds: { min: 5, max: 5 } },
        "5 rounds",
        [
          mv("rope-climb", minutes(3), { note: "max reps" }),
          mv("air-squat", minutes(2), { note: "max reps" }),
          mv("push-up", minutes(2), { note: "max reps" }),
          mv("run", meters(400), minutes(3), { note: "rest the remainder" }),
        ],
        {
          intents: [
            "Wear a weight vest or body armor.",
            "After the run, rest for the remainder of the 3 minutes before beginning the next round.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Tiff",
    firstPosted: "2016-12-23",
    posted: `On a 25-minute clock:
1.5-mile run
Then, in the remaining time, complete as many rounds and reps as possible of:
11 chest-to-bar pull-ups
7 hang squat cleans
7 push presses
♀ 105 lb
♂ 155 lb`,
    blocks: [
      block("other", { durationSeconds: 1500 }, "On a 25-minute clock", [mv("run", miles(1.5))]),
      block("amrap", {}, "Then, in the remaining time, AMRAP", [
        mv("chest-to-bar-pull-up", reps(11)),
        mv("hang-squat-clean", reps(7), bb(155, 105)),
        mv("push-press", reps(7), bb(155, 105)),
      ]),
    ],
  }),
  hero({
    name: "Paul Pena",
    firstPosted: "2017-01-19",
    posted: `7 rounds, each for time, of:
100-meter sprint
19 kettlebell swings
10 burpee box jumps
Rest 3 minutes between rounds.
♀ 53-lb kettlebell, 20-inch box
♂ 70-lb kettlebell, 24-inch box`,
    blocks: [
      rounds(
        7,
        [
          mv("run", meters(100), { note: "sprint" }),
          mv("kettlebell-swing", reps(19), kb(70, 53)),
          mv("burpee-box-jump", reps(10), { note: "24/20-inch box" }),
        ],
        {
          title: "7 rounds, each for time",
          restSeconds: 180,
          intents: ["Rest 3 minutes between rounds."],
        },
      ),
    ],
  }),
  hero({
    name: "Yeti",
    firstPosted: "2017-02-21",
    posted: `For time:
25 pull-ups
10 muscle-ups
1.5-mile run
10 muscle-ups
25 pull-ups`,
    blocks: [
      forTime([
        mv("pull-up", reps(25)),
        mv("ring-muscle-up", reps(10)),
        mv("run", miles(1.5)),
        mv("ring-muscle-up", reps(10)),
        mv("pull-up", reps(25)),
      ]),
    ],
  }),
  hero({
    name: "Liam",
    firstPosted: "2017-03-21",
    posted: `For time:
Run 800 meters with a plate
100 toes-to-bars
50 front squats
10 rope climbs to 15 feet
Run 800 meters with a plate
Partition the toes-to-bars, front squats, and rope climbs as needed. Start and finish with the run.
♀ 25-lb plate, 105-lb barbell
♂ 45-lb plate, 155-lb barbell`,
    blocks: [
      forTime(
        [
          mv("run", meters(800), plate(45, 25), { note: "carrying a plate" }),
          mv("toes-to-bar", reps(100)),
          mv("front-squat", reps(50), bb(155, 105)),
          mv("rope-climb", reps(10), { note: "to 15 feet" }),
          mv("run", meters(800), plate(45, 25), { note: "carrying a plate" }),
        ],
        {
          intents: [
            "Partition the toes-to-bars, front squats, and rope climbs as needed.",
            "Start and finish with the run.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Wes",
    firstPosted: "2017-04-15",
    posted: `For time:
Run 800 meters with a 25-lb plate
Then, 14 rounds of:
5 strict pull-ups
4 burpee box jumps, 24-inch box
3 cleans, 185 lb
Then, run 800 meters with a 25-lb plate`,
    blocks: [
      forTime([mv("run", meters(800), plate(25), { note: "carrying a plate" })]),
      rounds(14, [
        mv("strict-pull-up", reps(5)),
        mv("burpee-box-jump", reps(4), { note: "24-inch box" }),
        mv("clean", reps(3), bb(185)),
      ]),
      forTime([mv("run", meters(800), plate(25), { note: "carrying a plate" })]),
    ],
  }),
  hero({
    name: "Miron",
    firstPosted: "2017-04-30",
    posted: `5 rounds for time of:
800-meter run
23 back squats, ¾ body weight
13 deadlifts, 1 ½ body weight`,
    blocks: [
      rounds(5, [
        mv("run", meters(800)),
        mv("back-squat", reps(23), { note: "0.75 × bodyweight" }),
        mv("deadlift", reps(13), { note: "1.5 × bodyweight" }),
      ]),
    ],
  }),
  hero({
    name: "Pat",
    firstPosted: "2017-05-29",
    posted: `For time:
Run 800 meters with a plate
Then, 14 rounds of:
5 strict pull-ups
4 burpee box jumps
3 cleans
Then,
Run 800 meters with a plate
♀ 25-lb plate, 20-inch box, 125-lb barbell
♂ 25-lb plate, 24-inch box, 185-lb barbell`,
    blocks: [
      forTime([mv("run", meters(800), plate(25, 25), { note: "carrying a plate" })]),
      rounds(14, [
        mv("strict-pull-up", reps(5)),
        mv("burpee-box-jump", reps(4), { note: "24/20-inch box" }),
        mv("clean", reps(3), bb(185, 125)),
      ]),
      forTime([mv("run", meters(800), plate(25, 25), { note: "carrying a plate" })]),
    ],
  }),
  hero({
    name: "Scotty",
    firstPosted: "2017-06-16",
    posted: `Complete as many rounds and reps as possible in 11 minutes of:
5 deadlifts
18 wall-ball shots
17 burpees over the bar
♀ 205-lb barbell, 14-lb medicine ball to a 9-foot target
♂ 315-lb barbell, 20-lb medicine ball to a 10-foot target`,
    blocks: [
      amrap(11, [
        mv("deadlift", reps(5), bb(315, 205)),
        mv("wall-ball", reps(18), ball(20, 14), { note: "to 10/9 ft" }),
        mv("bar-facing-burpee", reps(17)),
      ]),
    ],
  }),
  hero({
    name: "Rich",
    firstPosted: "2017-07-04",
    posted: `For time:
13 squat snatches
Then, 10 rounds of:
10 pull-ups
100-meter sprint
Then, 13 squat cleans
♀ 105 lb
♂ 155 lb`,
    blocks: [
      forTime([mv("snatch", reps(13), bb(155, 105))]),
      rounds(10, [mv("pull-up", reps(10)), mv("run", meters(100), { note: "sprint" })]),
      forTime([mv("clean", reps(13), bb(155, 105))]),
    ],
  }),
  hero({
    name: "Dallas 5",
    firstPosted: "2017-07-08",
    scoring: "reps",
    posted: `5 minutes of:
Burpees
Then, 5 minutes of:
7 deadlifts
7 box jumps
Then, 5 minutes of:
Turkish get-ups
Then, 5 minutes of:
7 snatches
7 push-ups
Then, 5 minutes of:
Rowing for calories
Complete as many reps as possible at each 5-minute station. Rest 1 minute between stations.
♀ 105-lb deadlift, 20-inch box, 30-lb dumbbell for Turkish get-up, 55-lb snatch
♂ 155-lb deadlift, 24-inch box, 40-lb dumbbell for Turkish get-up, 75-lb snatch`,
    blocks: [
      amrap(5, [mv("burpee", { note: "max reps" })], {
        intents: [
          "Complete as many reps as possible at each 5-minute station.",
          "Rest 1 minute between stations.",
        ],
      }),
      rest(60),
      amrap(5, [
        mv("deadlift", reps(7), bb(155, 105)),
        mv("box-jump", reps(7), { note: "24/20-inch box" }),
      ]),
      rest(60),
      amrap(5, [mv("turkish-get-up", db(40, 30), { note: "max reps" })]),
      rest(60),
      amrap(5, [mv("snatch", reps(7), bb(75, 55)), mv("push-up", reps(7))]),
      rest(60),
      amrap(5, [mv("row", { note: "max calories" })]),
    ],
  }),
];
