# ============================================
# Yumi Deck — Frontend Dockerfile (Simple)
# ============================================

############################
# Build stage
############################
FROM oven/bun:1.3-slim AS builder
WORKDIR /app

# Workspace config
COPY package.json bun.lock* ./
COPY bunfig.toml* ./

# Deck package manifest
COPY packages/deck/package.json packages/deck/

# Install dependencies (reproducible)
RUN bun install

# Copy deck source
COPY packages/deck packages/deck

# Build frontend
WORKDIR /app/packages/deck
RUN bun run build

############################
# Runtime stage (nginx)
############################
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/packages/deck/dist /usr/share/nginx/html

# OPTIONAL:
# Only use this if your build does NOT include public assets in dist
# COPY --from=builder /app/packages/deck/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
