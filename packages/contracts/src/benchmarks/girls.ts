import {
  amrap,
  ball,
  bb,
  block,
  db,
  emom,
  forTime,
  girl,
  intervals,
  ladder,
  meters,
  mv,
  pood,
  reps,
  rounds,
} from "./dsl.ts";

/**
 * The Girls, as listed in CrossFit's FAQ ("Explain the workouts with names"), including the
 * New Girls of January 2021. Box heights and wall-ball targets are notes; bodyweight loads
 * are in the posted text only, since Chalk does not know the athlete's weight.
 */
export const GIRLS = [
  girl({
    name: "Angie",
    firstPosted: "2004-07-26",
    posted: `For time:
100 pull-ups
100 push-ups
100 sit-ups
100 squats
Complete all reps of each exercise before moving to the next.`,
    blocks: [
      forTime(
        [
          mv("pull-up", reps(100)),
          mv("push-up", reps(100)),
          mv("sit-up", reps(100)),
          mv("air-squat", reps(100)),
        ],
        { intents: ["Complete all reps of each exercise before moving to the next."] },
      ),
    ],
  }),
  girl({
    name: "Barbara",
    firstPosted: "2003-09-27",
    posted: `5 rounds, each for time, of:
20 pull-ups
30 push-ups
40 sit-ups
50 squats
Rest precisely 3 minutes between each round.`,
    blocks: [
      rounds(
        5,
        [
          mv("pull-up", reps(20)),
          mv("push-up", reps(30)),
          mv("sit-up", reps(40)),
          mv("air-squat", reps(50)),
        ],
        {
          title: "5 rounds, each for time",
          restSeconds: 180,
          intents: ["Rest precisely 3 minutes between each round."],
        },
      ),
    ],
  }),
  girl({
    name: "Chelsea",
    firstPosted: "2003-09-07",
    scoring: "reps",
    posted: `Every minute on the minute for 30 minutes:
5 pull-ups
10 push-ups
15 squats`,
    blocks: [
      emom(30, [mv("pull-up", reps(5)), mv("push-up", reps(10)), mv("air-squat", reps(15))], {
        intents: ["Score the rounds completed."],
      }),
    ],
  }),
  girl({
    name: "Cindy",
    firstPosted: "2004-12-29",
    posted: `As many rounds as possible in 20 minutes of:
5 pull-ups
10 push-ups
15 squats`,
    blocks: [
      amrap(20, [mv("pull-up", reps(5)), mv("push-up", reps(10)), mv("air-squat", reps(15))]),
    ],
  }),
  girl({
    name: "Diane",
    firstPosted: "2003-09-19",
    posted: `21-15-9 reps for time of:
Deadlifts
Handstand push-ups
♀ 155 lb
♂ 225 lb`,
    blocks: [ladder([21, 15, 9], [mv("deadlift", bb(225, 155)), mv("handstand-push-up")])],
  }),
  girl({
    name: "Elizabeth",
    firstPosted: "2003-09-12",
    posted: `21-15-9 reps for time of:
Cleans
Ring dips
♀ 95 lb
♂ 135 lb`,
    blocks: [ladder([21, 15, 9], [mv("clean", bb(135, 95)), mv("ring-dip")])],
  }),
  girl({
    name: "Fran",
    firstPosted: "2003-08-25",
    posted: `21-15-9 reps for time of:
Thrusters
Pull-ups
♀ 65 lb
♂ 95 lb`,
    blocks: [ladder([21, 15, 9], [mv("thruster", bb(95, 65)), mv("pull-up")])],
  }),
  girl({
    name: "Grace",
    firstPosted: "2004-06-24",
    posted: `For time:
30 clean and jerks
♀ 95 lb
♂ 135 lb`,
    blocks: [forTime([mv("clean-and-jerk", reps(30), bb(135, 95))])],
  }),
  girl({
    name: "Helen",
    firstPosted: "2003-08-09",
    posted: `3 rounds for time of:
400-meter run
21 kettlebell swings
12 pull-ups
♀ 1 pood
♂ 1.5 pood`,
    blocks: [
      rounds(3, [
        mv("run", meters(400)),
        mv("kettlebell-swing", reps(21), pood(1.5, 1)),
        mv("pull-up", reps(12)),
      ]),
    ],
  }),
  girl({
    name: "Isabel",
    firstPosted: "2004-11-11",
    posted: `For time:
30 snatches
♀ 95 lb
♂ 135 lb`,
    blocks: [forTime([mv("snatch", reps(30), bb(135, 95))])],
  }),
  girl({
    name: "Jackie",
    firstPosted: "2005-08-03",
    posted: `For time:
1,000-meter row
50 thrusters
30 pull-ups
♀ 35 lb
♂ 45 lb`,
    blocks: [
      forTime([
        mv("row", meters(1000)),
        mv("thruster", reps(50), bb(45, 35)),
        mv("pull-up", reps(30)),
      ]),
    ],
  }),
  girl({
    name: "Karen",
    firstPosted: "2008-08-07",
    posted: `For time:
150 wall-ball shots
♀ 14-lb ball to 9 feet
♂ 20-lb ball to 10 feet`,
    blocks: [forTime([mv("wall-ball", reps(150), ball(20, 14), { note: "to 10/9 ft" })])],
  }),
  girl({
    name: "Linda",
    aliases: ["Three Bars of Death"],
    firstPosted: "2003-07-05",
    posted: `10-9-8-7-6-5-4-3-2-1 reps for time of:
Deadlifts, 1 1/2 bodyweight
Bench presses, bodyweight
Cleans, 3/4 bodyweight`,
    blocks: [
      ladder(
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        [
          mv("deadlift", { note: "1.5 × bodyweight" }),
          mv("bench-press", { note: "bodyweight" }),
          mv("clean", { note: "0.75 × bodyweight" }),
        ],
      ),
    ],
  }),
  girl({
    name: "Mary",
    firstPosted: "2005-01-19",
    posted: `As many rounds as possible in 20 minutes of:
5 handstand push-ups
10 one-legged squats, alternating
15 pull-ups`,
    blocks: [
      amrap(20, [
        mv("handstand-push-up", reps(5)),
        mv("pistol", reps(10), { note: "alternating legs" }),
        mv("pull-up", reps(15)),
      ]),
    ],
  }),
  girl({
    name: "Nancy",
    firstPosted: "2004-12-05",
    posted: `5 rounds for time of:
400-meter run
15 overhead squats
♀ 65 lb
♂ 95 lb`,
    blocks: [rounds(5, [mv("run", meters(400)), mv("overhead-squat", reps(15), bb(95, 65))])],
  }),
  girl({
    name: "Annie",
    firstPosted: "2005-04-16",
    posted: `50-40-30-20-10 reps for time of:
Double-unders
Sit-ups`,
    blocks: [ladder([50, 40, 30, 20, 10], [mv("double-under"), mv("sit-up")])],
  }),
  girl({
    name: "Eva",
    firstPosted: "2008-02-24",
    posted: `5 rounds for time of:
800-meter run
30 kettlebell swings
30 pull-ups
♀ 1.5 pood
♂ 2 pood`,
    blocks: [
      rounds(5, [
        mv("run", meters(800)),
        mv("kettlebell-swing", reps(30), pood(2, 1.5)),
        mv("pull-up", reps(30)),
      ]),
    ],
  }),
  girl({
    name: "Kelly",
    firstPosted: "2005-04-10",
    posted: `5 rounds for time of:
400-meter run
30 box jumps
30 wall-ball shots
♀ 20-inch box, 14-lb ball
♂ 24-inch box, 20-lb ball`,
    blocks: [
      rounds(5, [
        mv("run", meters(400)),
        mv("box-jump", reps(30), { note: "24/20-inch box" }),
        mv("wall-ball", reps(30), ball(20, 14)),
      ]),
    ],
  }),
  girl({
    name: "Lynne",
    firstPosted: "2004-04-22",
    scoring: "reps",
    posted: `5 rounds for max reps of:
Bench presses, bodyweight
Pull-ups
There is no time component to this workout. Rest as needed.`,
    blocks: [
      block(
        "other",
        { rounds: { min: 5, max: 5 } },
        "5 rounds for max reps",
        [mv("bench-press", { note: "bodyweight" }), mv("pull-up")],
        { intents: ["There is no time component to this workout. Rest as needed."] },
      ),
    ],
  }),
  girl({
    name: "Nicole",
    firstPosted: "2006-12-11",
    scoring: "reps",
    posted: `As many rounds as possible in 20 minutes of:
400-meter run
Max pull-ups
Note the number of pull-ups completed for each round.`,
    blocks: [
      amrap(20, [mv("run", meters(400)), mv("pull-up", { note: "max reps" })], {
        intents: ["Note the number of pull-ups completed for each round."],
      }),
    ],
  }),
  girl({
    name: "Amanda",
    firstPosted: "2010-07-17",
    posted: `9-7-5 reps for time of:
Muscle-ups
Squat snatches
♀ 95 lb
♂ 135 lb`,
    blocks: [ladder([9, 7, 5], [mv("ring-muscle-up"), mv("snatch", bb(135, 95))])],
  }),
  girl({
    name: "Gwen",
    firstPosted: "2003-05-25",
    scoring: "load",
    posted: `15-12-9 reps of:
Clean and jerks
Touch and go at floor only. Even a re-grip off the floor is a foul. No dumping. Use the same load for each set. Rest as needed between sets.`,
    blocks: [
      block("strength", { scheme: [15, 12, 9] }, "15-12-9 reps", [mv("clean-and-jerk")], {
        intents: [
          "Touch and go at floor only. Even a re-grip off the floor is a foul. No dumping.",
          "Use the same load for each set. Rest as needed between sets.",
        ],
      }),
    ],
  }),
  girl({
    name: "Marguerita",
    firstPosted: "2014-01-15",
    posted: `50 reps for time of:
Burpee / push-up / jumping-jack / sit-up / handstand
One rep is a burpee, a push-up, a jumping jack, a sit-up and a handstand.`,
    blocks: [
      rounds(
        50,
        [
          mv("burpee", reps(1)),
          mv("push-up", reps(1)),
          mv("jumping-jack", reps(1)),
          mv("sit-up", reps(1)),
          mv("handstand-hold", reps(1)),
        ],
        {
          title: "50 reps for time",
          intents: ["One rep is a burpee, a push-up, a jumping jack, a sit-up and a handstand."],
        },
      ),
    ],
  }),
  girl({
    name: "Candy",
    posted: `5 rounds for time of:
20 pull-ups
40 push-ups
60 squats`,
    blocks: [
      rounds(5, [mv("pull-up", reps(20)), mv("push-up", reps(40)), mv("air-squat", reps(60))]),
    ],
  }),
  girl({
    name: "Maggie",
    firstPosted: "2006-07-28",
    posted: `5 rounds for time of:
20 handstand push-ups
40 pull-ups
60 one-legged squats, alternating legs`,
    blocks: [
      rounds(5, [
        mv("handstand-push-up", reps(20)),
        mv("pull-up", reps(40)),
        mv("pistol", reps(60), { note: "alternating legs" }),
      ]),
    ],
  }),
  girl({
    name: "Hope",
    firstPosted: "2012-06-08",
    scoring: "reps",
    posted: `3 rounds for total reps of:
1 minute of burpees
1 minute of power snatches
1 minute of box jumps
1 minute of thrusters
1 minute of chest-to-bar pull-ups
Rest 1 minute
♀ 55 lb, 20-inch box
♂ 75 lb, 24-inch box
The clock does not reset or stop between exercises. One point per rep.`,
    blocks: [
      intervals(
        { workSeconds: 60, rounds: 3 },
        [
          mv("burpee"),
          mv("power-snatch", bb(75, 55)),
          mv("box-jump", { note: "24/20-inch box" }),
          mv("thruster", bb(75, 55)),
          mv("chest-to-bar-pull-up"),
        ],
        {
          title: "3 rounds, 1 min per station",
          restSeconds: 60,
          intents: [
            "The clock does not reset or stop between exercises. One point per rep.",
            "Rest 1 minute after each round.",
          ],
        },
      ),
    ],
  }),
  girl({
    name: "Grettel",
    firstPosted: "2021-01-03",
    posted: `10 rounds for time of:
3 clean and jerks
3 bar-facing burpees
♀ 95 lb
♂ 135 lb`,
    blocks: [
      rounds(10, [mv("clean-and-jerk", reps(3), bb(135, 95)), mv("bar-facing-burpee", reps(3))]),
    ],
  }),
  girl({
    name: "Ingrid",
    firstPosted: "2021-01-03",
    posted: `10 rounds for time of:
3 snatches
3 bar-facing burpees
♀ 95 lb
♂ 135 lb`,
    blocks: [rounds(10, [mv("snatch", reps(3), bb(135, 95)), mv("bar-facing-burpee", reps(3))])],
  }),
  girl({
    name: "Barbara Ann",
    firstPosted: "2021-01-04",
    posted: `5 rounds, each for time, of:
20 handstand push-ups
30 deadlifts
40 sit-ups
50 double-unders
Rest precisely 3 minutes between each round.
♀ 95 lb
♂ 135 lb`,
    blocks: [
      rounds(
        5,
        [
          mv("handstand-push-up", reps(20)),
          mv("deadlift", reps(30), bb(135, 95)),
          mv("sit-up", reps(40)),
          mv("double-under", reps(50)),
        ],
        {
          title: "5 rounds, each for time",
          restSeconds: 180,
          intents: ["Rest precisely 3 minutes between each round."],
        },
      ),
    ],
  }),
  girl({
    name: "Lyla",
    firstPosted: "2021-01-07",
    posted: `10-9-8-7-6-5-4-3-2-1 reps for time of:
Muscle-ups
Clean and jerks, bodyweight`,
    blocks: [
      ladder(
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        [mv("ring-muscle-up"), mv("clean-and-jerk", { note: "bodyweight" })],
      ),
    ],
  }),
  girl({
    name: "Ellen",
    firstPosted: "2021-01-10",
    posted: `3 rounds for time of:
20 burpees
21 dumbbell snatches
12 dumbbell thrusters
♀ 35-lb dumbbells
♂ 50-lb dumbbells
Use one dumbbell for the snatches and two for the thrusters.`,
    blocks: [
      rounds(
        3,
        [
          mv("burpee", reps(20)),
          mv("dumbbell-snatch", reps(21), db(50, 35)),
          mv("dumbbell-thruster", reps(12), db(50, 35), { note: "two dumbbells" }),
        ],
        { intents: ["Use one dumbbell for the snatches and two for the thrusters."] },
      ),
    ],
  }),
  girl({
    name: "Andi",
    firstPosted: "2021-01-14",
    posted: `For time:
100 hang power snatches
100 push presses
100 sumo deadlift high pulls
100 front squats
♀ 45 lb
♂ 65 lb`,
    blocks: [
      forTime([
        mv("hang-power-snatch", reps(100), bb(65, 45)),
        mv("push-press", reps(100), bb(65, 45)),
        mv("sumo-deadlift-high-pull", reps(100), bb(65, 45)),
        mv("front-squat", reps(100), bb(65, 45)),
      ]),
    ],
  }),
  girl({
    name: "Lane",
    firstPosted: "2021-01-26",
    scoring: "reps",
    posted: `5 rounds for max reps of:
Hang power snatches, 3/4 bodyweight
Handstand push-ups
Rest as needed between sets.`,
    blocks: [
      block(
        "other",
        { rounds: { min: 5, max: 5 } },
        "5 rounds for max reps",
        [mv("hang-power-snatch", { note: "0.75 × bodyweight" }), mv("handstand-push-up")],
        { intents: ["Rest as needed between sets."] },
      ),
    ],
  }),
];
