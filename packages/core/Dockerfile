# ============================================
# Yumi Core — Canonical Bun Production Image
# ============================================

############################
# Builder
############################
FROM oven/bun:1.3-slim AS builder
WORKDIR /app

# Native deps for builds
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Workspace config
COPY package.json bun.lock* ./
COPY bunfig.toml* ./
COPY tsconfig.base.json tsconfig.json ./

# Workspace manifests (needed for lockfile resolution)
COPY packages/core/package.json packages/core/
COPY packages/logger/package.json packages/logger/
COPY packages/patterns/package.json packages/patterns/
COPY packages/results/package.json packages/results/
COPY packages/stats/package.json packages/stats/
COPY packages/tools/package.json packages/tools/
COPY packages/vectordb/package.json packages/vectordb/

# Full install — DO NOT fight Bun
RUN bun install

# Copy sources
COPY packages ./packages

# Build ONLY core (adjust if name differs)
RUN bun run --cwd packages/core build


############################
# Runtime
############################
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

# Runtime-only deps
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 yumi && \
    useradd --system --uid 1001 --gid 1001 --no-create-home yumi

# Copy ONLY runtime artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/package.json ./

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
