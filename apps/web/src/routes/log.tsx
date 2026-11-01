import { createFileRoute } from "@tanstack/react-router";

import { LogWorkoutForm } from "../components/LogWorkoutForm.tsx";
import { WorkoutHistory } from "../components/WorkoutHistory.tsx";

export const Route = createFileRoute("/log")({ component: LogPage });

function LogPage() {
  return (
    <main className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Log a workout</h2>
        <LogWorkoutForm />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">History</h2>
        <WorkoutHistory />
      </section>
    </main>
  );
}
