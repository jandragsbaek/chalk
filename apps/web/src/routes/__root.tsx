import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";

export const Route = createRootRoute({ component: RootLayout });

const NAV_LINK_CLASS =
  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

/** Pages that lay out wide tables and rulers get the desk's full width. */
const WIDE_PREFIXES = ["/levels", "/benchmarks"];

function RootLayout() {
  const wide = useRouterState({
    select: (state) => WIDE_PREFIXES.some((prefix) => state.location.pathname.startsWith(prefix)),
  });
  return (
    <div
      className={
        wide ? "mx-auto min-h-dvh max-w-7xl px-4 pb-16" : "mx-auto min-h-dvh max-w-2xl px-4 pb-16"
      }
    >
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
          <Link
            to="/benchmarks"
            className={NAV_LINK_CLASS}
            activeProps={{ className: "bg-muted text-foreground" }}
          >
            Benchmarks
          </Link>
          <Link
            to="/levels"
            className={NAV_LINK_CLASS}
            activeProps={{ className: "bg-muted text-foreground" }}
          >
            Levels
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
