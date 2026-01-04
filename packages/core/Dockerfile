# ============================================
# Yumi Core - Dockerfile for Komodo Build
# ============================================
# Build from yumi root: docker build -f packages/core/Dockerfile -t yumi-core .

FROM oven/bun:1.3 AS base
WORKDIR /app

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps

# Copy workspace configuration
COPY package.json bun.lock* ./
COPY bunfig.toml* ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all workspace packages package.json files
COPY packages/core/package.json ./packages/core/
COPY packages/logger/package.json ./packages/logger/
COPY packages/patterns/package.json ./packages/patterns/
COPY packages/results/package.json ./packages/results/
COPY packages/stats/package.json ./packages/stats/
COPY packages/tools/package.json ./packages/tools/
COPY packages/vectordb/package.json ./packages/vectordb/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# ============================================
# Build stage
# ============================================
FROM deps AS builder

# Copy all source files for required packages
COPY packages/core ./packages/core
COPY packages/logger ./packages/logger
COPY packages/patterns ./packages/patterns
COPY packages/results ./packages/results
COPY packages/stats ./packages/stats
COPY packages/tools ./packages/tools
COPY packages/vectordb ./packages/vectordb

# ============================================
# Production stage
# ============================================
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

# Install curl for healthcheck and create non-root user
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 yumi && \
    useradd --system --uid 1001 --gid 1001 --no-create-home yumi

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/tsconfig.json ./

# Create data directory for SQLite and audio files
RUN mkdir -p /app/packages/core/.yumi && \
    chown -R yumi:yumi /app

USER yumi

# Expose the default port
EXPOSE 11000

# Environment variables
ENV NODE_ENV=production
ENV PORT=11000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:11000/api/stats || exit 1

# Start the core server
WORKDIR /app/packages/core
CMD ["bun", "run", "start"]
