import { ball, bb, forTime, intervals, kb, mv, notable, reps, rounds } from "./dsl.ts";

/** Classics that are neither Girls nor Heroes but are benchmarks at every box. */
export const NOTABLES = [
  notable({
    name: "Filthy Fifty",
    posted: `For time:
50 box jumps
50 jumping pull-ups
50 kettlebell swings
Walking lunge, 50 steps
50 knees-to-elbows
50 push presses
50 back extensions
50 wall-ball shots
50 burpees
50 double-unders
♀ 20-inch box, 26-lb kettlebell, 35-lb barbell, 14-lb ball
♂ 24-inch box, 1-pood kettlebell, 45-lb barbell, 20-lb ball`,
    blocks: [
      forTime([
        mv("box-jump", reps(50), { note: "24/20-inch box" }),
        mv("jumping-pull-up", reps(50)),
        mv("kettlebell-swing", reps(50), kb(35, 26)),
        mv("walking-lunge", reps(50), { note: "steps" }),
        mv("knees-to-elbows", reps(50)),
        mv("push-press", reps(50), bb(45, 35)),
        mv("back-extension", reps(50)),
        mv("wall-ball", reps(50), ball(20, 14)),
        mv("burpee", reps(50)),
        mv("double-under", reps(50)),
      ]),
    ],
  }),
  notable({
    name: "Fight Gone Bad",
    aliases: ["FGB"],
    scoring: "reps",
    posted: `3 rounds of:
1 minute of wall-ball shots
1 minute of sumo deadlift high pulls
1 minute of box jumps
1 minute of push presses
1 minute of rowing for calories
Rest 1 minute
♀ 14-lb ball, 55-lb barbell, 20-inch box
♂ 20-lb ball, 75-lb barbell, 20-inch box
The clock does not reset or stop between exercises. One point per rep, and per calorie on the row.`,
    blocks: [
      intervals(
        { workSeconds: 60, rounds: 3 },
        [
          mv("wall-ball", ball(20, 14)),
          mv("sumo-deadlift-high-pull", bb(75, 55)),
          mv("box-jump", { note: "20-inch box" }),
          mv("push-press", bb(75, 55)),
          mv("row", { note: "calories" }),
        ],
        {
          title: "3 rounds, 1 min per station",
          restSeconds: 60,
          intents: [
            "The clock does not reset or stop between exercises.",
            "One point per rep, and per calorie on the row. Rest 1 minute after each round.",
          ],
        },
      ),
    ],
  }),
  notable({
    name: "Nasty Girls",
    posted: `3 rounds for time of:
50 squats
7 muscle-ups
10 hang power cleans
♀ 95 lb
♂ 135 lb`,
    blocks: [
      rounds(3, [
        mv("air-squat", reps(50)),
        mv("ring-muscle-up", reps(7)),
        mv("hang-power-clean", reps(10), bb(135, 95)),
      ]),
    ],
  }),
];
