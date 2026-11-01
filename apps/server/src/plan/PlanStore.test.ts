import {
  makeMovementMatcher,
  MovementId,
  PlanId,
  suggestSpans,
  type ImportDocument,
  type Span,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import * as PlanStore from "./PlanStore.ts";

const layer = Layer.mergeAll(
  PlanStore.layer,
  ImportStore.layer,
  CatalogStore.layer,
  WorkoutStore.layer,
).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

// The board as the box posts it in the morning: no session heading, so no date span.
const POSTED = `For time
21-15-9
Thrusters @43 kg
Pull-ups`;

const posted = (planned: (span: Span) => Span = (span) => span) =>
  Effect.gen(function* () {
    const catalog = yield* (yield* CatalogStore.CatalogStore).list();
    let next = 0;
    return {
      text: POSTED,
      spans: suggestSpans(POSTED, makeMovementMatcher(catalog), () => `s${++next}`).map(planned),
      performedOn: "2026-11-01",
    } satisfies ImportDocument;
  });

/** Thrusters at 30 kg, pull-ups split between jumping and kipping. */
const scaled = (span: Span): Span => {
  if (span._tag !== "movement") return span;
  if (span.movementId === "thruster") return { ...span, plan: { loadKg: 30 } };
  if (span.movementId === "pull-up")
    return {
      ...span,
      plan: {
        variants: [
          { movementId: MovementId.make("jumping-pull-up"), reps: 25 },
          { movementId: MovementId.make("pull-up"), reps: 20 },
        ],
      },
    };
  return span;
};

describe("PlanStore", () => {
  it.effect("keeps a posted workout with its planned scaling, counted nowhere until logged", () =>
    Effect.gen(function* () {
      const plans = yield* PlanStore.PlanStore;
      const document = yield* posted(scaled);
      const plan = yield* plans.save({ document });

      expect(plan).toMatchObject({ plannedOn: "2026-11-01", document });
      expect(yield* plans.list()).toEqual([plan]);
      expect(yield* plans.get(plan.id)).toEqual(plan);
      expect(yield* (yield* WorkoutStore.WorkoutStore).list()).toEqual([]);
      expect(yield* (yield* ImportStore.ImportStore).list()).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("rewrites a plan in place, and refuses one that is gone", () =>
    Effect.gen(function* () {
      const plans = yield* PlanStore.PlanStore;
      const first = yield* plans.save({ document: yield* posted() });
      const moved = { ...(yield* posted(scaled)), performedOn: "2026-11-02" };
      const second = yield* plans.save({ id: first.id, document: moved });

      expect(second).toMatchObject({ id: first.id, plannedOn: "2026-11-02", document: moved });
      expect(yield* plans.list()).toEqual([second]);

      const gone = PlanId.make("no-such-plan");
      expect((yield* plans.save({ id: gone, document: moved }).pipe(Effect.flip))._tag).toBe(
        "PlanNotFoundError",
      );
      expect((yield* plans.remove(gone).pipe(Effect.flip))._tag).toBe("PlanNotFoundError");
      yield* plans.remove(first.id);
      expect(yield* plans.list()).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("refuses a plan the importer would refuse: no day, or an unresolved movement", () =>
    Effect.gen(function* () {
      const plans = yield* PlanStore.PlanStore;
      const { performedOn: _day, ...undated } = yield* posted();
      const invalid = yield* plans.save({ document: undated }).pipe(Effect.flip);
      expect(invalid._tag).toBe("ImportInvalidError");

      const document = yield* posted();
      const unresolved: ImportDocument = {
        ...document,
        spans: [...document.spans, { _tag: "movement", id: "x", start: 0, end: 3 }],
      };
      expect((yield* plans.save({ document: unresolved }).pipe(Effect.flip))._tag).toBe(
        "ImportInvalidError",
      );
      expect(yield* plans.list()).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect(
    "logging the session from its plan removes the plan and keeps it beside the result",
    () =>
      Effect.gen(function* () {
        const plans = yield* PlanStore.PlanStore;
        const imports = yield* ImportStore.ImportStore;
        const plan = yield* plans.save({ document: yield* posted(scaled) });
        const done: ImportDocument = {
          ...plan.document,
          spans: plan.document.spans.map((span) =>
            span._tag === "movement" && span.movementId === "thruster"
              ? { ...span, performance: { loadKg: 35 } }
              : span,
          ),
        };

        const summary = yield* imports.save({ document: done, fromPlan: plan.id });
        expect(yield* plans.list()).toEqual([]);
        const stored = yield* imports.get(summary.workoutId);
        const thruster = stored.document.spans.find(
          (span) => span._tag === "movement" && span.movementId === "thruster",
        );
        expect(thruster).toMatchObject({ plan: { loadKg: 30 }, performance: { loadKg: 35 } });
      }).pipe(Effect.provide(layer)),
  );
});
