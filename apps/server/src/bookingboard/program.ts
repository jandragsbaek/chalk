/** Turning bookingboard's answers into what Chalk reads: box-local days and org program text. */

/** The box is in Vejle; bookingboard mixes `+00:00` and local offsets, so days are read here. */
export const BOX_TIME_ZONE = "Europe/Copenhagen";

const boxParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOX_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An ISO instant as the box's calendar day and clock: `{ date: "2026-10-30", time: "15:30" }`. */
export const boxLocal = (iso: string): { readonly date: string; readonly time: string } => {
  const parts = Object.fromEntries(
    boxParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    time: `${parts["hour"]}:${parts["minute"]}`,
  };
};

/** The calendar day before `date`, both IsoDate. */
export const dayBefore = (date: string): string => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
};

/** The token's `exp` as an ISO instant; undefined when it is not a JWT with one. */
export const tokenExpiry = (token: string): string | undefined => {
  const payload = token.split(".")[1];
  if (payload === undefined) return undefined;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const exp =
      typeof claims === "object" && claims !== null && "exp" in claims ? claims.exp : undefined;
    return typeof exp === "number" && Number.isFinite(exp)
      ? new Date(exp * 1000).toISOString()
      : undefined;
  } catch {
    return undefined;
  }
};

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aelig: "æ",
  AElig: "Æ",
  oslash: "ø",
  Oslash: "Ø",
  aring: "å",
  Aring: "Å",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  eacute: "é",
  // Coaches type dashes in ranges ("18–15"); the importer reads a hyphen.
  ndash: "-",
  mdash: "-",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  times: "×",
  deg: "°",
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[name] ?? whole;
  });

/**
 * The coach's HTML as lines: block ends and `<br>` break lines, tags go, entities and non-breaking
 * spaces become text, empty lines drop. A leading "-" or "•" goes too, since the org text adds
 * its own bullet; a leading "*" stays, as it marks the coach's comment.
 */
export const htmlLines = (html: string): ReadonlyArray<string> =>
  decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/ /g, " ")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*[-•]\s+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line !== "");

export interface ProgramWorkout {
  readonly title?: string | null | undefined;
  readonly text?: string | null | undefined;
  readonly description?: string | null | undefined;
}

/**
 * A class's workouts as the athlete's notes write them: `*** Workout`, one `**** <title>` per
 * workout, one `- ` line each. Empty when no workout has any text.
 */
export const programText = (workouts: ReadonlyArray<ProgramWorkout>): string => {
  const parts = workouts.flatMap((workout, index) => {
    const html = workout.text?.trim() ? workout.text : (workout.description ?? "");
    const lines = htmlLines(html);
    if (lines.length === 0) return [];
    const title = workout.title?.trim() || `Workout #${index + 1}`;
    return [[`**** ${title}`, ...lines.map((line) => `- ${line}`)].join("\n")];
  });
  return parts.length === 0 ? "" : ["*** Workout", ...parts].join("\n");
};
