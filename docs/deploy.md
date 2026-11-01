# Deploy

Chalk runs on one lab VM, `lab-chalk-01`, reachable on the tailnet only: it has no login, and the
admin API writes. [Kamal 2](https://kamal-deploy.org) ships one image as two roles, the app and
the backoffice. Nothing is secret: Kamal pushes the image through a local registry over SSH, and
the app reads no credentials.

Request path: tailnet → Caddy (ts.net TLS) → kamal-proxy on `127.0.0.1:80` → the role whose host
matches. Both roles mount the `chalk_data` volume at `/data`.

| URL                                             | Caddy                              | Role, mode, port       |
| ----------------------------------------------- | ---------------------------------- | ---------------------- |
| `https://lab-chalk-01.llama-burbot.ts.net`      | `:443`, Host unchanged             | `web`, `api`, 4300     |
| `https://lab-chalk-01.llama-burbot.ts.net:8443` | `:8443`, Host set to `chalk-admin` | `admin`, `admin`, 4301 |

## The image

`Dockerfile`: Node runs the server's TypeScript directly, so only the two SPAs are built. The
runtime stage holds the server's production dependencies (no native modules: SQLite is
`node:sqlite`), `apps/server`, `packages/contracts` and both `dist` folders. `CHALK_HOST=0.0.0.0`
and `CHALK_DB_PATH=/data/chalk.sqlite` are baked in; the role picks `CHALK_MODE` and, for the
backoffice, `CHALK_WEB_DIST`.

- Do not switch to `pnpm deploy`: it copies workspace packages into `node_modules`, where Node
  will not strip types, and `@chalk/contracts` is TypeScript source.
- Installs run with `--ignore-scripts`: the root `prepare` installs git hooks and needs git.

Try it locally:

```bash
docker build -t chalk .
docker run --rm -p 4300:4300 -v chalk_data:/data chalk
docker run --rm -p 4301:4301 -v chalk_data:/data -e CHALK_MODE=admin \
  -e CHALK_WEB_DIST=/app/apps/backoffice/dist chalk
```

## Deploying

Kamal is pinned in `mise.toml` (Ruby + the `kamal` gem), so `mise install` brings it. It builds
from the committed `HEAD`, not the working tree.

```bash
kamal setup    # first time: boots kamal-proxy and both roles
kamal deploy   # afterwards
kamal logs     # alias: app logs -f
```

A deploy boots the new container next to the old one, waits for `/` to answer 200, then switches.
Both briefly open the same SQLite file, which WAL handles on one host. Migrations run when the
new container starts, so keep them additive.

## The VM

`lab-chalk-01` (tailscale `100.122.93.105`) is provisioned from the ansible repo
(`coldbrewwithmilk/ansible`, `playbooks/chalk.yml`, `docs/CHALK.md`): Tailscale with `tag:lab`,
Docker, and Caddy with ts.net certificates on the tailscale IPs. Caddy's `:443` forwards to
`127.0.0.1:80` unchanged; `:8443` sets `Host: chalk-admin`. kamal-proxy stays on loopback
(`proxy.run.bind_ips`) so Caddy can hold the tailscale ports.

Kamal connects as `semaphore` with the fleet nodes' ansible key, `~/.ssh/t3code_ansible`, named in
`deploy.yml` because Kamal's SSH ignores `Match user` blocks in `~/.ssh/config`. Deploying from
elsewhere needs a key `semaphore` accepts.

- Backups: the database lives in the `chalk_data` volume
  (`/var/lib/docker/volumes/chalk_data/_data/chalk.sqlite`). Copy it with
  `sqlite3 … ".backup …"`, not `cp`, while Chalk runs.
