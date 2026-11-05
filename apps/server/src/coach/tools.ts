import {
  BENCHMARK_CATEGORY_NAMES,
  blockLabel,
  CAPACITY_LABELS,
  Debrief,
  deriveSession,
  describeBlock,
  FEEL_LABELS,
  formatBlockResult,
  formatPerformed,
  formatQuantity,
  formatSeconds,
  LIMITER_LABELS,
  scaleLabel,
  sessionPowerRows,
  type DerivedItem,
  type Performance,
  BlockId,
  BlockStatus,
  DraftSessionInput,
  isLoggedLift,
  lineText,
  TrainingMax,
  BenchmarkCategory,
  benchmarkById,
  BenchmarkId,
  BENCHMARKS,
  BenchmarkScoring,
  describeCoaching,
  describePlace,
  SESSION_TYPE_LABELS,
  sessionTypeOf,
  describeDifference,
  estimateOneRepMax,
  IsoDate,
  MatchKind,
  MAX_ESTIMATE_REPS,
  MovementCategory,
  MovementId,
  normalizeBenchmarkName,
  partLabel,
  REST_DAY_LABELS,
  RestDayKind,
  RestDaySource,
  scalingUsage,
  WorkoutId,
  WorkoutKind,
  type CoachReceipt,
  type CoachRequestPart,
  type LiftSet,
  type Movement,
  type PartRef,
  type ProgrammedSession,
  type TrainingBlock,
} from "@chalk/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import type * as CatalogStore from "../catalog/CatalogStore.ts";
import type * as ImportStore from "../import/ImportStore.ts";
import type * as LevelStore from "../levels/LevelStore.ts";
import type * as PowerStore from "../power/PowerStore.ts";
import type * as ProfileStore from "../profile/ProfileStore.ts";
import type * as VolumeStore from "../volume/VolumeStore.ts";
import type * as RestDayStore from "../rest/RestDayStore.ts";
import type * as PlanStore from "../plan/PlanStore.ts";
import type * as StrengthStore from "../strength/StrengthStore.ts";
import type * as BlockStore from "../training/BlockStore.ts";
import type * as WorkoutStore from "../workout/WorkoutStore.ts";

/**
 * The coach's tools over the athlete's log: reads, and two writes (putting a rest day in the
 * calendar, and drafting a training block the athlete then puts there). Each call becomes a
 * receipt: what was asked, a one-line answer, and the rows the model saw, so the athlete can
 * check the numbers and see what the coach changed.
 */

/** What a tool returns to the model when it cannot answer; the model reads the message. */
export const ToolFailure = Schema.Struct({ message: Schema.String });
export type ToolFailure = typeof ToolFailure.Type;

const Range = {
  from: Schema.optionalKey(IsoDate).annotate({ description: "First day, inclusive, YYYY-MM-DD" }),
  to: Schema.optionalKey(IsoDate).annotate({ description: "Last day, inclusive, YYYY-MM-DD" }),
};

const common = { failure: ToolFailure, failureMode: "return" } as const;

/** How a debrief reads, for the tool descriptions. */
const DEBRIEF_FIELDS =
  "result in their words; feel 1-5 (awful, rough, ok, good, great); effort, the session RPE " +
  "1-10; capacity 1-5, how hard they could push that day (empty, low, normal, high, peak); " +
  "minutes trained; limiters (what held them back: engine, muscular, strength, skill, grip, " +
  "mobility, pacing, energy, mind, pain, or none); pain (where it hurt); nextTime (what they " +
  "would change); notes.";

const ListMovements = Tool.make("list_movements", {
  description:
    "Search the movement catalog. Returns ids (slugs like 'back-squat') that the other tools take.",
  parameters: Schema.Struct({
    query: Schema.optionalKey(Schema.String).annotate({
      description: "Part of a movement name, e.g. 'squat'; omit for the whole catalog",
    }),
  }),
  success: Schema.Array(
    Schema.Struct({ id: MovementId, name: Schema.String, category: MovementCategory }),
  ),
  ...common,
});

const ListWorkouts = Tool.make("list_workouts", {
  description:
    "Logged training sessions, newest first: date, name, kind (the workout's format), score, " +
    "whether it was Rx, and where recorded the session type ('WOD class', 'Strength class' or " +
    "'Solo' for one done alone), who coached it, and where it was trained ('The box', 'Home' " +
    "or the other box's name). With the athlete's debrief when they wrote one: " +
    DEBRIEF_FIELDS +
    " Read get_session for what was programmed and how each movement was done.",
  parameters: Schema.Struct({
    ...Range,
    limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
  }),
  success: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      performedOn: IsoDate,
      name: Schema.String,
      kind: WorkoutKind,
      score: Schema.String,
      rx: Schema.Boolean,
      benchmark: Schema.optionalKey(Schema.String),
      session: Schema.optionalKey(Schema.String),
      coachedBy: Schema.optionalKey(Schema.String),
      place: Schema.String,
      debrief: Schema.optionalKey(Debrief),
    }),
  ),
  ...common,
});

const ListLiftSets = Tool.make("list_lift_sets", {
  description: "Every logged strength set of one movement (reps x kg), newest first.",
  parameters: Schema.Struct({
    movementId: MovementId.annotate({ description: "Catalog id, e.g. 'back-squat'" }),
    ...Range,
  }),
  success: Schema.Array(
    Schema.Struct({ performedOn: IsoDate, reps: Schema.Int, loadKg: Schema.Finite }),
  ),
  ...common,
});

const GetRepMaxes = Tool.make("get_rep_maxes", {
  description:
    "Rep maxes (1, 2, 3, 5, 10RM) derived from logged sets, and the best estimated 1RM " +
    "(Epley, with the Brzycki/Lombardi spread). A rep max whose fromReps exceeds its reps is " +
    "implied by a bigger set, not tested.",
  parameters: Schema.Struct({
    movementId: Schema.optionalKey(MovementId).annotate({
      description: "Catalog id; omit for every movement with sets",
    }),
  }),
  success: Schema.Array(
    Schema.Struct({
      movementId: MovementId,
      movement: Schema.String,
      repMaxes: Schema.Array(
        Schema.Struct({
          reps: Schema.Int,
          loadKg: Schema.Finite,
          fromReps: Schema.Int,
          performedOn: IsoDate,
        }),
      ),
      estimated1Rm: Schema.NullOr(
        Schema.Struct({
          kg: Schema.Finite,
          lowKg: Schema.Finite,
          highKg: Schema.Finite,
          fromSet: Schema.String,
          performedOn: IsoDate,
        }),
      ),
    }),
  ),
  ...common,
});

const ListBenchmarkResults = Tool.make("list_benchmark_results", {
  description: "Attempts at named workouts (Fran, Murph, ...), newest first.",
  parameters: Schema.Struct({
    benchmarkId: Schema.optionalKey(BenchmarkId).annotate({
      description: "Slug like 'fran'; omit for every benchmark",
    }),
  }),
  success: Schema.Array(
    Schema.Struct({
      benchmark: Schema.String,
      performedOn: IsoDate,
      score: Schema.String,
      rx: Schema.NullOr(Schema.Boolean),
    }),
  ),
  ...common,
});

const ListBenchmarks = Tool.make("list_benchmarks", {
  description:
    "Chalk's catalog of named workouts the athlete can test against: the Girls, the Heroes " +
    "and a few classics, each with how it is scored and its prescription as CrossFit posted it. " +
    "The Heroes alone are over 200; filter by category or name when you can.",
  parameters: Schema.Struct({
    category: Schema.optionalKey(BenchmarkCategory).annotate({
      description: "'girl', 'hero' or 'notable' (other classics); omit for all",
    }),
    query: Schema.optionalKey(Schema.String).annotate({
      description: "Part of a name or alias, e.g. 'fran'; omit for every name",
    }),
  }),
  success: Schema.Array(
    Schema.Struct({
      id: BenchmarkId,
      name: Schema.String,
      category: BenchmarkCategory,
      scoring: BenchmarkScoring,
      posted: Schema.String,
    }),
  ),
  ...common,
});

/** Sessions a similar-sessions read covers, newest first, and matches it lists per part. */
const SIMILAR_SESSIONS = 10;
const SIMILAR_MATCHES = 3;

const SimilarSide = {
  workoutId: Schema.String,
  performedOn: IsoDate,
  workout: Schema.String,
  /** The part's title and headline, "Workout #2 · AMRAP 15 min". */
  part: Schema.String,
  result: Schema.optionalKey(Schema.String),
  /** The heaviest lift set the part wrote, "5 x 105 kg Back squat". */
  topSet: Schema.optionalKey(Schema.String),
};

const FindSimilarSessions = Tool.make("find_similar_sessions", {
  description:
    "Whether a session's parts repeat earlier or later logged parts (the same workout again, " +
    "or the same benchmark) or look like them (at least 60 % alike), with each side's date, " +
    "result or heaviest set, and what the other side did differently. Use it for 'have I done " +
    "this before, and how did I do?' or a retest. Give a session id from list_workouts, or a " +
    `date range; it covers at most ${SIMILAR_SESSIONS} sessions, newest first, and lists only ` +
    "parts with a match. A part of one movement only reports repeats; for that lift's " +
    "history use list_lift_sets.",
  parameters: Schema.Struct({
    workoutId: Schema.optionalKey(WorkoutId).annotate({
      description: "A session id from list_workouts; omit for every session in the range",
    }),
    ...Range,
  }),
  success: Schema.Array(
    Schema.Struct({
      ...SimilarSide,
      matches: Schema.Array(
        Schema.Struct({
          kind: MatchKind,
          /** Percent; 100 for a repeat. */
          alike: Schema.Int,
          ...SimilarSide,
          /** What the other side did, said as "then" (earlier) or "later". */
          differences: Schema.Array(Schema.String),
        }),
      ),
      /** Matches beyond the ones listed. */
      moreMatches: Schema.Int,
    }),
  ),
  ...common,
});

const ListRestDays = Tool.make("list_rest_days", {
  description:
    "Days the athlete chose not to train, oldest first, with why (rest, sick, injured, travel) " +
    "and who marked it (the athlete or you). A day with nothing logged and no mark is not a " +
    "rest day, just a day with nothing logged.",
  parameters: Schema.Struct({ ...Range }),
  success: Schema.Array(
    Schema.Struct({ day: IsoDate, kind: RestDayKind, markedBy: RestDaySource }),
  ),
  ...common,
});

const MarkRestDay = Tool.make("mark_rest_day", {
  description:
    "Put a rest day in the athlete's calendar, for today or a later day. Only when the athlete " +
    "asks for it or agrees to your suggestion. Refused on a day with a session logged, or one " +
    "the athlete marked themselves; a day you marked before is re-marked.",
  parameters: Schema.Struct({
    day: IsoDate.annotate({ description: "The day, YYYY-MM-DD; today or later" }),
    kind: Schema.optionalKey(RestDayKind).annotate({
      description: "Why: 'rest' (the default), 'sick', 'injured' or 'travel'",
    }),
  }),
  success: Schema.Struct({ day: IsoDate, kind: RestDayKind }),
  ...common,
});

/** Days a calendar read covers at most, and by default from today. */
const CALENDAR_MAX_DAYS = 62;
const CALENDAR_DEFAULT_DAYS = 14;

const ListBlocks = Tool.make("list_blocks", {
  description:
    "Training blocks: strength cycles and runs of accessory or prehab work, the ones in the " +
    "calendar and the drafts you proposed that the athlete has not put there yet. Each with " +
    "its id, dates, training maxes, and how many sessions are done.",
  parameters: Schema.Struct({
    status: Schema.optionalKey(BlockStatus).annotate({
      description: "'draft' or 'scheduled'; omit for both",
    }),
  }),
  success: Schema.Array(
    Schema.Struct({
      id: BlockId,
      name: Schema.String,
      goal: Schema.String,
      status: BlockStatus,
      madeBy: Schema.Literals(["athlete", "coach"]),
      from: Schema.NullOr(IsoDate),
      to: Schema.NullOr(IsoDate),
      trainingMaxes: Schema.Array(Schema.Struct({ movement: Schema.String, kg: Schema.Finite })),
      sessions: Schema.Int,
      done: Schema.Int,
    }),
  ),
  ...common,
});

const ListCalendar = Tool.make("list_calendar", {
  description:
    "The athlete's calendar day by day: sessions logged, box workouts planned on the Plan page, " +
    "days marked rest, and programmed sessions from training blocks (scheduled, or 'draft' when only proposed), " +
    "each programmed session with its lines and how many are done. Use it before you plan " +
    "anything, to see the box days and what is already there. Defaults to today and the 13 " +
    `days after; at most ${CALENDAR_MAX_DAYS} days.`,
  parameters: Schema.Struct({ ...Range }),
  success: Schema.Array(
    Schema.Struct({
      day: IsoDate,
      kind: Schema.Literals(["logged", "box plan", "programmed", "draft", "rest"]),
      what: Schema.String,
      detail: Schema.String,
      sessionId: Schema.optionalKey(Schema.String),
    }),
  ),
  ...common,
});

const DraftBlock = Tool.make("draft_block", {
  description:
    "Propose a training block: a strength cycle (Smolov Jr, a 5/3/1 wave) or a run of " +
    "accessory or prehab work, as dated sessions of prescribed lines. It is saved as a draft; " +
    "the athlete reviews it on the Calendar page and puts it in the calendar, so tell them " +
    "that. Only when the athlete asks for a plan or agrees to yours. Read their rep maxes and " +
    "list_calendar first; set each lift's training max from what they have shown, and give " +
    "loads as a percent of it. Place heavy days around their box classes and leave real rest; " +
    "prehab and mobility can sit on rest days. To change a draft, pass its id as replaces; a " +
    "block already in the calendar cannot be replaced.",
  parameters: Schema.Struct({
    name: Schema.String.annotate({ description: "Short, e.g. 'Smolov Jr · back squat'" }),
    goal: Schema.String.annotate({
      description: "One or two sentences: what it builds and how it fits the box classes",
    }),
    trainingMaxes: Schema.Array(TrainingMax).annotate({
      description: "Per lift with percents: movementId and the kg the percents are taken from",
    }),
    sessions: Schema.Array(DraftSessionInput).annotate({
      description:
        "Dated sessions, today or later. Each line: name, and movementId when it is in the " +
        "catalog; sets with reps or seconds (each: true for per side); load as percent (of the " +
        "training max), loadKg, or words in load ('light band')",
    }),
    replaces: Schema.optionalKey(BlockId).annotate({
      description: "A draft's id from list_blocks, to rewrite it instead of adding another",
    }),
  }),
  success: Schema.Struct({ id: BlockId, sessions: Schema.Int, from: IsoDate, to: IsoDate }),
  ...common,
});

const ListScalings = Tool.make("list_scalings", {
  description:
    "How the athlete scaled programmed movements: per movement, the sessions it was " +
    "programmed in, the sessions done scaled, and what they did instead (sessions and reps, " +
    "e.g. ring rows for pull-ups), with the scalings they keep for it. For 'the last 6 weeks' " +
    "pass from. Without movementId, only movements done scaled at least once in the range.",
  parameters: Schema.Struct({
    movementId: Schema.optionalKey(MovementId).annotate({
      description: "Catalog id, e.g. 'pull-up'; omit for every movement done scaled",
    }),
    ...Range,
  }),
  success: Schema.Array(
    Schema.Struct({
      movementId: MovementId,
      movement: Schema.String,
      sessions: Schema.Int,
      scaledSessions: Schema.Int,
      doneAs: Schema.Array(
        Schema.Struct({
          movementId: MovementId,
          movement: Schema.String,
          sessions: Schema.Int,
          reps: Schema.Int,
        }),
      ),
      lastScaledOn: Schema.optionalKey(IsoDate),
      scalesTo: Schema.Array(Schema.String),
    }),
  ),
  ...common,
});

/** A movement's "how it was done" with names: the `Performance` an athlete records. */
const PerformanceView = Schema.Struct({
  loadKg: Schema.optionalKey(Schema.Finite),
  implements: Schema.optionalKey(Schema.Int),
  variants: Schema.optionalKey(
    Schema.Array(Schema.Struct({ movement: Schema.String, reps: Schema.Int })),
  ),
  unbroken: Schema.optionalKey(Schema.Int),
  perRound: Schema.optionalKey(Schema.Struct({ min: Schema.Finite, max: Schema.Finite })),
  rounds: Schema.optionalKey(Schema.Array(Schema.Int)),
  roundLoadsKg: Schema.optionalKey(Schema.Array(Schema.Finite)),
});

/** One movement of a block: what the board wrote, the plan, and how it was done. */
const MovementView = Schema.Struct({
  movement: Schema.String,
  written: Schema.String,
  prescribed: Schema.Array(Schema.String),
  planned: Schema.optionalKey(PerformanceView),
  done: Schema.optionalKey(PerformanceView),
  assumed: Schema.optionalKey(Schema.Boolean),
  lifted: Schema.optionalKey(Schema.String),
});

const GetSession = Tool.make("get_session", {
  description:
    "One logged session in full: the workout row, the athlete's whole debrief (" +
    DEBRIEF_FIELDS +
    "), and for a session imported from the board, the text as pasted and every part, block " +
    "and movement: the block's format, the coach's intent, the result, and per movement what " +
    "was prescribed, what was planned and how it was done. In `done` and `planned`: an empty " +
    "object means as written; loadKg is per implement (implements 2 for a pair); variants " +
    "split the reps when scaled ('25 Jumping pull-up + 20 Pull-up'); unbroken is the biggest " +
    "unbroken set; rounds is the count reached each round (perRound its range); roundLoadsKg " +
    "a load that rose round by round. assumed means the athlete said nothing and the board " +
    "counts it as written. lifted is the sets lifted, set by set.",
  parameters: Schema.Struct({
    workoutId: WorkoutId.annotate({ description: "A session id from list_workouts" }),
  }),
  success: Schema.Struct({
    id: Schema.String,
    performedOn: IsoDate,
    name: Schema.String,
    kind: WorkoutKind,
    score: Schema.String,
    rx: Schema.Boolean,
    session: Schema.optionalKey(Schema.String),
    coachedBy: Schema.optionalKey(Schema.String),
    place: Schema.String,
    notes: Schema.String,
    debrief: Schema.optionalKey(Debrief),
    text: Schema.optionalKey(Schema.String),
    parts: Schema.Array(
      Schema.Struct({
        title: Schema.String,
        benchmark: Schema.optionalKey(Schema.String),
        blocks: Schema.Array(
          Schema.Struct({
            title: Schema.String,
            format: Schema.String,
            intent: Schema.Array(Schema.String),
            result: Schema.optionalKey(Schema.String),
            scores: Schema.Array(Schema.String),
            tonnageKg: Schema.Finite,
            movements: Schema.Array(
              Schema.Struct({
                ...MovementView.fields,
                /** The "or" lines; the one the athlete picked carries how it was done. */
                alternatives: Schema.Array(MovementView),
              }),
            ),
          }),
        ),
      }),
    ),
    liftSetsFromNotes: Schema.Array(
      Schema.Struct({
        movement: Schema.String,
        reps: Schema.Int,
        loadKg: Schema.Finite,
        sets: Schema.Int,
      }),
    ),
  }),
  ...common,
});

/** Weeks a volume read covers by default: this one and the three before. */
const VOLUME_DEFAULT_WEEKS = 4;

const GetVolume = Tool.make("get_volume", {
  description:
    "Training volume per ISO week (Monday first), per movement as done (the variation reps " +
    "were scaled to): sessions, reps, metres, calories, seconds and tonnage (reps x external " +
    "load; bodyweight adds nothing), with writtenAs when the board wrote another movement, and " +
    "the lines that could not be counted. Defaults to this week and the " +
    `${VOLUME_DEFAULT_WEEKS - 1} before.`,
  parameters: Schema.Struct({
    ...Range,
    movementId: Schema.optionalKey(MovementId).annotate({
      description: "Catalog id, e.g. 'thruster'; omit for every movement",
    }),
  }),
  success: Schema.Array(
    Schema.Struct({
      weekStart: IsoDate,
      tonnageKg: Schema.Finite,
      movements: Schema.Array(
        Schema.Struct({
          movementId: MovementId,
          movement: Schema.String,
          writtenAs: Schema.Array(Schema.String),
          sessions: Schema.Int,
          reps: Schema.Finite,
          metres: Schema.Finite,
          calories: Schema.Finite,
          seconds: Schema.Finite,
          tonnageKg: Schema.Finite,
        }),
      ),
      leftOut: Schema.Array(
        Schema.Struct({ performedOn: IsoDate, line: Schema.String, reason: Schema.String }),
      ),
    }),
  ),
  ...common,
});

/** Days a body read covers by default, up to today. */
const BODY_DEFAULT_DAYS = 90;

const ListBody = Tool.make("list_body", {
  description:
    "The athlete's weigh-ins, oldest first: bodyweight, and body fat and muscle mass when the " +
    "scale measured them (null when not), typed by the athlete ('manual') or read from their " +
    `Garmin scale. Defaults to the last ${BODY_DEFAULT_DAYS} days.`,
  parameters: Schema.Struct({ ...Range }),
  success: Schema.Array(
    Schema.Struct({
      day: IsoDate,
      kg: Schema.Finite,
      bodyFatPct: Schema.NullOr(Schema.Finite),
      muscleMassKg: Schema.NullOr(Schema.Finite),
      source: Schema.Literals(["manual", "garmin"]),
    }),
  ),
  ...common,
});

const GetPower = Tool.make("get_power", {
  description:
    "Estimated work and power per session, oldest first, as the Power page shows it: the " +
    "work (kJ) a session's movements took for the athlete's body that day (height and " +
    "weigh-ins from Settings), and power (W) over its timed conditioning blocks only; " +
    "strength blocks are left out of power. A benchmark done Rx is counted whole, so its " +
    "watts compare across attempts. An estimate from a work model per movement, good for " +
    "trends, not a measurement.",
  parameters: Schema.Struct({ ...Range }),
  success: Schema.Array(
    Schema.Struct({
      workoutId: Schema.String,
      performedOn: IsoDate,
      name: Schema.String,
      benchmark: Schema.Boolean,
      workKj: Schema.Finite,
      seconds: Schema.Finite,
      watts: Schema.optionalKey(Schema.Finite),
      over: Schema.Array(Schema.String),
      strengthBlocksLeftOut: Schema.Int,
    }),
  ),
  ...common,
});

export const CoachToolkit = Toolkit.make(
  ListMovements,
  ListWorkouts,
  GetSession,
  ListLiftSets,
  ListScalings,
  GetRepMaxes,
  GetVolume,
  ListBody,
  GetPower,
  ListBenchmarks,
  ListBenchmarkResults,
  FindSimilarSessions,
  ListRestDays,
  MarkRestDay,
  ListBlocks,
  ListCalendar,
  DraftBlock,
);

/** The coach's reads without its writes: the MCP server serves these over the same handlers. */
export const CoachReads = {
  ListMovements,
  ListWorkouts,
  GetSession,
  ListLiftSets,
  ListScalings,
  GetRepMaxes,
  GetVolume,
  ListBody,
  GetPower,
  ListBenchmarks,
  ListBenchmarkResults,
  FindSimilarSessions,
  ListRestDays,
  ListBlocks,
  ListCalendar,
} as const;

type CoachTools = Toolkit.Tools<typeof CoachToolkit>;

/** `params` without the keys set to null, at any depth; arrays keep their nulls. */
const dropNulls = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(dropNulls)
    : typeof value === "object" && value !== null
      ? Object.fromEntries(
          Object.entries(value).flatMap(([key, item]) =>
            item === null ? [] : [[key, dropNulls(item)]],
          ),
        )
      : value;

/**
 * Claude and GPT get optional parameters as required nullable (the provider's codec) and send
 * null for "omitted", which the tool schemas reject: drop null keys first. A call refused
 * before its handler runs is filed as a failed receipt; the model still gets the toolkit's error.
 */
export const guardCalls = (
  toolkit: Toolkit.WithHandler<CoachTools>,
  log: ReadLog,
): Toolkit.WithHandler<CoachTools> => {
  const decoders = new Map(
    Object.values(toolkit.tools).map((tool) => [
      tool.name,
      Schema.decodeUnknownEffect(tool.parametersSchema),
    ]),
  );
  const refused = (tool: string, params: unknown, reason: string) => {
    const request: ReadonlyArray<CoachRequestPart> = [
      { tag: "text", text: JSON.stringify(params) ?? "" },
    ];
    return log.begin(tool, request).pipe(
      Effect.flatMap((number) =>
        log.finish({
          number,
          tool,
          request,
          summary: reason,
          status: "failed",
          columns: [],
          rows: [],
          truncated: 0,
        }),
      ),
      // Past the read budget there is no receipt to file; the toolkit still answers.
      Effect.ignore,
    );
  };
  const handle: Toolkit.WithHandler<CoachTools>["handle"] = (name, params, toolCallId, options) => {
    const cleaned = dropNulls(params) as typeof params;
    const decode = decoders.get(name);
    // An unknown name never gets here: the model's response fails to decode first.
    const check =
      decode === undefined
        ? Effect.void
        : decode(cleaned).pipe(
            Effect.matchEffect({
              onSuccess: () => Effect.void,
              onFailure: (error) =>
                refused(name, params, `Refused: ${error.message.replace(/\s+/g, " ")}`),
            }),
          );
    return check.pipe(Effect.andThen(toolkit.handle(name, cleaned, toolCallId, options)));
  };
  return { tools: toolkit.tools, handle };
};

/** Rows a receipt keeps; the model gets every row, the athlete's copy is capped. */
const RECEIPT_ROWS = 60;

/** The receipt's table and line for a successful read. */
interface Readout {
  readonly summary: string;
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
}

/** Called around every tool call, so the caller can stream and number the receipts. */
export interface ReadLog {
  /** Takes the next receipt number, or fails when the read budget is spent. */
  readonly begin: (
    tool: string,
    request: ReadonlyArray<CoachRequestPart>,
  ) => Effect.Effect<number, ToolFailure>;
  readonly finish: (receipt: CoachReceipt) => Effect.Effect<void>;
}

const kg = (value: number) => `${Math.round(value * 10) / 10} kg`;

interface DayRange {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

const inRange = (day: string, range: DayRange) =>
  (range.from === undefined || day >= range.from) && (range.to === undefined || day <= range.to);

const BY: Record<RestDaySource, string> = { athlete: "You", coach: "Coach" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-30" as "30 Oct 2026", the way the receipt prints it. */
const day = (iso: string) => {
  const [year, month, date] = iso.split("-");
  return `${Number(date)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
};

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const rangeWords = (range: DayRange) =>
  range.from !== undefined && range.to !== undefined
    ? `${day(range.from)} to ${day(range.to)}`
    : range.from !== undefined
      ? `Since ${day(range.from)}`
      : range.to !== undefined
        ? `Until ${day(range.to)}`
        : "All time";

const range = (dates: DayRange): CoachRequestPart => ({ tag: "range", text: rangeWords(dates) });
const movement = (text: string): CoachRequestPart => ({ tag: "movement", text });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const SCORED_BY: Record<BenchmarkScoring, string> = {
  time: "Time",
  rounds_reps: "Rounds + reps",
  reps: "Reps",
  load: "Load",
};

/** "Rough · RPE 9 · capacity low · engine, energy": a debrief's ratings on one line. */
const debriefLine = (debrief: Debrief) => {
  const limiters = (debrief.limiters ?? []).filter((limiter) => limiter !== "none");
  return [
    debrief.feel === undefined ? undefined : scaleLabel(FEEL_LABELS, debrief.feel),
    debrief.effort === undefined ? undefined : `RPE ${debrief.effort}`,
    debrief.capacity === undefined
      ? undefined
      : `capacity ${scaleLabel(CAPACITY_LABELS, debrief.capacity).toLowerCase()}`,
    debrief.minutes === undefined ? undefined : `${debrief.minutes} min`,
    limiters.length === 0
      ? undefined
      : limiters.map((limiter) => LIMITER_LABELS[limiter].label.toLowerCase()).join(", "),
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
};

/** "As written", "2 x 22.5 kg", "25 Jumping pull-up + 20 Pull-up", "rounds 8, 8, 7". */
const performanceText = (performance: typeof PerformanceView.Type) => {
  const parts = [
    performance.roundLoadsKg !== undefined && performance.roundLoadsKg.length > 0
      ? `${performance.roundLoadsKg.join("-")} kg`
      : performance.loadKg === undefined
        ? undefined
        : `${performance.implements === 2 ? "2 x " : ""}${kg(performance.loadKg)}`,
    performance.variants?.map((variant) => `${variant.reps} ${variant.movement}`).join(" + "),
    performance.rounds !== undefined && performance.rounds.length > 0
      ? `rounds ${performance.rounds.join(", ")}`
      : performance.perRound === undefined
        ? undefined
        : `${performance.perRound.min}-${performance.perRound.max} each round`,
    performance.unbroken === undefined ? undefined : `${performance.unbroken} unbroken`,
  ].filter((part) => part !== undefined && part !== "");
  return parts.length === 0 ? "As written" : parts.join(", ");
};

/** The Monday of `iso`'s ISO week. */
const mondayOf = (iso: string) =>
  addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

const amount = (value: number) => String(Math.round(value * 10) / 10);

/** Handlers over the stores, reporting each call to `log`. */
export const makeHandlers = (deps: {
  readonly workouts: WorkoutStore.WorkoutStore["Service"];
  readonly strength: StrengthStore.StrengthStore["Service"];
  readonly restDays: RestDayStore.RestDayStore["Service"];
  /** The coach's today, YYYY-MM-DD: the first day it may mark. */
  readonly plans: PlanStore.PlanStore["Service"];
  readonly blocks: BlockStore.BlockStore["Service"];
  readonly levels: LevelStore.LevelStore["Service"];
  readonly imports: ImportStore.ImportStore["Service"];
  readonly volume: VolumeStore.VolumeStore["Service"];
  readonly profile: ProfileStore.ProfileStore["Service"];
  readonly power: PowerStore.PowerStore["Service"];
  readonly catalog: CatalogStore.CatalogStore["Service"];
  readonly today: IsoDate;
  readonly log: ReadLog;
}) => {
  const { workouts, strength, restDays, plans, blocks, levels, today, log } = deps;
  const { imports, volume, profile, power, catalog } = deps;

  const movementNames = strength
    .movements()
    .pipe(
      Effect.map((movements) => new Map(movements.map((movement) => [movement.id, movement.name]))),
    );

  /**
   * How many of a session's lines are done: ticked by the athlete, or a lift with sets of
   * that movement logged on the session's day.
   */
  const doneLines = strength.list().pipe(
    Effect.map((sets) => {
      const lifted = new Set(sets.map((set) => `${set.performedOn}|${set.movementId}`));
      return (session: ProgrammedSession) =>
        session.lines.filter(
          (line, index) =>
            session.ticked.includes(index) ||
            (isLoggedLift(line) && lifted.has(`${session.day}|${line.movementId}`)),
        ).length;
    }),
  );

  /** Runs one read: numbers it, turns storage failures into a message, and files the receipt. */
  const read = Effect.fn("CoachTools.read")(function* <A>(
    tool: string,
    request: ReadonlyArray<CoachRequestPart>,
    run: Effect.Effect<A, ToolFailure | { readonly _tag: string; readonly message: string }>,
    readout: (value: A) => Readout,
  ) {
    const number = yield* log.begin(tool, request);
    const failed = (message: string) =>
      log
        .finish({
          number,
          tool,
          request,
          summary: message,
          status: "failed",
          columns: [],
          rows: [],
          truncated: 0,
        })
        .pipe(Effect.andThen(Effect.fail<ToolFailure>({ message })));
    const value = yield* run.pipe(
      Effect.catch((error) =>
        "_tag" in error
          ? Effect.logError(error.message).pipe(
              Effect.andThen(failed("Could not read the training log.")),
            )
          : failed(error.message),
      ),
    );
    const { summary, columns, rows } = readout(value);
    yield* log.finish({
      number,
      tool,
      request,
      summary,
      status: "ok",
      columns: [...columns],
      rows: rows.slice(0, RECEIPT_ROWS).map((row) => [...row]),
      truncated: Math.max(0, rows.length - RECEIPT_ROWS),
    });
    return value;
  });

  const requireMovement = (id: MovementId) =>
    movementNames.pipe(
      Effect.flatMap((names) => {
        const name = names.get(id);
        return name === undefined
          ? Effect.fail<ToolFailure>({
              message: `No movement '${id}' in the catalog. Use list_movements to find its id.`,
            })
          : Effect.succeed(name);
      }),
    );

  return CoachToolkit.of({
    list_movements: ({ query }) => {
      const needle = query?.trim().toLowerCase() ?? "";
      return read(
        "list_movements",
        [{ tag: "text", text: needle === "" ? "Whole catalog" : `Names with "${needle}"` }],
        strength
          .movements()
          .pipe(
            Effect.map((movements) =>
              movements
                .filter((movement: Movement) => movement.name.toLowerCase().includes(needle))
                .map(({ id, name, category }) => ({ id, name, category })),
            ),
          ),
        (found) => ({
          summary: plural(found.length, "movement"),
          columns: ["Movement", "Id", "Category"],
          rows: found.map((movement) => [movement.name, movement.id, movement.category]),
        }),
      );
    },

    list_workouts: ({ from, to, limit }) =>
      read(
        "list_workouts",
        [range({ from, to })],
        Effect.all([workouts.list(), imports.debriefs()]).pipe(
          Effect.map(([all, debriefs]) =>
            all
              .filter((workout) => inRange(workout.performedOn, { from, to }))
              .slice(0, limit ?? 30)
              .map((workout) => {
                const debrief = debriefs.get(workout.id);
                const benchmark =
                  workout.benchmarkId === undefined
                    ? undefined
                    : benchmarkById(workout.benchmarkId)?.name;
                const type = sessionTypeOf(workout);
                return {
                  id: workout.id,
                  performedOn: workout.performedOn,
                  name: workout.name,
                  kind: workout.kind,
                  score: workout.score,
                  rx: workout.rx,
                  ...(benchmark === undefined ? {} : { benchmark }),
                  ...(type === undefined ? {} : { session: SESSION_TYPE_LABELS[type] }),
                  ...(workout.coaching === undefined
                    ? {}
                    : { coachedBy: describeCoaching(workout.coaching) }),
                  place: describePlace(workout.place),
                  ...(debrief === undefined ? {} : { debrief }),
                };
              }),
          ),
        ),
        (found) => ({
          summary: plural(found.length, "session"),
          columns: [
            "Date",
            "Workout",
            "Kind",
            "Score",
            "Session",
            "Coached by",
            "Place",
            "Debrief",
          ],
          rows: found.map((workout) => [
            day(workout.performedOn),
            workout.name,
            workout.kind,
            workout.score === "" ? "" : `${workout.score}${workout.rx ? " Rx" : ""}`,
            workout.session ?? "",
            workout.coachedBy ?? "",
            workout.place,
            workout.debrief === undefined ? "" : debriefLine(workout.debrief),
          ]),
        }),
      ),

    get_session: Effect.fn("CoachTools.get_session")(function* ({ workoutId }) {
      const all = yield* workouts.list().pipe(Effect.orElseSucceed(() => []));
      const workout = all.find((candidate) => candidate.id === workoutId);
      return yield* read(
        "get_session",
        [
          {
            tag: "text",
            text:
              workout === undefined ? workoutId : `${workout.name}, ${day(workout.performedOn)}`,
          },
        ],
        Effect.gen(function* () {
          if (workout === undefined)
            return yield* Effect.fail<ToolFailure>({
              message: `No session '${workoutId}'. Use list_workouts to find its id.`,
            });
          const stored = yield* imports
            .get(workoutId)
            .pipe(Effect.catchTags({ ImportNotFoundError: () => Effect.succeed(undefined) }));
          const [names, { sex }] = yield* Effect.all([movementNames, profile.get()]);
          const nameOf = (id: MovementId) => names.get(id) ?? id;
          const view = (performance: Performance): typeof PerformanceView.Type => {
            const { variants, ...rest } = performance;
            return {
              ...rest,
              ...(variants === undefined
                ? {}
                : {
                    variants: variants.map((variant) => ({
                      movement: nameOf(variant.movementId),
                      reps: variant.reps,
                    })),
                  }),
            };
          };
          const itemName = (item: DerivedItem) =>
            item.movementId === undefined ? item.text : nameOf(item.movementId);
          const movementView = (item: DerivedItem): typeof MovementView.Type => ({
            movement: itemName(item),
            written: item.text,
            prescribed: item.sets
              .map((set) => set.quantities.map(formatQuantity).join(" "))
              .filter((set) => set !== ""),
            ...(item.plan === undefined ? {} : { planned: view(item.plan) }),
            ...(item.performance === undefined ? {} : { done: view(item.performance) }),
            ...(item.assumed === true ? { assumed: true } : {}),
            ...(item.performed.length === 0 ? {} : { lifted: formatPerformed(item.performed) }),
          });
          const derived =
            stored === undefined
              ? undefined
              : deriveSession(stored.document, (id) => names.get(id), { sex });
          const type = sessionTypeOf(workout);
          const debrief = stored?.document.debrief;
          return {
            id: workout.id,
            performedOn: workout.performedOn,
            name: workout.name,
            kind: workout.kind,
            score: workout.score,
            rx: workout.rx,
            ...(type === undefined ? {} : { session: SESSION_TYPE_LABELS[type] }),
            ...(workout.coaching === undefined
              ? {}
              : { coachedBy: describeCoaching(workout.coaching) }),
            place: describePlace(workout.place),
            notes: workout.notes,
            ...(debrief === undefined ? {} : { debrief }),
            ...(stored === undefined ? {} : { text: stored.document.text }),
            parts: (derived?.parts ?? []).map((part) => {
              const benchmark =
                part.benchmarkId === undefined ? undefined : benchmarkById(part.benchmarkId)?.name;
              return {
                title: part.title,
                ...(benchmark === undefined ? {} : { benchmark }),
                blocks: part.blocks.map((block) => ({
                  title: block.title,
                  format: describeBlock(block.format, block.params),
                  intent: block.intents.map((intent) => intent.text),
                  ...(block.result === undefined
                    ? {}
                    : { result: formatBlockResult(block.result) }),
                  scores: [...block.scores],
                  tonnageKg: Math.round(block.tonnageKg * 10) / 10,
                  movements: block.items.map((item) => ({
                    ...movementView(item),
                    alternatives: item.alternatives.map(movementView),
                  })),
                })),
              };
            }),
            liftSetsFromNotes: (derived?.liftSets ?? []).map((set) => ({
              movement: nameOf(set.movementId),
              reps: set.reps,
              loadKg: set.loadKg,
              sets: set.count,
            })),
          };
        }),
        (found) => ({
          summary: [
            found.debrief === undefined ? "No debrief" : debriefLine(found.debrief),
            plural(
              found.parts.reduce((count, part) => count + part.blocks.length, 0),
              "block",
            ),
          ]
            .filter((part) => part !== "")
            .join(" · "),
          columns: ["Block", "Movement", "Prescribed", "Done", "Result"],
          rows: found.parts.flatMap((part) =>
            part.blocks.flatMap((block) =>
              block.movements.map((item) => [
                blockLabel(part.title, block.title),
                item.movement,
                item.prescribed.join(", "),
                item.done === undefined ? "" : performanceText(item.done),
                block.result ?? block.scores.join(", "),
              ]),
            ),
          ),
        }),
      );
    }),

    get_volume: Effect.fn("CoachTools.get_volume")(function* ({ from, to, movementId }) {
      const names = yield* movementNames.pipe(
        Effect.orElseSucceed(() => new Map<MovementId, string>()),
      );
      const label = (id: MovementId) => names.get(id) ?? id;
      const span = {
        from: from ?? mondayOf(addDays(today, -7 * (VOLUME_DEFAULT_WEEKS - 1))),
        to,
      };
      return yield* read(
        "get_volume",
        [
          movementId === undefined
            ? { tag: "text", text: "Every movement" }
            : movement(label(movementId)),
          range(span),
        ],
        Effect.gen(function* () {
          if (movementId !== undefined) yield* requireMovement(movementId);
          const weeks = yield* volume.weeks();
          const wanted = (id: MovementId | undefined, writtenAs?: MovementId) =>
            movementId === undefined || id === movementId || writtenAs === movementId;
          return weeks.flatMap((week) => {
            const byMovement = new Map<
              MovementId,
              {
                sessions: Set<string>;
                writtenAs: Set<string>;
                reps: number;
                metres: number;
                calories: number;
                seconds: number;
                tonnageKg: number;
              }
            >();
            for (const entry of week.entries) {
              if (!inRange(entry.performedOn, span) || !wanted(entry.movementId, entry.writtenAs))
                continue;
              const sum = byMovement.get(entry.movementId) ?? {
                sessions: new Set<string>(),
                writtenAs: new Set<string>(),
                reps: 0,
                metres: 0,
                calories: 0,
                seconds: 0,
                tonnageKg: 0,
              };
              sum.sessions.add(entry.workoutId ?? `sets on ${entry.performedOn}`);
              if (entry.writtenAs !== entry.movementId) sum.writtenAs.add(label(entry.writtenAs));
              sum.reps += entry.reps;
              sum.metres += entry.metres;
              sum.calories += entry.calories;
              sum.seconds += entry.seconds;
              sum.tonnageKg += entry.tonnageKg;
              byMovement.set(entry.movementId, sum);
            }
            const leftOut = week.leftOut
              .filter((left) => inRange(left.performedOn, span) && wanted(left.movementId))
              .map((left) => ({
                performedOn: left.performedOn,
                line: left.text,
                reason: left.reason,
              }));
            if (byMovement.size === 0 && leftOut.length === 0) return [];
            const movements = [...byMovement]
              .map(([id, sum]) => ({
                movementId: id,
                movement: label(id),
                writtenAs: [...sum.writtenAs],
                sessions: sum.sessions.size,
                reps: sum.reps,
                metres: sum.metres,
                calories: sum.calories,
                seconds: sum.seconds,
                tonnageKg: Math.round(sum.tonnageKg * 10) / 10,
              }))
              .toSorted((left, right) => left.movement.localeCompare(right.movement));
            return [
              {
                weekStart: week.weekStart,
                tonnageKg:
                  Math.round(movements.reduce((total, entry) => total + entry.tonnageKg, 0) * 10) /
                  10,
                movements,
                leftOut,
              },
            ];
          });
        }),
        (found) => ({
          summary:
            found.length === 0
              ? "Nothing counted"
              : `${plural(found.length, "week")}, ${kg(found.reduce((total, week) => total + week.tonnageKg, 0))} lifted`,
          columns: ["Week of", "Movement", "Sessions", "Reps", "Metres", "Cal", "Time", "Tonnage"],
          rows: found.flatMap((week) =>
            week.movements.map((entry) => [
              day(week.weekStart),
              entry.movement,
              String(entry.sessions),
              entry.reps === 0 ? "" : amount(entry.reps),
              entry.metres === 0 ? "" : amount(entry.metres),
              entry.calories === 0 ? "" : amount(entry.calories),
              entry.seconds === 0 ? "" : formatSeconds(entry.seconds),
              entry.tonnageKg === 0 ? "" : kg(entry.tonnageKg),
            ]),
          ),
        }),
      );
    }),

    list_body: ({ from, to }) => {
      const span = { from: from ?? addDays(today, -(BODY_DEFAULT_DAYS - 1)), to };
      return read(
        "list_body",
        [range(span)],
        profile.get().pipe(
          Effect.map(({ bodyweights }) =>
            bodyweights
              .filter((entry) => inRange(entry.performedOn, span))
              .map((entry) => ({
                day: entry.performedOn,
                kg: entry.kg,
                bodyFatPct: entry.bodyFatPct,
                muscleMassKg: entry.muscleMassKg,
                source: entry.source,
              })),
          ),
        ),
        (found) => {
          const latest = found.at(-1);
          return {
            summary:
              latest === undefined
                ? "No weigh-ins"
                : `${plural(found.length, "weigh-in")}, latest ${kg(latest.kg)}`,
            columns: ["Date", "Weight", "Body fat", "Muscle", "From"],
            rows: found.map((entry) => [
              day(entry.day),
              kg(entry.kg),
              entry.bodyFatPct === null ? "" : `${amount(entry.bodyFatPct)} %`,
              entry.muscleMassKg === null ? "" : kg(entry.muscleMassKg),
              entry.source === "garmin" ? "Garmin scale" : "Typed",
            ]),
          };
        },
      );
    },

    get_power: ({ from, to }) =>
      read(
        "get_power",
        [range({ from, to })],
        Effect.gen(function* () {
          const [sessions, athlete, movements] = yield* Effect.all([
            power.sessions(),
            profile.get(),
            catalog.list(),
          ]);
          if (athlete.heightCm === null || athlete.bodyweights.length === 0)
            return yield* Effect.fail<ToolFailure>({
              message:
                "Power needs the athlete's height and a weigh-in, and Settings has " +
                (athlete.heightCm === null ? "no height." : "no weigh-in."),
            });
          return sessionPowerRows(sessions, athlete, movements)
            .filter((row) => inRange(row.performedOn, { from, to }))
            .map((row) => ({
              workoutId: row.workoutId,
              performedOn: row.performedOn,
              name: row.name,
              benchmark: row.benchmark,
              workKj: Math.round(row.joules / 100) / 10,
              seconds: Math.round(row.seconds),
              ...(row.watts === undefined ? {} : { watts: Math.round(row.watts) }),
              over: row.counted.map((block) => block.title),
              strengthBlocksLeftOut: row.strengthBlocks,
            }));
        }),
        (found) => ({
          summary: plural(found.length, "session"),
          columns: ["Date", "Session", "Work", "Time", "Power"],
          rows: found.map((row) => [
            day(row.performedOn),
            row.name,
            `${row.workKj} kJ`,
            row.seconds === 0 ? "" : formatSeconds(row.seconds),
            row.watts === undefined ? "" : `${row.watts} W`,
          ]),
        }),
      ),

    list_lift_sets: Effect.fn("CoachTools.list_lift_sets")(function* ({ movementId, from, to }) {
      const names = yield* movementNames.pipe(
        Effect.orElseSucceed(() => new Map<MovementId, string>()),
      );
      const name = names.get(movementId) ?? movementId;
      return yield* read(
        "list_lift_sets",
        [movement(name), range({ from, to })],
        requireMovement(movementId).pipe(
          Effect.andThen(strength.list()),
          Effect.map((sets) =>
            sets
              .filter(
                (set: LiftSet) =>
                  set.movementId === movementId && inRange(set.performedOn, { from, to }),
              )
              .map(({ performedOn, reps, loadKg }) => ({ performedOn, reps, loadKg })),
          ),
        ),
        (sets) => {
          const heaviest = Math.max(0, ...sets.map((set) => set.loadKg));
          return {
            summary:
              sets.length === 0
                ? "No sets"
                : `${plural(sets.length, "set")}, heaviest ${kg(heaviest)}`,
            columns: ["Date", "Reps", "Load"],
            rows: sets.map((set) => [day(set.performedOn), String(set.reps), kg(set.loadKg)]),
          };
        },
      );
    }),

    get_rep_maxes: Effect.fn("CoachTools.get_rep_maxes")(function* ({ movementId }) {
      const names = yield* movementNames.pipe(
        Effect.orElseSucceed(() => new Map<MovementId, string>()),
      );
      const label = (id: MovementId) => names.get(id) ?? id;
      return yield* read(
        "get_rep_maxes",
        [
          movementId === undefined
            ? { tag: "text", text: "Every movement" }
            : movement(label(movementId)),
        ],
        Effect.gen(function* () {
          if (movementId !== undefined) yield* requireMovement(movementId);
          const [records, sets] = yield* Effect.all([strength.records(), strength.list()]);
          return records
            .filter((record) => movementId === undefined || record.movementId === movementId)
            .map((record) => {
              let best: { set: LiftSet; kg: number; lowKg: number; highKg: number } | undefined;
              for (const set of sets) {
                if (set.movementId !== record.movementId || set.reps > MAX_ESTIMATE_REPS) continue;
                const estimate = estimateOneRepMax(set.loadKg, set.reps);
                if (best === undefined || estimate.epley > best.kg)
                  best = { set, kg: estimate.epley, lowKg: estimate.low, highKg: estimate.high };
              }
              return {
                movementId: record.movementId,
                movement: label(record.movementId),
                repMaxes: record.repMaxes.map(({ reps, loadKg, fromReps, performedOn }) => ({
                  reps,
                  loadKg,
                  fromReps,
                  performedOn,
                })),
                estimated1Rm:
                  best === undefined
                    ? null
                    : {
                        kg: Math.round(best.kg * 10) / 10,
                        lowKg: Math.round(best.lowKg * 10) / 10,
                        highKg: Math.round(best.highKg * 10) / 10,
                        fromSet: `${best.set.reps} x ${kg(best.set.loadKg)}`,
                        performedOn: best.set.performedOn,
                      },
              };
            });
        }),
        (found) => {
          const [only] = found;
          return {
            summary:
              found.length === 1 && only !== undefined
                ? only.estimated1Rm === null
                  ? `${plural(only.repMaxes.length, "rep max")}`
                  : `e1RM ${kg(only.estimated1Rm.kg)} (${kg(only.estimated1Rm.lowKg)} to ${kg(only.estimated1Rm.highKg)})`
                : plural(found.length, "movement"),
            columns: ["Movement", "RM", "Load", "Date"],
            rows: found.flatMap((record) => [
              ...record.repMaxes.map((max) => [
                record.movement,
                `${max.reps}RM`,
                `${kg(max.loadKg)}${max.fromReps > max.reps ? "*" : ""}`,
                day(max.performedOn),
              ]),
              ...(record.estimated1Rm === null
                ? []
                : [
                    [
                      record.movement,
                      "e1RM",
                      `${kg(record.estimated1Rm.kg)} (est.)`,
                      day(record.estimated1Rm.performedOn),
                    ],
                  ]),
            ]),
          };
        },
      );
    }),

    list_benchmarks: ({ category, query }) => {
      const needle = normalizeBenchmarkName(query ?? "");
      return read(
        "list_benchmarks",
        [
          {
            tag: "text",
            text:
              category === undefined
                ? needle === ""
                  ? "Every benchmark"
                  : `Names with "${needle}"`
                : needle === ""
                  ? BENCHMARK_CATEGORY_NAMES[category]
                  : `${BENCHMARK_CATEGORY_NAMES[category]} with "${needle}"`,
          },
        ],
        Effect.succeed(
          BENCHMARKS.filter(
            (benchmark) =>
              (category === undefined || benchmark.category === category) &&
              [benchmark.name, ...benchmark.aliases].some((name) =>
                normalizeBenchmarkName(name).includes(needle),
              ),
          ).map(({ id, name, category, scoring, posted }) => ({
            id,
            name,
            category,
            scoring,
            posted,
          })),
        ),
        (found) => ({
          summary: plural(found.length, "benchmark"),
          columns: ["Benchmark", "Category", "Scored by"],
          rows: found.map((benchmark) => [
            benchmark.name,
            BENCHMARK_CATEGORY_NAMES[benchmark.category],
            SCORED_BY[benchmark.scoring],
          ]),
        }),
      );
    },

    list_benchmark_results: ({ benchmarkId }) =>
      read(
        "list_benchmark_results",
        [
          benchmarkId === undefined
            ? { tag: "text", text: "Every benchmark" }
            : { tag: "benchmark", text: benchmarkById(benchmarkId)?.name ?? benchmarkId },
        ],
        workouts.results().pipe(
          Effect.map((results) =>
            results
              .filter((result) => benchmarkId === undefined || result.benchmarkId === benchmarkId)
              .map((result) => ({
                benchmark: benchmarkById(result.benchmarkId)?.name ?? result.benchmarkId,
                performedOn: result.performedOn,
                score: result.score,
                rx: result.rx,
              })),
          ),
        ),
        (found) => ({
          summary: plural(found.length, "attempt"),
          columns: ["Date", "Benchmark", "Score", "Rx"],
          rows: found.map((result) => [
            day(result.performedOn),
            result.benchmark,
            result.score,
            result.rx === null ? "" : result.rx ? "Rx" : "Scaled",
          ]),
        }),
      ),

    find_similar_sessions: Effect.fn("CoachTools.find_similar_sessions")(function* ({
      workoutId,
      from,
      to,
    }) {
      const all = yield* workouts.list().pipe(Effect.orElseSucceed(() => []));
      const named = all.find((workout) => workout.id === workoutId);
      return yield* read(
        "find_similar_sessions",
        [
          ...(workoutId === undefined
            ? []
            : [
                {
                  tag: "text" as const,
                  text:
                    named === undefined ? workoutId : `${named.name}, ${day(named.performedOn)}`,
                },
              ]),
          ...(workoutId === undefined || from !== undefined || to !== undefined
            ? [range({ from, to })]
            : []),
        ],
        Effect.gen(function* () {
          if (workoutId !== undefined && named === undefined)
            return yield* Effect.fail<ToolFailure>({
              message: `No session '${workoutId}'. Use list_workouts to find its id.`,
            });
          const [similar, names] = yield* Effect.all([workouts.similar(), movementNames]);
          const nameOf = (id: MovementId) => names.get(id) ?? id;
          const refs = new Map(similar.parts.map((part) => [part.id, part]));
          const side = (part: PartRef) => ({
            workoutId: part.workoutId,
            performedOn: part.performedOn,
            workout: part.workoutName,
            part: partLabel(part),
            ...(part.result === "" ? {} : { result: part.result }),
            ...(part.top === null
              ? {}
              : {
                  topSet: `${part.top.reps} x ${kg(part.top.loadKg)} ${nameOf(part.top.movementId)}`,
                }),
          });
          const sessions = new Set<string>();
          return similar.echoes.flatMap((echo) => {
            const part = refs.get(echo.part);
            if (
              part === undefined ||
              (workoutId !== undefined && part.workoutId !== workoutId) ||
              !inRange(part.performedOn, { from, to })
            )
              return [];
            if (!sessions.has(part.workoutId)) {
              if (sessions.size === SIMILAR_SESSIONS) return [];
              sessions.add(part.workoutId);
            }
            const matches = echo.matches.slice(0, SIMILAR_MATCHES).flatMap((match) => {
              const other = refs.get(match.other);
              if (other === undefined) return [];
              const when = other.performedOn > part.performedOn ? "later" : "then";
              return [
                {
                  kind: match.kind,
                  alike: Math.round(match.score * 100),
                  ...side(other),
                  differences: match.differences.map((difference) =>
                    describeDifference(difference, nameOf, when),
                  ),
                },
              ];
            });
            return [{ ...side(part), matches, moreMatches: echo.total - matches.length }];
          });
        }),
        (found) => {
          const matches = found.flatMap((part) => part.matches);
          const repeats = matches.filter((match) => match.kind === "repeat").length;
          const outcome = (side: { readonly result?: string; readonly topSet?: string }) =>
            side.result ?? side.topSet ?? "";
          return {
            summary:
              found.length === 0
                ? "No repeats or look-alikes"
                : [
                    ...(repeats === 0 ? [] : [plural(repeats, "repeat")]),
                    ...(matches.length === repeats
                      ? []
                      : [plural(matches.length - repeats, "look-alike")]),
                  ].join(", "),
            columns: ["Date", "Part", "Result", "Match", "Other", "Its result"],
            rows: found.flatMap((part) =>
              part.matches.map((match) => [
                day(part.performedOn),
                part.part,
                outcome(part),
                match.kind === "repeat" ? "Repeat" : `${match.alike} % alike`,
                `${day(match.performedOn)}, ${match.part}`,
                outcome(match),
              ]),
            ),
          };
        },
      );
    }),

    list_scalings: Effect.fn("CoachTools.list_scalings")(function* ({ movementId, from, to }) {
      const names = yield* movementNames.pipe(
        Effect.orElseSucceed(() => new Map<MovementId, string>()),
      );
      const label = (id: MovementId) => names.get(id) ?? id;
      return yield* read(
        "list_scalings",
        [
          movementId === undefined
            ? { tag: "text", text: "Every movement done scaled" }
            : movement(label(movementId)),
          range({ from, to }),
        ],
        Effect.gen(function* () {
          if (movementId !== undefined) yield* requireMovement(movementId);
          const overview = yield* levels.overview();
          const usage = scalingUsage(
            overview.items.filter((item) => inRange(item.performedOn, { from, to })),
          );
          const scalesTo = new Map(
            overview.movements.map((entry) => [entry.id, (entry.scalings ?? []).map(label)]),
          );
          const ids =
            movementId === undefined
              ? [...usage].filter(([, entry]) => entry.scaled > 0).map(([id]) => id)
              : [movementId];
          return ids
            .map((id) => {
              const entry = usage.get(id);
              return {
                movementId: id,
                movement: label(id),
                sessions: entry?.sessions ?? 0,
                scaledSessions: entry?.scaled ?? 0,
                doneAs: (entry?.swaps ?? []).map((swap) => ({
                  movementId: swap.movementId,
                  movement: label(swap.movementId),
                  sessions: swap.sessions,
                  reps: swap.reps,
                })),
                ...(entry?.lastScaledOn === undefined
                  ? {}
                  : { lastScaledOn: IsoDate.make(entry.lastScaledOn) }),
                scalesTo: scalesTo.get(id) ?? [],
              };
            })
            .toSorted(
              (left, right) =>
                right.scaledSessions - left.scaledSessions || right.sessions - left.sessions,
            );
        }),
        (found) => ({
          summary:
            movementId === undefined
              ? plural(found.length, "movement") + " done scaled"
              : `Scaled in ${found[0]?.scaledSessions ?? 0} of ${plural(found[0]?.sessions ?? 0, "session")}`,
          columns: ["Movement", "Sessions", "Scaled", "Done as", "Last scaled"],
          rows: found.map((entry) => [
            entry.movement,
            String(entry.sessions),
            String(entry.scaledSessions),
            entry.doneAs
              .map((swap) => `${swap.movement} ×${swap.sessions} (${swap.reps} reps)`)
              .join(", "),
            entry.lastScaledOn === undefined ? "" : day(entry.lastScaledOn),
          ]),
        }),
      );
    }),

    list_rest_days: ({ from, to }) =>
      read(
        "list_rest_days",
        [range({ from, to })],
        restDays
          .list()
          .pipe(
            Effect.map((days) =>
              days
                .filter((rest) => inRange(rest.day, { from, to }))
                .map(({ day, kind, source }) => ({ day, kind, markedBy: source })),
            ),
          ),
        (found) => ({
          summary: plural(found.length, "rest day"),
          columns: ["Date", "Why", "Marked by"],
          rows: found.map((rest) => [day(rest.day), REST_DAY_LABELS[rest.kind], BY[rest.markedBy]]),
        }),
      ),

    mark_rest_day: ({ day: date, kind = "rest" }) =>
      read(
        "mark_rest_day",
        [
          { tag: "range", text: day(date) },
          { tag: "text", text: REST_DAY_LABELS[kind] },
        ],
        Effect.gen(function* () {
          if (date < today)
            return yield* Effect.fail<ToolFailure>({
              message: `${day(date)} is past; only today (${day(today)}) or later can be marked.`,
            });
          const [logged, sets, marked] = yield* Effect.all([
            workouts.list(),
            strength.list(),
            restDays.list(),
          ]);
          if (
            logged.some((workout) => workout.performedOn === date) ||
            sets.some((set) => set.performedOn === date)
          )
            return yield* Effect.fail<ToolFailure>({
              message: `${day(date)} already has a session logged.`,
            });
          const existing = marked.find((rest) => rest.day === date);
          if (existing?.source === "athlete")
            return yield* Effect.fail<ToolFailure>({
              message: `The athlete already marked ${day(date)} as ${REST_DAY_LABELS[existing.kind].toLowerCase()}.`,
            });
          const saved = yield* restDays.mark({ day: date, kind }, "coach");
          return { day: saved.day, kind: saved.kind };
        }),
        (saved) => ({
          summary: `Marked ${REST_DAY_LABELS[saved.kind].toLowerCase()}`,
          columns: ["Date", "Why", "Marked by"],
          rows: [[day(saved.day), REST_DAY_LABELS[saved.kind], BY.coach]],
        }),
      ),

    list_blocks: ({ status }) =>
      read(
        "list_blocks",
        [{ tag: "text", text: status === undefined ? "Every block" : `${status} blocks` }],
        Effect.gen(function* () {
          const [all, names, done] = yield* Effect.all([blocks.list(), movementNames, doneLines]);
          return all
            .filter((block) => status === undefined || block.status === status)
            .map((block) => ({
              id: block.id,
              name: block.name,
              goal: block.goal,
              status: block.status,
              madeBy: block.source,
              from: block.sessions[0]?.day ?? null,
              to: block.sessions.at(-1)?.day ?? null,
              trainingMaxes: block.trainingMaxes.map((max) => ({
                movement: names.get(max.movementId) ?? max.movementId,
                kg: max.kg,
              })),
              sessions: block.sessions.length,
              done: block.sessions.filter((session) => {
                const count = done(session);
                return count > 0 && count === session.lines.length;
              }).length,
            }));
        }),
        (found) => ({
          summary: plural(found.length, "block"),
          columns: ["Block", "Status", "Dates", "Training max", "Sessions done"],
          rows: found.map((block) => [
            block.name,
            block.status === "draft" ? "Draft" : "In calendar",
            block.from === null || block.to === null
              ? ""
              : `${day(block.from)} to ${day(block.to)}`,
            block.trainingMaxes.map((max) => `${max.movement} ${kg(max.kg)}`).join(", "),
            `${block.done} of ${block.sessions}`,
          ]),
        }),
      ),

    list_calendar: ({ from = today, to }) => {
      const last = to ?? addDays(from, CALENDAR_DEFAULT_DAYS - 1);
      return read(
        "list_calendar",
        [range({ from, to: last })],
        Effect.gen(function* () {
          if (last < from)
            return yield* Effect.fail<ToolFailure>({ message: "The range ends before it starts." });
          if (daysBetween(from, last) >= CALENDAR_MAX_DAYS)
            return yield* Effect.fail<ToolFailure>({
              message: `Read at most ${CALENDAR_MAX_DAYS} days at a time.`,
            });
          const span = { from, to: last };
          const [logged, posted, all, done, rested] = yield* Effect.all([
            workouts.list(),
            plans.list(),
            blocks.list(),
            doneLines,
            restDays.list(),
          ]);
          const entries = [
            ...logged
              .filter((workout) => inRange(workout.performedOn, span))
              .map((workout) => ({
                day: workout.performedOn,
                kind: "logged" as const,
                what: workout.name,
                detail: [workout.kind, workout.score].filter((part) => part !== "").join(", "),
              })),
            ...posted
              .filter((plan) => inRange(plan.plannedOn, span))
              .map((plan) => ({
                day: plan.plannedOn,
                kind: "box plan" as const,
                what: plan.name,
                detail: "Planned on the Plan page, not logged yet",
              })),
            ...rested
              .filter((rest) => inRange(rest.day, span))
              .map((rest) => ({
                day: rest.day,
                kind: "rest" as const,
                what: REST_DAY_LABELS[rest.kind],
                detail: `Marked by ${rest.source === "coach" ? "you" : "the athlete"}`,
              })),
            ...all.flatMap((block: TrainingBlock) =>
              block.sessions
                .filter((session) => inRange(session.day, span))
                .map((session) => ({
                  day: session.day,
                  kind: block.status === "draft" ? ("draft" as const) : ("programmed" as const),
                  what: `${block.name} · ${session.title}`,
                  detail: [
                    ...(session.note === undefined ? [] : [session.note]),
                    ...session.lines.map((line) => lineText(line, block.trainingMaxes)),
                    `${done(session)} of ${session.lines.length} done`,
                  ].join("; "),
                  sessionId: session.id,
                })),
            ),
          ];
          return entries.sort((a, b) => a.day.localeCompare(b.day));
        }),
        (found) => ({
          summary: found.length === 0 ? "Nothing on these days" : plural(found.length, "entry"),
          columns: ["Date", "Kind", "What", "Detail"],
          rows: found.map((entry) => [day(entry.day), entry.kind, entry.what, entry.detail]),
        }),
      );
    },

    draft_block: ({ name, goal, trainingMaxes, sessions, replaces }) =>
      read(
        "draft_block",
        [
          { tag: "text", text: name },
          ...(replaces === undefined ? [] : [{ tag: "text" as const, text: "Rewrites a draft" }]),
        ],
        Effect.gen(function* () {
          const early = sessions.find((session) => session.day < today);
          if (early !== undefined)
            return yield* Effect.fail<ToolFailure>({
              message: `${day(early.day)} is past; sessions start today (${day(today)}) or later.`,
            });
          const saved = yield* blocks
            .draft(
              { name: name.trim(), goal: goal.trim(), trainingMaxes, sessions },
              "coach",
              replaces,
            )
            .pipe(
              Effect.catchTags({
                BlockInvalidError: (error) =>
                  Effect.fail<ToolFailure>({ message: `Not saved: ${error.problems.join(" ")}` }),
                BlockNotFoundError: () =>
                  Effect.fail<ToolFailure>({
                    message:
                      "No draft with that id; a block already in the calendar cannot be " +
                      "replaced. Use list_blocks for draft ids, or draft a new block.",
                  }),
              }),
            );
          return saved;
        }),
        (saved) => ({
          summary: `Drafted ${plural(saved.sessions.length, "session")}, waiting on the Calendar page`,
          columns: ["Date", "Session", "Lines"],
          rows: saved.sessions.map((session) => [
            day(session.day),
            session.title,
            session.lines.map((line) => lineText(line, saved.trainingMaxes)).join("; "),
          ]),
        }),
      ).pipe(
        Effect.map((saved) => ({
          id: saved.id,
          sessions: saved.sessions.length,
          from: saved.sessions[0]?.day ?? today,
          to: saved.sessions.at(-1)?.day ?? today,
        })),
      ),
  });
};
