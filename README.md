<img src="assets/icon.svg" width="64" height="64" alt="">

# Chalk

Track your CrossFit workouts and strength numbers, and (soon) get coached on them.

Today: log workouts with a free-form score, and log strength sets (reps × kg) against a movement
catalog, with 1/2/3/5/10RM derived per movement and an estimated 1RM chart over time. The
Import page brings in past sessions from pasted text: Chalk highlights movements and numbers, you fix
the highlights, and parts, blocks, movements and lift sets are saved from them. A strength
movement takes a result (fixed load, ramp by a step, or set by set), so each session has a total
lifted in kg. Each movement is graded on GymDanmark's FF level sheet (Fundamentals to RX, plus
Chalk's own Elite): the importer records how it was done, and `/levels` draws a ruler per
movement family with where the workouts put you and what you can do. `/benchmarks` holds 280
named workouts (the Girls, CrossFit's Hero workouts, a few classics) with their boards in kg, how
their Rx grades on the level sheet, and your attempts; logging one, or importing a session that
names one, links it. `/plan` takes the workout the box posts in the morning: mark it up
like an import, plan each movement's scaling (load, or reps by variation, graded on the level
sheet), and log it from Today after the session. Where it is going:

- [docs/domain.md](docs/domain.md): movements, scaling, workouts composed of movements, rep
  maxes, the weekly volume grid.
- [docs/roadmap.md](docs/roadmap.md): phases, in order.
- [docs/coaching.md](docs/coaching.md): the coach on `/coach` (built: conversations whose
  every read of your log is a receipt) and what comes next: check-ins that fill the debrief, and
  an MCP server over the same tools.

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
```

Production: one process serves the RPC, the admin API and the built web app from one origin.

```bash
pnpm build
pnpm start        # http://127.0.0.1:4300
```

| Variable             | Default                       | Purpose                                                                                          |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `CHALK_HOST`         | `127.0.0.1`                   | Interface the server listens on                                                                  |
| `CHALK_PORT`         | `4300`                        | Server port (the dev proxy reads it)                                                             |
| `CHALK_DB_PATH`      | `data/chalk.sqlite`           | SQLite database file                                                                             |
| `CHALK_WEB_DIST`     | unset                         | Built SPA to serve; `pnpm start` sets it                                                         |
| `OPENROUTER_API_KEY` | unset                         | Turns the coach on; never sent to the browser                                                    |
| `CHALK_COACH_MODEL`  | `anthropic/claude-sonnet-5.5` | Coach's default model (OpenRouter slug); the composer offers [the list](docs/coaching.md#models) |

Deploying: [docs/deploy.md](docs/deploy.md) (Docker image, Kamal, a tailnet-only lab VM).

Other commands: `pnpm openapi` (regenerate `packages/contracts/openapi/admin.json`; a test fails when it is stale), `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm fmt`, and `pnpm check` (everything CI runs; [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on the lab's self-hosted runners, fork PRs on GitHub-hosted). The toolchain is [Vite+](https://viteplus.dev) (`vp`): one root `vite.config.ts` configures tests, Oxlint (with the local `oxlint-plugin-chalk/` rules and `@shadcn/lint`), Oxfmt, and the pre-commit hook, which formats and lints staged files with `vp staged`. `@effect/vitest` is patched (`patches/`) to import `vite-plus/test` instead of `vitest`. The lint setup and the rules in `oxlint-plugin-chalk/` are adapted from [T3 Code](https://github.com/pingdotgg/t3code) under its MIT license (`oxlint-plugin-chalk/LICENSE`).

## How it fits together

```
packages/contracts   Effect Schema domain types, branded ids, tagged errors,
                     RpcGroup (app) + ChalkAdminApi HttpApi (admin) + checked-in OpenAPI
packages/ui          shadcn components on Base UI, theme tokens (theme.css)
        │  (both imported as TypeScript source, no build step)
        ├──────────────────────────────────┐
apps/server                            apps/web (:5173)
  bin.ts      NodeRuntime + Layer.launch   rpc/    AtomRpc client (/rpc)
  server.ts   Layer graph: RPC, admin      api/    AtomHttpApi client (/api/admin)
              HttpApi and the SPA on       state/  query + mutation atoms; both clients
              one HttpRouter                       share one reactivity key per data set
  rpc.ts      thin RPC handlers            routes/ file-based routes; desk pages
                                                   (/workouts, /import) keep search in the URL
  adminApi.ts thin HttpApi handlers
  workout/    WorkoutStore service (SQL)
  catalog/    CatalogStore: movements with aliases, user-added movements
  import/     ImportStore: saves a pasted session (text + spans) and what it derives
  strength/   StrengthStore (movements, lift sets) + rep max computation
  persistence/ SQLite (node:sqlite) + migrations
```

- **One server, one app, two transports.** The app's pages read and write over Effect RPC
  (`/rpc`); the desk pages (workout search, import) use the admin `HttpApi` (`/api/admin`, with
  OpenAPI at `/api/admin/openapi.json`). One process serves both and the SPA from one origin.
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
