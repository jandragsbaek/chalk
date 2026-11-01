import {
  BENCHMARK_CATEGORY_NAMES,
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
    "'Solo' for one done alone) and who coached it.",
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

export const CoachToolkit = Toolkit.make(
  ListMovements,
  ListWorkouts,
  ListLiftSets,
  GetRepMaxes,
  ListBenchmarks,
  ListBenchmarkResults,
  FindSimilarSessions,
  ListRestDays,
  MarkRestDay,
  ListBlocks,
  ListCalendar,
  DraftBlock,
);

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

/** Handlers over the stores, reporting each call to `log`. */
export const makeHandlers = (deps: {
  readonly workouts: WorkoutStore.WorkoutStore["Service"];
  readonly strength: StrengthStore.StrengthStore["Service"];
  readonly restDays: RestDayStore.RestDayStore["Service"];
  /** The coach's today, YYYY-MM-DD: the first day it may mark. */
  readonly plans: PlanStore.PlanStore["Service"];
  readonly blocks: BlockStore.BlockStore["Service"];
  readonly today: IsoDate;
  readonly log: ReadLog;
}) => {
  const { workouts, strength, restDays, plans, blocks, today, log } = deps;

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
        workouts.list().pipe(
          Effect.map((all) =>
            all
              .filter((workout) => inRange(workout.performedOn, { from, to }))
              .slice(0, limit ?? 30)
              .map((workout) => {
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
                };
              }),
          ),
        ),
        (found) => ({
          summary: plural(found.length, "session"),
          columns: ["Date", "Workout", "Kind", "Score", "Session", "Coached by"],
          rows: found.map((workout) => [
            day(workout.performedOn),
            workout.name,
            workout.kind,
            workout.score === "" ? "" : `${workout.score}${workout.rx ? " Rx" : ""}`,
            workout.session ?? "",
            workout.coachedBy ?? "",
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
