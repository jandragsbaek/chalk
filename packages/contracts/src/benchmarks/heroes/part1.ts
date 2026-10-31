import {
  amrap,
  ball,
  bb,
  db,
  feet,
  forTime,
  hero,
  kb,
  km,
  ladder,
  meters,
  miles,
  mv,
  object,
  plate,
  reps,
  rounds,
  yards,
} from "../dsl.ts";
import type { Benchmark } from "../model.ts";

/** Hero workouts, part 1 of the official list in posting order. */
export const HEROES_1: ReadonlyArray<Benchmark> = [
  hero({
    name: "JT",
    firstPosted: "2005-07-06",
    posted: `21-15-9 reps for time of:
Handstand push-ups
Ring dips
Push-ups`,
    blocks: [ladder([21, 15, 9], [mv("handstand-push-up"), mv("ring-dip"), mv("push-up")])],
  }),
  hero({
    name: "Michael",
    firstPosted: "2005-07-15",
    posted: `3 rounds for time of:
Run 800 meters
50 back extensions
50 sit-ups`,
    blocks: [
      rounds(3, [mv("run", meters(800)), mv("back-extension", reps(50)), mv("sit-up", reps(50))]),
    ],
  }),
  hero({
    name: "Murph",
    firstPosted: "2005-08-18",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
1-mile run
100 pull-ups
200 push-ups
300 squats
1-mile run
Partition the pull-ups, push-ups, and squats as needed. Start and finish with a mile run. If you’ve got a 20-lb vest or body armor, wear it.`,
    blocks: [
      forTime(
        [
          mv("run", miles(1)),
          mv("pull-up", reps(100)),
          mv("push-up", reps(200)),
          mv("air-squat", reps(300)),
          mv("run", miles(1)),
        ],
        {
          intents: [
            "Partition the pull-ups, push-ups, and squats as needed.",
            "Start and finish with a mile run.",
            "If you’ve got a 20-lb vest or body armor, wear it.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Daniel",
    firstPosted: "2006-06-15",
    posted: `For time:
50 pull-ups
400-meter run
21 thrusters
800-meter run
21 thrusters
400-meter run
50 pull-ups
♀ 65 lb
♂ 95 lb`,
    blocks: [
      forTime([
        mv("pull-up", reps(50)),
        mv("run", meters(400)),
        mv("thruster", reps(21), bb(95, 65)),
        mv("run", meters(800)),
        mv("thruster", reps(21), bb(95, 65)),
        mv("run", meters(400)),
        mv("pull-up", reps(50)),
      ]),
    ],
  }),
  hero({
    name: "Josh",
    firstPosted: "2007-02-26",
    posted: `For time:
21 overhead squats
42 pull-ups
15 overhead squats
30 pull-ups
9 overhead squats
18 pull-ups
♀ 65 lb
♂ 95 lb`,
    blocks: [
      forTime([
        mv("overhead-squat", reps(21), bb(95, 65)),
        mv("pull-up", reps(42)),
        mv("overhead-squat", reps(15), bb(95, 65)),
        mv("pull-up", reps(30)),
        mv("overhead-squat", reps(9), bb(95, 65)),
        mv("pull-up", reps(18)),
      ]),
    ],
  }),
  hero({
    name: "Jason",
    firstPosted: "2007-08-02",
    posted: `For time:
100 squats
5 muscle-ups
75 squats
10 muscle-ups
50 squats
15 muscle-ups
25 squats
20 muscle-ups`,
    blocks: [
      forTime([
        mv("air-squat", reps(100)),
        mv("ring-muscle-up", reps(5)),
        mv("air-squat", reps(75)),
        mv("ring-muscle-up", reps(10)),
        mv("air-squat", reps(50)),
        mv("ring-muscle-up", reps(15)),
        mv("air-squat", reps(25)),
        mv("ring-muscle-up", reps(20)),
      ]),
    ],
  }),
  hero({
    name: "Badger",
    firstPosted: "2007-12-19",
    posted: `3 rounds for time of:
30 squat cleans
30 pull-ups
Run 800 meters
♀ 65 lb
♂ 95 lb`,
    blocks: [
      rounds(3, [
        mv("clean", reps(30), bb(95, 65)),
        mv("pull-up", reps(30)),
        mv("run", meters(800)),
      ]),
    ],
  }),
  hero({
    name: "Joshie",
    firstPosted: "2007-12-22",
    posted: `3 rounds for time of:
21 dumbbell snatches, right arm
21 L pull-ups
21 dumbbell snatches, left arm
21 L pull-ups
♀ 25 lb
♂ 40 lb`,
    blocks: [
      rounds(3, [
        mv("dumbbell-snatch", reps(21), db(40, 25), { note: "right arm" }),
        mv("l-pull-up", reps(21)),
        mv("dumbbell-snatch", reps(21), db(40, 25), { note: "left arm" }),
        mv("l-pull-up", reps(21)),
      ]),
    ],
  }),
  hero({
    name: "Nate",
    firstPosted: "2008-02-12",
    posted: `Complete as many rounds as possible in 20 minutes of:
2 muscle-ups
4 handstand push-ups
8 kettlebell swings
♀ 53 lb
♂ 70 lb`,
    blocks: [
      amrap(20, [
        mv("ring-muscle-up", reps(2)),
        mv("handstand-push-up", reps(4)),
        mv("kettlebell-swing", reps(8), kb(70, 53)),
      ]),
    ],
  }),
  hero({
    name: "Randy",
    firstPosted: "2008-02-13",
    posted: `For time:
75 power snatches
♀ 55 lb
♂ 75 lb`,
    blocks: [forTime([mv("power-snatch", reps(75), bb(75, 55))])],
  }),
  hero({
    name: "Tommy V",
    firstPosted: "2008-03-12",
    posted: `For time:
21 thrusters
12 rope climbs
15 thrusters
9 rope climbs
9 thrusters
6 rope climbs
♀ 75 lb, 15-foot rope
♂ 115 lb, 15-foot rope`,
    blocks: [
      forTime([
        mv("thruster", reps(21), bb(115, 75)),
        mv("rope-climb", reps(12), { note: "15-foot rope" }),
        mv("thruster", reps(15), bb(115, 75)),
        mv("rope-climb", reps(9), { note: "15-foot rope" }),
        mv("thruster", reps(9), bb(115, 75)),
        mv("rope-climb", reps(6), { note: "15-foot rope" }),
      ]),
    ],
  }),
  hero({
    name: "Griff",
    firstPosted: "2008-06-09",
    posted: `For time:
Run 800 meters
Run 400 meters backwards
Run 800 meters
Run 400 meters backwards`,
    blocks: [
      forTime([
        mv("run", meters(800)),
        mv("run", meters(400), { note: "backwards" }),
        mv("run", meters(800)),
        mv("run", meters(400), { note: "backwards" }),
      ]),
    ],
  }),
  hero({
    name: "Ryan",
    firstPosted: "2008-10-08",
    posted: `5 rounds for time of:
7 muscle-ups
21 burpees`,
    blocks: [rounds(5, [mv("ring-muscle-up", reps(7)), mv("burpee", reps(21))])],
  }),
  hero({
    name: "Erin",
    firstPosted: "2008-10-09",
    posted: `5 rounds for time of:
15 dumbbell split cleans
21 pull-ups
♀ 30 lb
♂ 40 lb`,
    blocks: [
      rounds(5, [mv("dumbbell-split-clean", reps(15), db(40, 30)), mv("pull-up", reps(21))]),
    ],
  }),
  hero({
    name: "Mr. Joshua",
    firstPosted: "2008-10-10",
    posted: `5 rounds for time of:
Run 400 meters
30 GHD sit-ups
15 deadlifts
♀ 175 lb
♂ 250 lb`,
    blocks: [
      rounds(5, [
        mv("run", meters(400)),
        mv("ghd-sit-up", reps(30)),
        mv("deadlift", reps(15), bb(250, 175)),
      ]),
    ],
  }),
  hero({
    name: "DT",
    firstPosted: "2009-04-14",
    posted: `5 rounds for time of:
12 deadlifts
9 hang power cleans
6 push jerks
♀ 105 lb
♂ 155 lb`,
    blocks: [
      rounds(5, [
        mv("deadlift", reps(12), bb(155, 105)),
        mv("hang-power-clean", reps(9), bb(155, 105)),
        mv("push-jerk", reps(6), bb(155, 105)),
      ]),
    ],
  }),
  hero({
    name: "Danny",
    firstPosted: "2009-04-16",
    posted: `Complete as many rounds in 20 minutes as you can of:
30 box jumps
20 push presses
30 pull-ups
♀ 75-lb barbell, 20-inch box
♂ 115-lb barbell, 24-inch box`,
    blocks: [
      amrap(20, [
        mv("box-jump", reps(30), { note: "24/20-inch box" }),
        mv("push-press", reps(20), bb(115, 75)),
        mv("pull-up", reps(30)),
      ]),
    ],
  }),
  hero({
    name: "Hansen",
    firstPosted: "2009-05-02",
    posted: `5 rounds for time of:
30 kettlebell swings
30 burpees
30 GHD sit-ups
♀ 53 lb
♂ 70 lb`,
    blocks: [
      rounds(5, [
        mv("kettlebell-swing", reps(30), kb(70, 53)),
        mv("burpee", reps(30)),
        mv("ghd-sit-up", reps(30)),
      ]),
    ],
  }),
  hero({
    name: "Tyler",
    firstPosted: "2009-10-17",
    posted: `5 rounds for time of:
7 muscle-ups
21 sumo deadlift high pulls
♀ 65 lb
♂ 95 lb`,
    blocks: [
      rounds(5, [
        mv("ring-muscle-up", reps(7)),
        mv("sumo-deadlift-high-pull", reps(21), bb(95, 65)),
      ]),
    ],
  }),
  hero({
    name: "Lumberjack 20",
    firstPosted: "2009-12-05",
    posted: `For time:
20 deadlifts
Run 400 meters
20 kettlebell swings
Run 400 meters
20 overhead squats
Run 400 meters
20 burpees
Run 400 meters
20 chest-to-bar pull-ups
Run 400 meters
20 box jumps
Run 400 meters
20 dumbbell squat cleans
Run 400 meters
♀ 185-lb deadlifts, 53-lb kettlebell, 75-lb overhead squats, 20-inch box, 30-lb dumbbells
♂ 275-lb deadlifts, 70-lb kettlebell, 115-lb overhead squats, 24-inch box, 45-lb dumbbells`,
    blocks: [
      forTime([
        mv("deadlift", reps(20), bb(275, 185)),
        mv("run", meters(400)),
        mv("kettlebell-swing", reps(20), kb(70, 53)),
        mv("run", meters(400)),
        mv("overhead-squat", reps(20), bb(115, 75)),
        mv("run", meters(400)),
        mv("burpee", reps(20)),
        mv("run", meters(400)),
        mv("chest-to-bar-pull-up", reps(20)),
        mv("run", meters(400)),
        mv("box-jump", reps(20), { note: "24/20-inch box" }),
        mv("run", meters(400)),
        mv("dumbbell-squat-clean", reps(20), db(45, 30)),
        mv("run", meters(400)),
      ]),
    ],
  }),
  hero({
    name: "Stephen",
    firstPosted: "2010-02-07",
    posted: `30-25-20-15-10-5 reps of:
GHD sit-ups
Back extensions
Knees-to-elbows
Stiff-legged deadlift
♀ 65 lb
♂ 95 lb`,
    blocks: [
      ladder(
        [30, 25, 20, 15, 10, 5],
        [
          mv("ghd-sit-up"),
          mv("back-extension"),
          mv("knees-to-elbows"),
          mv("stiff-legged-deadlift", bb(95, 65)),
        ],
      ),
    ],
  }),
  hero({
    name: "Garrett",
    firstPosted: "2010-02-22",
    posted: `3 rounds for time of:
75 squats
25 ring handstand push-ups
25 L pull-ups`,
    blocks: [
      rounds(3, [
        mv("air-squat", reps(75)),
        mv("ring-handstand-push-up", reps(25)),
        mv("l-pull-up", reps(25)),
      ]),
    ],
  }),
  hero({
    name: "War Frank",
    firstPosted: "2010-03-01",
    posted: `3 rounds for time of:
25 muscle-ups
100 squats
35 GHD sit-ups`,
    blocks: [
      rounds(3, [
        mv("ring-muscle-up", reps(25)),
        mv("air-squat", reps(100)),
        mv("ghd-sit-up", reps(35)),
      ]),
    ],
  }),
  hero({
    name: "McGhee",
    firstPosted: "2010-04-15",
    posted: `As many rounds as possible in 30 minutes of:
5 deadlifts
13 push-ups
9 box jumps
♀ 185-lb barbell, 20-inch box
♂ 275-lb barbell, 24-inch box`,
    blocks: [
      amrap(30, [
        mv("deadlift", reps(5), bb(275, 185)),
        mv("push-up", reps(13)),
        mv("box-jump", reps(9), { note: "24/20-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "Paul",
    firstPosted: "2010-04-24",
    posted: `5 rounds for time of:
50 double-unders
35 knees-to-elbows
20-yard overhead walk
♀ 125 lb
♂ 185 lb`,
    blocks: [
      rounds(5, [
        mv("double-under", reps(50)),
        mv("knees-to-elbows", reps(35)),
        mv("overhead-carry", yards(20), bb(185, 125)),
      ]),
    ],
  }),
  hero({
    name: "Jerry",
    firstPosted: "2010-05-09",
    posted: `For time:
Run 1 mile
Row 2K
Run 1 mile`,
    blocks: [forTime([mv("run", miles(1)), mv("row", km(2)), mv("run", miles(1))])],
  }),
  hero({
    name: "Nutts",
    firstPosted: "2010-05-28",
    posted: `For time:
10 handstand push-ups
15 deadlifts
25 box jumps
50 pull-ups
100 wall-ball shots
200 double-unders
Run 400 meters with a plate
♀ 175-lb deadlifts, 24-inch box, 14-lb medicine ball to 9 feet, 25-lb plate
♂ 250-lb deadlifts, 30-inch box, 20-lb medicine ball to 10 feet, 45-lb plate`,
    blocks: [
      forTime([
        mv("handstand-push-up", reps(10)),
        mv("deadlift", reps(15), bb(250, 175)),
        mv("box-jump", reps(25), { note: "30/24-inch box" }),
        mv("pull-up", reps(50)),
        mv("wall-ball", reps(100), ball(20, 14), { note: "to 10/9 ft" }),
        mv("double-under", reps(200)),
        mv("run", meters(400), plate(45, 25), { note: "carrying a plate" }),
      ]),
    ],
  }),
  hero({
    name: "Arnie",
    firstPosted: "2010-05-29",
    posted: `With a single kettlebell for time:
21 Turkish get-ups, right arm
50 kettlebell swings
21 overhead squats, left arm
50 kettlebell swings
21 overhead squats, right arm
50 kettlebell swings
21 Turkish get-ups, left arm
♀ 53 lb
♂ 70 lb`,
    blocks: [
      forTime(
        [
          mv("turkish-get-up", reps(21), kb(70, 53), { note: "right arm" }),
          mv("kettlebell-swing", reps(50), kb(70, 53)),
          mv("single-arm-overhead-squat", reps(21), kb(70, 53), { note: "left arm" }),
          mv("kettlebell-swing", reps(50), kb(70, 53)),
          mv("single-arm-overhead-squat", reps(21), kb(70, 53), { note: "right arm" }),
          mv("kettlebell-swing", reps(50), kb(70, 53)),
          mv("turkish-get-up", reps(21), kb(70, 53), { note: "left arm" }),
        ],
        { title: "With a single kettlebell for time" },
      ),
    ],
  }),
  hero({
    name: "The Seven",
    aliases: ["Seven"],
    firstPosted: "2010-05-30",
    posted: `7 rounds for time of:
7 handstand push-ups
7 thrusters
7 knees-to-elbows
7 deadlifts
7 burpees
7 kettlebell swings
7 pull-ups
♀ 95-lb thrusters, 165-lb deadlifts, 53-lb kettlebell
♂ 135-lb thrusters, 245-lb deadlifts, 70-lb kettlebell`,
    blocks: [
      rounds(7, [
        mv("handstand-push-up", reps(7)),
        mv("thruster", reps(7), bb(135, 95)),
        mv("knees-to-elbows", reps(7)),
        mv("deadlift", reps(7), bb(245, 165)),
        mv("burpee", reps(7)),
        mv("kettlebell-swing", reps(7), kb(70, 53)),
        mv("pull-up", reps(7)),
      ]),
    ],
  }),
  hero({
    name: "RJ",
    firstPosted: "2010-06-22",
    posted: `5 rounds for time of:
Run 800 meters
5 rope climbs to 15 feet
50 push-ups`,
    blocks: [
      rounds(5, [
        mv("run", meters(800)),
        mv("rope-climb", reps(5), { note: "to 15 feet" }),
        mv("push-up", reps(50)),
      ]),
    ],
  }),
  hero({
    name: "Luce",
    firstPosted: "2010-07-05",
    vest: { lb: [20, 14], optional: false },
    posted: `Wearing a weight vest, 3 rounds for time of:
1K run
10 muscle-ups
100 squats
♀ 14-lb vest
♂ 20-lb vest`,
    blocks: [
      rounds(3, [mv("run", km(1)), mv("ring-muscle-up", reps(10)), mv("air-squat", reps(100))], {
        intents: ["Wearing a weight vest."],
      }),
    ],
  }),
  hero({
    name: "Johnson",
    firstPosted: "2010-07-09",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
9 deadlifts
8 muscle-ups
9 squat cleans
♀ 165-lb deadlifts, 105-lb squat cleans
♂ 245-lb deadlifts, 155-lb squat cleans`,
    blocks: [
      amrap(20, [
        mv("deadlift", reps(9), bb(245, 165)),
        mv("ring-muscle-up", reps(8)),
        mv("clean", reps(9), bb(155, 105)),
      ]),
    ],
  }),
  hero({
    name: "Roy",
    firstPosted: "2010-07-27",
    posted: `5 rounds for time of:
15 deadlifts
20 box jumps
25 pull-ups
♀ 155-lb deadlifts, 20-inch box
♂ 225-lb deadlifts, 24-inch box`,
    blocks: [
      rounds(5, [
        mv("deadlift", reps(15), bb(225, 155)),
        mv("box-jump", reps(20), { note: "24/20-inch box" }),
        mv("pull-up", reps(25)),
      ]),
    ],
  }),
  hero({
    name: "Adambrown",
    firstPosted: "2010-08-10",
    posted: `2 rounds for time of:
24 deadlifts
24 box jumps
24 wall-ball shots
24 bench presses
24 box jumps
24 wall-ball shots
24 cleans
♀ 95-lb deadlifts, 20-inch box, 14-lb ball to 9 feet, 135-lb bench press, 95-lb clean
♂ 295-lb deadlifts, 24-inch box, 20-lb ball to 10 feet, 195-lb bench press, 145-lb cleans`,
    blocks: [
      rounds(2, [
        mv("deadlift", reps(24), bb(295, 95)),
        mv("box-jump", reps(24), { note: "24/20-inch box" }),
        mv("wall-ball", reps(24), ball(20, 14), { note: "to 10/9 ft" }),
        mv("bench-press", reps(24), bb(195, 135)),
        mv("box-jump", reps(24), { note: "24/20-inch box" }),
        mv("wall-ball", reps(24), ball(20, 14), { note: "to 10/9 ft" }),
        mv("clean", reps(24), bb(145, 95)),
      ]),
    ],
  }),
  hero({
    name: "Coe",
    firstPosted: "2010-08-12",
    posted: `10 rounds for time of:
10 thrusters
10 ring push-ups
♀ 65 lb
♂ 95 lb`,
    blocks: [rounds(10, [mv("thruster", reps(10), bb(95, 65)), mv("ring-push-up", reps(10))])],
  }),
  hero({
    name: "Severin",
    firstPosted: "2010-09-05",
    vest: { lb: [20, 14], optional: true },
    posted: `For time:
50 strict pull-ups
100 hand-release push-ups
Run 5K
If you’ve got a weight vest or body armor, wear it.
♀ 14-lb vest
♂ 20-lb vest`,
    blocks: [
      forTime(
        [mv("strict-pull-up", reps(50)), mv("hand-release-push-up", reps(100)), mv("run", km(5))],
        { intents: ["If you’ve got a weight vest or body armor, wear it."] },
      ),
    ],
  }),
  hero({
    name: "Helton",
    firstPosted: "2010-09-09",
    posted: `3 rounds for time of:
Run 800 meters
30 dumbbell squat cleans
30 burpees
♀ 35-lb dumbbells
♂ 50-lb dumbbells`,
    blocks: [
      rounds(3, [
        mv("run", meters(800)),
        mv("dumbbell-squat-clean", reps(30), db(50, 35)),
        mv("burpee", reps(30)),
      ]),
    ],
  }),
  hero({
    name: "Jack",
    firstPosted: "2010-09-29",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
10 push presses
10 kettlebell swings
10 box jumps
♀ 75-lb barbell, 35-lb kettlebell, 20-inch box
♂ 115-lb barbell, 53-lb kettlebell, 24-inch box`,
    blocks: [
      amrap(20, [
        mv("push-press", reps(10), bb(115, 75)),
        mv("kettlebell-swing", reps(10), kb(53, 35)),
        mv("box-jump", reps(10), { note: "24/20-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "Forrest",
    firstPosted: "2010-10-17",
    posted: `3 rounds for time of:
20 L pull-ups
30 toes-to-bars
40 burpees
Run 800 meters`,
    blocks: [
      rounds(3, [
        mv("l-pull-up", reps(20)),
        mv("toes-to-bar", reps(30)),
        mv("burpee", reps(40)),
        mv("run", meters(800)),
      ]),
    ],
  }),
  hero({
    name: "Bulger",
    firstPosted: "2010-10-19",
    posted: `10 rounds for time of:
150-meter run
7 chest-to-bar pull-ups
7 front squats
7 handstand push-ups
♀ 95 lb
♂ 135 lb`,
    blocks: [
      rounds(10, [
        mv("run", meters(150)),
        mv("chest-to-bar-pull-up", reps(7)),
        mv("front-squat", reps(7), bb(135, 95)),
        mv("handstand-push-up", reps(7)),
      ]),
    ],
  }),
  hero({
    name: "Brenton",
    firstPosted: "2010-10-21",
    vest: { lb: [20, 14], optional: true },
    posted: `5 rounds for time of:
100-foot bear crawl
100-foot standing broad jump
Do 3 burpees after every 5 broad jumps. If you’ve got a 20-lb vest or body armor, wear it.`,
    blocks: [
      rounds(
        5,
        [
          mv("bear-crawl", feet(100)),
          mv("broad-jump", feet(100), { note: "standing" }),
          mv("burpee", { note: "3 after every 5 broad jumps" }),
        ],
        {
          intents: [
            "Do 3 burpees after every 5 broad jumps.",
            "If you’ve got a 20-lb vest or body armor, wear it.",
          ],
        },
      ),
    ],
  }),
  hero({
    name: "Blake",
    firstPosted: "2010-11-13",
    posted: `4 rounds for time of:
100-foot overhead walking lunge
30 box jumps
20 wall-ball shots
10 handstand push-ups
♀ 25-lb plate, 20-inch box, 14-lb medicine ball to a 9-foot target
♂ 45-lb plate, 24-inch box, 20-lb medicine ball to a 10-foot target`,
    blocks: [
      rounds(4, [
        mv("overhead-walking-lunge", feet(100), plate(45, 25)),
        mv("box-jump", reps(30), { note: "24/20-inch box" }),
        mv("wall-ball", reps(20), ball(20, 14), { note: "to 10/9 ft" }),
        mv("handstand-push-up", reps(10)),
      ]),
    ],
  }),
  hero({
    name: "Collin",
    firstPosted: "2010-11-21",
    posted: `6 rounds for time of:
400-meter sandbag carry
12 push presses
12 box jumps
12 sumo deadlift high pulls
♀ 35-lb sandbag, 75-lb push press, 20-inch box, 65-lb sumo deadlift high pull
♂ 50-lb sandbag, 115-lb push press, 24-inch box, 95-lb sumo deadlift high pull`,
    blocks: [
      rounds(6, [
        mv("sandbag-carry", meters(400), object(50, 35)),
        mv("push-press", reps(12), bb(115, 75)),
        mv("box-jump", reps(12), { note: "24/20-inch box" }),
        mv("sumo-deadlift-high-pull", reps(12), bb(95, 65)),
      ]),
    ],
  }),
  hero({
    name: "Thompson",
    firstPosted: "2010-11-30",
    posted: `10 rounds for time of:
1 rope climb to 15 feet
29 back squats
10-meter barbell farmers carry
♀ 65-lb back squat, 95-lb farmers carry
♂ 95-lb back squat, 135-lb farmers carry
Begin the rope climbs seated on the floor.`,
    blocks: [
      rounds(
        10,
        [
          mv("rope-climb", reps(1), { note: "to 15 feet" }),
          mv("back-squat", reps(29), bb(95, 65)),
          mv("farmers-carry", meters(10), bb(135, 95), { note: "barbell" }),
        ],
        { intents: ["Begin the rope climbs seated on the floor."] },
      ),
    ],
  }),
  hero({
    name: "Whitten",
    firstPosted: "2010-12-12",
    posted: `5 rounds for time of:
22 kettlebell swings
22 box jumps
400-meter run
22 burpees
22 wall-ball shots
♀ 53-lb kettlebell, 20-inch box, 14-lb medicine ball to a 9-foot target
♂ 72-lb kettlebell, 24-inch box, 20-lb medicine ball to a 10-foot target`,
    blocks: [
      rounds(5, [
        mv("kettlebell-swing", reps(22), kb(72, 53)),
        mv("box-jump", reps(22), { note: "24/20-inch box" }),
        mv("run", meters(400)),
        mv("burpee", reps(22)),
        mv("wall-ball", reps(22), ball(20, 14), { note: "to 10/9 ft" }),
      ]),
    ],
  }),
  hero({
    name: "Bull",
    firstPosted: "2010-12-26",
    posted: `2 rounds for time of:
200 double-unders
50 overhead squats
50 pull-ups
1-mile run
♀ 95-lb barbell
♂ 135-lb barbell`,
    blocks: [
      rounds(2, [
        mv("double-under", reps(200)),
        mv("overhead-squat", reps(50), bb(135, 95)),
        mv("pull-up", reps(50)),
        mv("run", miles(1)),
      ]),
    ],
  }),
  hero({
    name: "Rankel",
    firstPosted: "2011-01-07",
    posted: `Complete as many rounds as possible in 20 minutes of:
6 deadlifts
7 burpee pull-ups
10 kettlebell swings
200-meter run
♀ 155-lb barbell, 53-lb kettlebell
♂ 225-lb barbell, 70-lb kettlebell`,
    blocks: [
      amrap(20, [
        mv("deadlift", reps(6), bb(225, 155)),
        mv("burpee-pull-up", reps(7)),
        mv("kettlebell-swing", reps(10), kb(70, 53)),
        mv("run", meters(200)),
      ]),
    ],
  }),
  hero({
    name: "Holbrook",
    firstPosted: "2011-01-27",
    posted: `10 rounds, each for time, of:
5 thrusters
10 pull-ups
100-meter sprint
Rest 1 minute between rounds.
♀ 75 lb
♂ 115 lb`,
    blocks: [
      rounds(
        10,
        [
          mv("thruster", reps(5), bb(115, 75)),
          mv("pull-up", reps(10)),
          mv("run", meters(100), { note: "sprint" }),
        ],
        {
          title: "10 rounds, each for time",
          restSeconds: 60,
          intents: ["Rest 1 minute between rounds."],
        },
      ),
    ],
  }),
  hero({
    name: "Ledesma",
    firstPosted: "2011-02-08",
    posted: `Complete as many rounds and reps as possible in 20 minutes of:
5 parallette handstand push-ups
10 toes-to-rings
15 medicine-ball cleans
♀ 14-lb medicine ball
♂ 20-lb medicine ball`,
    blocks: [
      amrap(20, [
        mv("parallette-handstand-push-up", reps(5)),
        mv("toes-to-ring", reps(10)),
        mv("medicine-ball-clean", reps(15), ball(20, 14)),
      ]),
    ],
  }),
  hero({
    name: "Wittman",
    firstPosted: "2011-02-10",
    posted: `7 rounds for time of:
15 kettlebell swings
15 power cleans
15 box jumps
♀ 35-lb kettlebell, 65-lb barbell, 20-inch box
♂ 53-lb kettlebell, 95-lb barbell, 24-inch box`,
    blocks: [
      rounds(7, [
        mv("kettlebell-swing", reps(15), kb(53, 35)),
        mv("power-clean", reps(15), bb(95, 65)),
        mv("box-jump", reps(15), { note: "24/20-inch box" }),
      ]),
    ],
  }),
  hero({
    name: "McCluskey",
    firstPosted: "2011-03-01",
    vest: { lb: [20, 14], optional: true },
    posted: `3 rounds of:
9 muscle-ups
15 burpee pull-ups
21 pull-ups
Run 800 meters
If you’ve got a 20-lb vest or body armor, wear it.`,
    blocks: [
      rounds(
        3,
        [
          mv("ring-muscle-up", reps(9)),
          mv("burpee-pull-up", reps(15)),
          mv("pull-up", reps(21)),
          mv("run", meters(800)),
        ],
        { intents: ["If you’ve got a 20-lb vest or body armor, wear it."] },
      ),
    ],
  }),
  hero({
    name: "Weaver",
    firstPosted: "2011-03-18",
    posted: `4 rounds for time of:
10 L pull-ups
15 push-ups
15 chest-to-bar pull-ups
15 push-ups
20 pull-ups
15 push-ups`,
    blocks: [
      rounds(4, [
        mv("l-pull-up", reps(10)),
        mv("push-up", reps(15)),
        mv("chest-to-bar-pull-up", reps(15)),
        mv("push-up", reps(15)),
        mv("pull-up", reps(20)),
        mv("push-up", reps(15)),
      ]),
    ],
  }),
  hero({
    name: "Hammer",
    firstPosted: "2011-04-17",
    posted: `5 rounds, each for time, of:
5 power cleans
10 front squats
5 jerks
20 pull-ups
Rest 90 seconds between rounds.
♀ 95 lb
♂ 135 lb`,
    blocks: [
      rounds(
        5,
        [
          mv("power-clean", reps(5), bb(135, 95)),
          mv("front-squat", reps(10), bb(135, 95)),
          mv("jerk", reps(5), bb(135, 95)),
          mv("pull-up", reps(20)),
        ],
        {
          title: "5 rounds, each for time",
          restSeconds: 90,
          intents: ["Rest 90 seconds between rounds."],
        },
      ),
    ],
  }),
  hero({
    name: "Abbate",
    firstPosted: "2011-03-26",
    posted: `For time:
1-mile run
21 clean and jerks
800-meter run
21 clean and jerks
1-mile run
♀ 105 lb
♂ 155 lb`,
    blocks: [
      forTime([
        mv("run", miles(1)),
        mv("clean-and-jerk", reps(21), bb(155, 105)),
        mv("run", meters(800)),
        mv("clean-and-jerk", reps(21), bb(155, 105)),
        mv("run", miles(1)),
      ]),
    ],
  }),
  hero({
    name: "Moore",
    firstPosted: "2011-04-28",
    posted: `Complete as many rounds in 20 minutes as you can of:
1 rope climb to 15 feet
Run 400 meters
Max-rep handstand push-ups`,
    blocks: [
      amrap(20, [
        mv("rope-climb", reps(1), { note: "to 15 feet" }),
        mv("run", meters(400)),
        mv("handstand-push-up", { note: "max reps" }),
      ]),
    ],
  }),
  hero({
    name: "Wilmot",
    firstPosted: "2011-05-20",
    posted: `6 rounds for time of:
50 squats
25 ring dips`,
    blocks: [rounds(6, [mv("air-squat", reps(50)), mv("ring-dip", reps(25))])],
  }),
  hero({
    name: "Moon",
    firstPosted: "2011-06-02",
    posted: `7 rounds for time of:
10 dumbbell hang split snatches, right arm
1 rope climb to 15 feet
10 dumbbell hang split snatches, left arm
1 rope climb
Alternate feet on the split snatches.
♀ 30-lb dumbbell
♂ 40-lb dumbbell`,
    blocks: [
      rounds(
        7,
        [
          mv("dumbbell-hang-split-snatch", reps(10), db(40, 30), { note: "right arm" }),
          mv("rope-climb", reps(1), { note: "to 15 feet" }),
          mv("dumbbell-hang-split-snatch", reps(10), db(40, 30), { note: "left arm" }),
          mv("rope-climb", reps(1)),
        ],
        { intents: ["Alternate feet on the split snatches."] },
      ),
    ],
  }),
  hero({
    name: "Small",
    firstPosted: "2011-06-12",
    posted: `3 rounds for time of:
Row 1,000 meters
50 burpees
50 box jumps
Run 800 meters
♀ 20-inch box
♂ 24-inch box`,
    blocks: [
      rounds(3, [
        mv("row", meters(1000)),
        mv("burpee", reps(50)),
        mv("box-jump", reps(50), { note: "24/20-inch box" }),
        mv("run", meters(800)),
      ]),
    ],
  }),
  hero({
    name: "Morrison",
    firstPosted: "2011-07-04",
    posted: `50-40-30-20-10 reps for time of:
Wall-ball shots
Box jumps
Kettlebell swings
♀ 14-lb medicine ball to a 9-foot target, 20-inch box, 35-lb kettlebell
♂ 20-lb medicine ball to a 10-foot target, 24-inch box, 53-lb kettlebell`,
    blocks: [
      ladder(
        [50, 40, 30, 20, 10],
        [
          mv("wall-ball", ball(20, 14), { note: "to 10/9 ft" }),
          mv("box-jump", { note: "24/20-inch box" }),
          mv("kettlebell-swing", kb(53, 35)),
        ],
      ),
    ],
  }),
  hero({
    name: "Manion",
    firstPosted: "2011-07-18",
    posted: `7 rounds for time of:
Run 400 meters
29 back squat
♀ 95 lb
♂ 135 lb`,
    blocks: [rounds(7, [mv("run", meters(400)), mv("back-squat", reps(29), bb(135, 95))])],
  }),
  hero({
    name: "Gator",
    firstPosted: "2011-08-12",
    posted: `8 rounds for time of:
5 front squat
26 ring push-ups
♀ 125 lb
♂ 185 lb`,
    blocks: [rounds(8, [mv("front-squat", reps(5), bb(185, 125)), mv("ring-push-up", reps(26))])],
  }),
];
