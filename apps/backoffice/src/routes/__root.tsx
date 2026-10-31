import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({ component: RootLayout });

function NavTab({ to, label, exact }: { to: "/" | "/import"; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="flex h-12 items-center border-b-2 border-transparent px-3 text-sm font-semibold uppercase tracking-wide text-band-muted font-stretch-semi-condensed hover:text-band-foreground data-[status=active]:border-band-foreground data-[status=active]:text-band-foreground"
    >
      {label}
    </Link>
  );
}

function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-band text-band-foreground">
        <div className="flex h-12 items-center gap-6 px-6">
          <Link to="/" className="flex items-baseline gap-2.5">
            <span className="protocol-title text-2xl">Chalk</span>
            <span className="form-label text-band-muted">Backoffice</span>
          </Link>
          <nav aria-label="Sections" className="flex items-center">
            <NavTab to="/" label="Workouts" exact />
            <NavTab to="/import" label="Import" />
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
