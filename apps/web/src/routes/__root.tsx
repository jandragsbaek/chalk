import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createRootRoute({ component: RootLayout });

type NavTarget =
  | "/"
  | "/calendar"
  | "/plan"
  | "/log"
  | "/strength"
  | "/benchmarks"
  | "/levels"
  | "/movements"
  | "/power"
  | "/workouts"
  | "/import"
  | "/coach"
  | "/settings";

const NAV: ReadonlyArray<{ to: NavTarget; label: string; exact?: boolean }> = [
  { to: "/", label: "Today", exact: true },
  { to: "/calendar", label: "Calendar" },
  { to: "/plan", label: "Plan" },
  { to: "/log", label: "Log" },
  { to: "/strength", label: "Strength" },
  { to: "/benchmarks", label: "Benchmarks" },
  { to: "/levels", label: "Levels" },
  { to: "/movements", label: "Movements" },
  { to: "/power", label: "Power" },
  { to: "/workouts", label: "Workouts" },
  { to: "/import", label: "Import" },
  { to: "/coach", label: "Coach" },
  { to: "/settings", label: "Settings" },
];

/**
 * Desk pages lay out their own width under the band; the calendar, the movement catalog, the
 * import and plan workbench and the coach own the viewport. Settings lays out its own two columns.
 */
const OWN_LAYOUT_PREFIXES = [
  "/calendar",
  "/movements",
  "/workouts",
  "/import",
  "/plan",
  "/coach",
  "/settings",
];
/** Pages that lay out wide tables and rulers get the desk's full width. */
const WIDE_PREFIXES = ["/levels", "/benchmarks"];

type PageLayout = "own" | "wide" | "narrow";

function pageLayout(pathname: string): PageLayout {
  // The front page lays out its own week column and field.
  if (pathname === "/") return "own";
  if (OWN_LAYOUT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "own";
  if (WIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "wide";
  return "narrow";
}

function NavTab({ to, label, exact }: { to: NavTarget; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="flex h-12 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-semibold uppercase tracking-wide text-band-muted font-stretch-semi-condensed hover:text-band-foreground data-[status=active]:border-band-foreground data-[status=active]:text-band-foreground"
    >
      {label}
    </Link>
  );
}

function Page({ layout }: { layout: PageLayout }) {
  if (layout === "own") return <Outlet />;
  return (
    <div
      className={
        layout === "wide"
          ? "mx-auto w-full max-w-7xl px-4 pt-8 pb-16"
          : "mx-auto w-full max-w-2xl px-4 pt-8 pb-16"
      }
    >
      <Outlet />
    </div>
  );
}

function RootLayout() {
  const layout = useRouterState({ select: (state) => pageLayout(state.location.pathname) });
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-band text-band-foreground">
        <div className="flex h-12 items-center gap-4 px-4 sm:gap-6 sm:px-6">
          <Link to="/" className="shrink-0">
            <span className="protocol-title text-2xl">Chalk</span>
          </Link>
          <nav aria-label="Sections" data-tab-row className="flex items-center overflow-x-auto">
            {NAV.map((tab) => (
              <NavTab key={tab.to} {...tab} />
            ))}
          </nav>
        </div>
      </header>
      <Page layout={layout} />
    </div>
  );
}
