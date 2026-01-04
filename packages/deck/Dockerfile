# ============================================
# Yumi Deck - Dockerfile for Frontend
# ============================================
# Build from yumi root: docker build -f packages/deck/Dockerfile -t yumi-deck .

# ============================================
# Build stage
# ============================================
FROM oven/bun:1.3 AS builder
WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock* ./
COPY bunfig.toml* ./

# Copy deck package
COPY packages/deck/package.json ./packages/deck/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy deck source files
COPY packages/deck ./packages/deck

# Build the frontend
WORKDIR /app/packages/deck
RUN bun run build

# ============================================
# Production stage - serve with nginx
# ============================================
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY packages/deck/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/packages/deck/dist /usr/share/nginx/html

# Copy public assets (VRM models, textures, etc.)
COPY --from=builder /app/packages/deck/public /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
