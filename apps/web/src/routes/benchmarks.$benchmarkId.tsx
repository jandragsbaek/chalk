import { benchmarkById } from "@chalk/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BenchmarkDetail } from "../components/BenchmarkDetail.tsx";

export const Route = createFileRoute("/benchmarks/$benchmarkId")({ component: BenchmarkPage });

function BenchmarkPage() {
  const { benchmarkId } = Route.useParams();
  const benchmark = benchmarkById(benchmarkId);
  if (benchmark === undefined)
    return (
      <main className="grid gap-3 px-6 py-10 text-sm">
        <p>No benchmark is called "{benchmarkId}".</p>
        <Link to="/benchmarks" className="w-fit font-semibold underline">
          All benchmarks
        </Link>
      </main>
    );
  // Keyed, so the log form starts fresh on another benchmark.
  return <BenchmarkDetail key={benchmark.id} benchmark={benchmark} />;
}
