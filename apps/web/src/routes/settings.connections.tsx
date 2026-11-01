import { createFileRoute } from "@tanstack/react-router";

import { BookingboardForm } from "../components/settings/BookingboardForm.tsx";
import { GarminForm } from "../components/settings/GarminForm.tsx";

export const Route = createFileRoute("/settings/connections")({ component: ConnectionsPage });

/** The outside services Chalk reads from: the box's bookingboard and the Garmin scale. */
function ConnectionsPage() {
  return (
    <div className="grid max-w-3xl content-start gap-10">
      <BookingboardForm />
      <GarminForm />
    </div>
  );
}
