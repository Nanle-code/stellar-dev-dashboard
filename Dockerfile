# ── Build stage (web) ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable

WORKDIR /app

# Copy only the workspace manifests so the web install never resolves the
# Node-only express/ws/ioredis/@tensorflow/tfjs-node dependency trees.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/package.json
COPY src/ml/package.json ./src/ml/package.json
COPY mobile/package.json ./mobile/package.json

RUN pnpm install --frozen-lockfile --filter stellar-dev-dashboard --include-workspace-root

COPY . .
RUN pnpm --filter stellar-dev-dashboard --include-workspace-root run build

# ── Production stage (static web assets) ──────────────────────────────────────
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# ── API stage ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS api

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/package.json
COPY src/ml/package.json ./src/ml/package.json
COPY mobile/package.json ./mobile/package.json

# The API reuses shared modules from src/, so it installs the web production
# deps plus the api package (express/ws) — but not the ML native toolchain.
RUN pnpm install --frozen-lockfile --prod --filter stellar-dev-dashboard --filter api --include-workspace-root

COPY api ./api
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "api/server.js"]
