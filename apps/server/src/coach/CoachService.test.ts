import { COACH_MODELS, CoachThreadId, MovementId, type CoachEvent } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as AiError from "effect/ai/AiError";
import * as ConfigProvider from "effect/ConfigProvider";
import * as LanguageModel from "effect/ai/LanguageModel";
import type * as Response from "effect/ai/Response";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import * as CoachService from "./CoachService.ts";
import * as CoachStore from "./CoachStore.ts";

const usage = { inputTokens: {}, outputTokens: {} };

const toolCalls = (
  calls: ReadonlyArray<{ readonly name: string; readonly params: unknown }>,
): Array<Response.PartEncoded> => [
  ...calls.map(({ name, params }, index): Response.PartEncoded => ({
    type: "tool-call",
    id: `call-${name}-${index}-${Math.random().toString(36).slice(2)}`,
    name,
    params,
  })),
  { type: "finish", reason: "tool-calls", usage },
];

const text = (value: string): Array<Response.PartEncoded> => [
  { type: "text", text: value },
  { type: "finish", reason: "stop", usage },
];

/**
 * A model that answers from a script: each call gets the options it was sent and returns the
 * parts the script picks. Calls are kept with the slug that took them, so a test can check what
 * the model was shown and which model answered. Offers "test/model" (the default) and
 * "test/other".
 */
const scriptedModel = (
  script: (
    options: LanguageModel.ProviderOptions,
    call: number,
  ) => Effect.Effect<Array<Response.PartEncoded>, AiError.AiError>,
) => {
  const calls: Array<LanguageModel.ProviderOptions> = [];
  const slugs: Array<string> = [];
  const choice = (slug: string) =>
    LanguageModel.make({
      generateText: (options) => {
        calls.push(options);
        slugs.push(slug);
        return script(options, calls.length);
      },
      streamText: () => Stream.die("the coach does not stream from the model"),
    }).pipe(
      Effect.map((languageModel): CoachService.CoachModelChoice => ({
        slug,
        label: slug,
        price: null,
        languageModel,
      })),
    );
  const model = Layer.effect(
    CoachService.CoachModel,
    Effect.all([choice("test/model"), choice("test/other")]).pipe(
      Effect.map((choices) =>
        CoachService.CoachModel.of({
          models: Option.some({ defaultModel: "test/model", choices }),
        }),
      ),
    ),
  );
  return { calls, slugs, model };
};

const noModel = Layer.succeed(
  CoachService.CoachModel,
  CoachService.CoachModel.of({ models: Option.none() }),
);

const layerWith = <E>(
  model: Layer.Layer<CoachService.CoachModel, E>,
  coachStore: typeof CoachStore.layer = CoachStore.layer,
) =>
  CoachService.layer.pipe(
    Layer.provide(model),
    Layer.provideMerge(
      Layer.mergeAll(coachStore, StrengthStore.layer, WorkoutStore.layer).pipe(
        Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
        Layer.provide(ServerConfig.layerTest()),
      ),
    ),
  );

const squat = MovementId.make("back-squat");

const seedSquats = Effect.gen(function* () {
  const strength = yield* StrengthStore.StrengthStore;
  yield* strength.log({
    movementId: squat,
    performedOn: "2026-09-12",
    reps: 5,
    loadKg: 115,
    notes: "",
  });
  yield* strength.log({
    movementId: squat,
    performedOn: "2026-10-30",
    reps: 5,
    loadKg: 110,
    notes: "",
  });
});

const send = (input: Parameters<CoachService.CoachService["Service"]["send"]>[0]) =>
  Effect.gen(function* () {
    const coach = yield* CoachService.CoachService;
    return Array.from(yield* Stream.runCollect(coach.send(input)));
  });

const last = <A>(events: ReadonlyArray<A>) => events[events.length - 1];

describe("CoachService", () => {
  it.effect("says it is unavailable without a model, and saves nothing", () =>
    Effect.gen(function* () {
      const coach = yield* CoachService.CoachService;
      expect(yield* coach.status()).toEqual({ available: false, defaultModel: null, models: [] });
      const error = yield* send({ text: "How is my squat?" }).pipe(Effect.flip);
      expect(error._tag).toBe("CoachUnavailableError");
      expect(yield* coach.threads()).toEqual([]);
    }).pipe(Effect.provide(layerWith(noModel))),
  );

  const readsThenAnswers = scriptedModel((options) =>
    Effect.succeed(
      options.prompt.content.at(-1)?.role === "tool"
        ? text("Five sets at 110 kg, under the 115 kg 5RM (R1).")
        : toolCalls([{ name: "get_rep_maxes", params: { movementId: "back-squat" } }]),
    ),
  );

  it.effect("streams each read as a receipt, saves both turns, and resumes the thread", () =>
    Effect.gen(function* () {
      yield* seedSquats;
      const first = yield* send({ text: "How is my squat?" });
      expect(first.map((event) => event._tag)).toEqual([
        "AthleteTurn",
        "ReadStarted",
        "ReadFinished",
        "CoachTurn",
      ]);
      const receipt = (first[2] as Extract<CoachEvent, { _tag: "ReadFinished" }>).receipt;
      expect(receipt).toMatchObject({
        number: 1,
        tool: "get_rep_maxes",
        request: [{ tag: "movement", text: "Back squat" }],
        status: "ok",
        columns: ["Movement", "RM", "Load", "Date"],
      });
      expect(receipt.rows).toContainEqual(["Back squat", "5RM", "115 kg", "12 Sep 2026"]);
      expect(receipt.summary).toMatch(/^e1RM 134\.2 kg/);

      const reply = last(first) as Extract<CoachEvent, { _tag: "CoachTurn" }>;
      expect(reply.turn).toMatchObject({
        seq: 2,
        role: "coach",
        text: "Five sets at 110 kg, under the 115 kg 5RM (R1).",
      });
      expect(reply.thread).toMatchObject({
        title: "How is my squat?",
        turns: 2,
        reads: 1,
        unanswered: false,
      });

      // The second message continues the thread: receipts keep counting, the model sees it all.
      const second = yield* send({ threadId: reply.thread.id, text: "And the deadlift?" });
      const again = second.find(
        (event): event is Extract<CoachEvent, { _tag: "ReadFinished" }> =>
          event._tag === "ReadFinished",
      );
      expect(again?.receipt.number).toBe(2);
      const resumed = readsThenAnswers.calls[2];
      const said = JSON.stringify(resumed?.prompt.content);
      expect(said).toContain("How is my squat?");
      expect(said).toContain("And the deadlift?");
      expect(resumed?.prompt.content.filter((message) => message.role === "system")).toHaveLength(
        1,
      );

      const coach = yield* CoachService.CoachService;
      const detail = yield* coach.thread(reply.thread.id);
      expect(detail.turns.map((turn) => [turn.seq, turn.role, turn.receipts.length])).toEqual([
        [1, "athlete", 0],
        [2, "coach", 1],
        [3, "athlete", 0],
        [4, "coach", 1],
      ]);
      expect(detail.thread.reads).toBe(2);
    }).pipe(Effect.provide(layerWith(readsThenAnswers.model))),
  );

  const picked = scriptedModel(() => Effect.succeed(text("Answered.")));

  it.effect("answers with the model the athlete picked, and refuses one it does not offer", () =>
    Effect.gen(function* () {
      const coach = yield* CoachService.CoachService;
      expect(yield* coach.status()).toMatchObject({
        available: true,
        defaultModel: "test/model",
        models: [{ slug: "test/model" }, { slug: "test/other" }],
      });

      const first = last(yield* send({ text: "Default, please." })) as Extract<
        CoachEvent,
        { _tag: "CoachTurn" }
      >;
      expect(first.turn.model).toBe("test/model");

      // Switching mid-thread: the reply and the thread both carry the new model.
      const second = last(
        yield* send({ threadId: first.thread.id, text: "Now the other one.", model: "test/other" }),
      ) as Extract<CoachEvent, { _tag: "CoachTurn" }>;
      expect(picked.slugs).toEqual(["test/model", "test/other"]);
      expect(second.turn.model).toBe("test/other");
      expect(second.thread.model).toBe("test/other");
      const detail = yield* coach.thread(first.thread.id);
      expect(detail.turns.map((turn) => [turn.role, turn.model])).toEqual([
        ["athlete", undefined],
        ["coach", "test/model"],
        ["athlete", undefined],
        ["coach", "test/other"],
      ]);

      const error = yield* send({ text: "Use mine.", model: "openai/gpt-4o" }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "CoachModelNotAllowedError", model: "openai/gpt-4o" });
      expect(yield* coach.threads()).toHaveLength(1);
      expect(picked.slugs).toHaveLength(2);
    }).pipe(Effect.provide(layerWith(picked.model))),
  );

  const greedy = scriptedModel((options) =>
    Effect.succeed(
      options.toolChoice === "none"
        ? text("That is all I could read.")
        : toolCalls([
            { name: "list_movements", params: { query: "squat" } },
            { name: "list_movements", params: { query: "clean" } },
            { name: "list_movements", params: {} },
          ]),
    ),
  );

  it.effect("stops reading at the budget and still answers", () =>
    Effect.gen(function* () {
      const events = yield* send({ text: "Read everything." });
      const reply = last(events) as Extract<CoachEvent, { _tag: "CoachTurn" }>;
      expect(reply.turn.receipts).toHaveLength(CoachService.MAX_READS);
      expect(reply.turn.receipts.map((receipt) => receipt.number)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(reply.turn.stopped).toBe("read-limit");
      expect(reply.turn.text).toBe("That is all I could read.");
      expect(greedy.calls).toHaveLength(CoachService.MAX_STEPS);
    }).pipe(Effect.provide(layerWith(greedy.model))),
  );

  const failing = scriptedModel(() =>
    Effect.fail(
      AiError.make({
        module: "test",
        method: "generateText",
        reason: new AiError.UnknownError({ description: "upstream 500" }),
      }),
    ),
  );

  it.effect("saves a failed reply as a stopped turn, so the thread stays whole", () =>
    Effect.gen(function* () {
      const events = yield* send({ text: "Anything?" });
      const reply = last(events) as Extract<CoachEvent, { _tag: "CoachTurn" }>;
      expect(reply.turn).toMatchObject({ role: "coach", stopped: "model-error", receipts: [] });
      expect(reply.turn.text).toContain("could not answer");
      expect(reply.thread).toMatchObject({ turns: 2, unanswered: true });

      // Asking again in the thread: the model is shown the question that failed, too.
      yield* send({ threadId: reply.thread.id, text: "Still there?" });
      const said = JSON.stringify(failing.calls.at(-1)?.prompt.content);
      expect(said).toContain("Anything?");
      expect(said).toContain("Still there?");
    }).pipe(Effect.provide(layerWith(failing.model))),
  );

  const gate = Deferred.makeUnsafe<void>();
  const slowAnswer = scriptedModel((options) =>
    options.prompt.content.at(-1)?.role === "tool"
      ? Deferred.await(gate).pipe(Effect.as(text("Done reading (R1).")))
      : Effect.succeed(toolCalls([{ name: "list_movements", params: {} }])),
  );
  /** Completes once the coach's reply is saved. */
  const replySaved = Deferred.makeUnsafe<void>();
  const tappedStore = Layer.effect(
    CoachStore.CoachStore,
    Effect.gen(function* () {
      const store = yield* CoachStore.CoachStore;
      return CoachStore.CoachStore.of({
        ...store,
        append: (id, turn, stamp) =>
          store
            .append(id, turn, stamp)
            .pipe(
              Effect.tap(() =>
                turn.role === "coach" ? Deferred.succeed(replySaved, undefined) : Effect.void,
              ),
            ),
      });
    }),
  ).pipe(Layer.provide(CoachStore.layer));

  it.effect("finishes and saves the reply when the page stops listening mid-reply", () =>
    Effect.gen(function* () {
      const coach = yield* CoachService.CoachService;
      // The page goes away once the first read lands, while the model is still writing.
      const seen = Array.from(
        yield* Stream.runCollect(
          coach
            .send({ text: "Read the catalog." })
            .pipe(Stream.takeUntil((event) => event._tag === "ReadFinished")),
        ),
      );
      const thread = (seen[0] as Extract<CoachEvent, { _tag: "AthleteTurn" }>).thread;
      yield* Deferred.succeed(gate, undefined);
      yield* Deferred.await(replySaved);

      const detail = yield* coach.thread(thread.id);
      expect(detail.turns.map((turn) => [turn.role, turn.text, turn.receipts.length])).toEqual([
        ["athlete", "Read the catalog.", 0],
        ["coach", "Done reading (R1).", 1],
      ]);
    }).pipe(Effect.provide(layerWith(slowAnswer.model, tappedStore))),
  );

  it.effect("refuses a thread that does not exist", () =>
    Effect.gen(function* () {
      const error = yield* send({
        threadId: CoachThreadId.make("missing"),
        text: "Hello?",
      }).pipe(Effect.flip);
      expect(error._tag).toBe("CoachThreadNotFoundError");
    }).pipe(Effect.provide(layerWith(failing.model))),
  );
});

describe("CoachService.layerModel", () => {
  const statusWith = (env: Record<string, string>) =>
    Effect.gen(function* () {
      const coach = yield* CoachService.CoachService;
      return yield* coach.status();
    }).pipe(
      Effect.provide(
        layerWith(
          CoachService.layerModel.pipe(
            Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
          ),
        ),
      ),
    );

  it.effect("offers Chalk's list, with CHALK_COACH_MODEL as the default", () =>
    Effect.gen(function* () {
      const status = yield* statusWith({
        OPENROUTER_API_KEY: "sk-test",
        CHALK_COACH_MODEL: "z-ai/glm-5.3",
      });
      expect(status).toEqual({
        available: true,
        defaultModel: "z-ai/glm-5.3",
        models: COACH_MODELS,
      });
    }),
  );

  it.effect("offers a CHALK_COACH_MODEL outside the list ahead of it, unpriced", () =>
    Effect.gen(function* () {
      const status = yield* statusWith({
        OPENROUTER_API_KEY: "sk-test",
        CHALK_COACH_MODEL: "acme/coach-1",
      });
      expect(status.defaultModel).toBe("acme/coach-1");
      expect(status.models).toEqual([
        { slug: "acme/coach-1", label: "coach-1", price: null },
        ...COACH_MODELS,
      ]);
    }),
  );

  it.effect("is off without a key", () =>
    Effect.gen(function* () {
      expect(yield* statusWith({ CHALK_COACH_MODEL: "acme/coach-1" })).toEqual({
        available: false,
        defaultModel: null,
        models: [],
      });
    }),
  );
});
