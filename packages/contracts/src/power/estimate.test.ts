import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import { benchmarkById } from "../benchmarks/index.ts";
import type { CatalogMovement, ImportDocument, Span } from "../sessionImport.ts";
import { deriveSession } from "../sessionImport/derive.ts";
import { CATALOG, SESSION_167, SNATCH_EMOM } from "../sessionImport/fixtures/sessions.ts";
import { makeMovementMatcher } from "../sessionImport/movementMatcher.ts";
import { suggestSpans } from "../sessionImport/suggest.ts";
import { bodyOf } from "./body.ts";
import {
  estimateBenchmarkWork,
  estimateBlockWork,
  estimateSessionWork,
  workModelsFor,
  type WorkBlock,
  type WorkItem,
} from "./estimate.ts";

const matcher = makeMovementMatcher(CATALOG);
const nameOf = (id: MovementId) => CATALOG.find((movement) => movement.id === id)?.name;
const modelOf = workModelsFor([]);
const jan = bodyOf({ sex: "m", heightCm: 180, bodyweightKg: 85 });

const documentOf = (text: string, extra: ReadonlyArray<Span> = []): ImportDocument => {
  let next = 0;
  return { text, spans: [...suggestSpans(text, matcher, () => `s${++next}`), ...extra] };
};

const item = (movementId: string, overrides: Partial<WorkItem> = {}): WorkItem => ({
  movementId: MovementId.make(movementId),
  text: movementId,
  sets: [],
  performed: [],
  performance: undefined,
  alternatives: [],
  ...overrides,
});

const reps = (count: number, female?: number) => ({
  quantities: [
    {
      measure: "reps" as const,
      amount: { min: count, max: count },
      ...(female === undefined ? {} : { female: { min: female, max: female } }),
    },
  ],
});

describe("bodyOf", () => {
  it("scales segments with height and masses with bodyweight", () => {
    const tall = bodyOf({ sex: "m", heightCm: 200, bodyweightKg: 85 });
    expect(tall.thighM).toBeGreaterThan(jan.thighM);
    expect(tall.overheadM / jan.overheadM).toBeCloseTo(200 / 180);
    expect(jan.overheadM).toBeGreaterThan(jan.shoulderHeightM);
    expect(jan.gripHeightM).toBeLessThan(jan.hipHeightM);
    const total = jan.upperBodyKg + jan.thighsKg + jan.shanksKg + jan.feetKg;
    expect(total).toBeCloseTo(85, 0);
  });

  it("uses a measured arm or leg over the estimate, unless it is implausible", () => {
    const longArms = bodyOf({ sex: "m", heightCm: 180, bodyweightKg: 85, armLengthCm: 75 });
    expect(longArms.overheadM - longArms.shoulderHeightM).toBeCloseTo(0.75);
    const longLegs = bodyOf({ sex: "m", heightCm: 180, bodyweightKg: 85, legLengthCm: 92 });
    expect(longLegs.thighM).toBeGreaterThan(jan.thighM);
    const typo = bodyOf({ sex: "m", heightCm: 180, bodyweightKg: 85, armLengthCm: 6.6 });
    expect(typo.upperArmM).toBeCloseTo(jan.upperArmM);
  });
});

describe("estimateBenchmarkWork", () => {
  const fran = benchmarkById("fran")!;

  it("turns a time into watts: the same work in half the time is twice the power", () => {
    const slow = estimateBenchmarkWork(fran, "6:00", jan, modelOf)!;
    const fast = estimateBenchmarkWork(fran, "3:00", jan, modelOf)!;
    expect(slow.joules).toBeCloseTo(fast.joules);
    expect(fast.watts).toBeCloseTo(slow.watts * 2);
    expect(fast.leftOut).toEqual([]);
    // 45 thrusters at 43 kg and 45 pull-ups for an 85 kg athlete: about 60 kJ.
    expect(fast.joules / 1000).toBeGreaterThan(45);
    expect(fast.joules / 1000).toBeLessThan(75);
  });

  it("moves more for a heavier athlete", () => {
    const heavy = bodyOf({ sex: "m", heightCm: 180, bodyweightKg: 100 });
    expect(estimateBenchmarkWork(fran, "4:00", heavy, modelOf)!.joules).toBeGreaterThan(
      estimateBenchmarkWork(fran, "4:00", jan, modelOf)!.joules,
    );
  });

  it("counts an AMRAP benchmark's rounds and partial round over its length", () => {
    const cindy = benchmarkById("cindy")!;
    const twenty = estimateBenchmarkWork(cindy, "20", jan, modelOf)!;
    const more = estimateBenchmarkWork(cindy, "20+5", jan, modelOf)!;
    expect(twenty.seconds).toBe(20 * 60);
    expect(more.joules).toBeGreaterThan(twenty.joules);
    expect(estimateBenchmarkWork(cindy, "DNF", jan, modelOf)).toBeUndefined();
  });

  it("lifts two dumbbells where the board says so", () => {
    const ellen = benchmarkById("ellen")!;
    const doubled = estimateBenchmarkWork(ellen, "15:00", jan, modelOf)!;
    // The same workout with the thrusters' note dropped: one dumbbell.
    const single = estimateBenchmarkWork(
      {
        ...ellen,
        blocks: ellen.blocks.map((block) => ({
          ...block,
          items: block.items.map(({ note: _note, ...item }) => item),
        })),
      },
      "15:00",
      jan,
      modelOf,
    )!;
    expect(doubled.joules).toBeGreaterThan(single.joules);
  });

  it("has no number without a score", () => {
    expect(estimateBenchmarkWork(fran, "", jan, modelOf)).toBeUndefined();
  });
});

describe("estimateBlockWork", () => {
  const forTime = (items: ReadonlyArray<WorkItem>, scores = ["5:00"]): WorkBlock => ({
    format: "for_time",
    params: {},
    items,
    scores,
  });

  it("counts carries as no work and says why a movement is left out", () => {
    const work = estimateBlockWork(
      forTime([
        item("farmers-carry", {
          sets: [
            {
              quantities: [
                { measure: "distance_m", amount: { min: 50, max: 50 } },
                { measure: "load_kg", amount: { min: 32, max: 32 } },
              ],
            },
          ],
        }),
        item("made-up-move", { sets: [reps(10)] }),
        item("thruster", { sets: [reps(10)] }),
      ]),
      jan,
      modelOf,
    );
    expect(work.joules).toBe(0);
    expect(work.skipped).toBeUndefined();
    expect(work.items.map((counted) => counted.movementId)).toEqual(["farmers-carry"]);
    expect(work.leftOut.map((left) => [left.movementId, left.reason])).toEqual([
      ["made-up-move", "No work model for this movement yet."],
      ["thruster", "No load to count (a percentage of 1RM is not read yet)."],
    ]);
  });

  it("has no number for a block where nothing could be counted, and says what was left out", () => {
    const work = estimateBlockWork(
      {
        format: "every",
        params: { intervalSeconds: 90, rounds: { min: 6, max: 6 } },
        items: [item("power-clean", { sets: [reps(1)] })],
        scores: [],
      },
      jan,
      modelOf,
    );
    expect(work.skipped).toBe("Nothing it could count.");
    expect(work.watts).toBeUndefined();
    expect(work.leftOut.map((left) => left.movementId)).toEqual(["power-clean"]);
  });

  it("works a variation without a model as its core movement", () => {
    const catalog: ReadonlyArray<CatalogMovement> = [
      {
        id: MovementId.make("pause-front-squat"),
        name: "Pause front squat",
        category: "barbell",
        aliases: [],
        variationOf: MovementId.make("front-squat"),
      },
    ];
    const lifted = (id: string) =>
      estimateBlockWork(
        {
          format: "strength",
          params: {},
          items: [item(id, { performed: [{ reps: 3, loadKg: 100 }] })],
          scores: [],
        },
        jan,
        workModelsFor(catalog),
      ).joules;
    expect(lifted("pause-front-squat")).toBeCloseTo(lifted("front-squat"));
  });

  it("counts lifted sets each at its own load", () => {
    const sets = (performed: WorkItem["performed"]) =>
      estimateBlockWork(
        { format: "strength", params: {}, items: [item("deadlift", { performed })], scores: [] },
        jan,
        modelOf,
      );
    const light = sets([{ reps: 5, loadKg: 100 }]);
    const ramp = sets([
      { reps: 5, loadKg: 100 },
      { reps: 5, loadKg: 140 },
    ]);
    expect(ramp.items).toHaveLength(2);
    expect(ramp.joules).toBeGreaterThan(2 * light.joules);
    expect(light.watts).toBeUndefined();
  });

  it("splits the reps over the variations done", () => {
    const pullUps = (performance: WorkItem["performance"]) =>
      estimateBlockWork(
        forTime([item("pull-up", { sets: [reps(50)], performance })]),
        jan,
        modelOf,
      );
    const jumping = pullUps({
      variants: [
        { movementId: MovementId.make("pull-up"), reps: 6 },
        { movementId: MovementId.make("jumping-pull-up"), reps: 44 },
      ],
    });
    expect(jumping.items.map((counted) => [counted.movementId, counted.amount])).toEqual([
      ["pull-up", 6],
      ["jumping-pull-up", 44],
    ]);
    expect(jumping.joules).toBeLessThan(pullUps(undefined).joules);
  });

  it("counts shuttle runs as lengths: 7.5 m unless the board writes the length", () => {
    const catalog: ReadonlyArray<CatalogMovement> = [
      {
        id: MovementId.make("shuttle-run"),
        name: "Shuttle run",
        category: "monostructural",
        aliases: [],
      },
      {
        id: MovementId.make("walking-lunge"),
        name: "Walking lunge",
        category: "gymnastics",
        aliases: [],
      },
    ];
    const shuttles = makeMovementMatcher(catalog);
    const joulesOf = (line: string) => {
      const text = `For time\n${line}\n`;
      let next = 0;
      const session = deriveSession(
        { text, spans: suggestSpans(text, shuttles, () => `s${++next}`) },
        (id) => id,
      );
      return estimateSessionWork(session, jan, modelOf).parts[0]!.blocks[0]!.work.joules;
    };
    // Running work is 1 J per kg per metre, so an 85 kg athlete's joules / 85 are metres.
    const metres = (line: string) => joulesOf(line) / 85;
    expect(metres("10 shuttle runs")).toBeCloseTo(75);
    expect(metres("10 shuttle runs 10m")).toBeCloseTo(100);
    expect(metres("10 shuttle runs (7,5 m)")).toBeCloseTo(75);
    expect(metres("10 x 10 m shuttle run")).toBeCloseTo(100);
    // A count each round is in reps, so 8 shuttles of 10 m a round are 80 m.
    const amrap = (perRound: number) =>
      estimateBlockWork(
        {
          format: "amrap",
          params: { durationSeconds: 600 },
          items: [
            item("shuttle-run", {
              sets: [
                {
                  quantities: [
                    { measure: "reps", amount: { min: 10, max: 10 } },
                    { measure: "distance_m", amount: { min: 10, max: 10 } },
                  ],
                },
              ],
              performance: { perRound: { min: perRound, max: perRound } },
            }),
          ],
          scores: ["5+0"],
        },
        jan,
        modelOf,
      );
    expect(amrap(8).items.map((counted) => [counted.unit, counted.amount])).toEqual([["m", 400]]);
    // Sets of a distance hold for any movement counted in metres.
    expect(joulesOf("4 x 10m walking lunges")).toBeCloseTo(joulesOf("40 m walking lunges"));
  });

  it("reads the female side of a split for a female athlete", () => {
    const her = bodyOf({ sex: "f", heightCm: 180, bodyweightKg: 85 });
    const work = estimateBlockWork(
      forTime([
        item("row", {
          sets: [
            {
              quantities: [
                { measure: "calories", amount: { min: 20, max: 20 }, female: { min: 15, max: 15 } },
              ],
            },
          ],
        }),
      ]),
      her,
      modelOf,
    );
    expect(work.items[0]?.amount).toBe(15);
  });
});

describe("estimateSessionWork", () => {
  it("counts an AMRAP from its score: full rounds plus the partial one", () => {
    const text = `${SESSION_167}\n- Score: 5+12`;
    const document = documentOf(text);
    const amrap = document.spans.find(
      (span): span is Extract<Span, { _tag: "block" }> =>
        span._tag === "block" && span.format === "amrap",
    )!;
    const scoreAt = text.indexOf("5+12");
    const scored: ImportDocument = {
      ...document,
      spans: [
        ...document.spans.filter((span) => span._tag !== "score"),
        { _tag: "score", id: "score", start: scoreAt, end: scoreAt + 4, attachedTo: amrap.id },
      ],
    };
    const blockOf = (doc: ImportDocument) =>
      estimateSessionWork(deriveSession(doc, nameOf), jan, modelOf).parts[1]!.blocks[0]!.work;

    const work = blockOf(scored);
    expect(work.seconds).toBe(15 * 60);
    // 5 rounds of 60 double-unders, 12 thrusters, 10 burpees, and 12 more reps: the first 12 DUs.
    const amounts = Object.fromEntries(
      work.items.map((counted) => [counted.movementId, counted.amount]),
    );
    expect(amounts).toMatchObject({ "double-under": 312, thruster: 60, burpee: 50 });
    expect(work.watts).toBeCloseTo(work.joules / 900);

    const unscored = blockOf({
      ...document,
      spans: document.spans.filter((span) => span._tag !== "score"),
    });
    expect(unscored.skipped).toBe("AMRAP without a score.");
  });

  it("rotates an EMOM's numbered lines, rest included, one per minute", () => {
    const session = deriveSession(
      documentOf(`** Session 1 <2026-10-01 on>\n*** Workout\n${SNATCH_EMOM}`),
      nameOf,
    );
    const emom = session.parts[1]!.blocks.find((block) => block.format === "emom")!;
    expect(emom.rotation).toBe(4);
    const work = estimateBlockWork(emom, jan, modelOf);
    expect(work.seconds).toBe(16 * 60);
    // Four times through "18-15/15-12 cal": the board's range, 15 to 18, averaged.
    expect(work.items.find((counted) => counted.movementId === "row")?.amount).toBe(4 * 16.5);
  });
});
