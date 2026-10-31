import { createFileRoute } from "@tanstack/react-router";

import { BenchmarkList } from "../components/BenchmarkList.tsx";
import { BENCHMARK_FILTERS, type BenchmarkFilter } from "../lib/benchmarks.ts";

interface BenchmarkSearch {
  readonly q?: string;
  readonly filter?: BenchmarkFilter;
}

export const Route = createFileRoute("/benchmarks/")({
  validateSearch: (search: Record<string, unknown>): BenchmarkSearch => {
    const filter = BENCHMARK_FILTERS.find((option) => option.id === search["filter"])?.id;
    const q = typeof search["q"] === "string" && search["q"] !== "" ? search["q"] : undefined;
    return { ...(q === undefined ? {} : { q }), ...(filter === undefined ? {} : { filter }) };
  },
  component: BenchmarksPage,
});

function BenchmarksPage() {
  const { q = "", filter = "all" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BenchmarkList
      query={q}
      filter={filter}
      onSearch={(next) =>
        void navigate({
          search: {
            ...(next.q === "" ? {} : { q: next.q }),
            ...(next.filter === "all" ? {} : { filter: next.filter }),
          },
          replace: true,
        })
      }
    />
  );
}
