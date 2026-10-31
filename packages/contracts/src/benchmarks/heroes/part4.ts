import {
  amrap,
  ball,
  bb,
  block,
  cal,
  db,
  feet,
  forTime,
  hero,
  kb,
  ladder,
  meters,
  miles,
  mv,
  object,
  plate,
  reps,
  rest,
  rounds,
  seconds,
  yards,
} from "../dsl.ts";
import type { Benchmark } from "../model.ts";

/** Hero workouts, part 4 of the official list in posting order. */
export const HEROES_4: ReadonlyArray<Benchmark> = [
  hero({
    name: "Dunn",
    firstPosted: "2017-08-24",
    posted: `Complete as many rounds as possible in 19 minutes of:
3 muscle-ups
1 shuttle sprint (5 yards, 10 yards, 15 yards)
6 burpee box jump-overs
On the burpees, jump over the box without touching it.
♀ 20-inch box
♂ 20-inch box`,
    blocks: [
      amrap(
        19,
        [
          mv("ring-muscle-up", reps(3)),
          mv("shuttle-run", reps(1), { note: "sprint, 5, 10, 15 yards" }),
          mv("burpee-box-jump-over", reps(6), { note: "20-inch box" }),
        ],
        { intents: ["On the burpees, jump over the box without touching it."] },
      ),
    ],
  }),
  hero({
    name: "Kev",
    firstPosted: "2017-09-06",
    team: 2,
    posted: `With a partner, complete as many rounds and reps as possible in 26 minutes of:
6 deadlifts, each
9 synchronized bar-facing burpees
9 bar muscle-ups, each
55-foot partner barbell carry
♀ 205-lb barbell
♂ 315-lb barbell`,
    blocks: [
      amrap(26, [
        mv("deadlift", reps(6), bb(315, 205), { note: "each" }),
        mv("bar-facing-burpee", reps(9), { note: "synchronized" }),
        mv("bar-muscle-up", reps(9), { note: "each" }),
        mv("farmers-carry", feet(55), bb(315, 205), { note: "partner barbell carry" }),
      ]),
    ],
  }),
  hero({
    name: "Emily",
    firstPosted: "2017-09-10",
    posted: `10 rounds for time of:
30 double-unders
15 pull-ups
30 squats
100-meter sprint
Rest 2 minutes`,
    blocks: [
      rounds(
        10,
        [
          mv("double-under", reps(30)),
          mv("pull-up", reps(15)),
          mv("air-squat", reps(30)),
          mv("run", meters(100), { note: "sprint" }),
        ],
        { restSeconds: 120, intents: ["Rest 2 minutes."] },
      ),
    ],
  }),
  hero({
    name: "Andy",
    firstPosted: "2017-09-26",
    vest: { lb: [20, 14], optional: false },
    posted: `For time:
25 thrusters
50 box jumps
75 deadlifts
1.5-mile run
75 deadlifts
50 box jumps
25 thrusters
Wear a weight vest or body armor.
♀ 14-lb weight vest, 75-lb barbell, 20-inch box
♂ 20-lb weight vest, 115-lb barbell, 24-inch box`,
    blocks: [
      forTime(
        [
          mv("thruster", reps(25), bb(115, 75)),
          mv("box-jump", reps(50), { note: "24/20-inch box" }),
          mv("deadlift", reps(75), bb(115, 75)),
          mv("run", miles(1.5)),
          mv("deadlift", reps(75), bb(115, 75)),
          mv("box-jump", reps(50), { note: "24/20-inch box" }),
          mv("thruster", reps(25), bb(115, 75)),
        ],
        { intents: ["Wear a weight vest or body armor."] },
      ),
    ],
  }),
  hero({
    name: "Viola",
    firstPosted: "2017-11-11",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
400-meter run
11 power snatches
17 pull-ups
13 power cleans
♀ 65 lb
♂ 95 lb`,
    blocks: [
      amrap(20, [
        mv("run", meters(400)),
        mv("power-snatch", reps(11), bb(95, 65)),
        mv("pull-up", reps(17)),
        mv("power-clean", reps(13), bb(95, 65)),
      ]),
    ],
  }),
  hero({
    name: "Coffland",
    firstPosted: "2017-11-13",
    posted: `Hang from a pull-up bar for 6 minutes
Each time you drop from the bar, complete:
800-meter run
30 push-ups`,
    blocks: [
      block(
        "for_time",
        {},
        "Hang from a pull-up bar for 6 minutes",
        [
          mv("dead-hang", seconds(360), { note: "accumulated" }),
          mv("run", meters(800), { note: "each time you drop" }),
          mv("push-up", reps(30), { note: "each time you drop" }),
        ],
        {
          intents: ["Each time you drop from the bar, complete an 800-meter run and 30 push-ups."],
        },
      ),
    ],
  }),
  hero({
    name: "The Lyon",
    firstPosted: "2017-12-27",
    posted: `5 rounds, each for time, of:
7 squat cleans
7 shoulder-to-overheads
7 burpee chest-to-bar pull-ups
Rest 2 minutes between rounds.
Ideally, use a pull-up bar that is 6 inches above your max reach when standing.
♀ 115-lb barbell
♂ 165-lb barbell`,
    blocks: [
      rounds(
        5,
        [
          mv("clean", reps(7), bb(165, 115)),
          mv("shoulder-to-overhead", reps(7), bb(165, 115)),
          mv("burpee-chest-to-bar-pull-up", reps(7)),
        ],
        {
          title: "5 rounds, each for time",
          restSeconds: 120,
          intents: [
            "Rest 2 minutes between rounds.",
            "Ideally, use a pull-up bar that is 6 inches above your max reach when standing.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "T",
    firstPosted: "2018-02-04",
    posted: `5 rounds for time of:
100-meter sprint
10 squat clean thrusters
15 kettlebell swings
100-meter sprint
Rest 2 minutes
♀ 75-lb barbell and 35-lb kettlebell
♂ 75-lb barbell and 35-lb kettlebell`,
    blocks: [
      rounds(
        5,
        [
          mv("run", meters(100), { note: "sprint" }),
          mv("squat-clean-thruster", reps(10), bb(75)),
          mv("kettlebell-swing", reps(15), kb(35)),
          mv("run", meters(100), { note: "sprint" }),
        ],
        { restSeconds: 120, intents: ["Rest 2 minutes."] },
      ),
    ],
  }),
  hero({
    name: "Havana",
    firstPosted: "2018-02-20",
    posted: `Complete as many rounds as possible in 25 minutes of:
150 double-unders
50 push-ups
15 power cleans
♀ 125 lb
♂ 185 lb`,
    blocks: [
      amrap(25, [
        mv("double-under", reps(150)),
        mv("push-up", reps(50)),
        mv("power-clean", reps(15), bb(185, 125)),
      ]),
    ],
  }),
  hero({
    name: "Tama",
    firstPosted: "2018-03-28",
    posted: `For time:
800-meter single-arm barbell farmers carry, weight 1
31 toes-to-bars
31 push-ups
31 front squats
400-meter single-arm barbell farmers carry, weight 2
31 toes-to-bars
31 push-ups
31 hang power cleans
200-meter single-arm barbell farmers carry, weight 3
♀ Farmers carry 35 - 65 - 95 lb; Front squat 65 lb; Hang power clean 95 lb
♂ Farmers carry 45 - 95 - 135 lb; Front squat 95 lb; Hang power clean 135 lb`,
    blocks: [
      forTime([
        mv("farmers-carry", meters(800), bb(45, 35), { note: "single-arm barbell, weight 1" }),
        mv("toes-to-bar", reps(31)),
        mv("push-up", reps(31)),
        mv("front-squat", reps(31), bb(95, 65)),
        mv("farmers-carry", meters(400), bb(95, 65), { note: "single-arm barbell, weight 2" }),
        mv("toes-to-bar", reps(31)),
        mv("push-up", reps(31)),
        mv("hang-power-clean", reps(31), bb(135, 95)),
        mv("farmers-carry", meters(200), bb(135, 95), { note: "single-arm barbell, weight 3" }),
      ]),
    ],
  }),
  hero({
    name: "Otis",
    firstPosted: "2018-04-24",
    scoring: "reps",
    posted: `Complete as many reps as possible in 15 minutes of:
1 back squat, 1 shoulder press, 1 deadlift
2 back squats, 2 shoulder presses, 2 deadlifts
3 back squats, 3 shoulder presses, 3 deadlifts
Etc.
Use 1½ body weight for the squats and deadlifts and ¾ body weight for the presses.`,
    blocks: [
      amrap(
        15,
        [
          mv("back-squat", { note: "1.5 × bodyweight" }),
          mv("strict-press", { note: "0.75 × bodyweight" }),
          mv("deadlift", { note: "1.5 × bodyweight" }),
        ],
        {
          title: "AMRAP 15 min, 1-2-3 reps etc.",
          intents: [
            "Use 1½ body weight for the squats and deadlifts and ¾ body weight for the presses.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Josie",
    firstPosted: "2018-06-17",
    vest: { lb: [20, 14], optional: false },
    posted: `For time, wearing a 20-lb vest:
1-mile run
Then, 3 rounds of:
30 burpees
4 power cleans
6 front squats
Then, 1-mile run
♀ 105 lb
♂ 155 lb`,
    blocks: [
      forTime([mv("run", miles(1))], { intents: ["Wearing a 20-lb vest."] }),
      rounds(3, [
        mv("burpee", reps(30)),
        mv("power-clean", reps(4), bb(155, 105)),
        mv("front-squat", reps(6), bb(155, 105)),
      ]),
      forTime([mv("run", miles(1))]),
    ],
  }),
  hero({
    name: "Dork",
    firstPosted: "2018-10-10",
    posted: `6 rounds for time of:
60 double-unders
30 kettlebell swings
15 burpees
♀ 35-lb kettlebell
♂ 53-lb kettlebell`,
    blocks: [
      rounds(6, [
        mv("double-under", reps(60)),
        mv("kettlebell-swing", reps(30), kb(53, 35)),
        mv("burpee", reps(15)),
      ]),
    ],
  }),
  hero({
    name: "Bert",
    firstPosted: "2018-10-26",
    posted: `For time:
50 burpees
400-meter run
100 push-ups
400-meter run
150 walking lunges
400-meter run
200 squats
400-meter run
150 walking lunges
400-meter run
100 push-ups
400-meter run
50 burpees`,
    blocks: [
      forTime([
        mv("burpee", reps(50)),
        mv("run", meters(400)),
        mv("push-up", reps(100)),
        mv("run", meters(400)),
        mv("walking-lunge", reps(150)),
        mv("run", meters(400)),
        mv("air-squat", reps(200)),
        mv("run", meters(400)),
        mv("walking-lunge", reps(150)),
        mv("run", meters(400)),
        mv("push-up", reps(100)),
        mv("run", meters(400)),
        mv("burpee", reps(50)),
      ]),
    ],
  }),
  hero({
    name: "Wade",
    firstPosted: "2018-11-11",
    vest: { lb: [20, 14], optional: false },
    posted: `For time, wearing a 20-lb vest or body armor:
Run 1,200 meters
Then, 4 rounds of:
12 strict pull-ups
9 strict dips
6 strict handstand push-ups
Then, run 1,200 meters`,
    blocks: [
      forTime([mv("run", meters(1200))], {
        intents: ["Wearing a 20-lb vest or body armor."],
      }),
      rounds(4, [
        mv("strict-pull-up", reps(12)),
        mv("bar-dip", reps(9), { note: "strict" }),
        mv("strict-handstand-push-up", reps(6)),
      ]),
      forTime([mv("run", meters(1200))]),
    ],
  }),
  hero({
    name: "Fournier",
    firstPosted: "2020-08-28",
    posted: `For time:
50 shoulder-to-overheads
50-foot arm-over-arm sled pull
40 burpees
50-foot arm-over-arm sled pull
30 sumo deadlift high pulls
50-foot arm-over-arm sled pull
♀ 75-lb shoulder-to-overhead, 55-lb sumo deadlift high pull
♂ 115-lb shoulder-to-overhead, 85-lb sumo deadlift high pull
For the sled pull, use a load that is challenging but doesn’t require extended rest periods.`,
    blocks: [
      forTime(
        [
          mv("shoulder-to-overhead", reps(50), bb(115, 75)),
          mv("sled-pull", feet(50), { note: "arm-over-arm" }),
          mv("burpee", reps(40)),
          mv("sled-pull", feet(50), { note: "arm-over-arm" }),
          mv("sumo-deadlift-high-pull", reps(30), bb(85, 55)),
          mv("sled-pull", feet(50), { note: "arm-over-arm" }),
        ],
        {
          intents: [
            "For the sled pull, use a load that is challenging but doesn’t require extended rest periods.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Larry",
    firstPosted: "2020-11-11",
    posted: `21-18-15-12-9-6-3 reps for time of:
Front squats
Bar-facing burpees
♀ 75-lb squat, 50-lb sandbag
♂ 115-lb squat, 80-lb sandbag`,
    blocks: [
      ladder(
        [21, 18, 15, 12, 9, 6, 3],
        [
          mv("front-squat", bb(115, 75)),
          mv("bar-facing-burpee", object(80, 50), { note: "sandbag" }),
        ],
      ),
    ],
  }),
  hero({
    name: "Kelly Brown",
    firstPosted: "2020-11-13",
    posted: `5 rounds for time of:
Row 440 meter
10 box jumps
10 deadlifts
10 wall-ball shots
♀ 20-lb medicine ball to 9 feet, 185-lb deadlift, 24-inch box
♂ 30-lb medicine ball to 10 feet, 275-lb deadlift, 30-inch box`,
    blocks: [
      rounds(5, [
        mv("row", meters(440)),
        mv("box-jump", reps(10), { note: "30/24-inch box" }),
        mv("deadlift", reps(10), bb(275, 185)),
        mv("wall-ball", reps(10), ball(30, 20), { note: "to 10/9 ft" }),
      ]),
    ],
  }),
  hero({
    name: "Kerrie",
    firstPosted: "2020-12-10",
    vest: { lb: [20, 14], optional: false },
    posted: `Wearing a weight vest, 10 rounds for time of:
100-meter sprint
5 burpees
20 sit-ups
15 push-ups
100-meter sprint
Rest 2 minutes`,
    blocks: [
      rounds(
        10,
        [
          mv("run", meters(100), { note: "sprint" }),
          mv("burpee", reps(5)),
          mv("sit-up", reps(20)),
          mv("push-up", reps(15)),
          mv("run", meters(100), { note: "sprint" }),
        ],
        { restSeconds: 120, intents: ["Wearing a weight vest.", "Rest 2 minutes."] },
      ),
    ],
  }),
  hero({
    name: "Martin",
    firstPosted: "2021-01-24",
    team: 2,
    posted: `For time, with a partner:
2,000-meter row
100 bodyweight deadlifts
50 thrusters (65/95 lb)
1,000-meter row
100 hand-release push-ups
50 pull-ups
500-meter row
100 sit-ups
100 wall-ball shots (14/20 lb)`,
    blocks: [
      forTime([
        mv("row", meters(2000)),
        mv("deadlift", reps(100), { note: "bodyweight" }),
        mv("thruster", reps(50), bb(95, 65)),
        mv("row", meters(1000)),
        mv("hand-release-push-up", reps(100)),
        mv("pull-up", reps(50)),
        mv("row", meters(500)),
        mv("sit-up", reps(100)),
        mv("wall-ball", reps(100), ball(20, 14)),
      ]),
    ],
  }),
  hero({
    name: "Laura",
    firstPosted: "2021-02-13",
    team: 2,
    posted: `With a partner, complete as many rounds as possible in 21 minutes of:
30-calorie row
20 burpees over the rower
10 power cleans
♀ 105 lb
♂ 155 lb`,
    blocks: [
      amrap(21, [
        mv("row", cal(30)),
        mv("burpee-over-rower", reps(20)),
        mv("power-clean", reps(10), bb(155, 105)),
      ]),
    ],
  }),
  hero({
    name: "Lorenzo",
    firstPosted: "2021-02-20",
    posted: `For time:
Run 1,000 meters
Then,
5 rounds of:
15 push-ups
20 medicine-ball cleans
21 burpees
Then,
Run 1,000 meters`,
    blocks: [
      forTime([mv("run", meters(1000))]),
      rounds(5, [
        mv("push-up", reps(15)),
        mv("medicine-ball-clean", reps(20)),
        mv("burpee", reps(21)),
      ]),
      forTime([mv("run", meters(1000))]),
    ],
  }),
  hero({
    name: "Peyton",
    firstPosted: "2021-07-03",
    posted: `Complete as many rounds as possible in 20 minutes of:
10 chest-to-bar pull-ups
10 dumbbell thrusters, 35/50 lb
Stop and perform 40 double-unders every 2 minutes, including at 0:00.
Then, at the 20:00 mark, complete a 2-mile run.
Post rounds of the AMRAP and run time to comments.`,
    blocks: [
      amrap(
        20,
        [
          mv("chest-to-bar-pull-up", reps(10)),
          mv("dumbbell-thruster", reps(10), db(50, 35)),
          mv("double-under", reps(40), { note: "every 2 minutes, including at 0:00" }),
        ],
        {
          intents: [
            "Stop and perform 40 double-unders every 2 minutes, including at 0:00.",
            "Post rounds of the AMRAP and run time to comments.",
          ],
        },
      ),
      forTime([mv("run", miles(2))], {
        title: "At 20:00, 2-mile run for time",
        intents: ["Then, at the 20:00 mark, complete a 2-mile run."],
      }),
    ],
  }),
  hero({
    name: "Maxton",
    firstPosted: "2021-11-11",
    vest: { lb: [20, 14], optional: false },
    posted: `With a weight vest, 13 rounds for time of:
8 strict pull-ups
26 box step-ups
21 burpees
♀ 14-lb vest, 20-inch box
♂ 20-lb vest, 24-inch box`,
    blocks: [
      rounds(
        13,
        [
          mv("strict-pull-up", reps(8)),
          mv("box-step-up", reps(26), { note: "24/20-inch box" }),
          mv("burpee", reps(21)),
        ],
        { intents: ["With a weight vest."] },
      ),
    ],
  }),
  hero({
    name: "Eva Strong",
    firstPosted: "2022-06-18",
    team: 2,
    posted: `With a partner, 5 rounds for time of:
24 double-unders (each)
19 toes-to-bars (total)
2 clean and jerks (total)
400-meter run (together)
♀ 135 lb
♂ 205 lb`,
    blocks: [
      rounds(5, [
        mv("double-under", reps(24), { note: "each" }),
        mv("toes-to-bar", reps(19), { note: "total" }),
        mv("clean-and-jerk", reps(2), bb(205, 135), { note: "total" }),
        mv("run", meters(400), { note: "together" }),
      ]),
    ],
  }),
  hero({
    name: "CHAD1000X",
    firstPosted: "2023-11-11",
    posted: `For time:
1,000 weighted box step-ups
♀ 35-lb ruck, 20-inch box
♂ 45-lb ruck, 20-inch box`,
    blocks: [
      forTime([
        mv("dumbbell-box-step-up", reps(1000), object(45, 35), { note: "ruck, 20-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "TPT9000",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
100-meter run
Then, 9 rounds of:
8 burpees
26 kettlebell swings
21 wall-ball shots
100-meter run
♀ 35-lb kettlebell, 14-lb medicine ball to 9-foot target
♂ 44-lb kettlebell, 20-lb medicine ball to 10-foot target
If you have a 14-/20-lb weight vest, wear it.`,
    blocks: [
      forTime([mv("run", meters(100))], {
        intents: ["If you have a 14-/20-lb weight vest, wear it."],
      }),
      rounds(9, [
        mv("burpee", reps(8)),
        mv("kettlebell-swing", reps(26), kb(44, 35)),
        mv("wall-ball", reps(21), ball(20, 14), { note: "to 10/9 ft" }),
        mv("run", meters(100)),
      ]),
    ],
  }),
  hero({
    name: "Garbo",
    posted: `On a 21-minute clock:
400-meter run
Then, as many rounds and reps as possible of:
10 hand-release push-ups
4 strict pull-ups
20 kettlebell swings
10 kettlebell goblet squats
♀ 35-lb kettlebell
♂ 53-lb kettlebell`,
    blocks: [
      forTime([mv("run", meters(400))], { title: "On a 21-minute clock" }),
      block("amrap", {}, "Then, AMRAP in the remaining time", [
        mv("hand-release-push-up", reps(10)),
        mv("strict-pull-up", reps(4)),
        mv("kettlebell-swing", reps(20), kb(53, 35)),
        mv("goblet-squat", reps(10), kb(53, 35)),
      ]),
    ],
  }),
  hero({
    name: "McCartney",
    team: 3,
    posted: `For time in teams of 3:
2,000-meter row
14 dumbbell thrusters
34 kettlebell swings
484 double-unders
108 burpees
2,000-meter row
18 deadlifts
♀ 35-lb dumbbells, 53-lb kettlebell, 155-lb deadlifts
♂ 50-lb dumbbells, 70-lb kettlebell, 225-lb deadlifts`,
    blocks: [
      forTime([
        mv("row", meters(2000)),
        mv("dumbbell-thruster", reps(14), db(50, 35)),
        mv("kettlebell-swing", reps(34), kb(70, 53)),
        mv("double-under", reps(484)),
        mv("burpee", reps(108)),
        mv("row", meters(2000)),
        mv("deadlift", reps(18), bb(225, 155)),
      ]),
    ],
  }),
  hero({
    name: "Wesley",
    posted: `On a 35-minute clock:
800-meter run
Then, as many rounds and reps as possible of:
8 box jumps
6 strict pull-ups
21-yard walking lunge with a 45-lb plate overhead`,
    blocks: [
      forTime([mv("run", meters(800))], { title: "On a 35-minute clock" }),
      block("amrap", {}, "Then, AMRAP in the remaining time", [
        mv("box-jump", reps(8)),
        mv("strict-pull-up", reps(6)),
        mv("overhead-walking-lunge", yards(21), plate(45)),
      ]),
    ],
  }),
  hero({
    name: "Hammy",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
1,200-meter run
80 box step-overs
40 hand-release push-ups
800-meter run
40 burpees to target
20 strict pull-ups
400-meter run
20 burpee box jumps
10 ring muscle-ups
400-meter run
40 burpees to target
20 strict pull-ups
800-meter run
80 box step-overs
40 hand-release push-ups
1,200-meter run
If you have a 14-/20-lb weight vest, wear it for as much of the workout as possible.
♀ 20-inch box, 6-inch target for burpees
♂ 24-inch box, 6-inch target for burpees`,
    blocks: [
      forTime(
        [
          mv("run", meters(1200)),
          mv("box-step-over", reps(80), { note: "24/20-inch box" }),
          mv("hand-release-push-up", reps(40)),
          mv("run", meters(800)),
          mv("burpee-to-target", reps(40), { note: "6-inch target" }),
          mv("strict-pull-up", reps(20)),
          mv("run", meters(400)),
          mv("burpee-box-jump", reps(20), { note: "24/20-inch box" }),
          mv("ring-muscle-up", reps(10)),
          mv("run", meters(400)),
          mv("burpee-to-target", reps(40), { note: "6-inch target" }),
          mv("strict-pull-up", reps(20)),
          mv("run", meters(800)),
          mv("box-step-over", reps(80), { note: "24/20-inch box" }),
          mv("hand-release-push-up", reps(40)),
          mv("run", meters(1200)),
        ],
        {
          intents: [
            "If you have a 14-/20-lb weight vest, wear it for as much of the workout as possible.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Triple Deuce",
    posted: `As many rounds and reps as possible in 20 minutes of:
22 burpees
22 air squats
22 pull-ups
22 sandbag ground-to-over-the-shoulders
722-meter sprint
♀ 40-lb sandbag
♂ 60-lb sandbag`,
    blocks: [
      amrap(20, [
        mv("burpee", reps(22)),
        mv("air-squat", reps(22)),
        mv("pull-up", reps(22)),
        mv("sandbag-to-shoulder", reps(22), object(60, 40)),
        mv("run", meters(722), { note: "sprint" }),
      ]),
    ],
  }),
  hero({
    name: "K27",
    posted: `27 rounds for time of:
5 hang power cleans
5 burpees
15 double-unders
♀ 105 lb
♂ 185 lb`,
    blocks: [
      rounds(27, [
        mv("hang-power-clean", reps(5), bb(185, 105)),
        mv("burpee", reps(5)),
        mv("double-under", reps(15)),
      ]),
    ],
  }),
  hero({
    name: "Buriak",
    posted: `As many rounds and reps as possible in 20 minutes of:
5 squat cleans
10 burpees over the bar
15 pull-ups
200-meter run
♀ 135 lb
♂ 155 lb`,
    blocks: [
      amrap(20, [
        mv("clean", reps(5), bb(155, 135)),
        mv("bar-facing-burpee", reps(10)),
        mv("pull-up", reps(15)),
        mv("run", meters(200)),
      ]),
    ],
  }),
  hero({
    name: "ODA 7313",
    vest: { lb: [14, 10], optional: false },
    posted: `7 rounds for time of:
300-meter jog
10 left-arm dumbbell thrusters
10 right-arm dumbbell thrusters
7 strict pull-ups
Wear a 10-14-lb weight vest.
♀ 20 lb
♂ 30 lb`,
    blocks: [
      rounds(
        7,
        [
          mv("run", meters(300), { note: "jog" }),
          mv("dumbbell-thruster", reps(10), db(30, 20), { note: "left arm" }),
          mv("dumbbell-thruster", reps(10), db(30, 20), { note: "right arm" }),
          mv("strict-pull-up", reps(7)),
        ],
        { intents: ["Wear a 10-14-lb weight vest."] },
      ),
    ],
  }),
  hero({
    name: "Goose",
    team: 2,
    posted: `For time with a partner:
106 deadlifts
Then, 7 rounds of:
3 rope climbs
15 thrusters
15 kettlebell swings
Then, 400-meter run with a plate (Both partners carry a plate.)
♀ 95-lb barbell, 15-foot rope, 53-lb kettlebell, 25-lb plate
♂ 135-lb barbell, 15-foot rope, 70-lb kettlebell, 45-lb plate`,
    blocks: [
      forTime([mv("deadlift", reps(106), bb(135, 95))]),
      rounds(7, [
        mv("rope-climb", reps(3), { note: "15-foot rope" }),
        mv("thruster", reps(15), bb(135, 95)),
        mv("kettlebell-swing", reps(15), kb(70, 53)),
      ]),
      forTime([mv("run", meters(400), plate(45, 25), { note: "carrying a plate" })], {
        intents: ["Both partners carry a plate."],
      }),
    ],
  }),
  hero({
    name: "Pikey",
    posted: `For time:
Run 400 meters
12 burpee bar muscle-ups
15 squat snatches
Run 800 meters
12 burpee bar muscle-ups
20 clean and jerks
Run 800 meters
12 burpee bar muscle-ups
18 thrusters
Run 400 meters
♀ 105-lb barbell
♂ 155-lb barbell`,
    blocks: [
      forTime([
        mv("run", meters(400)),
        mv("burpee-bar-muscle-up", reps(12)),
        mv("snatch", reps(15), bb(155, 105)),
        mv("run", meters(800)),
        mv("burpee-bar-muscle-up", reps(12)),
        mv("clean-and-jerk", reps(20), bb(155, 105)),
        mv("run", meters(800)),
        mv("burpee-bar-muscle-up", reps(12)),
        mv("thruster", reps(18), bb(155, 105)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Gale Force",
    posted: `As many rounds and reps as possible in 30 minutes of:
20 box step-ups with a weighted backpack
23 burpees-over-backpack
19 air squats
When 30 minutes have elapsed, complete one more set of 19 squats together as a group.
♀ 35-lb backpack, 20-inch box
♂ 50-lb backpack, 24-inch box`,
    blocks: [
      amrap(
        30,
        [
          mv("dumbbell-box-step-up", reps(20), object(50, 35), {
            note: "weighted backpack, 24/20-inch box",
          }),
          mv("burpee", reps(23), { note: "over the backpack" }),
          mv("air-squat", reps(19)),
        ],
        {
          intents: [
            "When 30 minutes have elapsed, complete one more set of 19 squats together as a group.",
          ],
        },
      ),
      block("other", {}, "Then, 19 squats together as a group", [mv("air-squat", reps(19))]),
    ],
  }),
  hero({
    name: "Northrup",
    posted: `For time:
26 barbell back-rack step-ups
Then, 3 rounds of:
17 power cleans
19 sit-ups
21 deadlifts
Then, 31-calorie row
♀ 20-inch box, 65-lb barbell
♂ 24-inch box, 95-lb barbell`,
    blocks: [
      forTime([mv("barbell-step-up", reps(26), bb(95, 65), { note: "back rack, 24/20-inch box" })]),
      rounds(3, [
        mv("power-clean", reps(17), bb(95, 65)),
        mv("sit-up", reps(19)),
        mv("deadlift", reps(21), bb(95, 65)),
      ]),
      forTime([mv("row", cal(31))]),
    ],
  }),
  hero({
    name: "Fern",
    timeCapMinutes: 60,
    vest: { lb: [20, 14], optional: false },
    posted: `With a 60-minute time cap:
For time:
2-mile run
Then 9 rounds of:
20-calorie row
20 burpees
Then 3 rounds for time of
30 push-ups
30 pull-ups
30 burpees
♀ Wear a 14-lb weight vest
♂ Wear a 20-lb weight vest`,
    blocks: [
      forTime([mv("run", miles(2))], { intents: ["Wear a 20/14-lb weight vest."] }),
      rounds(9, [mv("row", cal(20)), mv("burpee", reps(20))]),
      rounds(3, [mv("push-up", reps(30)), mv("pull-up", reps(30)), mv("burpee", reps(30))]),
    ],
  }),
  hero({
    name: "Finseth",
    scoring: "reps",
    posted: `On an 18-minute clock for reps:
83 wall-ball shots
Then, as many rounds and reps as possible of:
2 power cleans
18 push-ups
24 double-unders
♀ 14-lb medicine ball to 9 feet, 125-lb barbell
♂ 20-lb medicine ball to 10 feet, 185-lb barbell`,
    blocks: [
      forTime([mv("wall-ball", reps(83), ball(20, 14), { note: "to 10/9 ft" })], {
        title: "On an 18-minute clock for reps",
      }),
      block("amrap", {}, "Then, AMRAP in the remaining time", [
        mv("power-clean", reps(2), bb(185, 125)),
        mv("push-up", reps(18)),
        mv("double-under", reps(24)),
      ]),
    ],
  }),
  hero({
    name: "Gage",
    posted: `For time:
1,996-meter row
Then, 3 rounds of:
12 power cleans
11 back squats
3 rope climbs to 15 feet
27 burpees
Then, 2,024-meter row
♀ 105-lb barbell,
♂ 155-lb barbell,`,
    blocks: [
      forTime([mv("row", meters(1996))]),
      rounds(3, [
        mv("power-clean", reps(12), bb(155, 105)),
        mv("back-squat", reps(11), bb(155, 105)),
        mv("rope-climb", reps(3), { note: "to 15 feet" }),
        mv("burpee", reps(27)),
      ]),
      forTime([mv("row", meters(2024))]),
    ],
  }),
  hero({
    name: "Josh-O",
    team: 2,
    posted: `For time with a partner:
400-meter run
2 rounds of:
44 dumbbell front squats
44 dumbbell floor presses
44 dumbbell hang clean and jerks
Then,
1,979-meter row
2 rounds of:
44 dumbbell deadlifts
44 dumbbell bent-over rows
44 dumbbell lunges
Then,
400-meter Run
Run together and split all other work as needed. Use two dumbbells.
♀ 35-lb dumbbells
♂ 50-lb dumbbells`,
    blocks: [
      forTime([mv("run", meters(400))], {
        intents: ["Run together and split all other work as needed.", "Use two dumbbells."],
      }),
      rounds(2, [
        mv("dumbbell-front-squat", reps(44), db(50, 35)),
        mv("dumbbell-floor-press", reps(44), db(50, 35)),
        mv("dumbbell-clean-and-jerk", reps(44), db(50, 35), { note: "hang" }),
      ]),
      forTime([mv("row", meters(1979))]),
      rounds(2, [
        mv("dumbbell-deadlift", reps(44), db(50, 35)),
        mv("dumbbell-row", reps(44), db(50, 35)),
        mv("dumbbell-walking-lunge", reps(44), db(50, 35)),
      ]),
      forTime([mv("run", meters(400))]),
    ],
  }),
  hero({
    name: "Whitt",
    posted: `3 rounds for time:
800-meter run with medicine ball
30 wall-ball shots
30 ball slams with medicine ball
♀ 20-lb medicine ball
♂ 30-lb medicine ball`,
    blocks: [
      rounds(3, [
        mv("run", meters(800), ball(30, 20), { note: "carrying a medicine ball" }),
        mv("wall-ball", reps(30), ball(30, 20)),
        mv("ball-slam", reps(30), ball(30, 20)),
      ]),
    ],
  }),
  hero({
    name: "Ryan SO",
    vest: { lb: [20, 14], optional: false },
    posted: `For time:
1,600-meter run
Then,
4 rounds of:
9 power cleans
2 strict pull-ups
14 burpees
Then,
3 rounds of:
13 box jumps
13 push-ups
50 double-unders
Then,
1,600-meter run
♀ 14-lb weight vest for run, 95-lb barbell, 20-inch box
♂ 20-lb weight vest for run, 135-lb barbell, 24-inch box`,
    blocks: [
      forTime([mv("run", meters(1600), { note: "weight vest" })], {
        intents: ["Wear a 20/14-lb weight vest for the runs."],
      }),
      rounds(4, [
        mv("power-clean", reps(9), bb(135, 95)),
        mv("strict-pull-up", reps(2)),
        mv("burpee", reps(14)),
      ]),
      rounds(3, [
        mv("box-jump", reps(13), { note: "24/20-inch box" }),
        mv("push-up", reps(13)),
        mv("double-under", reps(50)),
      ]),
      forTime([mv("run", meters(1600), { note: "weight vest" })]),
    ],
  }),
  hero({
    name: "Hoover",
    posted: `8 rounds for time of:
Run 400 meters
15 burpee box jump-overs
10-calorie bike
6 alternating dumbbell snatches
♀ 20-inch box, 50-lb dumbbell
♂ 24-inch box, 75-lb dumbbell`,
    blocks: [
      rounds(8, [
        mv("run", meters(400)),
        mv("burpee-box-jump-over", reps(15), { note: "24/20-inch box" }),
        mv("bike", cal(10)),
        mv("dumbbell-snatch", reps(6), db(75, 50), { note: "alternating" }),
      ]),
    ],
  }),
  hero({
    name: "City 100",
    team: 2,
    posted: `For time with a partner:
31 shuttle runs (7 meters down, 7 meters back)
Then,
10 rounds for time of:
7 deadlifts
7 hang power cleans
7-meter overhead walking lunge
♀ 105-lb barbell
♂ 155-lb barbell
One partner must hold a barbell in the front rack while the other partner performs an entire round of the complex. Upon finishing the round, switch stations.`,
    blocks: [
      forTime([mv("shuttle-run", reps(31), { note: "7 meters down, 7 meters back" })]),
      rounds(
        10,
        [
          mv("deadlift", reps(7), bb(155, 105)),
          mv("hang-power-clean", reps(7), bb(155, 105)),
          mv("overhead-walking-lunge", meters(7), bb(155, 105)),
        ],
        {
          intents: [
            "One partner must hold a barbell in the front rack while the other partner performs an entire round of the complex.",
            "Upon finishing the round, switch stations.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Alec",
    posted: `For time:
3 rounds of:
8 burpees
28 air squats
9 push-ups
Then,
Run 1,000 meters
25 over-the-shoulder sandbag cleans
Run 1,000 meters
Then,
5 rounds of:
10 deadlifts
14 box jumps
10 burpees
♀ 75-lb sandbag, 155-lb deadlifts, 20-inch box
♂ 100-lb sandbag, 225-lb deadlifts, 24-inch box`,
    blocks: [
      rounds(3, [mv("burpee", reps(8)), mv("air-squat", reps(28)), mv("push-up", reps(9))]),
      forTime([
        mv("run", meters(1000)),
        mv("sandbag-to-shoulder", reps(25), object(100, 75), { note: "over-the-shoulder clean" }),
        mv("run", meters(1000)),
      ]),
      rounds(5, [
        mv("deadlift", reps(10), bb(225, 155)),
        mv("box-jump", reps(14), { note: "24/20-inch box" }),
        mv("burpee", reps(10)),
      ]),
    ],
  }),
  hero({
    name: "Muller",
    posted: `For time:
Run 1,000 meters
710-meter plate carry
Then,
5 rounds of:
13 burpee pull-ups
13 deadlifts
Then,
710-meter plate carry
Run 1,000 meters
♀ 25-lb plate, 155-lb deadlifts
♂ 45-lb plate, 225-lb deadlifts`,
    blocks: [
      forTime([mv("run", meters(1000)), mv("plate-carry", meters(710), plate(45, 25))]),
      rounds(5, [mv("burpee-pull-up", reps(13)), mv("deadlift", reps(13), bb(225, 155))]),
      forTime([mv("plate-carry", meters(710), plate(45, 25)), mv("run", meters(1000))]),
    ],
  }),
  hero({
    name: "Dominic J. Hall",
    scoring: "reps",
    vest: { lb: [20, 14], optional: false },
    posted: `On a running clock:
From 0:00-12:23:
Max-reps box step-ups
From 12:23-15:00:
Rest
From 15:00-48:00:
As many reps as possible of:
9 deadlifts
400-m run
22 push-ups
♀ Wear a 14-lb vest, 20-inch box, 185-lb deadlifts
♂ Wear a 20-lb vest, 20-inch box, 275-lb deadlifts`,
    blocks: [
      block(
        "amrap",
        { durationSeconds: 743 },
        "From 0:00-12:23",
        [mv("box-step-up", { note: "max reps, 20-inch box" })],
        { intents: ["On a running clock.", "Wear a 20/14-lb vest."] },
      ),
      rest(157),
      amrap(
        33,
        [mv("deadlift", reps(9), bb(275, 185)), mv("run", meters(400)), mv("push-up", reps(22))],
        { title: "From 15:00-48:00" },
      ),
    ],
  }),
  hero({
    name: "Jonathon Farmer",
    posted: `For time:
1,500-meter row
Then,
2 rounds of:
53 push-ups
11 pull-ups
5 shoulder presses
100-meter farmers carry
50-meter sled push
300-meter sprint
Then,
1,500-meter row
♀ 95-lb shoulder press, 35-lb farmers carry, 45-lb sled push
♂ 135-lb shoulder press, 70-lb farmers carry, 90-lb sled push`,
    blocks: [
      forTime([mv("row", meters(1500))]),
      rounds(2, [
        mv("push-up", reps(53)),
        mv("pull-up", reps(11)),
        mv("strict-press", reps(5), bb(135, 95)),
        mv("farmers-carry", meters(100), object(70, 35)),
        mv("sled-push", meters(50), object(90, 45)),
        mv("run", meters(300), { note: "sprint" }),
      ]),
      forTime([mv("row", meters(1500))]),
    ],
  }),
  hero({
    name: "Ryan Comas",
    team: 3,
    posted: `For time as a 3-person team:
1,065-foot versa climb or 1,065-meter row or ski
Then,
10 rounds of:
13 deadlifts
13 pull-ups
13-calorie row
13 back squats
13 burpees
Then,
1,065-foot versa climb or 1,065-meter row or ski
♀ 165-lb barbell
♂ 225-lb barbell`,
    blocks: [
      forTime([
        mv("versaclimber", feet(1065), {
          or: [mv("row", meters(1065)), mv("ski-erg", meters(1065))],
        }),
      ]),
      rounds(10, [
        mv("deadlift", reps(13), bb(225, 165)),
        mv("pull-up", reps(13)),
        mv("row", cal(13)),
        mv("back-squat", reps(13), bb(225, 165)),
        mv("burpee", reps(13)),
      ]),
      forTime([
        mv("versaclimber", feet(1065), {
          or: [mv("row", meters(1065)), mv("ski-erg", meters(1065))],
        }),
      ]),
    ],
  }),
  hero({
    name: "Timothy Helton",
    team: 3,
    posted: `For time, as a 3-person team:
2,364-meter row
Then,
10 rounds of:
49 wall-ball shots
26 pull-ups
200-meter run
8 ring muscle-ups
40 deadlifts
Then,
On a 10-minute clock:
Build to a heavy single back squat for each team member.
Clock begins immediately upon completion of the 10 rounds.
♀ 14-lb medicine ball to 9 feet, 105-lb deadlift
♂ 20-lb medicine ball to 10 feet, 155-lb deadlift`,
    blocks: [
      forTime([mv("row", meters(2364))]),
      rounds(10, [
        mv("wall-ball", reps(49), ball(20, 14), { note: "to 10/9 ft" }),
        mv("pull-up", reps(26)),
        mv("run", meters(200)),
        mv("ring-muscle-up", reps(8)),
        mv("deadlift", reps(40), bb(155, 105)),
      ]),
      block(
        "strength",
        { durationSeconds: 600 },
        "On a 10-minute clock: heavy single back squat",
        [mv("back-squat", reps(1), { note: "each team member" })],
        {
          intents: [
            "Build to a heavy single back squat for each team member.",
            "Clock begins immediately upon completion of the 10 rounds.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Topsy",
    firstPosted: "2016-10-23",
    posted: `Complete as many rounds and reps as possible in 25 minutes of:
3 ring muscle-ups
8 thrusters
17-calorie row
♀ 75 lb
♂ 115 lb`,
    blocks: [
      amrap(25, [
        mv("ring-muscle-up", reps(3)),
        mv("thruster", reps(8), bb(115, 75)),
        mv("row", cal(17)),
      ]),
    ],
  }),
  hero({
    name: "Locke",
    posted: `For time:
565-meter row or run
Then,
7 rounds
9 deadlifts
25 push-ups
21 box step-ups
Then,
565-meter row or run
♀ 125 lb, 20-inch box
♂ 185 lb, 24-inch box`,
    blocks: [
      forTime([mv("row", meters(565), { or: [mv("run", meters(565))] })]),
      rounds(7, [
        mv("deadlift", reps(9), bb(185, 125)),
        mv("push-up", reps(25)),
        mv("box-step-up", reps(21), { note: "24/20-inch box" }),
      ]),
      forTime([mv("row", meters(565), { or: [mv("run", meters(565))] })]),
    ],
  }),
  hero({
    name: "Estrada",
    posted: `100 box step-ups with a weighted backpack
Then,
3 rounds of:
800-meter run
17-calorie bike
25 front squats
♀ 35-lb backpack, 20-inch box, 135 lb front squats
♂ 50-lb backpack, 20-inch box, 185 lb front squats`,
    blocks: [
      forTime([
        mv("dumbbell-box-step-up", reps(100), object(50, 35), {
          note: "weighted backpack, 20-inch box",
        }),
      ]),
      rounds(3, [
        mv("run", meters(800)),
        mv("bike", cal(17)),
        mv("front-squat", reps(25), bb(185, 135)),
      ]),
    ],
  }),
  hero({
    name: "Leehan",
    posted: `7 rounds for time of:
6 deadlifts
6 air squats
6 box jumps (20/24 inches)
Add 6 reps to each movement after every round.
Then, 1,742-meter row
♀ 125 lb, 20-inch box,
♂ 185 lb, 24-inch box,`,
    blocks: [
      ladder(
        [6, 12, 18, 24, 30, 36, 42],
        [mv("deadlift", bb(185, 125)), mv("air-squat"), mv("box-jump", { note: "24/20-inch box" })],
        {
          title: "7 rounds for time",
          intents: ["Add 6 reps to each movement after every round."],
        },
      ),
      forTime([mv("row", meters(1742))]),
    ],
  }),
  hero({
    name: "Nunez",
    posted: `For time:
800m run
60 burpee box jump overs
50 pull-ups
40 squats (weight 1)
600m run
30 burpee box jump overs
25 chest-to-bar pull-ups
20 squats (weight 2)
400m run
15 burpee box jump overs
12 bar muscle-ups
10 squat cleans (weight 3)
♀ 20 inch box, 65 - 125 - 155 lb. squats
♂ 20 inch box, 95 - 185 - 225 lb. squats`,
    blocks: [
      forTime([
        mv("run", meters(800)),
        mv("burpee-box-jump-over", reps(60), { note: "20-inch box" }),
        mv("pull-up", reps(50)),
        mv("back-squat", reps(40), bb(95, 65), { note: "squats, weight 1" }),
        mv("run", meters(600)),
        mv("burpee-box-jump-over", reps(30), { note: "20-inch box" }),
        mv("chest-to-bar-pull-up", reps(25)),
        mv("back-squat", reps(20), bb(185, 125), { note: "squats, weight 2" }),
        mv("run", meters(400)),
        mv("burpee-box-jump-over", reps(15), { note: "20-inch box" }),
        mv("bar-muscle-up", reps(12)),
        mv("clean", reps(10), bb(225, 155), { note: "weight 3" }),
      ]),
    ],
  }),
  hero({
    name: "Drew",
    vest: { lb: [20, 14], optional: false },
    posted: `For time, all with a weight vest: (Each round honors one of the heroes who died in the helicopter crash.)
Kraus: 200-meter run, 30 pull-ups, 30 hand-release push-ups, 4 deadlifts*
Rest 30 seconds
Scott: 400-meter run, 25 pull-ups, 25 hand-release push-ups, 4 deadlifts*
Rest 30 seconds
Good: 600-meter run, 20 pull-ups, 20 hand-release push-ups, 4 deadlifts*
Rest 30 seconds
Cully: 800-meter run, 15 pull-ups, 15 hand-release push-ups, 4 deadlifts*
Rest 30 seconds
Night Stalkers: 269 step-ups
*Prescribed weight for deadlifts is 1.5 times bodyweight.`,
    blocks: [
      forTime(
        [
          mv("run", meters(200)),
          mv("pull-up", reps(30)),
          mv("hand-release-push-up", reps(30)),
          mv("deadlift", reps(4), { note: "1.5 × bodyweight" }),
        ],
        {
          title: "Kraus",
          intents: [
            "All with a weight vest.",
            "Each round honors one of the heroes who died in the helicopter crash.",
            "Prescribed weight for deadlifts is 1.5 times bodyweight.",
          ],
        },
      ),
      rest(30),
      forTime(
        [
          mv("run", meters(400)),
          mv("pull-up", reps(25)),
          mv("hand-release-push-up", reps(25)),
          mv("deadlift", reps(4), { note: "1.5 × bodyweight" }),
        ],
        { title: "Scott" },
      ),
      rest(30),
      forTime(
        [
          mv("run", meters(600)),
          mv("pull-up", reps(20)),
          mv("hand-release-push-up", reps(20)),
          mv("deadlift", reps(4), { note: "1.5 × bodyweight" }),
        ],
        { title: "Good" },
      ),
      rest(30),
      forTime(
        [
          mv("run", meters(800)),
          mv("pull-up", reps(15)),
          mv("hand-release-push-up", reps(15)),
          mv("deadlift", reps(4), { note: "1.5 × bodyweight" }),
        ],
        { title: "Cully" },
      ),
      rest(30),
      forTime([mv("box-step-up", reps(269))], { title: "Night Stalkers" }),
    ],
  }),
  hero({
    name: "Maloney",
    posted: `6 rounds for time of:
300-meter shuttle run (50-meters out and back x 6, 100-meters out and back x 3)
16 deadlifts
6 hang power cleans
♀ 125 lb
♂ 185 lb
Rest 2 minutes between sets.`,
    blocks: [
      rounds(
        6,
        [
          mv("shuttle-run", meters(300), {
            note: "50 m out and back × 6, 100 m out and back × 3",
          }),
          mv("deadlift", reps(16), bb(185, 125)),
          mv("hang-power-clean", reps(6), bb(185, 125)),
        ],
        { restSeconds: 120, intents: ["Rest 2 minutes between sets."] },
      ),
    ],
  }),
  hero({
    name: "Jack’s Triangle",
    firstPosted: "2026-03-06",
    scoring: "reps",
    posted: `On a 23:00 clock, for total reps:
Minutes 0:00-2:00
Max deadlifts (155/225 lb)
Minutes 2:00-21:00
As many rounds and reps as possible in 19 minutes of:
4 strict pull-ups
11 box jumps
13 hand-release push-ups
23-calorie bike
Minutes 21:00-23:00
Max deadlifts
♀ 155-lb barbell, 24-inch box
♂ 225-lb barbell, 30-inch box`,
    blocks: [
      block(
        "amrap",
        { durationSeconds: 120 },
        "Minutes 0:00-2:00",
        [mv("deadlift", bb(225, 155), { note: "max reps" })],
        { intents: ["On a 23:00 clock, for total reps."] },
      ),
      amrap(
        19,
        [
          mv("strict-pull-up", reps(4)),
          mv("box-jump", reps(11), { note: "30/24-inch box" }),
          mv("hand-release-push-up", reps(13)),
          mv("bike", cal(23)),
        ],
        { title: "Minutes 2:00-21:00" },
      ),
      block("amrap", { durationSeconds: 120 }, "Minutes 21:00-23:00", [
        mv("deadlift", bb(225, 155), { note: "max reps" }),
      ]),
    ],
  }),
];
