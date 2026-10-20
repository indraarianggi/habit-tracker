# syntax=docker/dockerfile:1
# Pola B (docs/deployment-home-server.md §14.1): built in GitHub Actions for
# linux/amd64, pushed to GHCR, the server only ever pulls and runs it.

FROM node:22.20.0-slim AS build
WORKDIR /app
# Installed directly (not via corepack) to pin the exact version without
# corepack's own latest-version network lookup, which fails signature
# verification against npm's rotated signing keys on the corepack build
# bundled with this Node image.
RUN npm install -g pnpm@11.20.0 \
  # better-sqlite3 needs a toolchain if no prebuilt binary matches this base image.
  && apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Baked into the client bundle (shown on /privacy) — real deploys override this
# with the actual monitored address via --build-arg.
ARG VITE_PRIVACY_CONTACT_EMAIL=build@invalid.test
ENV VITE_PRIVACY_CONTACT_EMAIL=$VITE_PRIVACY_CONTACT_EMAIL
# `pnpm run build` prerenders "/" by booting the app in-process and crawling
# it, which imports src/server/auth.ts — these never need to be real (the
# running container reads its own values from the server's .env at startup,
# per docs/deployment-home-server.md §14.3), just present and well-formed so
# that crawl doesn't crash with a missing-env error and silently skip the page.
ENV BETTER_AUTH_URL=http://127.0.0.1:3000 \
  BETTER_AUTH_SECRET=docker-build-placeholder-not-a-real-secret-32c \
  GOOGLE_CLIENT_ID=docker-build-placeholder \
  GOOGLE_CLIENT_SECRET=docker-build-placeholder \
  DATABASE_PATH=.data/build.sqlite
RUN pnpm run build
# Nitro's node-server output under .output/ is self-contained (bundled server
# code plus any native addons it can't inline, e.g. better-sqlite3's compiled
# binary) — no separate node_modules copy is needed in the runtime stage.

FROM node:22.20.0-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 habit-tracker \
  && useradd --system --uid 1001 --gid habit-tracker habit-tracker \
  && mkdir -p /app/.data && chown -R habit-tracker:habit-tracker /app
COPY --from=build --chown=habit-tracker:habit-tracker /app/.output ./.output
USER habit-tracker
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
