import { createFileRoute } from "@tanstack/react-router";

import { LiftSetHistory } from "../components/LiftSetHistory.tsx";
import { LogLiftSetForm } from "../components/LogLiftSetForm.tsx";
import { RepMaxTable } from "../components/RepMaxTable.tsx";
import { StrengthProgress } from "../components/StrengthProgress.tsx";

export const Route = createFileRoute("/strength")({ component: StrengthPage });

function StrengthPage() {
  return (
    <main className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Log a set</h2>
        <LogLiftSetForm />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Progress</h2>
        <StrengthProgress />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Rep maxes</h2>
        <RepMaxTable />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Sets</h2>
        <LiftSetHistory />
      </section>
    </main>
  );
}
