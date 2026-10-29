<img src="assets/icon.svg" width="64" height="64" alt="">

# Chalk

Track your CrossFit workouts, and (soon) get coached on them.

Chalk is also a learning project. It uses the architecture and stack of
[T3 Code](https://github.com/pingdotgg/t3code), scaled down to a small app: shared Effect Schema
contracts, an Effect server with typed RPC, and a React client that reads server data through
Effect atoms.

## Run it

Requires Node 24+. pnpm comes through Corepack, which ships with Node.

```bash
corepack pnpm install
corepack pnpm dev          # server on :4300, web on http://localhost:5173
```

Production: one process serves the API and the built web app from a single origin.

```bash
corepack pnpm build
corepack pnpm start        # http://127.0.0.1:4300
```

| Variable | Default | Purpose |
|---|---|---|
| `CHALK_HOST` | `127.0.0.1` | Interface the server listens on |
| `CHALK_PORT` | `4300` | Server port (the web dev proxy reads it too) |
| `CHALK_DB_PATH` | `data/chalk.sqlite` | SQLite database file |
| `CHALK_WEB_DIST` | unset | Built web app to serve; `start` sets it |

Other commands: `corepack pnpm typecheck`, `corepack pnpm test`.

## How it fits together

```
packages/contracts   Effect Schema domain types, branded ids, tagged errors, one RpcGroup
        │  (imported as TypeScript source by both sides, no build step)
        ├────────────────────────────────────────────┐
apps/server                                      apps/web
  bin.ts      NodeRuntime + Layer.launch           main.tsx    RegistryProvider + TanStack Router
  server.ts   Layer graph: HttpRouter, RPC route,  rpc/        AtomRpc client over HTTP (/rpc)
              static web app, services             state/      query atoms + mutation atoms
  rpc.ts      thin handlers: call one service      components/ shadcn-style UI on Base UI
              method, map errors                   routes/     file-based routes
  workout/    WorkoutStore service (SQL)
  persistence/ SQLite (node:sqlite) + migrations
```

- **Contracts first.** Every request, response and error crossing the wire is an Effect Schema in
  `packages/contracts`. Both the server and the client validate against it.
- **Services, thin transports.** Features are `Context.Service` classes with a `make` and a
  `layer`. RPC handlers decode, call one method and map errors. Storage causes stay in the
  server log.
- **Atoms for server state.** `ChalkClient.query(...)` is an atom the UI reads. Mutations pass a
  reactivity key, so the list refetches after a write.
- **React Compiler** handles memoization; there is no manual `useMemo` or `useCallback`.

## Stack

TypeScript (strict) · Effect 4 (`effect/rpc`, `effect/sql`, `effect/http`, `effect/reactivity`) ·
SQLite via `node:sqlite` · React 19 + React Compiler · Vite · TanStack Router · Tailwind CSS 4 ·
Base UI · Vitest + `@effect/vitest` · pnpm workspaces
