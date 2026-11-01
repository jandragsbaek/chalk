import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Who ran a session: a class at the box under its coach ("Rikke L."), or the athlete on their
 * own (open gym, a session away from the box). Absent where it is not recorded.
 */
export const Coaching = Schema.TaggedUnion({
  coached: { coach: TrimmedNonEmptyString },
  solo: {},
});
export type Coaching = typeof Coaching.Type;

/** What the athlete types for a session done alone, and what lists show for one. */
export const SOLO_LABEL = "Solo";

/** "Rikke L." or "Solo". */
export const describeCoaching = (coaching: Coaching): string =>
  coaching._tag === "solo" ? SOLO_LABEL : coaching.coach;

/**
 * Typed text as coaching: "Solo" (any case) is the athlete alone, other text a coach's name,
 * blank not recorded.
 */
export const parseCoaching = (text: string): Coaching | undefined => {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed === "") return undefined;
  if (trimmed.toLowerCase() === SOLO_LABEL.toLowerCase()) return { _tag: "solo" };
  return { _tag: "coached", coach: trimmed };
};

/** For a line about the session: "with Rikke L." or "Solo". */
export const coachingPhrase = (coaching: Coaching): string =>
  coaching._tag === "solo" ? SOLO_LABEL : `with ${coaching.coach}`;

/** The class a session was at the box: the daily WOD, or a strength class ("Power"). */
export const ClassType = Schema.Literals(["wod", "strength"]);
export type ClassType = typeof ClassType.Type;

/**
 * What a session was: a WOD class, a strength class, or trained alone. Solo is the coaching's,
 * so a session is never a class and solo at once; a class's coach sits beside its type.
 */
export type SessionType = ClassType | "solo";

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  wod: "WOD class",
  strength: "Strength class",
  solo: SOLO_LABEL,
};

export const SESSION_TYPES = Object.keys(SESSION_TYPE_LABELS) as ReadonlyArray<SessionType>;

/** What a session records of who ran it and what it was; each absent when not recorded. */
export interface SessionMarks {
  readonly classType?: ClassType;
  readonly coaching?: Coaching;
}

const marks = (classType: ClassType | undefined, coaching: Coaching | undefined): SessionMarks => ({
  ...(classType === undefined ? {} : { classType }),
  ...(coaching === undefined ? {} : { coaching }),
});

/** Solo when done alone, else the class it was; undefined when not recorded. */
export const sessionTypeOf = (session: SessionMarks): SessionType | undefined =>
  session.coaching?._tag === "solo" ? "solo" : session.classType;

/**
 * The session marked as `type`: Solo is a session alone (no class), a class drops Solo but keeps
 * a coach already named, and none clears the class (and Solo).
 */
export const withSessionType = (
  session: SessionMarks,
  type: SessionType | undefined,
): SessionMarks =>
  type === "solo"
    ? marks(undefined, { _tag: "solo" })
    : marks(type, session.coaching?._tag === "solo" ? undefined : session.coaching);

/**
 * The session with its coaching changed: Solo drops the class, and a coach named for a session
 * that was solo makes it a class, the WOD unless it says otherwise.
 */
export const withCoaching = (
  session: SessionMarks,
  coaching: Coaching | undefined,
  classType?: ClassType,
): SessionMarks => {
  if (coaching?._tag === "solo") return marks(undefined, coaching);
  const wasSolo = session.coaching?._tag === "solo";
  return marks(
    classType ?? session.classType ?? (wasSolo && coaching ? "wod" : undefined),
    coaching,
  );
};

/**
 * For a line about the session: "WOD class with Rikke L.", "Strength class", "Solo", or
 * "with Rikke L." when only the coach is known; undefined when neither is recorded.
 */
export const sessionPhrase = (session: SessionMarks): string | undefined => {
  const type = sessionTypeOf(session);
  if (type === "solo") return SOLO_LABEL;
  const coach = session.coaching?._tag === "coached" ? coachingPhrase(session.coaching) : undefined;
  if (type === undefined) return coach;
  return coach === undefined ? SESSION_TYPE_LABELS[type] : `${SESSION_TYPE_LABELS[type]} ${coach}`;
};
