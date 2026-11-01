import { makeMovementMatcher, suggestSpans } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as LanguageModel from "effect/ai/LanguageModel";
import type * as Prompt from "effect/ai/Prompt";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import { CoachModel } from "../coach/CoachService.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as SessionNamer from "./SessionNamer.ts";
import { cleanName, describeForNaming } from "./SessionNamer.ts";
import * as WorkoutStore from "./WorkoutStore.ts";

const usage = { inputTokens: {}, outputTokens: {} };

/** A model that names every session the same and keeps what it was shown. */
const namingModel = (reply: string) => {
  const prompts: Array<Prompt.Prompt> = [];
  const layer = Layer.effect(
    CoachModel,
    LanguageModel.make({
      generateText: (options) => {
        prompts.push(options.prompt);
        return Effect.succeed([
          { type: "text", text: reply },
          { type: "finish", reason: "stop", usage },
        ]);
      },
      streamText: () => Stream.die("naming does not stream"),
    }).pipe(
      Effect.map((languageModel) =>
        CoachModel.of({
          models: Option.some({
            defaultModel: "test/model",
            choices: [{ slug: "test/model", label: "Test", price: null, languageModel }],
          }),
        }),
      ),
    ),
  );
  return { prompts, layer };
};

const stores = Layer.mergeAll(ImportStore.layer, WorkoutStore.layer, CatalogStore.layer).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

describe("SessionNamer", () => {
  it.effect("names an imported session with the model, and leaves a typed name alone", () => {
    const model = namingModel('"Squat and deadlift, thruster finisher."');
    return Effect.gen(function* () {
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const text = "** Session 160 <2026-10-13 ti>\n**** Workout #1\n- Back squat 5x5 @100kg";
      let next = 0;
      const spans = suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`);
      yield* (yield* ImportStore.ImportStore).save({ document: { text, spans } });
      const workouts = yield* WorkoutStore.WorkoutStore;
      yield* workouts.log({
        performedOn: "2026-10-12",
        name: "Cindy",
        kind: "amrap",
        score: "20+3",
        rx: true,
        notes: "",
      });

      yield* Layer.build(SessionNamer.layer.pipe(Layer.provide(model.layer)));
      // The first look runs at once; the clock only has to let the forked look finish.
      yield* TestClock.adjust("1 second");
      const named = () =>
        workouts.list().pipe(Effect.map((all) => all.map((workout) => workout.name)));
      expect(yield* named()).toEqual(["Squat and deadlift, thruster finisher", "Cindy"]);
      // Only the import went to the model, and it read the board as pasted.
      expect(model.prompts).toHaveLength(1);
      expect(JSON.stringify(model.prompts[0])).toContain("- Back squat 5x5 @100kg");
    }).pipe(Effect.scoped, Effect.provide(stores));
  });
});

describe("cleanName", () => {
  it("keeps the name and drops what a model wraps it in", () => {
    expect(cleanName('"Snatch ladder, toes-to-bar AMRAP."\n\nThis names the main lift.')).toBe(
      "Snatch ladder, toes-to-bar AMRAP",
    );
    expect(cleanName("Name: Thruster and pull-up sprint")).toBe("Thruster and pull-up sprint");
  });

  it("never keeps a session number", () => {
    expect(cleanName("Session 171: Front squat triples")).toBe("Front squat triples");
    expect(cleanName("Session No. 12 – Engine 30")).toBe("Engine 30");
  });

  it("cuts a long name at a word", () => {
    const name = cleanName(
      "Heavy back squat triples into a long rowing, burpee and wall ball chipper for time",
    );
    expect(name).toBe("Heavy back squat triples into a long rowing, burpee and");
    expect(name!.length).toBeLessThanOrEqual(60);
  });

  it("gives nothing for an empty reply", () => {
    expect(cleanName('  ""  ')).toBeUndefined();
  });
});

describe("describeForNaming", () => {
  it("hands the model the board as pasted", () => {
    const document = JSON.stringify({ text: "Workout #1\n- Fran", spans: [] });
    expect(
      describeForNaming({ id: "w1", kind: "for_time", score: "3:58", notes: "", document }),
    ).toBe("The board as written:\nWorkout #1\n- Fran\n\nKind: For time\nScore: 3:58");
  });

  it("describes a logged workout by its kind, score and notes", () => {
    expect(
      describeForNaming({
        id: "w2",
        kind: "amrap",
        score: "",
        notes: "Row, burpees, wall balls",
        document: null,
      }),
    ).toBe("Kind: AMRAP\nNotes: Row, burpees, wall balls");
  });
});
