import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import type { CatalogMovement } from "../sessionImport.ts";
import { trailingWords, variationLadder } from "./variations.ts";

const movement = (
  id: string,
  name: string,
  variationOf?: string,
  aliases: ReadonlyArray<string> = [],
): CatalogMovement => ({
  id: MovementId.make(id),
  name,
  category: "gymnastics",
  aliases,
  ...(variationOf === undefined ? {} : { variationOf: MovementId.make(variationOf) }),
});

const CATALOG = [
  movement("burpee", "Burpee"),
  movement("bar-facing-burpee", "Bar-facing burpee", "burpee", ["Burpee over bar"]),
  movement("burpee-over-dumbbell", "Burpee over dumbbell", "burpee", ["Burpee over DB"]),
  movement("burpee-over-line", "Burpee over line", "burpee"),
  movement("burpee-box-jump-over", "Burpee box jump-over", "burpee"),
  movement("run", "Run"),
];

/** The words after the first occurrence of `movement` in `text`. */
const after = (text: string, word: string, spans: ReadonlyArray<string> = []) => {
  const start = text.indexOf(word);
  const marks = spans.map((other) => {
    const at = text.indexOf(other);
    return { start: at, end: at + other.length };
  });
  return trailingWords(text, { end: start + word.length }, marks)?.text;
};

describe("trailingWords", () => {
  it("reads the words after a mark, the board's dot included", () => {
    expect(after("- 12 Burpee o. line", "Burpee")).toBe("o. line");
    expect(after("12 Burpees lateral over DB\n10 Run", "Burpees")).toBe("lateral over DB");
  });

  it("stops at a number, a separator, a stop word or the next mark", () => {
    expect(after("12 Thrusters @40/25", "Thrusters")).toBeUndefined();
    expect(after("60 Double under or 90 Single unders", "Double under")).toBeUndefined();
    expect(after("Burpee box 24/20", "Burpee")).toBe("box");
    expect(after("Burpee to wall ball", "Burpee", ["wall ball"])).toBe("to");
    expect(after("Burpee\nline", "Burpee")).toBeUndefined();
  });
});

describe("variationLadder", () => {
  const names = (id: string, trailing: string | undefined) =>
    variationLadder(MovementId.make(id), CATALOG, trailing)?.options.map(
      (option) => option.movement.name,
    );

  it("ranks the core's variations by the words left over, shorthand read out", () => {
    const ladder = variationLadder(MovementId.make("burpee"), CATALOG, "o. line");
    expect(ladder?.core.id).toBe("burpee");
    expect(ladder?.options[0]?.movement.id).toBe("burpee-over-line");
    expect([...(ladder?.options[0]?.matched ?? [])]).toEqual(["over", "line"]);
    expect(names("burpee", "o. DB")?.[0]).toBe("Burpee over dumbbell");
    // An alias counts, and is named when it matched more than the name did.
    const bar = variationLadder(MovementId.make("burpee"), CATALOG, "o. bar")?.options[0];
    expect(bar).toMatchObject({
      movement: { name: "Bar-facing burpee" },
      score: 2,
      via: "Burpee over bar",
    });
  });

  it("offers the core and the other variations from a variation, and nothing without a family", () => {
    expect(names("burpee-over-line", undefined)).toEqual([
      "Bar-facing burpee",
      "Burpee",
      "Burpee box jump-over",
      "Burpee over dumbbell",
    ]);
    expect(variationLadder(MovementId.make("run"), CATALOG, "fast")).toBeUndefined();
  });
});
