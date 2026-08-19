FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/engine/ packages/engine/
COPY packages/server/ packages/server/

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @pluck/engine build
RUN pnpm --filter @pluck/server build

# ── Production ──
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY --from=builder /app/packages/engine/dist/ packages/engine/dist/
COPY --from=builder /app/packages/server/dist/ packages/server/dist/

RUN pnpm install --no-frozen-lockfile --prod

ENV NODE_ENV=production

CMD ["node", "packages/server/dist/index.js"]
