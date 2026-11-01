<img src="assets/icon.svg" width="64" height="64" alt="">

# Chalk

Track your CrossFit workouts and strength numbers, and (soon) get coached on them.

Today: log workouts with a free-form score, and log strength sets (reps × kg) against a movement
catalog, with 1/2/3/5/10RM derived per movement and an estimated 1RM chart over time. The
backoffice imports past sessions from pasted text: Chalk highlights movements and numbers, you fix
the highlights, and parts, blocks, movements and lift sets are saved from them. A strength
movement takes a result (fixed load, ramp by a step, or set by set), so each session has a total
lifted in kg. Each movement is graded on GymDanmark's FF level sheet (Fundamentals to RX, plus
Chalk's own Elite): the importer records how it was done, and `/levels` draws a ruler per
movement family with where the workouts put you and what you can do. `/benchmarks` holds 280
named workouts (the Girls, CrossFit's Hero workouts, a few classics) with their boards in kg, how
their Rx grades on the level sheet, and your attempts; logging one, or importing a session that
names one, links it. Where it is going:

- [docs/domain.md](docs/domain.md): movements, scaling, workouts composed of movements, rep
  maxes, the weekly volume grid.
- [docs/roadmap.md](docs/roadmap.md): phases, in order.
- [docs/coaching.md](docs/coaching.md): a short agentic coaching loop over an MCP server and
  OpenRouter.

Chalk is also a learning project. It uses the architecture and stack of
[T3 Code](https://github.com/pingdotgg/t3code), scaled down to a small app: shared Effect Schema
contracts, an Effect server with typed RPC, and a React client that reads server data through
Effect atoms.

## Run it

Tool versions (Node, pnpm) are pinned in `mise.toml`. With [mise](https://mise.jdx.dev) installed:

```bash
mise install
pnpm install
pnpm dev          # server on :4300, web on http://localhost:5173
pnpm dev:admin    # admin server on :4301, backoffice on http://localhost:5174
```

Production: one process serves the API and the built web app from a single origin.

```bash
pnpm build
pnpm start        # http://127.0.0.1:4300
pnpm start:admin  # http://127.0.0.1:4301 (backoffice + admin API)
```

| Variable         | Default             | Purpose                                     |
| ---------------- | ------------------- | ------------------------------------------- |
| `CHALK_MODE`     | `api`               | `api` (app RPC) or `admin` (admin HttpApi)  |
| `CHALK_HOST`     | `127.0.0.1`         | Interface the server listens on             |
| `CHALK_PORT`     | `4300` / `4301`     | Server port, by mode (dev proxies read it)  |
| `CHALK_DB_PATH`  | `data/chalk.sqlite` | SQLite database file                        |
| `CHALK_WEB_DIST` | unset               | Built SPA to serve; `start*` scripts set it |

Deploying: [docs/deploy.md](docs/deploy.md) (Docker image, Kamal, a tailnet-only lab VM).

Other commands: `pnpm openapi` (regenerate `packages/contracts/openapi/admin.json`; a test fails when it is stale), `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm fmt`, and `pnpm check` (everything CI runs). The toolchain is [Vite+](https://viteplus.dev) (`vp`): one root `vite.config.ts` configures tests, Oxlint (with the local `oxlint-plugin-chalk/` rules and `@shadcn/lint`), Oxfmt, and the pre-commit hook, which formats and lints staged files with `vp staged`. `@effect/vitest` is patched (`patches/`) to import `vite-plus/test` instead of `vitest`. The lint setup and the rules in `oxlint-plugin-chalk/` are adapted from [T3 Code](https://github.com/pingdotgg/t3code) under its MIT license (`oxlint-plugin-chalk/LICENSE`).

## How it fits together

```
packages/contracts   Effect Schema domain types, branded ids, tagged errors,
                     RpcGroup (app) + ChalkAdminApi HttpApi (admin) + checked-in OpenAPI
packages/ui          shadcn components on Base UI, theme tokens (theme.css)
        │  (both imported as TypeScript source, no build step)
        ├──────────────────────────────────┬─────────────────────────────────┐
apps/server                            apps/web (:5173)                  apps/backoffice (:5174)
  bin.ts      NodeRuntime + Layer.launch   rpc/    AtomRpc client (/rpc)     api/    AtomHttpApi client
  server.ts   Layer graph; CHALK_MODE      state/  query + mutation atoms    state/  query atoms (Atom.family
              picks RPC (api) or           routes/ file-based routes                 per search term)
              HttpApi (admin) routes                                         routes/ search state in the URL
  rpc.ts      thin RPC handlers
  adminApi.ts thin HttpApi handlers
  workout/    WorkoutStore service (SQL)
  catalog/    CatalogStore: movements with aliases, user-added movements
  import/     ImportStore: saves a pasted session (text + spans) and what it derives
  strength/   StrengthStore (movements, lift sets) + rep max computation
  persistence/ SQLite (node:sqlite) + migrations
```

- **One server, two modes.** `api` serves the app over Effect RPC; `admin` serves only the admin
  `HttpApi` (with OpenAPI at `/api/admin/openapi.json`) and the backoffice. The backoffice has no
  database access and shares only `packages/contracts` and `packages/ui`.
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
Base UI · visx · Vitest + `@effect/vitest` · pnpm workspaces
