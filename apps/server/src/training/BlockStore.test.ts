import { lineLoadKg, MovementId, type DraftBlockInput } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as BlockStore from "./BlockStore.ts";

const layer = BlockStore.layer.pipe(
  Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const squat = MovementId.make("back-squat");

const smolov: DraftBlockInput = {
  name: "Smolov Jr · back squat",
  goal: "Three weeks of squat volume around the box classes.",
  trainingMaxes: [{ movementId: squat, kg: 150 }],
  sessions: [
    {
      day: "2026-11-04",
      title: "Week 1 · Day 2",
      lines: [{ movementId: squat, name: "Back squat", sets: 7, reps: 5, percent: 75 }],
    },
    {
      day: "2026-11-02",
      title: "Week 1 · Day 1",
      note: "before class",
      lines: [
        { movementId: squat, name: "Back squat", sets: 6, reps: 6, percent: 70 },
        { name: "Band pull-apart", sets: 3, reps: 20, load: "light band" },
      ],
    },
  ],
};

describe("BlockStore", () => {
  it.effect("saves a draft with its sessions by day, then puts it in the calendar", () =>
    Effect.gen(function* () {
      const store = yield* BlockStore.BlockStore;
      const draft = yield* store.draft(smolov, "coach");
      expect(draft.status).toBe("draft");
      expect(draft.source).toBe("coach");
      expect(draft.sessions.map((session) => session.title)).toEqual([
        "Week 1 · Day 1",
        "Week 1 · Day 2",
      ]);
      expect(draft.sessions[0]?.note).toBe("before class");
      const first = draft.sessions[0]?.lines[0];
      expect(first && lineLoadKg(first, draft.trainingMaxes)).toBe(105);

      const scheduled = yield* store.schedule(draft.id);
      expect(scheduled.status).toBe("scheduled");
      expect(yield* store.list()).toHaveLength(1);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("refuses a percent with no training max, and an unknown movement", () =>
    Effect.gen(function* () {
      const store = yield* BlockStore.BlockStore;
      const error = yield* store
        .draft(
          {
            ...smolov,
            trainingMaxes: [],
            sessions: [
              {
                day: "2026-11-02",
                title: "Day 1",
                lines: [
                  { movementId: squat, name: "Back squat", sets: 5, reps: 5, percent: 70 },
                  { movementId: MovementId.make("zercher-lunge"), name: "Zercher lunge" },
                ],
              },
            ],
          },
          "coach",
        )
        .pipe(Effect.flip);
      expect(error._tag).toBe("BlockInvalidError");
      expect(error._tag === "BlockInvalidError" && error.problems).toHaveLength(2);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("rewrites a draft in place, but not a block already in the calendar", () =>
    Effect.gen(function* () {
      const store = yield* BlockStore.BlockStore;
      const draft = yield* store.draft(smolov, "coach");
      const revised = yield* store.draft(
        { ...smolov, name: "Smolov Jr, lighter", sessions: smolov.sessions.slice(0, 1) },
        "coach",
        draft.id,
      );
      expect(revised.id).toBe(draft.id);
      expect(revised.name).toBe("Smolov Jr, lighter");
      expect(revised.sessions).toHaveLength(1);

      yield* store.schedule(draft.id);
      const refused = yield* store.draft(smolov, "coach", draft.id).pipe(Effect.flip);
      expect(refused._tag).toBe("BlockNotFoundError");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("moves one session, ticks lines, rescales on a new training max", () =>
    Effect.gen(function* () {
      const store = yield* BlockStore.BlockStore;
      const block = yield* store.draft(smolov, "coach");
      const [dayOne, dayTwo] = block.sessions;
      if (dayOne === undefined || dayTwo === undefined) return expect.fail("two sessions");

      const moved = yield* store.move(dayOne.id, "2026-11-03");
      expect(moved.day).toBe("2026-11-03");

      yield* store.tick(dayOne.id, 1, true);
      const ticked = yield* store.tick(dayOne.id, 0, true);
      expect(ticked.ticked).toEqual([0, 1]);
      expect((yield* store.tick(dayOne.id, 1, false)).ticked).toEqual([0]);

      const rescaled = yield* store.setTrainingMax(block.id, { movementId: squat, kg: 160 });
      const session = rescaled.sessions.find((entry) => entry.id === dayTwo.id);
      const line = session?.lines[0];
      expect(line && lineLoadKg(line, rescaled.trainingMaxes)).toBe(120);
      expect(rescaled.sessions.find((entry) => entry.id === dayOne.id)?.day).toBe("2026-11-03");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("removes a session, then the whole block", () =>
    Effect.gen(function* () {
      const store = yield* BlockStore.BlockStore;
      const block = yield* store.draft(smolov, "athlete");
      const first = block.sessions[0];
      if (first === undefined) return expect.fail("a session");
      yield* store.removeSession(first.id);
      expect((yield* store.list())[0]?.sessions).toHaveLength(1);
      yield* store.remove(block.id);
      expect(yield* store.list()).toEqual([]);
      expect((yield* store.remove(block.id).pipe(Effect.flip))._tag).toBe("BlockNotFoundError");
    }).pipe(Effect.provide(layer)),
  );
});
