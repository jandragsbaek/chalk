import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import type { Span } from "../sessionImport.ts";
import { formatQuantity } from "./derive.ts";
import {
  BENCH_MAX_OUT,
  CATALOG,
  SESSION_160,
  SESSION_160_PLAIN,
  SESSION_166,
  SESSION_167,
  SNATCH_EMOM,
  SNATCH_EMOM_PLAIN,
} from "./fixtures/sessions.ts";
import { makeMovementMatcher, normalizeMovementPhrase } from "./movementMatcher.ts";
import {
  kgToPounds,
  loadUnitOf,
  parseBlockFormat,
  parseRoundRest,
  poundsToKg,
  quantityFromText,
} from "./parse.ts";
import { suggestAttachment, suggestSpans } from "./suggest.ts";

const matcher = makeMovementMatcher(CATALOG);

const suggest = (text: string) => {
  let next = 0;
  return suggestSpans(text, matcher, () => `s${++next}`);
};

/** Spans as readable rows: tag, text, and what the tag carries. */
const describeSpans = (text: string, spans: ReadonlyArray<Span>) => {
  const textOf = (id: string | undefined) => {
    const span = spans.find((candidate) => candidate.id === id);
    return span ? text.slice(span.start, span.end) : undefined;
  };
  return spans.map((span) => {
    const shown = text.slice(span.start, span.end);
    switch (span._tag) {
      case "movement":
        return span.alternativeOf === undefined
          ? `movement ${shown} = ${span.movementId}`
          : `movement ${shown} = ${span.movementId} (or ${textOf(span.alternativeOf)})`;
      case "quantity":
        return `quantity ${shown} = ${formatQuantity(span)} -> ${textOf(span.attachedTo) ?? "?"}`;
      case "block":
        return `block ${shown} = ${span.format} ${JSON.stringify(span.params)}`;
      case "date":
        return `date ${span.date}`;
      case "session":
        return `session ${span.number}`;
      case "score":
        return `score ${shown} -> ${textOf(span.attachedTo) ?? "?"}`;
      default:
        return `${span._tag} ${shown}`;
    }
  });
};

describe("suggestSpans", () => {
  it("reads the session heading, parts, formats and complexes", () => {
    expect(describeSpans(SESSION_167, suggest(SESSION_167))).toEqual([
      "session 167",
      "date 2026-10-28",
      "part Workout #1",
      'block Every 90 sec x 6 = every {"intervalSeconds":90,"rounds":{"min":6,"max":6}}',
      "movement Power clean = power-clean",
      "movement hang power clean = hang-power-clean",
      "quantity 1 = 1 rep -> Power clean",
      "quantity 2 = 2 reps -> hang power clean",
      // Starred lines are the coach's intent for the block above them.
      "intent Byg til en udfordrende vægt over de 5 sæt.",
      'block EMOM 5 = emom {"durationSeconds":300,"intervalSeconds":60}',
      "movement Power clean = power-clean",
      "movement Hang power clean = hang-power-clean",
      "quantity 1 = 1 rep -> Power clean",
      "quantity 2 = 2 reps -> Hang power clean",
      "intent 70-80% af ovenstående.",
      "part Workout #2",
      // The rest line below is the AMRAP's rest between rounds, not a block of its own.
      'block Amrap 15 = amrap {"durationSeconds":900,"restSeconds":30}',
      "movement Double under = double-under",
      "quantity 60 = 60 reps -> Double under",
      // Single-unders are not in this catalog: the count is left for the athlete to attach.
      "quantity 90 = 90 reps -> ?",
      "movement Thrusters = thruster",
      "quantity 12 = 12 reps -> Thrusters",
      "quantity @40/25 = 40/25 kg -> Thrusters",
      "movement Burpee = burpee",
      "quantity 10 = 10 reps -> Burpee",
      "intent Rest 30 sec b/t rounds.",
    ]);
  });

  it("links alternatives, splits AMRAPs around a rest, and leaves unknown movements open", () => {
    expect(describeSpans(SESSION_166, suggest(SESSION_166))).toEqual([
      "session 166",
      "date 2026-10-26",
      "part Workout #1",
      'block Every 3 min x 5 = every {"intervalSeconds":180,"rounds":{"min":5,"max":5}}',
      "movement Front squats = front-squat",
      "quantity 5 = 5 reps -> Front squats",
      "quantity @70-80% of 1 RM = 70-80 % -> Front squats",
      "quantity 20m = 20 m -> ?",
      "part Workout #2",
      'block Amrap 7 = amrap {"durationSeconds":420}',
      "movement row = row",
      "quantity 12/10 Cal = 12/10 cal -> row",
      "movement Burpee = burpee",
      "quantity 10 = 10 reps -> Burpee",
      "movement Double unders = double-under",
      "quantity 40 = 40 reps -> Double unders",
      "quantity 60 = 60 reps -> ?",
      'block Rest 2 min = rest {"durationSeconds":120}',
      'block Amrap 7 = amrap {"durationSeconds":420}',
      "movement Rope climbs = rope-climb",
      "movement Pull ups = pull-up (or Rope climbs)",
      "quantity 2 = 2 reps -> Rope climbs",
      "quantity 8 = 8 reps -> Pull ups",
      "movement Wall balls = wall-ball",
      "quantity 15 = 15 reps -> Wall balls",
    ]);
  });

  it("hangs a percentage ramp on the movement named above the format line", () => {
    const rows = describeSpans(BENCH_MAX_OUT, suggest(BENCH_MAX_OUT));
    expect(rows.slice(0, 6)).toEqual([
      "part Workout #1",
      "movement Bench press = bench-press",
      "block Max out! = strength {}",
      "quantity 10 reps = 10 reps -> Bench press",
      "quantity @20-30% = 20-30 % -> Bench press",
      "quantity 5 Reps = 5 reps -> Bench press",
    ]);
    expect(rows).toContain("quantity @ 92-95@ = 92-95 % -> Bench press");
    // "2-3 forsøg" and "1'er" are prose, and no comment line is read.
    expect(rows.filter((row) => row.includes("-> Bench press"))).toHaveLength(14);
    expect(rows).toContain(
      'block 40 sec på / 20 sec af x 9 = intervals {"workSeconds":40,"restSeconds":20,"rounds":{"min":9,"max":9}}',
    );
    expect(rows).toContain("quantity 20-30 sec = 20-30 sec -> ?");
  });

  it("turns notes into results, skipping failed attempts and asides", () => {
    const rows = describeSpans(SESSION_160, suggest(SESSION_160));
    expect(rows.slice(rows.indexOf("notes Notes"))).toEqual([
      "notes Notes",
      "movement Back squat = back-squat",
      "quantity 1RM = 1 rep -> Back squat",
      "quantity 150 kg = 150 kg -> Back squat",
    ]);
  });

  it("matches aliases and plurals, and splits complexes on +", () => {
    const rows = describeSpans(SNATCH_EMOM, suggest(SNATCH_EMOM));
    expect(rows).toContain("movement squat snatch = snatch");
    expect(rows).toContain("quantity 18-15/15-12 cal = Elite 18/15 · RX 15/12 cal -> row");
    expect(rows).toContain("quantity 2 = 2 reps -> overhead squat");
    // The 50 second cap describes the station, not the row.
    expect(rows.some((row) => row.includes("50 sec"))).toBe(false);
    expect(rows).toContain("intent Byg til en moderat vægt. Teknik frem for vægt.");
    expect(rows).toContain("intent Inspiration fra Prepared programning");
  });

  it("leaves a variation the catalog does not know open instead of matching inside it", () => {
    const withVariations = makeMovementMatcher([
      ...CATALOG,
      { id: MovementId.make("power-snatch"), name: "Power snatch", aliases: [] },
      { id: MovementId.make("hang-power-snatch"), name: "Hang power snatch", aliases: ["HPS"] },
    ]);
    const text = "- 1 High-hang power snatch + 2 power snatch\n- 3 Pause back squat\n- 2 HPS";
    let next = 0;
    expect(
      describeSpans(
        text,
        suggestSpans(text, withVariations, () => `s${++next}`),
      ),
    ).toEqual([
      "movement High-hang power snatch = undefined",
      "movement power snatch = power-snatch",
      "quantity 1 = 1 rep -> High-hang power snatch",
      "quantity 2 = 2 reps -> power snatch",
      "movement Pause back squat = undefined",
      "quantity 3 = 3 reps -> Pause back squat",
      "movement HPS = hang-power-snatch",
      "quantity 2 = 2 reps -> HPS",
    ]);
  });

  it("reads RPE on a movement line, and a line of only intensity as intent", () => {
    const text = "- Back squat 5x3 @RPE 8\n- Work up to RPE 9\n- 3 Deadlift @ 7-8 RPE";
    expect(describeSpans(text, suggest(text))).toEqual([
      "movement Back squat = back-squat",
      "quantity 5 = 5 sets -> Back squat",
      "quantity 3 = 3 reps -> Back squat",
      "quantity @RPE 8 = RPE 8 -> Back squat",
      "intent Work up to RPE 9",
      "movement Deadlift = deadlift",
      "quantity 3 = 3 reps -> Deadlift",
      "quantity @ 7-8 RPE = RPE 7-8 -> Deadlift",
    ]);
  });
});

describe("suggestSpans on plain text", () => {
  const rows = (text: string) => describeSpans(text, suggest(text));

  it("reads bookingboard's program like the org notes of the same class", () => {
    expect(rows(SNATCH_EMOM_PLAIN)).toEqual(rows(SNATCH_EMOM));
  });

  it("reads a session line, titles on top of a paragraph, bullets and notes without org", () => {
    expect(rows(SESSION_160_PLAIN)).toEqual(rows(SESSION_160));
  });

  it("opens no part for a sentence, a lone line or a line inside the notes", () => {
    expect(rows("Byg op.\nBack squat 5x5\n\nCore")).not.toContainEqual(
      expect.stringMatching(/^part /),
    );
    expect(rows("Notes\nFelt heavy today\nBack squat 100 kg")).not.toContainEqual(
      expect.stringMatching(/^part /),
    );
    expect(rows("Back squat\n\n21-15\n5 reps @40%")).not.toContainEqual(
      expect.stringMatching(/^part /),
    );
  });

  it("leaves org pastes to their stars, even with plain lines under a heading", () => {
    const text = "**** Strength\nBack squat\n\nBuild gradually\n5 reps @40%";
    expect(rows(text)).toEqual([
      "part Strength",
      "movement Back squat = back-squat",
      "quantity 5 reps = 5 reps -> Back squat",
      "quantity @40% = 40 % -> Back squat",
    ]);
  });
});

describe("parse helpers", () => {
  it("recognizes block formats at the start of a line", () => {
    expect(parseBlockFormat("E2MOM x 6")).toMatchObject({
      format: "every",
      params: { intervalSeconds: 120, rounds: { min: 6, max: 6 } },
    });
    expect(parseBlockFormat("21-15-9 for time")).toMatchObject({
      format: "for_time",
      params: { scheme: [21, 15, 9] },
    });
    expect(parseBlockFormat("5 rounds for time")).toMatchObject({
      format: "for_time",
      params: { rounds: { min: 5, max: 5 } },
    });
    expect(parseBlockFormat("12 Thrusters")).toBeUndefined();
  });

  it("tells a rest between rounds from a rest block", () => {
    expect(parseRoundRest("Rest 30 sec b/t rounds.")).toBe(30);
    expect(parseRoundRest("Rest 1 min between each round")).toBe(60);
    expect(parseRoundRest("90 sec rest after each round")).toBe(90);
    expect(parseRoundRest("Hvil 2 min mellem runder")).toBe(120);
    expect(parseRoundRest("Rest 2 min")).toBeUndefined();
    expect(parseBlockFormat("Rest 30 sec b/t rounds.")).toBeUndefined();
  });

  it("reads a highlighted phrase as the chosen measure, converting pounds", () => {
    expect(quantityFromText("@95/65 lb", "load_kg")).toEqual({
      measure: "load_kg",
      amount: { min: 43, max: 43 },
      female: { min: 29.5, max: 29.5 },
    });
    expect(quantityFromText("21-15-9", "reps")).toEqual({
      measure: "reps",
      amount: { min: 45, max: 45 },
      scheme: [21, 15, 9],
    });
    expect(quantityFromText("90", "calories")).toEqual({
      measure: "calories",
      amount: { min: 90, max: 90 },
    });
    expect(quantityFromText("heavy", "load_kg")).toBeUndefined();
  });

  it("reads loads written in pounds however the board spells them", () => {
    const text = [
      "Deadlift 3x3 @225#",
      "Thrusters 95/65 pounds",
      "Front squat 5 x 3 @ 135 lbs",
      "Back squat 3x5 @ 60 kilos",
    ].join("\n");
    expect(describeSpans(text, suggest(text)).filter((row) => row.startsWith("quantity"))).toEqual([
      "quantity 3 = 3 sets -> Deadlift",
      "quantity 3 = 3 reps -> Deadlift",
      "quantity 225# = 102 kg -> Deadlift",
      "quantity 95/65 pounds = 43/29.5 kg -> Thrusters",
      "quantity 5 = 5 sets -> Front squat",
      "quantity 3 = 3 reps -> Front squat",
      "quantity 135 lbs = 61.25 kg -> Front squat",
      "quantity 3 = 3 sets -> Back squat",
      "quantity 5 = 5 reps -> Back squat",
      "quantity 60 kilos = 60 kg -> Back squat",
    ]);
  });

  it("tells the unit a session writes its loads in", () => {
    expect(loadUnitOf("Deadlift 5x3 @225#\nThrusters 95/65 lb")).toBe("lb");
    expect(loadUnitOf("Back squat 5x5 @100 kg\nDB snatch 50 lb")).toBe("kg");
    expect(loadUnitOf("Back squat 5x5 @75%")).toBe("kg");
  });

  it("converts pounds to the quarter kilo and back to the pound typed", () => {
    expect(poundsToKg(135)).toBe(61.25);
    expect(kgToPounds(61.25)).toBe(135);
    expect([95, 136, 225, 315].map((pounds) => kgToPounds(poundsToKg(pounds)))).toEqual([
      95, 136, 225, 315,
    ]);
    expect(kgToPounds(60)).toBe(132.3);
  });

  it("normalizes movement phrases for alias lookups", () => {
    expect(normalizeMovementPhrase("Pull-Ups")).toBe("pull up");
    expect(normalizeMovementPhrase("DUs")).toBe("du");
    expect(matcher.lookup("double unders")).toBe("double-under");
  });

  it("attaches a hand-tagged quantity to the movement on its line, else the one above", () => {
    const spans = suggest(SESSION_166);
    const at = SESSION_166.indexOf("4 Wall walks");
    expect(suggestAttachment(SESSION_166, spans, { start: at, end: at + 1, measure: "reps" })).toBe(
      spans.find((span) => SESSION_166.slice(span.start, span.end) === "Wall balls")?.id,
    );
  });
});
