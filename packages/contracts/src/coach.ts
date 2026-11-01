import * as Schema from "effect/Schema";

import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * The coach: a conversation with a model that reads the athlete's log through read-only tools.
 * Every tool call is kept as a receipt, so each claim in a reply can point at what it read.
 */

const makeId = <Brand extends string>(brand: Parameters<typeof Schema.brand<Brand>>[0]) =>
  TrimmedNonEmptyString.pipe(Schema.brand<Brand>(brand));

export const CoachThreadId = makeId("CoachThreadId");
export type CoachThreadId = typeof CoachThreadId.Type;

/** One model the coach can answer with: its OpenRouter slug, a name to print, and a price hint. */
export const CoachModelOption = Schema.Struct({
  /** The OpenRouter slug, like "anthropic/claude-sonnet-5.5". */
  slug: Schema.String,
  label: Schema.String,
  /** Dollars per million tokens in / out, like "$2 / $10"; null when Chalk does not know it. */
  price: Schema.NullOr(Schema.String),
}).annotate({ identifier: "CoachModelOption" });
export type CoachModelOption = typeof CoachModelOption.Type;

/**
 * The models the athlete may pick from, in menu order: priced low enough to ask freely, and
 * reliable at tool calls, since the coach reads the log through tools. The server answers with
 * these and nothing else the browser asks for. Prices are OpenRouter's, per million tokens in /
 * out, as of November 2026; why each is here is in docs/coaching.md.
 */
export const COACH_MODELS: ReadonlyArray<CoachModelOption> = [
  { slug: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", price: "$2 / $10" },
  { slug: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", price: "$0.10 / $0.50" },
  { slug: "openai/gpt-6.1-terra", label: "GPT-6.1 Terra", price: "$1 / $5" },
  { slug: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", price: "$0.83 / $4.13" },
  { slug: "z-ai/glm-5.3", label: "GLM 5.3", price: "$0.08 / $3.60" },
  { slug: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", price: "$0.05 / $0.50" },
];

/** A model's name to print: its label when Chalk knows the slug, else the slug without its provider. */
export const coachModelLabel = (slug: string): string =>
  COACH_MODELS.find((option) => option.slug === slug)?.label ?? slug.split("/").at(-1) ?? slug;

/** What the athlete typed; long enough for a paragraph, short enough to stay a question. */
export const CoachMessageText = TrimmedNonEmptyString.check(Schema.isMaxLength(4000));

/**
 * One piece of what a read asked for, tagged so the page can print it as a carbon chip: the
 * movement, the benchmark, the date range, or a search phrase.
 */
export const CoachRequestPart = Schema.Struct({
  tag: Schema.Literals(["movement", "benchmark", "range", "text"]),
  text: Schema.String,
});
export type CoachRequestPart = typeof CoachRequestPart.Type;

/**
 * One tool call the coach made: what it asked for and a table of what came back. Numbered per
 * thread (R1, R2, ...), so a reply can cite "(R2)".
 */
export const CoachReceipt = Schema.Struct({
  /** 1-based, per thread. */
  number: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  tool: Schema.String,
  /** What it asked for: [movement "Back squat", range "1 Aug to 30 Oct"]. */
  request: Schema.Array(CoachRequestPart),
  /** The answer in a line: "38 sets, heaviest 115 kg". */
  summary: Schema.String,
  status: Schema.Literals(["ok", "failed"]),
  /** What the tool returned, as the table the athlete can open; empty when it failed. */
  columns: Schema.Array(Schema.String),
  rows: Schema.Array(Schema.Array(Schema.String)),
  /** Rows the tool returned beyond the ones kept here. */
  truncated: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}).annotate({ identifier: "CoachReceipt" });
export type CoachReceipt = typeof CoachReceipt.Type;

export const CoachTurn = Schema.Struct({
  /** 1-based, per thread. */
  seq: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  role: Schema.Literals(["athlete", "coach"]),
  text: Schema.String,
  /** The coach's reads for this reply, in call order; always empty on the athlete's turns. */
  receipts: Schema.Array(CoachReceipt),
  /** The model slug that wrote this reply; on coach turns only, and absent on replies saved before models could be picked. */
  model: Schema.optionalKey(Schema.String),
  /** Set when the coach stopped early: the read budget ran out, or the model failed. */
  stopped: Schema.optionalKey(Schema.Literals(["read-limit", "step-limit", "model-error"])),
  createdAt: IsoDateTime,
}).annotate({ identifier: "CoachTurn" });
export type CoachTurn = typeof CoachTurn.Type;

export const CoachThread = Schema.Struct({
  id: CoachThreadId,
  title: Schema.String,
  /** The model slug the thread was last answered with. */
  model: Schema.String,
  turns: Schema.Int,
  reads: Schema.Int,
  /** The last message has no answer yet: the reply failed or never came. */
  unanswered: Schema.Boolean,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}).annotate({ identifier: "CoachThread" });
export type CoachThread = typeof CoachThread.Type;

export const CoachThreadDetail = Schema.Struct({
  thread: CoachThread,
  turns: Schema.Array(CoachTurn),
}).annotate({ identifier: "CoachThreadDetail" });
export type CoachThreadDetail = typeof CoachThreadDetail.Type;

/**
 * Whether the coach can answer here, and with which models; the key itself never leaves the
 * server. Without a key there is no default and no models.
 */
export const CoachStatus = Schema.Struct({
  available: Schema.Boolean,
  /** The slug a message without a pick is answered with: `CHALK_COACH_MODEL`. */
  defaultModel: Schema.NullOr(Schema.String),
  /** What the athlete may pick: `COACH_MODELS`, plus the default when the server set one outside it. */
  models: Schema.Array(CoachModelOption),
}).annotate({ identifier: "CoachStatus" });
export type CoachStatus = typeof CoachStatus.Type;

export const CoachSendInput = Schema.Struct({
  /** Absent to start a new thread. */
  threadId: Schema.optionalKey(CoachThreadId),
  text: CoachMessageText,
  /** The slug to answer with; absent for the server's default. Anything not offered is refused. */
  model: Schema.optionalKey(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
});
export type CoachSendInput = typeof CoachSendInput.Type;

/**
 * What `coach.send` streams while the coach works: the saved athlete turn, each read as it
 * starts and finishes, then the saved reply.
 */
export const CoachEvent = Schema.Union([
  Schema.TaggedStruct("AthleteTurn", { thread: CoachThread, turn: CoachTurn }),
  Schema.TaggedStruct("ReadStarted", {
    number: Schema.Int,
    tool: Schema.String,
    request: Schema.Array(CoachRequestPart),
  }),
  Schema.TaggedStruct("ReadFinished", { receipt: CoachReceipt }),
  Schema.TaggedStruct("CoachTurn", { thread: CoachThread, turn: CoachTurn }),
]).annotate({ identifier: "CoachEvent" });
export type CoachEvent = typeof CoachEvent.Type;

export class CoachUnavailableError extends Schema.TaggedError<CoachUnavailableError>()(
  "CoachUnavailableError",
  {},
) {
  override get message(): string {
    return "The coach is not set up: the server has no OPENROUTER_API_KEY.";
  }
}

/** The browser asked for a model the server does not offer. */
export class CoachModelNotAllowedError extends Schema.TaggedError<CoachModelNotAllowedError>()(
  "CoachModelNotAllowedError",
  { model: Schema.String },
) {
  override get message(): string {
    return `The coach does not answer with ${this.model}; pick one of the offered models.`;
  }
}

export class CoachThreadNotFoundError extends Schema.TaggedError<CoachThreadNotFoundError>()(
  "CoachThreadNotFoundError",
  { id: CoachThreadId },
) {
  override get message(): string {
    return `Coach thread ${this.id} was not found.`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class CoachStorageError extends Schema.TaggedError<CoachStorageError>()(
  "CoachStorageError",
  { operation: Schema.String },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
