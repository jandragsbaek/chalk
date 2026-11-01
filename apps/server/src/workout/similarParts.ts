import {
  BenchmarkId,
  BlockFormat,
  BlockParams,
  findSimilarParts,
  IsoDate,
  MovementId,
  Quantity,
  WorkoutId,
  type PartRef,
  type PartShape,
  type PartTopSet,
  type PlanSimilarity,
  type ShapeBlock,
  type SimilarParts,
  type SimilarToPlanInput,
} from "@chalk/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

const PartRow = Schema.Struct({
  id: Schema.String,
  workoutId: WorkoutId,
  workoutName: Schema.String,
  performedOn: IsoDate,
  position: Schema.Number,
  title: Schema.String,
  benchmarkId: Schema.NullOr(BenchmarkId),
  workoutScore: Schema.String,
  partCount: Schema.Number,
});

const BlockRow = Schema.Struct({
  id: Schema.String,
  partId: Schema.String,
  format: Schema.NullOr(BlockFormat),
  params: Schema.fromJsonString(BlockParams),
  score: Schema.String,
});

const ItemRow = Schema.Struct({
  blockId: Schema.String,
  movementId: MovementId,
  alternative: Schema.Number,
  prescription: Schema.fromJsonString(
    Schema.Array(Schema.Struct({ quantities: Schema.Array(Quantity) })),
  ),
});

/** `partId` is null for a set from the notes, which belongs to no item. */
const LiftRow = Schema.Struct({
  workoutId: WorkoutId,
  partId: Schema.NullOr(Schema.String),
  movementId: MovementId,
  reps: Schema.Number,
  loadKg: Schema.Number,
});

const CoreRow = Schema.Struct({ id: MovementId, variationOf: Schema.NullOr(MovementId) });

const heavier = (left: PartTopSet | undefined, right: PartTopSet) =>
  left === undefined ||
  right.loadKg > left.loadKg ||
  (right.loadKg === left.loadKg && right.reps > left.reps)
    ? right
    : left;

/**
 * Every saved part compared with every other session's parts (`all`), or a plan's parts with
 * the saved ones (`toPlan`). A lift set counts for the part whose item wrote it; one from the
 * notes counts for the first part that programs its movement.
 */
export const makeLoadSimilarParts = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const selectParts = SqlSchema.findAll({
    Request: Schema.Void,
    Result: PartRow,
    execute: () => sql`
      SELECT p.id, p.workout_id AS "workoutId", w.name AS "workoutName",
             w.performed_on AS "performedOn",
             p.position, p.title, p.benchmark_id AS "benchmarkId", w.score AS "workoutScore",
             (SELECT COUNT(*) FROM workout_parts q WHERE q.workout_id = p.workout_id)
               AS "partCount"
      FROM workout_parts p
      JOIN workouts w ON w.id = p.workout_id
      ORDER BY w.performed_on DESC, w.id DESC, p.position
    `,
  });

  const selectBlocks = SqlSchema.findAll({
    Request: Schema.Void,
    Result: BlockRow,
    execute: () => sql`
      SELECT id, part_id AS "partId", format, params, score FROM workout_blocks
      ORDER BY part_id, position
    `,
  });

  const selectItems = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ItemRow,
    execute: () => sql`
      SELECT block_id AS "blockId", movement_id AS "movementId",
             (alternative_of IS NOT NULL) AS alternative, prescription
      FROM workout_items ORDER BY block_id, position
    `,
  });

  const selectLifts = SqlSchema.findAll({
    Request: Schema.Void,
    Result: LiftRow,
    execute: () => sql`
      SELECT l.workout_id AS "workoutId", b.part_id AS "partId", l.movement_id AS "movementId",
             l.reps, l.load_kg AS "loadKg"
      FROM lift_sets l
      LEFT JOIN workout_items i ON i.id = l.workout_item_id
      LEFT JOIN workout_blocks b ON b.id = i.block_id
      WHERE l.workout_id IS NOT NULL
    `,
  });

  const selectCores = SqlSchema.findAll({
    Request: Schema.Void,
    Result: CoreRow,
    execute: () => sql`SELECT id, variation_of AS "variationOf" FROM movements`,
  });

  const loadRows = Effect.all({
    parts: selectParts(undefined),
    blocks: selectBlocks(undefined),
    items: selectItems(undefined),
    lifts: selectLifts(undefined),
    cores: selectCores(undefined),
  });

  return {
    all: Effect.fn("loadSimilarParts")(function* () {
      return similarParts(yield* loadRows);
    }),
    toPlan: Effect.fn("loadSimilarToPlan")(function* (input: SimilarToPlanInput) {
      return similarToPlan(yield* loadRows, input);
    }),
  };
});

interface Rows {
  readonly parts: ReadonlyArray<typeof PartRow.Type>;
  readonly blocks: ReadonlyArray<typeof BlockRow.Type>;
  readonly items: ReadonlyArray<typeof ItemRow.Type>;
  readonly lifts: ReadonlyArray<typeof LiftRow.Type>;
  readonly cores: ReadonlyArray<typeof CoreRow.Type>;
}

/** The saved parts as shapes, and a way to name any of them with its result. */
function history({ parts, blocks, items, lifts, cores }: Rows) {
  const coreById = new Map(cores.map((row) => [row.id, row.variationOf ?? row.id]));
  const coreOf = (id: MovementId) => coreById.get(id) ?? id;

  const itemsByBlock = new Map<string, Array<ShapeBlock["items"][number]>>();
  for (const item of items) {
    if (item.alternative === 1) continue;
    const entry = {
      movementId: item.movementId,
      sets: item.prescription.map((set) => set.quantities),
    };
    const list = itemsByBlock.get(item.blockId);
    if (list) list.push(entry);
    else itemsByBlock.set(item.blockId, [entry]);
  }
  const blocksByPart = new Map<string, Array<typeof BlockRow.Type>>();
  for (const block of blocks) {
    const list = blocksByPart.get(block.partId);
    if (list) list.push(block);
    else blocksByPart.set(block.partId, [block]);
  }

  const shapes = parts.map((part): PartShape => ({
    id: part.id,
    workoutId: part.workoutId,
    performedOn: part.performedOn,
    benchmarkId: part.benchmarkId ?? undefined,
    blocks: (blocksByPart.get(part.id) ?? []).map((block) => ({
      format: block.format ?? undefined,
      params: block.params,
      items: itemsByBlock.get(block.id) ?? [],
    })),
  }));
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));

  const tops = new Map<string, PartTopSet>();
  const partsByWorkout = new Map<string, Array<PartShape>>();
  for (const shape of shapes) {
    const list = partsByWorkout.get(shape.workoutId);
    if (list) list.push(shape);
    else partsByWorkout.set(shape.workoutId, [shape]);
  }
  const partProgramming = (shape: PartShape, movementId: MovementId) =>
    shape.blocks.some((block) => block.items.some((item) => item.movementId === movementId));
  for (const lift of lifts) {
    const partId =
      lift.partId ??
      partsByWorkout.get(lift.workoutId)?.find((shape) => partProgramming(shape, lift.movementId))
        ?.id;
    if (partId === undefined) continue;
    const set = { movementId: lift.movementId, reps: lift.reps, loadKg: lift.loadKg };
    tops.set(partId, heavier(tops.get(partId), set));
  }

  /** The named saved parts, as refs in session order. */
  const refsOf = (named: ReadonlySet<string>) =>
    parts
      .filter((part) => named.has(part.id))
      .map((part): PartRef => {
        const shape = shapeById.get(part.id)!;
        const partBlocks = blocksByPart.get(part.id) ?? [];
        const headline = partBlocks.find(
          (block) => block.format !== null && block.format !== "rest",
        );
        const scores = partBlocks.map((block) => block.score).filter((score) => score !== "");
        return {
          id: part.id,
          workoutId: part.workoutId,
          workoutName: part.workoutName,
          performedOn: part.performedOn,
          position: part.position,
          title: part.title,
          ...(part.benchmarkId === null ? {} : { benchmarkId: part.benchmarkId }),
          headline: headline ? { format: headline.format, params: headline.params } : null,
          movementIds: [
            ...new Set(shape.blocks.flatMap((block) => block.items.map((item) => item.movementId))),
          ],
          result:
            scores.length > 0 ? scores.join(" · ") : part.partCount === 1 ? part.workoutScore : "",
          top: tops.get(part.id) ?? null,
        };
      });
  return { shapes, coreOf, refsOf };
}

function similarParts(rows: Rows): SimilarParts {
  const { shapes, coreOf, refsOf } = history(rows);
  const echoes = findSimilarParts(shapes, coreOf);
  const named = new Set(
    echoes.flatMap((echo) => [
      echo.part,
      ...echo.matches.map((match) => match.other),
      ...(echo.earlierRepeat === null ? [] : [echo.earlierRepeat]),
    ]),
  );
  return { parts: refsOf(named), echoes };
}

/**
 * Every planned part shares one session id no saved workout has, so the plan's parts are only
 * compared with saved parts, never with each other.
 */
const PLAN_SESSION = "plan";
const PLAN_PART = "plan:";

function similarToPlan(rows: Rows, input: SimilarToPlanInput): PlanSimilarity {
  const { shapes, coreOf, refsOf } = history(rows);
  const planned = input.parts.map((part, position): PartShape => ({
    id: `${PLAN_PART}${position}`,
    workoutId: PLAN_SESSION,
    performedOn: input.plannedOn,
    benchmarkId: part.benchmarkId,
    blocks: part.blocks.map((block) => ({
      format: block.format ?? undefined,
      params: block.params,
      items: block.items,
    })),
  }));
  const echoes = findSimilarParts([...planned, ...shapes], coreOf).flatMap((echo) =>
    echo.part.startsWith(PLAN_PART)
      ? [
          {
            position: Number(echo.part.slice(PLAN_PART.length)),
            matches: echo.matches,
            total: echo.total,
          },
        ]
      : [],
  );
  const named = new Set(echoes.flatMap((echo) => echo.matches.map((match) => match.other)));
  return { parts: refsOf(named), echoes };
}
