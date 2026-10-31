import {
  makeMovementMatcher,
  suggestSpans,
  WorkoutId,
  type ImportDocument,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import * as ImportStore from "./ImportStore.ts";

const layer = Layer.mergeAll(
  ImportStore.layer,
  CatalogStore.layer,
  StrengthStore.layer,
  WorkoutStore.layer,
).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const SESSION_160 = `** Session 160 <2026-10-13 ti>
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

/** Suggestions against the real seeded catalog, as the editor makes them. */
const suggestedDocument = (text: string) =>
  Effect.gen(function* () {
    const catalog = yield* (yield* CatalogStore.CatalogStore).list();
    let next = 0;
    return {
      text,
      spans: suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`),
    } satisfies ImportDocument;
  });

describe("ImportStore", () => {
  it.effect("stores the workout, its structure, and the lift sets from the notes", () =>
    Effect.gen(function* () {
      const store = yield* ImportStore.ImportStore;
      const document = yield* suggestedDocument(SESSION_160);
      const summary = yield* store.save({ document });
      expect(summary).toMatchObject({
        performedOn: "2026-10-13",
        sessionNumber: 160,
        name: "Session 160",
        partCount: 1,
        // back squat, deadlift, wall ball, and thruster as its alternative
        itemCount: 4,
        liftSetCount: 4,
      });

      const sets = yield* (yield* StrengthStore.StrengthStore).list();
      expect(sets.map((set) => [set.movementId, set.reps, set.loadKg]).sort()).toEqual([
        ["back-squat", 1, 150],
        ["deadlift", 5, 140],
        ["deadlift", 5, 140],
        ["deadlift", 5, 140],
      ]);

      const sql = yield* SqlClient.SqlClient;
      const items = yield* sql<{
        movement: string;
        alternative: string | null;
        prescription: string;
      }>`
        SELECT i.movement_id AS movement, a.movement_id AS alternative, i.prescription
        FROM workout_items i LEFT JOIN workout_items a ON a.id = i.alternative_of
        ORDER BY i.position, i.alternative_of IS NOT NULL
      `;
      expect(items.map((item) => [item.movement, item.alternative])).toEqual([
        ["back-squat", null],
        ["deadlift", null],
        ["wall-ball", null],
        ["thruster", "wall-ball"],
      ]);
      expect(JSON.parse(items[0]!.prescription)).toHaveLength(2);

      const blocks = yield* sql<{ format: string; intent: string }>`
        SELECT format, intent FROM workout_blocks ORDER BY position
      `;
      expect(blocks.map((block) => [block.format, JSON.parse(block.intent)])).toEqual([
        [
          "strength",
          [
            {
              text: "Byg op til en tung single, RPE 9.",
              quantities: [{ measure: "rpe", amount: { min: 9, max: 9 } }],
            },
          ],
        ],
        ["every", []],
      ]);

      const stored = yield* store.get(summary.workoutId);
      expect(stored.document).toEqual(document);
      const [workout] = yield* (yield* WorkoutStore.WorkoutStore).list();
      expect(workout).toMatchObject({ name: "Session 160", kind: "strength", score: "" });
    }).pipe(Effect.provide(layer)),
  );

  it.effect("refuses a duplicate session unless it replaces it, and replacing rewrites", () =>
    Effect.gen(function* () {
      const store = yield* ImportStore.ImportStore;
      const document = yield* suggestedDocument(SESSION_160);
      const first = yield* store.save({ document });

      const conflict = yield* store.save({ document }).pipe(Effect.flip);
      expect(conflict).toMatchObject({
        _tag: "ImportConflictError",
        existing: { workoutId: first.workoutId },
      });

      const withoutNotes = {
        ...document,
        spans: document.spans.filter((span) => span.start < SESSION_160.indexOf("*** Notes")),
      };
      const replaced = yield* store.save({ document: withoutNotes, replace: first.workoutId });
      expect(replaced.liftSetCount).toBe(0);
      expect(yield* store.list()).toEqual([replaced]);
      expect(yield* (yield* StrengthStore.StrengthStore).list()).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("refuses a document with blocking issues", () =>
    Effect.gen(function* () {
      const store = yield* ImportStore.ImportStore;
      const document = yield* suggestedDocument("- 12 Thrusters");
      const invalid = yield* store.save({ document }).pipe(Effect.flip);
      expect(invalid).toMatchObject({
        _tag: "ImportInvalidError",
        problems: ["No date. Highlight it in the text or set it."],
      });
      expect(
        (yield* store.save({ document: { ...document, performedOn: "2026-01-05" } })).name,
      ).toBe("Session 2026-01-05");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("deleting the workout removes the import with everything derived from it", () =>
    Effect.gen(function* () {
      const store = yield* ImportStore.ImportStore;
      const summary = yield* store.save({ document: yield* suggestedDocument(SESSION_160) });
      yield* (yield* WorkoutStore.WorkoutStore).remove(summary.workoutId);

      expect(yield* store.list()).toEqual([]);
      expect(yield* (yield* StrengthStore.StrengthStore).list()).toEqual([]);
      const sql = yield* SqlClient.SqlClient;
      const [counts] = yield* sql<{ parts: number; items: number }>`
        SELECT (SELECT COUNT(*) FROM workout_parts) AS parts, (SELECT COUNT(*) FROM workout_items) AS items
      `;
      expect(counts).toEqual({ parts: 0, items: 0 });
      const missing = yield* store.get(WorkoutId.make(summary.workoutId)).pipe(Effect.flip);
      expect(missing._tag).toBe("ImportNotFoundError");
    }).pipe(Effect.provide(layer)),
  );
});
