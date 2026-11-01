# syntax=docker/dockerfile:1
# One process on :4300: the app RPC, the admin API and the built SPA.
# Node runs the server's TypeScript directly; only the SPA is built.
ARG NODE_VERSION=24.22.1

FROM node:${NODE_VERSION}-slim AS base
RUN npm install --global pnpm@12.16.1 && npm cache clean --force
WORKDIR /app

FROM base AS build
COPY . .
# --ignore-scripts: the root `prepare` installs git hooks, which need git and mean nothing here.
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm build

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
COPY apps/server/package.json apps/server/
COPY packages/contracts/package.json packages/contracts/
# Server deps only. Workspace packages stay symlinks: Node will not strip types under node_modules.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter "@chalk/server..."

FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    CHALK_HOST=0.0.0.0 \
    CHALK_DB_PATH=/data/chalk.sqlite \
    CHALK_WEB_DIST=/app/apps/web/dist
WORKDIR /app
COPY --from=deps /app ./
COPY packages/contracts packages/contracts
COPY apps/server apps/server
COPY --from=build /app/apps/web/dist apps/web/dist
# A named volume mounted on /data inherits this ownership.
RUN mkdir /data && chown node:node /data
USER node
WORKDIR /app/apps/server
EXPOSE 4300
CMD ["node", "src/bin.ts"]
