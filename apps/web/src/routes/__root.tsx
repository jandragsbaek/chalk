import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";

export const Route = createRootRoute({ component: RootLayout });

const NAV_LINK_CLASS =
  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

function RootLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between gap-4 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">Chalk</span>
        </Link>
        <nav className="flex gap-1">
          <Link
            to="/"
            className={NAV_LINK_CLASS}
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-muted text-foreground" }}
          >
            Workouts
          </Link>
          <Link
            to="/strength"
            className={NAV_LINK_CLASS}
            activeProps={{ className: "bg-muted text-foreground" }}
          >
            Strength
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
