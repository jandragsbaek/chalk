import { ImportDocument, WORKOUT_KIND_LABELS, WorkoutKind } from "@chalk/contracts";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Prompt from "effect/ai/Prompt";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { CoachModel } from "../coach/CoachService.ts";

/** How often to look for sessions still wearing Chalk's own name. */
const LOOK_EVERY = Duration.seconds(20);
/** Sessions named per look; the backlog of older imports drains over a few minutes. */
const BATCH = 10;
const NAME_TIMEOUT = Duration.seconds(30);
const MAX_LENGTH = 60;

const SYSTEM = [
  "You name CrossFit training sessions for an athlete's training log.",
  "Reply with the name only: 2 to 6 words, like the title a coach writes on the whiteboard, in " +
    "sentence case. Name the session by what defines it: the main lift and the conditioning " +
    "piece ('Snatch ladder, toes-to-bar AMRAP'), or the workout's character ('Long row and " +
    "burpee chipper'). A known benchmark keeps its name ('Fran', 'Murph').",
  "No date, no session number, no quotes, no full stop at the end.",
].join("\n");

const PendingRow = Schema.Struct({
  id: Schema.String,
  kind: WorkoutKind,
  score: Schema.String,
  notes: Schema.String,
  document: Schema.NullOr(Schema.String),
});
type PendingRow = typeof PendingRow.Type;

const decodeDocument = Schema.decodeUnknownOption(Schema.fromJsonString(ImportDocument));

/** What the model reads: the board as pasted, or what a logged workout recorded. */
export const describeForNaming = (row: PendingRow): string => {
  const board = row.document === null ? Option.none() : decodeDocument(row.document);
  const lines = [
    ...(Option.isSome(board) ? ["The board as written:", board.value.text.trim(), ""] : []),
    `Kind: ${WORKOUT_KIND_LABELS[row.kind]}`,
    ...(row.score.trim() === "" ? [] : [`Score: ${row.score.trim()}`]),
    ...(Option.isNone(board) && row.notes.trim() !== "" ? [`Notes: ${row.notes.trim()}`] : []),
  ];
  return lines.join("\n");
};

/**
 * The model's reply as a name: its first line, without quotes, a leading "Session 171" or a
 * closing full stop, at most 60 characters; undefined when nothing is left.
 */
export const cleanName = (reply: string): string | undefined => {
  const line = reply
    .trim()
    .split("\n")[0]!
    .trim()
    .replace(/^name:\s*/i, "")
    .replace(/^["'“‘*]+|["'”’*]+$/g, "")
    .replace(/^session\s*(no\.?\s*)?#?\d+\s*[:·\-–—]?\s*/i, "")
    .replace(/\.$/, "")
    .trim();
  if (line === "") return undefined;
  if (line.length <= MAX_LENGTH) return line;
  const cut = line.slice(0, MAX_LENGTH);
  const space = cut.lastIndexOf(" ");
  return (space > 20 ? cut.slice(0, space) : cut).replace(/[,;:·\-–—]$/, "").trim();
};

/**
 * Names sessions that still carry Chalk's own name (an import's kind and first movements, or an
 * old "Session 171") with the coach's model. Looks every 20 seconds; a session the model fails
 * on keeps its name and is tried again after a restart. No OpenRouter key, no naming.
 */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const { models } = yield* CoachModel;
    if (Option.isNone(models)) return;
    const { defaultModel, choices } = models.value;
    const model = choices.find((choice) => choice.slug === defaultModel) ?? choices[0];
    if (model === undefined) return;
    const sql = yield* SqlClient.SqlClient;
    const failed = new Set<string>();

    const selectPending = SqlSchema.findAll({
      Request: Schema.Void,
      Result: PendingRow,
      execute: () => sql`
        SELECT w.id, w.kind, w.score, w.notes, si.document
        FROM workouts w LEFT JOIN session_imports si ON si.workout_id = w.id
        WHERE w.name_source = 'derived'
        ORDER BY w.performed_on DESC, w.id DESC
      `,
    });

    const nameOne = (row: PendingRow) =>
      LanguageModel.generateText({
        prompt: Prompt.setSystem(Prompt.make(describeForNaming(row)), SYSTEM),
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.languageModel),
        Effect.timeout(NAME_TIMEOUT),
        Effect.flatMap((response) =>
          Effect.gen(function* () {
            const name = cleanName(response.text);
            if (name === undefined) return yield* Effect.fail("the model gave no name");
            // Only while Chalk's name stands: a session renamed or deleted meanwhile is left be.
            yield* sql`
              UPDATE workouts SET name = ${name}, name_source = 'model'
              WHERE id = ${row.id} AND name_source = 'derived'
            `;
          }),
        ),
        Effect.catch((error) =>
          Effect.sync(() => failed.add(row.id)).pipe(
            Effect.andThen(Effect.logWarning(`Could not name session ${row.id}`, error)),
          ),
        ),
      );

    const look = selectPending(undefined).pipe(
      Effect.map((rows) => rows.filter((row) => !failed.has(row.id)).slice(0, BATCH)),
      Effect.flatMap((rows) => Effect.forEach(rows, nameOne, { discard: true })),
      Effect.catch((error) => Effect.logWarning("Could not look for sessions to name", error)),
    );

    yield* look.pipe(Effect.repeat(Schedule.spaced(LOOK_EVERY)), Effect.forkScoped);
  }),
);
