import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

const TABS = [
  { to: "/settings", label: "Profile", exact: true },
  { to: "/settings/connections", label: "Connections", exact: false },
] as const;

/** Settings: the athlete's profile, and the outside services Chalk reads from. */
function SettingsLayout() {
  return (
    <main className="mx-auto grid w-full max-w-6xl content-start gap-8 px-6 pt-8 pb-16">
      <div className="grid gap-4">
        <h1 className="protocol-title justify-self-start border-b-2 border-foreground pb-1.5 text-4xl">
          Settings
        </h1>
        <nav aria-label="Settings" className="flex border-b">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.exact }}
              data-sub-tab
              className="flex items-center"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </main>
  );
}
