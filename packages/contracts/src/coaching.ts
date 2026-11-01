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
