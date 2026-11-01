import type { CatalogMovement } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { filterMovements, scaledFrom } from "./movements.ts";

const catalog = [
  {
    id: "pull-up",
    name: "Pull-up",
    category: "gymnastics",
    aliases: ["Pullup"],
    scalings: ["ring-row"],
  },
  { id: "ring-row", name: "Ring row", category: "gymnastics", aliases: [] },
  {
    id: "wall-walk",
    name: "Wall walk",
    category: "gymnastics",
    aliases: [],
    scalings: ["walk-out", "ring-row"],
  },
  { id: "row", name: "Row", category: "monostructural", aliases: ["Rowing"] },
] as unknown as ReadonlyArray<CatalogMovement>;

describe("filterMovements", () => {
  const names = (filter: Partial<Parameters<typeof filterMovements>[1]>) =>
    filterMovements(catalog, {
      query: "",
      category: undefined,
      scalings: undefined,
      ...filter,
    }).map((movement) => movement.name);

  it("finds by name or alias, by category, and by whether it has scalings", () => {
    expect(names({ query: "pull up" })).toEqual(["Pull-up"]);
    expect(names({ query: "rowing" })).toEqual(["Row"]);
    expect(names({ category: "monostructural" })).toEqual(["Row"]);
    expect(names({ category: "gymnastics", scalings: "without" })).toEqual(["Ring row"]);
    expect(names({ scalings: "with" })).toEqual(["Pull-up", "Wall walk"]);
  });
});

describe("scaledFrom", () => {
  it("lists the movements that scale to this one", () => {
    expect(scaledFrom("ring-row" as never, catalog).map((movement) => movement.id)).toEqual([
      "pull-up",
      "wall-walk",
    ]);
  });
});
