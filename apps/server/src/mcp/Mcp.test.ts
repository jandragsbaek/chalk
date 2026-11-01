import {
  ImportSummary,
  makeMovementMatcher,
  suggestSpans,
  type ImportDocument,
  type Span,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as McpTest from "effect/ai/McpTest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as LevelStore from "../levels/LevelStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as PlanStore from "../plan/PlanStore.ts";
import * as RestDayStore from "../rest/RestDayStore.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as BlockStore from "../training/BlockStore.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import { DocumentInspection } from "./inspect.ts";
import * as Mcp from "./Mcp.ts";

const layer = Layer.mergeAll(
  WorkoutStore.layer,
  StrengthStore.layer,
  RestDayStore.layer,
  PlanStore.layer,
  BlockStore.layer,
  ImportStore.layer,
  CatalogStore.layer,
  LevelStore.layer.pipe(Layer.provide(CatalogStore.layer)),
).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const client = McpTest.makeClient(Mcp.registrations, { protocols: Mcp.PROTOCOLS });

const decodeImport = Schema.decodeUnknownEffect(
  Schema.Struct({ summary: ImportSummary, inspection: DocumentInspection }),
);

const SESSION = `** Session 160 <2026-10-13 ti>
*** Workout
**** Workout #1
- Back squat
- Max out!
- *Byg op til en tung single, RPE 9.
- 5 Reps @40%
- 1 rep @85%
- Every 90 sec x 8-10
- 1) 10 Dual DB romanian deadlift
- 2) 12 Wall balls or 15 Thrusters @20 kg
*** Notes
- Back squat 1RM: 150 kg. Failed 155 kg.
- Deadlift 3x5 @ 140 kg`;

const at = (phrase: string, from = 0) => {
  const start = SESSION.indexOf(phrase, from);
  return { start, end: start + phrase.length };
};

/**
 * The editor's suggestions, then what an athlete fixes before saving: the parser reads only
 * "deadlift" of "Dual DB romanian deadlift", so the movement is highlighted again over the whole
 * phrase (and its "10" re-attached), and the back squat gets the result lifted. The editor gives
 * its own span ids, so none match the server's.
 */
const corrected = (catalog: ReadonlyArray<Parameters<typeof makeMovementMatcher>[0][number]>) => {
  let next = 0;
  const suggested = suggestSpans(SESSION, makeMovementMatcher(catalog), () => `s${++next}`);
  const rdl = at("deadlift", SESSION.indexOf("Dual DB"));
  const lifted = at("Back squat");
  const spans: Array<Span> = suggested.map((span) => {
    if (span._tag === "movement" && span.start === rdl.start)
      return { ...span, ...at("Dual DB romanian deadlift") };
    if (span._tag === "movement" && span.start === lifted.start)
      return { ...span, result: { _tag: "fixed", sets: 1, reps: 1, loadKg: 150 } };
    return span;
  });
  const ids = new Map(spans.map((span, index) => [span.id, `e${index + 1}`]));
  const renamed = spans.map((span): Span => {
    const id = ids.get(span.id)!;
    if (span._tag === "quantity" && span.attachedTo !== undefined)
      return { ...span, id, attachedTo: ids.get(span.attachedTo)! };
    if (span._tag === "movement" && span.alternativeOf !== undefined)
      return { ...span, id, alternativeOf: ids.get(span.alternativeOf)! };
    return { ...span, id };
  });
  return { text: SESSION, spans: renamed } satisfies ImportDocument;
};

describe("Chalk MCP server", () => {
  it.effect("gives every tool an object result, as MCP clients require", () =>
    Effect.gen(function* () {
      const { tools } = yield* (yield* client).listTools();
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.outputSchema?.["type"], tool.name).toBe("object");
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      }
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

  it.effect("reviews an import's saved spans against what the parser suggests", () =>
    Effect.gen(function* () {
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const { workoutId } = yield* (yield* ImportStore.ImportStore).save({
        document: corrected(catalog),
      });

      const result = yield* (yield* client).callTool({
        name: "get_import",
        arguments: { workoutId },
      });
      expect(result.isError).toBeFalsy();
      const { inspection } = yield* decodeImport(result.structuredContent);
      const { review } = inspection;

      expect(review.missed.map((view) => [view.line, view.text, view.span._tag])).toEqual([
        [10, "Dual DB romanian deadlift", "movement"],
      ]);
      expect(review.extra.map((view) => [view.line, view.text, view.span._tag])).toEqual([
        [10, "deadlift", "movement"],
      ]);
      // The "10" hangs off the re-highlighted movement now; the parser hung it off "deadlift".
      expect(
        review.changed.map(({ saved, suggested }) => [saved.text, saved.of, suggested.of]),
      ).toEqual([["10", '"Dual DB romanian deadlift" (line 10)', '"deadlift" (line 10)']]);
      // The back squat's result is the athlete's entry, not a reading the parser got wrong.
      expect(review.agreed).toBe(inspection.spans.length - 2);
      expect(inspection.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

  it.effect("answers an unknown import with a message the agent can act on", () =>
    Effect.gen(function* () {
      const result = yield* (yield* client).callTool({
        name: "get_import",
        arguments: { workoutId: "not-a-workout" },
      });
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify({ message: "No imported session for workout not-a-workout." }),
        },
      ]);
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );
});
