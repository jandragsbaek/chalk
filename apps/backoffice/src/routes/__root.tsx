import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-6 pb-16">
      <header className="flex items-center justify-between border-b py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-foreground text-background">
            <ShieldCheck className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">Chalk Backoffice</span>
        </Link>
        <span className="text-xs text-muted-foreground">Admin host</span>
      </header>
      <Outlet />
    </div>
  );
}
