import type { Body } from "./body.ts";

/**
 * Work per unit of a movement against gravity: the body's moving segments and the load, raised
 * by distances read off the athlete's proportions. Concentric only; sideways travel does none.
 * Estimates: compare a workout with itself over time. Sources in docs/domain.md.
 */
export const G = 9.81;

type PerUnit = (body: Body, loadKg: number) => number;

export interface WorkModel {
  readonly perRep?: PerUnit;
  readonly perMeter?: PerUnit;
  readonly perCalorie?: PerUnit;
  /** A load is part of the movement: a thruster without one is not counted. */
  readonly loaded?: boolean;
  /** Why it moves nothing up (carries, holds); counted as zero work. */
  readonly none?: string;
}

/** The concentric metres each part travels, turned into joules. */
const joules = (kg: number, metres: number) => kg * G * Math.max(0, metres);

/** Bumper plate radius: where a loaded bar rests on the floor. */
const BAR_FLOOR_M = 0.225;
/** Dumbbell or kettlebell handle, medicine ball centre, sandbag: on the floor. */
const BELL_FLOOR_M = 0.15;
/** Standard boxes: 24 and 20 inches. */
const BOX_M = { m: 0.61, f: 0.51 } as const;
/** Wall-ball targets: 10 and 9 feet. */
const TARGET_M = { m: 3.05, f: 2.74 } as const;
/** A 15-foot rope. */
const ROPE_M = 4.57;
/** Mechanical joules per Concept2 calorie at 150–300 W (the display adds 300 kcal/h of rest). */
const JOULES_PER_CALORIE = 750;
/** Rower and SkiErg: watts = 2.8 / (s per m)³; at 2:00/500 m that is 48.6 J per metre. */
const ERG_JOULES_PER_METRE = 48.6;
/** BikeErg metres come about twice as fast for the same power. */
const BIKE_JOULES_PER_METRE = ERG_JOULES_PER_METRE / 2;
/** Cavagna: the external work of running, J per kg per metre. */
const RUN_JOULES_PER_KG_METRE = 1;
/** Sled on turf, rolling friction coefficient. */
const SLED_FRICTION = 0.3;

const arm = (b: Body) => b.upperArmM + b.forearmM;
/** What hangs from the hands: everything but the hands and forearms. */
const hanging = (b: Body) => b.massKg - b.handsKg - b.forearmsKg;
/** What a squat lowers and raises: everything above the shanks. */
const squatting = (b: Body) => b.massKg - b.feetKg - b.shanksKg;
const legs = (b: Body) => b.thighsKg + b.shanksKg + b.feetKg;
/** A hang start: the bar just above the knees. */
const hangStart = (b: Body) => b.gripHeightM - 0.05 * b.heightM;
const press = (b: Body) => b.overheadM - b.shoulderHeightM;

/** Body and load through a full squat. */
const squat = (b: Body, load = 0) => joules(squatting(b) + load, b.thighM);
/** Hips from hinged to tall: the upper body's centre rises about 0.3 of the trunk. */
const hinge = (b: Body) => joules(b.upperBodyKg, 0.3 * b.trunkM);
/** The dip and drive of a push press or jerk. */
const dip = (b: Body, load: number) => joules(squatting(b) + load, 0.05 * b.heightM);
/** Lying to standing: the centre of mass from about 0.1 to 0.55 of height. */
const getUp = (b: Body) => joules(b.massKg, 0.45 * b.heightM);
const burpee = (b: Body) => getUp(b) + joules(b.massKg, 0.05 * b.heightM);
const pullUp = (b: Body, load = 0) => joules(hanging(b) + load, arm(b));
const muscleUp = (b: Body) => joules(hanging(b), 1.8 * arm(b));
const box = (b: Body, load = 0) => joules(b.massKg + load, BOX_M[b.sex]);

// Barbell paths, load only; the body's part is added per movement.
const floorToHang = (b: Body) => b.gripHeightM - BAR_FLOOR_M;
const floorToRack = (b: Body) => b.shoulderHeightM - BAR_FLOOR_M;
const floorToOverhead = (b: Body) => b.overheadM - BAR_FLOOR_M;

const loaded = (perRep: PerUnit): WorkModel => ({ perRep, loaded: true });
const bodyweight = (perRep: (b: Body) => number): WorkModel => ({ perRep: (b) => perRep(b) });
/** Bodyweight movements that take an optional load (a vest, a weighted pull-up). */
const weighted = (perRep: PerUnit): WorkModel => ({ perRep });
const none = (reason: string): WorkModel => ({ none: reason });

const deadlift = loaded((b, kg) => joules(kg, floorToHang(b)) + hinge(b));
const clean = loaded((b, kg) => joules(kg, floorToRack(b) + b.thighM) + hinge(b) + squat(b));
const powerClean = loaded((b, kg) => joules(kg, floorToRack(b)) + hinge(b));
const hangPowerClean = loaded((b, kg) => joules(kg, b.shoulderHeightM - hangStart(b)));
const hangClean = loaded((b, kg) => joules(kg, b.shoulderHeightM - hangStart(b)) + squat(b, kg));
const snatch = loaded((b, kg) => joules(kg, floorToOverhead(b) + b.thighM) + hinge(b) + squat(b));
const powerSnatch = loaded((b, kg) => joules(kg, floorToOverhead(b)) + hinge(b));
const hangPowerSnatch = loaded((b, kg) => joules(kg, b.overheadM - hangStart(b)));
const frontSquat = loaded((b, kg) => squat(b, kg));
const strictPress = loaded((b, kg) => joules(kg, press(b)));
const pushPress = loaded((b, kg) => joules(kg, press(b)) + dip(b, kg));
const thruster = loaded((b, kg) => squat(b, kg) + joules(kg, press(b)));
const pull = (top: (b: Body) => number) =>
  loaded((b, kg) => joules(kg, top(b) - BAR_FLOOR_M) + hinge(b));
const bellSnatch = loaded((b, kg) => joules(kg, b.overheadM - BELL_FLOOR_M) + hinge(b));
const bellClean = loaded((b, kg) => joules(kg, b.shoulderHeightM - BELL_FLOOR_M) + hinge(b));
const lunge = (b: Body, kg: number) => joules(b.massKg + kg, 0.75 * b.thighM);
/** A walking lunge covers about 0.4 of height per step. */
const lungeStepsPerMetre = (b: Body) => 1 / (0.4 * b.heightM);
const lungeModel = (needsLoad: boolean): WorkModel => ({
  perRep: lunge,
  perMeter: (b, kg) => lunge(b, kg) * lungeStepsPerMetre(b),
  ...(needsLoad ? { loaded: true } : {}),
});
const erg: WorkModel = {
  perCalorie: () => JOULES_PER_CALORIE,
  perMeter: () => ERG_JOULES_PER_METRE,
};
const run: WorkModel = { perMeter: (b) => RUN_JOULES_PER_KG_METRE * b.massKg };

const CARRY = "A carry moves the load sideways, which is no work against gravity.";
const HOLD = "A hold moves nothing, so it does no work.";

/** Work models by catalog id; a variation without one uses its core movement's. */
export const WORK_MODELS: Readonly<Record<string, WorkModel>> = {
  // Deadlifts and pulls.
  deadlift,
  "sumo-deadlift": deadlift,
  "stiff-legged-deadlift": deadlift,
  "snatch-deadlift": deadlift,
  "clean-deadlift": deadlift,
  "dumbbell-deadlift": loaded((b, kg) => joules(kg, b.gripHeightM - BELL_FLOOR_M) + hinge(b)),
  "snatch-pull": pull((b) => b.hipHeightM + 0.05 * b.heightM),
  "deficit-snatch-pull": pull((b) => b.hipHeightM + 0.08 * b.heightM),
  "clean-pull": pull((b) => b.hipHeightM),
  "deficit-clean-pull": pull((b) => b.hipHeightM + 0.03 * b.heightM),
  "snatch-high-pull": pull((b) => b.shoulderHeightM - 0.05 * b.heightM),
  "clean-high-pull": pull((b) => b.shoulderHeightM - 0.1 * b.heightM),
  "sumo-deadlift-high-pull": pull((b) => b.chinHeightM),
  // Cleans.
  clean,
  "power-clean": powerClean,
  "hang-power-clean": hangPowerClean,
  "hang-squat-clean": hangClean,
  "clean-and-jerk": loaded(
    (b, kg) => joules(kg, floorToRack(b) + b.thighM + press(b)) + hinge(b) + squat(b) + dip(b, kg),
  ),
  // Snatches.
  snatch,
  "power-snatch": powerSnatch,
  "hang-power-snatch": hangPowerSnatch,
  "split-snatch": powerSnatch,
  "muscle-snatch": powerSnatch,
  "tall-snatch": loaded((b, kg) => joules(kg, b.overheadM - b.hipHeightM) + squat(b, kg)),
  "snatch-balance": loaded((b, kg) => squat(b, kg)),
  "drop-snatch": loaded((b, kg) => squat(b, kg)),
  // Squats.
  "back-squat": frontSquat,
  "front-squat": frontSquat,
  "overhead-squat": frontSquat,
  "goblet-squat": frontSquat,
  "dumbbell-front-squat": frontSquat,
  "single-arm-overhead-squat": frontSquat,
  "air-squat": bodyweight((b) => squat(b)),
  pistol: bodyweight((b) => squat(b)),
  "jerk-dip-squat": loaded((b, kg) => dip(b, kg)),
  // Presses and jerks.
  "strict-press": strictPress,
  "push-press": pushPress,
  "push-jerk": pushPress,
  "split-jerk": pushPress,
  jerk: pushPress,
  "shoulder-to-overhead": pushPress,
  "bench-press": loaded((b, kg) => joules(kg, 0.65 * arm(b))),
  "dumbbell-floor-press": loaded((b, kg) => joules(kg, 0.5 * arm(b))),
  // Thrusters.
  thruster,
  "dumbbell-thruster": thruster,
  "kettlebell-thruster": thruster,
  "squat-clean-thruster": loaded(
    (b, kg) => joules(kg, floorToRack(b) + b.thighM + press(b)) + hinge(b) + squat(b),
  ),
  "dumbbell-squat-clean-thruster": loaded(
    (b, kg) =>
      joules(kg, b.shoulderHeightM - BELL_FLOOR_M + b.thighM + press(b)) + hinge(b) + squat(b),
  ),
  // Dumbbells and kettlebells.
  "dumbbell-snatch": bellSnatch,
  "kettlebell-snatch": bellSnatch,
  "dumbbell-clean": bellClean,
  "dumbbell-squat-clean": loaded(
    (b, kg) => joules(kg, b.shoulderHeightM - BELL_FLOOR_M + b.thighM) + hinge(b) + squat(b),
  ),
  "dumbbell-hang-squat-clean": hangClean,
  "dumbbell-split-clean": bellClean,
  "dumbbell-clean-and-jerk": loaded(
    (b, kg) => joules(kg, b.overheadM - BELL_FLOOR_M) + hinge(b) + dip(b, kg),
  ),
  "kettlebell-clean-and-jerk": loaded(
    (b, kg) => joules(kg, b.overheadM - BELL_FLOOR_M) + hinge(b) + dip(b, kg),
  ),
  "dumbbell-hang-split-snatch": hangPowerSnatch,
  "dumbbell-row": loaded((b, kg) => joules(kg, 0.6 * arm(b))),
  "kettlebell-swing": loaded((b, kg) => joules(kg, b.chinHeightM - hangStart(b)) + hinge(b)),
  "russian-kettlebell-swing": loaded(
    (b, kg) => joules(kg, b.chinHeightM - hangStart(b)) + hinge(b),
  ),
  "american-kettlebell-swing": loaded((b, kg) => joules(kg, b.overheadM - hangStart(b)) + hinge(b)),
  "turkish-get-up": loaded((b, kg) => getUp(b) + joules(kg, 0.75 * b.heightM)),
  "dumbbell-burpee-deadlift": loaded(
    (b, kg) => getUp(b) + joules(kg, b.gripHeightM - BELL_FLOOR_M),
  ),
  "wall-ball": {
    perRep: (b, kg) => squat(b) + joules(kg, TARGET_M[b.sex] - b.chinHeightM + b.thighM),
    loaded: true,
  },
  "medicine-ball-clean": loaded(
    (b, kg) => joules(kg, b.shoulderHeightM - BELL_FLOOR_M + b.thighM) + hinge(b) + squat(b),
  ),
  "ball-slam": loaded((b, kg) => joules(kg, b.overheadM - BELL_FLOOR_M) + hinge(b)),
  "sandbag-clean": bellClean,
  "sandbag-to-shoulder": bellClean,
  // Pulling.
  "pull-up": weighted(pullUp),
  "strict-pull-up": weighted(pullUp),
  "weighted-pull-up": weighted(pullUp),
  "l-pull-up": weighted((b, kg) => pullUp(b, kg) + joules(legs(b), 0.2 * b.heightM)),
  "chest-to-bar-pull-up": weighted((b, kg) => joules(hanging(b) + kg, arm(b) + 0.05 * b.heightM)),
  "jumping-pull-up": bodyweight((b) => pullUp(b) / 2),
  "ring-row": bodyweight((b) => joules(0.5 * b.massKg, 0.7 * arm(b))),
  "bar-muscle-up": bodyweight(muscleUp),
  "ring-muscle-up": bodyweight(muscleUp),
  "strict-ring-muscle-up": bodyweight(muscleUp),
  "rope-climb": weighted((b, kg) => joules(b.massKg + kg, ROPE_M - b.overheadM)),
  "legless-rope-climb": weighted((b, kg) => joules(b.massKg + kg, ROPE_M - b.overheadM)),
  "l-sit-rope-climb": weighted((b, kg) => joules(b.massKg + kg, ROPE_M - b.overheadM)),
  // Pushing.
  "push-up": weighted((b, kg) => joules(0.65 * b.massKg + kg, 0.85 * arm(b))),
  "hand-release-push-up": weighted((b, kg) => joules(0.65 * b.massKg + kg, 0.9 * arm(b))),
  "ring-push-up": weighted((b, kg) => joules(0.65 * b.massKg + kg, 0.9 * arm(b))),
  "pike-push-up": bodyweight((b) => joules(0.8 * b.massKg, 0.6 * arm(b))),
  "handstand-push-up": weighted((b, kg) => joules(hanging(b) + kg, 0.85 * arm(b))),
  "strict-handstand-push-up": weighted((b, kg) => joules(hanging(b) + kg, 0.85 * arm(b))),
  "freestanding-handstand-push-up": bodyweight((b) => joules(hanging(b), 0.85 * arm(b))),
  "deficit-handstand-push-up": bodyweight((b) => joules(hanging(b), 0.85 * arm(b) + 0.1)),
  "parallette-handstand-push-up": bodyweight((b) => joules(hanging(b), 0.85 * arm(b) + 0.1)),
  "ring-handstand-push-up": bodyweight((b) => joules(hanging(b), 0.85 * arm(b) + 0.1)),
  "ring-dip": weighted((b, kg) => joules(hanging(b) + kg, 0.6 * arm(b))),
  "strict-ring-dip": weighted((b, kg) => joules(hanging(b) + kg, 0.6 * arm(b))),
  "bar-dip": weighted((b, kg) => joules(hanging(b) + kg, 0.6 * arm(b))),
  // Midline.
  "sit-up": bodyweight((b) => joules(b.upperBodyKg, 0.6 * b.trunkM)),
  "ghd-sit-up": bodyweight((b) => joules(b.upperBodyKg, 0.85 * b.trunkM)),
  "back-extension": bodyweight((b) => joules(b.upperBodyKg, 0.6 * b.trunkM)),
  "toes-to-bar": bodyweight((b) => joules(legs(b), 0.4 * b.heightM)),
  "strict-toes-to-bar": bodyweight((b) => joules(legs(b), 0.4 * b.heightM)),
  "toes-to-ring": bodyweight((b) => joules(legs(b), 0.4 * b.heightM)),
  "knees-to-elbows": bodyweight((b) => joules(legs(b), 0.3 * b.heightM)),
  "hanging-knee-raise": bodyweight((b) => joules(legs(b), 0.15 * b.heightM)),
  "hanging-hip-touch": bodyweight((b) => pullUp(b) / 2),
  // Jumping and getting up.
  burpee: bodyweight(burpee),
  "bar-facing-burpee": bodyweight((b) => burpee(b) + joules(b.massKg, 0.1)),
  "burpee-over-rower": bodyweight((b) => burpee(b) + joules(b.massKg, 0.1)),
  "burpee-to-target": bodyweight((b) => burpee(b) + joules(b.massKg, 0.1)),
  "burpee-box-jump": bodyweight((b) => getUp(b) + box(b)),
  "burpee-box-jump-over": bodyweight((b) => getUp(b) + box(b)),
  "burpee-pull-up": bodyweight((b) => getUp(b) + pullUp(b)),
  "burpee-chest-to-bar-pull-up": bodyweight(
    (b) => getUp(b) + joules(hanging(b), arm(b) + 0.05 * b.heightM),
  ),
  "burpee-muscle-up": bodyweight((b) => getUp(b) + muscleUp(b)),
  "burpee-bar-muscle-up": bodyweight((b) => getUp(b) + muscleUp(b)),
  "box-jump": weighted(box),
  "box-jump-over": weighted(box),
  "box-step-up": weighted(box),
  "box-step-over": weighted(box),
  "barbell-step-up": loaded(box),
  "dumbbell-box-step-up": loaded(box),
  "broad-jump": bodyweight((b) => joules(b.massKg, 0.3)),
  "jumping-jack": bodyweight((b) => joules(b.massKg, 0.05)),
  "single-under": bodyweight((b) => joules(b.massKg, 0.04)),
  "double-under": bodyweight((b) => joules(b.massKg, 0.1)),
  "double-crossover": bodyweight((b) => joules(b.massKg, 0.1)),
  "triple-under": bodyweight((b) => joules(b.massKg, 0.15)),
  "wall-walk": bodyweight((b) => joules(b.massKg, 0.5 * b.heightM)),
  "forward-roll": bodyweight((b) => joules(b.massKg, 0.25 * b.heightM)),
  // Lunges.
  "walking-lunge": lungeModel(false),
  "overhead-walking-lunge": lungeModel(true),
  "dumbbell-walking-lunge": lungeModel(true),
  "front-rack-lunge": lungeModel(true),
  // Machines and running.
  row: erg,
  "ski-erg": erg,
  bike: { perCalorie: () => JOULES_PER_CALORIE, perMeter: () => BIKE_JOULES_PER_METRE },
  run,
  "shuttle-run": run,
  "sled-push": { perMeter: (_b, kg) => joules(SLED_FRICTION * kg, 1), loaded: true },
  "sled-pull": { perMeter: (_b, kg) => joules(SLED_FRICTION * kg, 1), loaded: true },
  // No work against gravity.
  "farmers-carry": none(CARRY),
  "overhead-carry": none(CARRY),
  "front-rack-carry": none(CARRY),
  "plate-carry": none(CARRY),
  "sandbag-carry": none(CARRY),
  "buddy-carry": none(CARRY),
  "waiter-walk": none(CARRY),
  "bear-crawl": none(CARRY),
  "handstand-walk": none(CARRY),
  "dead-hang": none(HOLD),
  "handstand-hold": none(HOLD),
  "ring-lower": none("Lowering only: the work is negative."),
};
