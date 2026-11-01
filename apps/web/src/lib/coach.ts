import type {
  CoachEvent,
  CoachReceipt,
  CoachRequestPart,
  CoachThread,
  CoachTurn,
  LiftSet,
  Movement,
  MovementId,
  Workout,
} from "@chalk/contracts";

/** A read the coach has started; `receipt` lands when it finishes. */
export interface LiveRead {
  readonly number: number;
  readonly tool: string;
  readonly request: ReadonlyArray<CoachRequestPart>;
  readonly receipt?: CoachReceipt;
}

/** A reply in progress, folded from `coach.send` events. */
export interface LiveReply {
  readonly thread: CoachThread | null;
  readonly athlete: CoachTurn | null;
  readonly reads: ReadonlyArray<LiveRead>;
  readonly coach: CoachTurn | null;
}

export const EMPTY_REPLY: LiveReply = { thread: null, athlete: null, reads: [], coach: null };

export function applyCoachEvent(reply: LiveReply, event: CoachEvent): LiveReply {
  switch (event._tag) {
    case "AthleteTurn":
      return { ...reply, thread: event.thread, athlete: event.turn };
    case "ReadStarted":
      return {
        ...reply,
        reads: [...reply.reads, { number: event.number, tool: event.tool, request: event.request }],
      };
    case "ReadFinished":
      return {
        ...reply,
        reads: reply.reads.map((read) =>
          read.number === event.receipt.number ? { ...read, receipt: event.receipt } : read,
        ),
      };
    case "CoachTurn":
      return { ...reply, thread: event.thread, coach: event.turn };
  }
}

/**
 * The turns to print for a thread: the saved ones, then any live turn the saved list does not
 * have yet. `reading` is the coach's reads while its reply is still being written.
 */
export function threadTurns(
  saved: ReadonlyArray<CoachTurn>,
  live: LiveReply | null,
): { readonly turns: ReadonlyArray<CoachTurn>; readonly reading: ReadonlyArray<LiveRead> | null } {
  if (live === null) return { turns: saved, reading: null };
  const lastSeq = saved.at(-1)?.seq ?? 0;
  const fresh = [live.athlete, live.coach].filter(
    (turn): turn is CoachTurn => turn !== null && turn.seq > lastSeq,
  );
  return {
    turns: [...saved, ...fresh],
    reading: live.athlete !== null && live.coach === null ? live.reads : null,
  };
}

/** The reply's paragraphs (split on blank lines), each with where it starts: a stable key. */
export function paragraphs(
  text: string,
): ReadonlyArray<{ readonly offset: number; readonly text: string }> {
  return Array.from(text.matchAll(/[^\n](?:[^\n]|\n(?!\n))*/g), (match) => ({
    offset: match.index,
    text: match[0],
  }));
}

/** A run of a paragraph: plain text, or a receipt citation. `offset` is where it starts. */
export type TextSegment =
  | { readonly kind: "text"; readonly offset: number; readonly text: string }
  | { readonly kind: "cite"; readonly offset: number; readonly number: number };

/**
 * Splits a paragraph so receipt citations ("(R2)", "(R1, R3)") can be printed as links; the
 * parentheses and commas around them stay text.
 */
export function citeSegments(paragraph: string): ReadonlyArray<TextSegment> {
  const segments: Array<TextSegment> = [];
  let rest = 0;
  const text = (offset: number, end: number) => {
    if (end > offset) segments.push({ kind: "text", offset, text: paragraph.slice(offset, end) });
  };
  for (const match of paragraph.matchAll(/\(R\d+(?:,\s*R\d+)*\)/g)) {
    text(rest, match.index);
    let inner = match.index;
    for (const number of match[0].matchAll(/R(\d+)/g)) {
      const at = match.index + number.index;
      text(inner, at);
      segments.push({ kind: "cite", offset: at, number: Number(number[1]) });
      inner = at + number[0].length;
    }
    rest = match.index + match[0].length;
    text(inner, rest);
  }
  text(rest, paragraph.length);
  return segments;
}

/** "30 Oct": the questions are English sentences, so the date is too. */
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** The window the starter question about a lift looks at. */
const STARTER_WINDOW_DAYS = 84;

/**
 * Three questions to start from, grounded in the log: the lift trained most lately, the latest
 * session, and the block ahead.
 */
export function starterPrompts(input: {
  readonly workouts: ReadonlyArray<Workout>;
  readonly liftSets: ReadonlyArray<LiftSet>;
  readonly movements: ReadonlyArray<Movement>;
  readonly today: string;
}): ReadonlyArray<string> {
  const since = new Date(`${input.today}T00:00:00`);
  since.setDate(since.getDate() - STARTER_WINDOW_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);
  const counts = new Map<MovementId, number>();
  for (const set of input.liftSets)
    if (set.performedOn >= sinceIso)
      counts.set(set.movementId, (counts.get(set.movementId) ?? 0) + 1);
  const [topLift] = [...counts].toSorted((a, b) => b[1] - a[1]);
  const liftName = input.movements.find((movement) => movement.id === topLift?.[0])?.name;
  const [latest] = input.workouts.toSorted((a, b) => b.performedOn.localeCompare(a.performedOn));

  return [
    ...(liftName === undefined ? [] : [`Is my ${liftName.toLowerCase()} still going up?`]),
    ...(latest === undefined
      ? []
      : [
          `What stands out in ${latest.name} on ${dayMonth.format(new Date(`${latest.performedOn}T00:00:00`))}?`,
        ]),
    "Where should the next four weeks of training go?",
  ];
}
