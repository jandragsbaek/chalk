import {
  COACH_MODELS,
  coachModelLabel,
  CoachModelNotAllowedError,
  CoachStorageError,
  CoachUnavailableError,
  type CoachEvent,
  type CoachModelOption,
  type CoachReceipt,
  type CoachSendInput,
  type CoachStatus,
  type CoachThreadDetail,
  type CoachThreadId,
  type CoachThreadNotFoundError,
  type CoachThread,
  type CoachTurn,
} from "@chalk/contracts";
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient";
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel";
import * as Chat from "effect/ai/Chat";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Prompt from "effect/ai/Prompt";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import * as RestDayStore from "../rest/RestDayStore.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import * as CoachStore from "./CoachStore.ts";
import { CoachToolkit, makeHandlers, type ReadLog } from "./tools.ts";

/** Reads one reply may make; past this a read answers "budget spent" and the coach must answer. */
export const MAX_READS = 8;
/** Model calls one reply may make; the last one may not call tools. */
export const MAX_STEPS = 5;
/** Wall clock for one reply, reads included. */
const REPLY_TIMEOUT = Duration.seconds(120);

const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/**
 * What the athlete may pick, the default first when it is not on Chalk's list: the server's own
 * `CHALK_COACH_MODEL` is trusted (whoever sets it chose that model on purpose), the browser
 * only gets to choose from the list.
 */
export const modelOptions = (defaultModel: string): ReadonlyArray<CoachModelOption> =>
  COACH_MODELS.some((option) => option.slug === defaultModel)
    ? COACH_MODELS
    : [{ slug: defaultModel, label: coachModelLabel(defaultModel), price: null }, ...COACH_MODELS];

/** A model the athlete may pick, ready to answer. */
export interface CoachModelChoice extends CoachModelOption {
  readonly languageModel: LanguageModel.LanguageModel;
}

/** The models the coach answers with, or none when the server has no key. */
export class CoachModel extends Context.Service<
  CoachModel,
  {
    readonly models: Option.Option<{
      /** The slug a message without a pick is answered with. */
      readonly defaultModel: string;
      /** Every model the athlete may pick, in menu order; the default is one of them. */
      readonly choices: ReadonlyArray<CoachModelChoice>;
    }>;
  }
>()("chalk/coach/CoachModel") {}

/**
 * OpenRouter from `OPENROUTER_API_KEY`, one model per pickable slug, `CHALK_COACH_MODEL` the
 * default. No key, no coach.
 */
export const layerModel = Layer.effect(
  CoachModel,
  Effect.gen(function* () {
    const apiKey = yield* Config.Redacted("OPENROUTER_API_KEY").pipe(Config.option);
    const defaultModel = yield* Config.String("CHALK_COACH_MODEL").pipe(
      Config.withDefault(DEFAULT_MODEL),
    );
    if (Option.isNone(apiKey)) return CoachModel.of({ models: Option.none() });
    if (!COACH_MODELS.some((option) => option.slug === defaultModel))
      yield* Effect.logWarning(
        `CHALK_COACH_MODEL=${defaultModel} is not on Chalk's model list; the coach offers it as the default, ahead of the list.`,
      );
    const client = OpenRouterClient.layer({ apiKey: apiKey.value, siteTitle: "Chalk" }).pipe(
      Layer.provide(FetchHttpClient.layer),
    );
    const choices = yield* Effect.forEach(modelOptions(defaultModel), (option) =>
      OpenRouterLanguageModel.make({ model: option.slug }).pipe(
        Effect.map((languageModel): CoachModelChoice => ({ ...option, languageModel })),
      ),
    ).pipe(Effect.provide(client));
    return CoachModel.of({ models: Option.some({ defaultModel, choices }) });
  }),
);

const systemPrompt = (today: string) =>
  [
    "You are the athlete's CrossFit coach inside Chalk, their training log. Today is " +
      `${today}.`,
    "Read their log with the tools before you answer anything about their training; never " +
      "guess a number. Each tool call is shown to the athlete as a numbered receipt (R1, R2, " +
      "...), numbered in call order across the whole conversation. Cite the receipt a number " +
      "comes from, like (R2).",
    "Rep maxes marked with fromReps above reps are implied by a bigger set, not tested. An " +
      "estimated 1RM is an estimate: say so, and give its spread when it matters.",
    "Rest is the athlete's choice: a day with nothing logged is not a rest day unless " +
      "list_rest_days has it. When rest would help, suggest a day; put it in their calendar " +
      "with mark_rest_day only when they ask for it or agree, and say which day you marked.",
    "Be brief and concrete: a few short paragraphs at most, plain text, no headings or " +
      "tables. Ask one question back when the log cannot answer something.",
    "If the athlete mentions pain or injury, suggest they see a professional and give no " +
      "medical advice.",
  ].join("\n\n");

/** Sent once when the model ends a turn with no text and no reads, so the athlete gets an answer. */
const EMPTY_TURN_NUDGE =
  "You ended your turn without writing anything, so I saw no answer. Answer me now in plain " +
  "text from what you have read. If my log cannot answer it, say so and ask me one question.";

/** The thread title:the first line of the first message, cut at a word. */
const titleOf = (text: string) => {
  const line = text.split("\n")[0]?.trim() ?? text;
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : 80)}…`;
};

type SendError =
  | CoachUnavailableError
  | CoachModelNotAllowedError
  | CoachThreadNotFoundError
  | CoachStorageError;

export class CoachService extends Context.Service<
  CoachService,
  {
    readonly status: () => Effect.Effect<CoachStatus>;
    readonly threads: () => Effect.Effect<ReadonlyArray<CoachThread>, CoachStorageError>;
    readonly thread: (
      id: CoachThreadId,
    ) => Effect.Effect<CoachThreadDetail, CoachThreadNotFoundError | CoachStorageError>;
    /** Saves the athlete's message, then streams the coach's reads and its saved reply. */
    readonly send: (input: CoachSendInput) => Stream.Stream<CoachEvent, SendError>;
  }
>()("chalk/coach/CoachService") {}

// Persistence causes stay in the server log; clients only see which operation failed.
const reportStorageError = (error: CoachStore.CoachPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new CoachStorageError({ operation: error.operation }))),
  );

const make = Effect.gen(function* () {
  const { models } = yield* CoachModel;
  const store = yield* CoachStore.CoachStore;
  const workouts = yield* WorkoutStore.WorkoutStore;
  const strength = yield* StrengthStore.StrengthStore;
  const restDays = yield* RestDayStore.RestDayStore;

  const status = () =>
    Effect.succeed(
      Option.match(models, {
        onNone: (): CoachStatus => ({ available: false, defaultModel: null, models: [] }),
        onSome: ({ defaultModel, choices }): CoachStatus => ({
          available: true,
          defaultModel,
          models: choices.map(({ slug, label, price }) => ({ slug, label, price })),
        }),
      }),
    );

  const threads = () =>
    store.threads().pipe(Effect.catchTags({ CoachPersistenceError: reportStorageError }));

  const thread = (id: CoachThreadId) =>
    store.detail(id).pipe(Effect.catchTags({ CoachPersistenceError: reportStorageError }));

  /** Runs the model until it answers without reading, or a limit stops it. */
  const reply = Effect.fnUntraced(function* (options: {
    readonly model: CoachModelChoice;
    readonly history: string;
    readonly text: string;
    /** The athlete's local day; the server's UTC day when the browser did not say. */
    readonly today: string | undefined;
    readonly firstReceipt: number;
    readonly emit: (event: CoachEvent) => Effect.Effect<unknown>;
  }) {
    const receipts: Array<CoachReceipt> = [];
    let reads = 0;
    let readLimitHit = false;
    const log: ReadLog = {
      begin: (tool, request) =>
        Effect.suspend(() => {
          if (reads >= MAX_READS) {
            readLimitHit = true;
            return Effect.fail({
              message: `The read budget for this reply (${MAX_READS}) is spent. Answer with what you have read.`,
            });
          }
          const number = options.firstReceipt + reads;
          reads += 1;
          return options
            .emit({ _tag: "ReadStarted", number, tool, request })
            .pipe(Effect.as(number));
        }),
      finish: (receipt) =>
        Effect.suspend(() => {
          receipts.push(receipt);
          return options.emit({ _tag: "ReadFinished", receipt }).pipe(Effect.asVoid);
        }),
    };

    const today = options.today ?? DateTime.formatIsoDateUtc(yield* DateTime.now);
    const handlers = yield* CoachToolkit.toHandlers(
      makeHandlers({ workouts, strength, restDays, today, log }),
    );
    const toolkit = yield* CoachToolkit.pipe(Effect.provideContext(handlers));
    const chat = yield* options.history === ""
      ? Chat.empty
      : Chat.fromJson(options.history).pipe(Effect.orDie);
    // The athlete's message joins the transcript up front: Chat only commits a prompt once a
    // generation succeeds, and a failed reply must not drop the question from the thread.
    yield* Ref.update(chat.history, (history) =>
      Prompt.concat(Prompt.setSystem(history, systemPrompt(today)), Prompt.make(options.text)),
    );

    const texts: Array<string> = [];
    let stopped: CoachTurn["stopped"];
    const loop = Effect.gen(function* () {
      let prompt: string | [] = [];
      let nudged = false;
      for (let step = 0; step < MAX_STEPS; step++) {
        const last = step === MAX_STEPS - 1;
        const response = yield* chat.generateText({
          prompt,
          toolkit,
          toolChoice: last ? "none" : "auto",
        });
        prompt = [];
        const said = response.text.trim();
        if (said !== "") texts.push(said);
        if (response.toolCalls.length > 0) {
          if (last) stopped = "step-limit";
          continue;
        }
        if (said !== "" || nudged || last) return;
        // Models (Claude especially) sometimes end the turn empty right after a tool result.
        // Resending the same transcript tends to repeat that; a fresh user message gets the answer.
        yield* Effect.logWarning("Coach model ended its turn without an answer; asking again", {
          model: options.model.slug,
          step,
          finishReason: response.finishReason,
        });
        nudged = true;
        prompt = EMPTY_TURN_NUDGE;
      }
    }).pipe(
      Effect.provideService(LanguageModel.LanguageModel, options.model.languageModel),
      Effect.timeout(REPLY_TIMEOUT),
      Effect.catch((error) =>
        Effect.logError("Coach reply failed", error).pipe(
          Effect.andThen(
            Effect.sync(() => {
              stopped = "model-error";
              texts.push(
                error._tag === "TimeoutError"
                  ? "The coach took too long to answer and stopped."
                  : error.reason._tag === "AuthenticationError"
                    ? "The coach could not answer: OpenRouter refused the API key. Check OPENROUTER_API_KEY on the server."
                    : "The coach could not answer: the model request failed. Try again.",
              );
            }),
          ),
        ),
      ),
    );
    yield* loop;
    if (stopped === undefined && readLimitHit) stopped = "read-limit";

    const history = yield* chat.exportJson.pipe(Effect.orDie);
    const text = texts.join("\n\n");
    return {
      turn: {
        role: "coach" as const,
        text: text === "" ? "The coach read your log but wrote no answer." : text,
        receipts,
        model: options.model.slug,
        ...(stopped === undefined ? {} : { stopped }),
      },
      history,
    };
  });

  const send = (input: CoachSendInput): Stream.Stream<CoachEvent, SendError> =>
    Stream.callback<CoachEvent, SendError>((queue) =>
      Effect.gen(function* () {
        if (Option.isNone(models)) return yield* new CoachUnavailableError();
        const name = input.model ?? models.value.defaultModel;
        const model = models.value.choices.find((choice) => choice.slug === name);
        if (model === undefined) return yield* new CoachModelNotAllowedError({ model: name });
        const emit = (event: CoachEvent) => Queue.offer(queue, event);

        const started =
          input.threadId === undefined
            ? yield* store.start({ title: titleOf(input.text), model: name })
            : (yield* store.detail(input.threadId)).thread;
        const history = yield* store.history(started.id);

        const athlete = yield* store.append(
          started.id,
          { role: "athlete", text: input.text, receipts: [] },
          { model: name },
        );
        yield* emit({ _tag: "AthleteTurn", thread: athlete.thread, turn: athlete.turn });

        // The reply runs detached from the request: if the page goes away mid-reply, the coach
        // still finishes and saves it, and the thread shows it on the next visit.
        const replying = yield* Effect.forkDetach(
          Effect.gen(function* () {
            const answer = yield* reply({
              model,
              history,
              text: input.text,
              today: input.today,
              firstReceipt: started.reads + 1,
              emit,
            });
            const coach = yield* store.append(started.id, answer.turn, {
              model: name,
              history: answer.history,
            });
            yield* emit({ _tag: "CoachTurn", thread: coach.thread, turn: coach.turn });
          }),
        );
        yield* Fiber.join(replying);
        yield* Queue.end(queue);
      }).pipe(Effect.catchTags({ CoachPersistenceError: reportStorageError })),
    );

  return CoachService.of({ status, threads, thread, send });
});

export const layer = Layer.effect(CoachService, make);
