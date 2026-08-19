FROM node:22-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy packages (client excluded via .dockerignore)
COPY packages/engine/ packages/engine/
COPY packages/server/ packages/server/

# Install dependencies (no frozen-lockfile since client is excluded)
RUN pnpm install --no-frozen-lockfile

# Build engine first, then server
RUN pnpm --filter @pluck/engine build
RUN pnpm --filter @pluck/server build

# ── Production stage ──
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/engine/dist/ packages/engine/dist/
COPY packages/server/package.json packages/server/
COPY packages/server/dist/ packages/server/dist/

RUN pnpm install --no-frozen-lockfile --prod

EXPOSE 3334

ENV NODE_ENV=production
ENV PORT=3334

CMD ["node", "packages/server/dist/index.js"]
