import {
  BENCHMARKS,
  BenchmarkId,
  benchmarkById,
  MovementId,
  WorkoutId,
  type BenchmarkResult,
  type GradableMovement,
} from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { filterBenchmarks, historyByBenchmark, historyOf, rxDivision } from "./benchmarks.ts";

const attempt = (
  benchmarkId: string,
  performedOn: string,
  score: string,
  workoutId = `${benchmarkId}-${performedOn}`,
): BenchmarkResult => ({
  benchmarkId: BenchmarkId.make(benchmarkId),
  workoutId: WorkoutId.make(workoutId),
  performedOn,
  score,
  rx: true,
  imported: false,
});

describe("historyByBenchmark", () => {
  it("keeps the fastest time, and the earliest of equal ones", () => {
    const histories = historyByBenchmark(BENCHMARKS, [
      attempt("fran", "2026-10-01", "4:10"),
      attempt("fran", "2026-06-01", "3:58"),
      attempt("fran", "2026-08-01", "3:58"),
      attempt("fran", "2026-09-01", "DNF"),
    ]);
    const fran = historyOf(histories, "fran");
    expect(fran.attempts.map((result) => result.performedOn)).toEqual([
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
      "2026-06-01",
    ]);
    expect(fran.best?.performedOn).toBe("2026-06-01");
  });

  it("keeps the most rounds and reps for an AMRAP", () => {
    const histories = historyByBenchmark(BENCHMARKS, [
      attempt("cindy", "2026-01-01", "18+7"),
      attempt("cindy", "2026-02-01", "19"),
      attempt("cindy", "2026-03-01", "18+12"),
    ]);
    expect(historyOf(histories, "cindy").best?.score).toBe("19");
    expect(historyOf(histories, "grace")).toEqual({ attempts: [], best: undefined });
  });
});

describe("filterBenchmarks", () => {
  const names: Record<string, string> = { pistol: "Pistol", "pull-up": "Pull-up" };
  const nameOf = (id: MovementId) => names[id] ?? id;

  it("finds by name, alias and movement, within a category", () => {
    const options = { filter: "all" as const, done: new Set<string>(), nameOf };
    expect(filterBenchmarks(BENCHMARKS, { ...options, query: "fran" }).map((b) => b.id)).toEqual([
      "fran",
      "war-frank",
    ]);
    expect(
      filterBenchmarks(BENCHMARKS, { ...options, query: "three bars" }).map((b) => b.id),
    ).toEqual(["linda"]);
    const pistols = filterBenchmarks(BENCHMARKS, { ...options, query: "pistol", filter: "girl" });
    expect(pistols.map((b) => b.id)).toEqual(["mary", "maggie"]);
  });

  it("keeps only the ones done", () => {
    const done = filterBenchmarks(BENCHMARKS, {
      query: "",
      filter: "done",
      done: new Set(["murph", "fran"]),
      nameOf,
    });
    expect(done.map((b) => b.id)).toEqual(["fran", "murph"]);
  });
});

describe("rxDivision", () => {
  it("grades the Rx prescription on the sheet: Fran's 43 kg thrusters are Scaled", () => {
    const movements = new Map<MovementId, GradableMovement>([
      [
        MovementId.make("thruster"),
        { id: MovementId.make("thruster"), levelFamily: "bb-thruster" },
      ],
      [MovementId.make("pull-up"), { id: MovementId.make("pull-up"), levelFamily: "pull-ups" }],
    ]);
    expect(rxDivision(benchmarkById("fran")!, movements)).toEqual({ level: "scaled", graded: 2 });
  });
});
