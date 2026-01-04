# ============================================
# Yumi Core - Dockerfile for Komodo Build
# ============================================

FROM oven/bun:1.3 AS base
WORKDIR /app

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps

# Copy workspace configuration
COPY package.json bun.lock* bunfig.toml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all workspace packages (needed for workspace:* resolution)
COPY packages/core/package.json ./packages/core/
COPY packages/logger/package.json ./packages/logger/
COPY packages/patterns/package.json ./packages/patterns/
COPY packages/results/package.json ./packages/results/
COPY packages/stats/package.json ./packages/stats/
COPY packages/tools/package.json ./packages/tools/
COPY packages/vectordb/package.json ./packages/vectordb/

# Install dependencies
RUN bun install --frozen-lockfile

# ============================================
# Build stage
# ============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/

# Copy all source files
COPY . .

# Type check (optional, can be removed for faster builds)
# RUN cd packages/core && bun run typecheck

# ============================================
# Production stage
# ============================================
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 yumi && \
    adduser --system --uid 1001 --gid 1001 yumi

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
