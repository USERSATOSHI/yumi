# ============================================
# Yumi Core — Bun TS Runtime Dockerfile
# ============================================

############################
# Base
############################
FROM oven/bun:1.3-slim AS base
WORKDIR /app

############################
# Dependencies
############################
FROM base AS deps

# Native deps for any required modules
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Workspace config
COPY package.json bun.lock* ./
COPY bunfig.toml* ./
COPY tsconfig.base.json tsconfig.json ./

# Copy ONLY package manifests
COPY packages/core/package.json packages/core/
COPY packages/logger/package.json packages/logger/
COPY packages/patterns/package.json packages/patterns/
COPY packages/results/package.json packages/results/
COPY packages/stats/package.json packages/stats/
COPY packages/tools/package.json packages/tools/
COPY packages/vectordb/package.json packages/vectordb/

# Install all deps first (needed to resolve workspaces)
RUN bun install --production --frozen-lockfile || \
    bun install --production --no-save


############################
# Runtime
############################
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

# Runtime-only system deps
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 yumi && \
    useradd --system --uid 1001 --gid 1001 --no-create-home yumi

# Copy prod deps
COPY --from=deps /app/node_modules ./node_modules

# Copy ONLY needed source
COPY packages/core ./packages/core
COPY packages/logger ./packages/logger
COPY packages/patterns ./packages/patterns
COPY packages/results ./packages/results
COPY packages/stats ./packages/stats
COPY packages/tools ./packages/tools
COPY packages/vectordb ./packages/vectordb

COPY package.json ./

# App data dir
RUN mkdir -p /app/packages/core/.yumi && \
    chown -R yumi:yumi /app

USER yumi

ENV NODE_ENV=production
ENV PORT=11000

EXPOSE 11000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:11000/api/stats || exit 1

WORKDIR /app/packages/core
CMD ["bun", "run", "start"]
