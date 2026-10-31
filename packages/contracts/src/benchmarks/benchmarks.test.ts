import { describe, expect, it } from "@effect/vitest";

import { formatQuantity } from "../sessionImport/derive.ts";
import {
  BENCHMARKS,
  benchmarkById,
  benchmarkMovementIds,
  findBenchmark,
  isBetterScore,
  normalizeBenchmarkName,
  parseBenchmarkScore,
  type Benchmark,
  type BenchmarkItem,
} from "./index.ts";

const allItems = (benchmark: Benchmark): ReadonlyArray<BenchmarkItem> =>
  benchmark.blocks.flatMap((block) =>
    block.items.flatMap((item) => [item, ...(item.alternatives ?? [])]),
  );

/** One line per block: what a coach writes on the board, for spot checks. */
const board = (benchmark: Benchmark) =>
  benchmark.blocks.map((block) =>
    [
      block.title,
      ...block.items.map((item) =>
        [item.movementId, ...item.quantities.map(formatQuantity), item.note ?? ""]
          .filter((part) => part !== "")
          .join(" "),
      ),
    ].join(" | "),
  );

const problemsOf = (benchmark: Benchmark): ReadonlyArray<string> => {
  const problems: Array<string> = [];
  const problem = (message: string) => problems.push(`${benchmark.name}: ${message}`);
  if (benchmark.posted.trim() === "") problem("no posted text");
  if (benchmark.firstPosted !== undefined && !/^20\d\d-\d\d-\d\d$/.test(benchmark.firstPosted))
    problem(`first posted "${benchmark.firstPosted}" is not a date`);
  if (benchmark.firstPosted !== undefined && benchmark.firstPosted > "2026-10-31")
    problem("first posted in the future");
  if (!benchmark.blocks.some((block) => block.items.length > 0)) problem("no movements");
  for (const block of benchmark.blocks) {
    if (block.format === "rest" && block.items.length > 0) problem("a rest block has movements");
    if (block.format !== "rest" && block.items.length === 0) problem(`"${block.title}" is empty`);
  }
  for (const item of allItems(benchmark))
    for (const quantity of item.quantities) {
      const { amount, female } = quantity;
      if (!(amount.min >= 0 && amount.max >= amount.min && Number.isFinite(amount.max)))
        problem(`${item.movementId}: bad amount ${formatQuantity(quantity)}`);
      if (quantity.measure === "load_kg" && (amount.max <= 0 || amount.max > 250))
        problem(`${item.movementId}: load ${amount.max} kg is out of range`);
      if (quantity.measure === "load_kg" && female && female.max > amount.max)
        problem(`${item.movementId}: the female load is heavier, male and female are swapped`);
      if (quantity.measure === "distance_m" && amount.max > 20_000)
        problem(`${item.movementId}: ${amount.max} m is out of range`);
    }
  return problems;
};

describe("benchmarks", () => {
  it("are all well formed", () => {
    expect(BENCHMARKS.flatMap(problemsOf)).toEqual([]);
  });

  it("have unique ids, and names and aliases that mean one workout", () => {
    const ids = BENCHMARKS.map((benchmark) => benchmark.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    const names = BENCHMARKS.flatMap((benchmark) =>
      [benchmark.name, ...benchmark.aliases].map(normalizeBenchmarkName),
    );
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it("cover the Girls and the official Hero list", () => {
    const count = (category: Benchmark["category"]) =>
      BENCHMARKS.filter((benchmark) => benchmark.category === category).length;
    expect(count("girl")).toBe(33);
    expect(count("hero")).toBe(244);
  });

  it("find a benchmark by name, ignoring case and punctuation", () => {
    expect(findBenchmark("FRAN")?.id).toBe("fran");
    expect(findBenchmark("  fran: ")?.id).toBe("fran");
    expect(findBenchmark("Three bars of death")?.id).toBe("linda");
    expect(findBenchmark("Franny")).toBeUndefined();
    expect(benchmarkById("barbara-ann")?.name).toBe("Barbara Ann");
  });

  it("write the board in kilograms, male load first", () => {
    expect(board(benchmarkById("fran")!)).toEqual([
      "21-15-9 reps for time | thruster 43/29 kg | pull-up",
    ]);
    expect(board(benchmarkById("helen")!)).toEqual([
      "3 rounds for time | run 400 m | kettlebell-swing 21 reps 24/16 kg | pull-up 12 reps",
    ]);
    expect(benchmarkMovementIds(benchmarkById("helen")!)).toEqual([
      "run",
      "kettlebell-swing",
      "pull-up",
    ]);
  });

  it("score by what the workout counts", () => {
    expect(benchmarkById("fran")?.scoring).toBe("time");
    expect(benchmarkById("cindy")?.scoring).toBe("rounds_reps");
    expect(benchmarkById("gwen")?.scoring).toBe("load");
    expect(benchmarkById("fight-gone-bad")?.scoring).toBe("reps");
  });
});

describe("parseBenchmarkScore", () => {
  it("reads times, rounds and reps, reps and loads", () => {
    expect(parseBenchmarkScore("time", "4:32")).toBe(272);
    expect(parseBenchmarkScore("time", "Time 1:02:15 Rx")).toBe(3735);
    expect(parseBenchmarkScore("time", "DNF")).toBeUndefined();
    expect(parseBenchmarkScore("rounds_reps", "12+5")).toBe(12_005);
    expect(parseBenchmarkScore("rounds_reps", "12 rounds + 5 reps")).toBe(12_005);
    expect(parseBenchmarkScore("rounds_reps", "20 rounds")).toBe(20_000);
    expect(parseBenchmarkScore("rounds_reps", "18")).toBe(18_000);
    expect(parseBenchmarkScore("reps", "320 reps")).toBe(320);
    expect(parseBenchmarkScore("load", "102,5 kg")).toBe(102.5);
    expect(parseBenchmarkScore("load", "225 lb")).toBe(102);
  });

  it("ranks a lower time and more of everything else as better", () => {
    expect(isBetterScore("time", 250, 272)).toBe(true);
    expect(isBetterScore("rounds_reps", 12_005, 12_010)).toBe(false);
  });
});
