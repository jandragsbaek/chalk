import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16">
      <header className="flex items-center gap-2 py-6">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Dumbbell className="size-5" />
        </span>
        <span className="text-xl font-bold tracking-tight">Chalk</span>
      </header>
      <Outlet />
    </div>
  );
}
