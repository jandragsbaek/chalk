import {
  CatalogMovement,
  ImportSummary,
  IsoDate,
  PlanId,
  WorkoutId,
  type SessionPlan,
} from "@chalk/contracts";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import { CoachReads, makeHandlers, ToolFailure, type ReadLog } from "../coach/tools.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as LevelStore from "../levels/LevelStore.ts";
import * as PlanStore from "../plan/PlanStore.ts";
import * as RestDayStore from "../rest/RestDayStore.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as BlockStore from "../training/BlockStore.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import {
  DocumentInspection,
  inspectDocument,
  inspectSuggestion,
  SuggestionInspection,
} from "./inspect.ts";

/**
 * Chalk over MCP (Streamable HTTP at `/mcp`), so an agent can read the athlete's log: the
 * coach's reads, and the importer's view of every imported session. Read-only. Like the admin
 * API it has no login; the deployment keeps it on the tailnet.
 */
export const MCP_PATH = "/mcp";

const INSTRUCTIONS = `Chalk is a CrossFit and strength training log. These tools read it and never write.

Imports: the athlete pastes a session as text. Chalk's parser (suggestSpans in packages/contracts/src/sessionImport) highlights spans over the text (parts, blocks, movements, quantities, scores, benchmarks); the athlete corrects them in the editor and saves. The text and the saved spans are the source of truth; parts, blocks, items and lift sets are derived from them (deriveSession).

get_import and get_plan show a saved document next to what this server's parser suggests for the same text now: review.changed, review.missed and review.extra are where the parser and the athlete disagree, which is where the parser needs work. suggest_spans runs the parser on text that was never saved. To reproduce a case locally, take the text from get_import and the movements with their aliases from list_catalog.`;

const common = { failure: ToolFailure, failureMode: "return" } as const;

/** MCP wants an object at the root of a tool's result; the coach's reads return lists. */
const asRows = <
  Name extends string,
  Config extends {
    readonly parameters: Schema.Constraint;
    readonly success: Schema.Top;
    readonly failure: Schema.Constraint;
    readonly failureMode: Tool.FailureMode;
  },
  R,
>(
  tool: Tool.Tool<Name, Config, R>,
) => tool.setSuccess(Schema.Struct({ rows: tool.successSchema })).annotate(Tool.Readonly, true);

const ListImports = Tool.make("list_imports", {
  description:
    "Sessions imported from pasted text, newest day first: workout id, day, session number, " +
    "name, and counts of parts, items and lift sets. Pass the workout id to get_import.",
  parameters: Schema.Struct({
    from: Schema.optionalKey(IsoDate).annotate({ description: "First day, inclusive, YYYY-MM-DD" }),
    to: Schema.optionalKey(IsoDate).annotate({ description: "Last day, inclusive, YYYY-MM-DD" }),
    limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 200 }))),
  }),
  success: Schema.Struct({ imports: Schema.Array(ImportSummary) }),
  ...common,
}).annotate(Tool.Readonly, true);

const GetImport = Tool.make("get_import", {
  description:
    "One imported session: the text as pasted, every saved span with the text it covers and " +
    "its line, a review of the parser's suggestions for the same text against the saved spans, " +
    "the issues the editor would show, and the derived parts, blocks, items and lift sets.",
  parameters: Schema.Struct({
    workoutId: WorkoutId.annotate({ description: "The workout id, from list_imports" }),
  }),
  success: Schema.Struct({ summary: ImportSummary, inspection: DocumentInspection }),
  ...common,
}).annotate(Tool.Readonly, true);

const PlanSummary = Schema.Struct({
  id: PlanId,
  plannedOn: IsoDate,
  name: Schema.String,
  updatedAt: Schema.String,
});

const ListPlans = Tool.make("list_plans", {
  description:
    "Planned sessions not logged yet (the box's posted workout, marked up like an import), " +
    "oldest day first. Pass the id to get_plan.",
  success: Schema.Struct({ plans: Schema.Array(PlanSummary) }),
  ...common,
}).annotate(Tool.Readonly, true);

const GetPlan = Tool.make("get_plan", {
  description:
    "One planned session, inspected like get_import: text, saved spans, the parser review, " +
    "issues and the derived session.",
  parameters: Schema.Struct({
    id: PlanId.annotate({ description: "The plan id, from list_plans" }),
  }),
  success: Schema.Struct({ plan: PlanSummary, inspection: DocumentInspection }),
  ...common,
}).annotate(Tool.Readonly, true);

const SuggestSpans = Tool.make("suggest_spans", {
  description:
    "Runs the import parser on text, as the Import page does on paste, against the live " +
    "catalog: the suggested spans, the issues, and what they derive to. Nothing is saved.",
  parameters: Schema.Struct({
    text: Schema.String.annotate({ description: "One session, as it would be pasted" }),
  }),
  success: SuggestionInspection,
  ...common,
}).annotate(Tool.Readonly, true);

const ListCatalog = Tool.make("list_catalog", {
  description:
    "The movement catalog the parser matches against: ids, names, aliases (the other phrases " +
    "that match), category, the core movement a variation belongs to, and its level family.",
  parameters: Schema.Struct({
    query: Schema.optionalKey(Schema.String).annotate({
      description: "Part of a name or alias, e.g. 'squat'; omit for the whole catalog",
    }),
  }),
  success: Schema.Struct({ movements: Schema.Array(CatalogMovement) }),
  ...common,
}).annotate(Tool.Readonly, true);

export const ChalkMcpToolkit = Toolkit.make(
  asRows(CoachReads.ListMovements),
  asRows(CoachReads.ListWorkouts),
  asRows(CoachReads.ListLiftSets),
  asRows(CoachReads.ListScalings),
  asRows(CoachReads.GetRepMaxes),
  asRows(CoachReads.ListBenchmarks),
  asRows(CoachReads.ListBenchmarkResults),
  asRows(CoachReads.FindSimilarSessions),
  asRows(CoachReads.ListRestDays),
  asRows(CoachReads.ListBlocks),
  asRows(CoachReads.ListCalendar),
  ListImports,
  GetImport,
  ListPlans,
  GetPlan,
  SuggestSpans,
  ListCatalog,
);

/** No receipts: an MCP client keeps its own record of what it called. */
const unlogged: ReadLog = { begin: () => Effect.succeed(0), finish: () => Effect.void };

const rows = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(effect, (found) => ({ rows: found }));

/** Storage causes stay in the server log; the client reads which read failed. */
const unreadable =
  (what: string) =>
  (error: {
    readonly message: string;
    readonly cause?: unknown;
  }): Effect.Effect<never, ToolFailure> =>
    Effect.logError(error.message, error.cause).pipe(
      Effect.andThen(Effect.fail({ message: `Could not read ${what}.` })),
    );

const layerHandlers = ChalkMcpToolkit.toLayer(
  Effect.gen(function* () {
    const workouts = yield* WorkoutStore.WorkoutStore;
    const strength = yield* StrengthStore.StrengthStore;
    const restDays = yield* RestDayStore.RestDayStore;
    const plans = yield* PlanStore.PlanStore;
    const blocks = yield* BlockStore.BlockStore;
    const levels = yield* LevelStore.LevelStore;
    const imports = yield* ImportStore.ImportStore;
    const catalog = yield* CatalogStore.CatalogStore;

    /** The coach's handlers for this call, so "today" is the day it is made (UTC). */
    const coach = Effect.map(DateTime.now, (now) =>
      makeHandlers({
        workouts,
        strength,
        restDays,
        plans,
        blocks,
        levels,
        today: DateTime.formatIsoDateUtc(now),
        log: unlogged,
      }),
    );
    const movements = catalog
      .list()
      .pipe(Effect.catchTags({ CatalogPersistenceError: unreadable("the movement catalog") }));
    const planSummary = (plan: SessionPlan) => ({
      id: plan.id,
      plannedOn: plan.plannedOn,
      name: plan.name,
      updatedAt: plan.updatedAt,
    });

    return ChalkMcpToolkit.of({
      list_movements: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_movements(params)))),
      list_workouts: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_workouts(params)))),
      list_lift_sets: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_lift_sets(params)))),
      list_scalings: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_scalings(params)))),
      get_rep_maxes: (params) => coach.pipe(Effect.flatMap((h) => rows(h.get_rep_maxes(params)))),
      list_benchmarks: (params) =>
        coach.pipe(Effect.flatMap((h) => rows(h.list_benchmarks(params)))),
      list_benchmark_results: (params) =>
        coach.pipe(Effect.flatMap((h) => rows(h.list_benchmark_results(params)))),
      find_similar_sessions: (params) =>
        coach.pipe(Effect.flatMap((h) => rows(h.find_similar_sessions(params)))),
      list_rest_days: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_rest_days(params)))),
      list_blocks: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_blocks(params)))),
      list_calendar: (params) => coach.pipe(Effect.flatMap((h) => rows(h.list_calendar(params)))),

      list_imports: ({ from, to, limit = 50 }) =>
        imports.list().pipe(
          Effect.map((all) => ({
            imports: all
              .filter(
                (summary) =>
                  (from === undefined || summary.performedOn >= from) &&
                  (to === undefined || summary.performedOn <= to),
              )
              .slice(0, limit),
          })),
          Effect.catchTags({ ImportPersistenceError: unreadable("the imports") }),
        ),
      get_import: ({ workoutId }) =>
        Effect.all([
          imports.get(workoutId).pipe(
            Effect.catchTags({
              ImportNotFoundError: (error) => Effect.fail<ToolFailure>({ message: error.message }),
              ImportPersistenceError: unreadable("the import"),
            }),
          ),
          movements,
        ]).pipe(
          Effect.map(([stored, catalogMovements]) => ({
            summary: stored.summary,
            inspection: inspectDocument(stored.document, catalogMovements),
          })),
        ),
      list_plans: () =>
        plans.list().pipe(
          Effect.map((all) => ({ plans: all.map(planSummary) })),
          Effect.catchTags({ PlanPersistenceError: unreadable("the plans") }),
        ),
      get_plan: ({ id }) =>
        Effect.all([
          plans.get(id).pipe(
            Effect.catchTags({
              PlanNotFoundError: (error) => Effect.fail<ToolFailure>({ message: error.message }),
              PlanPersistenceError: unreadable("the plan"),
            }),
          ),
          movements,
        ]).pipe(
          Effect.map(([plan, catalogMovements]) => ({
            plan: planSummary(plan),
            inspection: inspectDocument(plan.document, catalogMovements),
          })),
        ),
      suggest_spans: ({ text }) =>
        movements.pipe(Effect.map((catalogMovements) => inspectSuggestion(text, catalogMovements))),
      list_catalog: ({ query }) => {
        const needle = query?.trim().toLowerCase() ?? "";
        return movements.pipe(
          Effect.map((all) => ({
            movements: all.filter((movement) =>
              [movement.name, ...movement.aliases].some((phrase) =>
                phrase.toLowerCase().includes(needle),
              ),
            ),
          })),
        );
      },
    });
  }),
);

/** The toolkit with its handlers, for the endpoint below and for `McpTest`. */
export const registrations = McpServer.toolkit(ChalkMcpToolkit).pipe(Layer.provide(layerHandlers));

/** Newest first: a client offers its version and the server answers with it when listed. */
export const PROTOCOLS = [
  McpProtocol.v2026_07_28,
  McpProtocol.v2025_11_25,
  McpProtocol.v2025_06_18,
  McpProtocol.v2025_03_26,
] as const;

/**
 * The endpoint. Requests carrying an `Origin` header are refused (no origin is allowed), so a
 * web page cannot reach it from a browser; MCP clients send none.
 */
export const layer = McpServer.layerHttp({
  name: "chalk",
  version: "0.0.0",
  instructions: INSTRUCTIONS,
  path: MCP_PATH,
  protocols: PROTOCOLS,
  allowSubscriptions: false,
  registrations,
});
