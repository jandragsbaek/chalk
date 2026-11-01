# Deploy

Chalk runs on one lab VM, `lab-chalk-01`, reachable on the tailnet only: it has no login, and the
admin API writes. [Kamal 2](https://kamal-deploy.org) ships one image as one role, `web`: a
single process serves the app RPC, the admin API and the SPA. Kamal pushes the image through a
local registry over SSH, so it holds no registry credentials. The app's one secret, the coach's
OpenRouter key, lives on the VM: see [Secrets](#secrets).

Request path: tailnet → Caddy (ts.net TLS, `:443`) → kamal-proxy on `127.0.0.1:80` → the `web`
container on 4300, which mounts the `chalk_data` volume at `/data`. Everything, the import desk
included, is at `https://lab-chalk-01.llama-burbot.ts.net`.

## The image

`Dockerfile`: Node runs the server's TypeScript directly, so only the SPA is built. The runtime
stage holds the server's production dependencies (no native modules: SQLite is `node:sqlite`),
`apps/server`, `packages/contracts` and `apps/web/dist`. `CHALK_HOST=0.0.0.0`,
`CHALK_DB_PATH=/data/chalk.sqlite` and `CHALK_WEB_DIST` are baked in.

- Do not switch to `pnpm deploy`: it copies workspace packages into `node_modules`, where Node
  will not strip types, and `@chalk/contracts` is TypeScript source.
- Installs run with `--ignore-scripts`: the root `prepare` installs git hooks and needs git.

Try it locally:

```bash
docker build -t chalk .
docker run --rm -p 4300:4300 -v chalk_data:/data chalk
```

Without a key the coach page says what to set; everything else works. To try the coach, add
`-e OPENROUTER_API_KEY=…` or `--env-file` with a file holding `OPENROUTER_API_KEY=…`.

## Deploying

Kamal is pinned in `mise.toml` (Ruby + the `kamal` gem), so `mise install` brings it. It builds
from the committed `HEAD`, not the working tree.

```bash
kamal setup    # first time: boots kamal-proxy and the app
kamal deploy   # afterwards
kamal logs     # alias: app logs -f
```

A deploy boots the new container next to the old one, waits for `/` to answer 200, then switches.
Both briefly open the same SQLite file, which WAL handles on one host. Migrations run when the
new container starts, so keep them additive.

## Secrets

The one deploy secret is `OPENROUTER_API_KEY`, which turns the coach on. It is managed in the ansible
repo (`coldbrewwithmilk/ansible`: SOPS host_vars for `lab-chalk-01`, see `docs/CHALK.md`), which
renders it to `/etc/chalk/chalk.env` (owner `semaphore`, `0600`). `deploy.yml` hands that file to
the `web` container with `options: env-file`, so Docker reads it on the VM.

- It is never in this repo, and never in Kamal's `.kamal/secrets`.
- The file must exist before `kamal deploy` (or `kamal setup`), or `docker run` fails.
- Docker reads the file only when it creates the container. To rotate: update it through ansible,
  then `kamal app boot` or redeploy.
- The value shows in `docker inspect` on the VM, like any container env.

The bookingboard token and the Garmin tokens are not deploy secrets: the athlete pastes them in
Settings, Connections and they live in the database (see [domain](domain.md#bookingboard-built)
and [Garmin](domain.md#garmin-connect-built)), so a copy of the volume holds them. The Garmin
refresh token is a standing login to the athlete's Garmin account.

## The VM

`lab-chalk-01` (tailscale `100.122.93.105`) is provisioned from the ansible repo
(`coldbrewwithmilk/ansible`, `playbooks/chalk.yml`, `docs/CHALK.md`): Tailscale with `tag:lab`,
Docker, and Caddy with ts.net certificates on the tailscale IPs. Caddy's `:443` forwards to
`127.0.0.1:80` unchanged. kamal-proxy stays on loopback
(`proxy.run.bind_ips`) so Caddy can hold the tailscale ports.

Kamal connects as `semaphore` with the fleet nodes' ansible key, `~/.ssh/t3code_ansible`, named in
`deploy.yml` because Kamal's SSH ignores `Match user` blocks in `~/.ssh/config`. Deploying from
elsewhere needs a key `semaphore` accepts.

- Backups: the database lives in the `chalk_data` volume
  (`/var/lib/docker/volumes/chalk_data/_data/chalk.sqlite`). Copy it with
  `sqlite3 … ".backup …"`, not `cp`, while Chalk runs.
