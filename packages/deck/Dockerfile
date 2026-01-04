# ============================================
# Yumi Deck — Frontend Dockerfile (Optimized)
# ============================================

############################
# Build stage
############################
FROM oven/bun:1.3-slim AS builder
WORKDIR /app

# Workspace config (cache-friendly)
COPY package.json bun.lock* ./
COPY bunfig.toml* ./

# Deck package manifest
COPY packages/deck/package.json packages/deck/

# Install deps (fail if lockfile is wrong)
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

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config
COPY packages/deck/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/packages/deck/dist /usr/share/nginx/html

# OPTIONAL:
# Only keep this if your build does NOT copy public/ into dist
# COPY --from=builder /app/packages/deck/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
