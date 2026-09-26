# Docker Compose Developer Bootstrap Guide

This guide describes the unified, validated local developer workflow for bootstrapping the Stellar Developer Dashboard services end-to-end using Docker Compose.

---

## Architecture Overview

The local environment consists of three interconnected services:

| Service | Port (Default) | Healthcheck Probe | Description |
| :--- | :--- | :--- | :--- |
| **`app-dev` (Web)** | `5173` | N/A (Vite HMR) | Interactive development frontend running Vite with hot reload. |
| **`app` (Web Prod)** | `8080` | `GET /health` (nginx) | Production-ready optimized web bundle served through Nginx. |
| **`api`** | `4000` | `GET /health` | Backend Express API with authentication and prediction routes. |
| **`redis`** | `6379` | `redis-cli ping` | In-memory cache and session broker for API caching. |

---

## Prerequisites

- **Docker Desktop** or Docker Engine with Docker Compose v2.0+
- **Node.js**: `v22.x` through `v26.x` (aligned with `package.json` engines policy `>=22 <27`)
- Free host ports: `5173` (or `8080`), `4000`, `6379`

---

## Quickstart

### 1. Configure Local Environment

Copy the example environment template:

```bash
cp .env.example .env
```

Default variables in `.env`:
```dotenv
NODE_ENV=development
WEB_PORT=5173
PORT=4000
API_PORT=4000
REDIS_PORT=6379
REDIS_URL=redis://redis:6379
VITE_API_URL=http://localhost:4000
```

### 2. Run Preflight Validation

Before starting containers, execute the bootstrap preflight validator:

```bash
node scripts/docker-compose-bootstrap.mjs --check
```

The preflight check:
1. Validates `docker-compose.yml` service definitions and healthcheck configurations.
2. Resolves environment configurations and validates port boundary ranges (`1-65535`).
3. Detects port conflicts on `5173`, `4000`, and `6379` on `127.0.0.1`.

### 3. Start Development Services

Run web, API, and Redis with live reload:

```bash
docker compose --profile dev up
```

Or detached in background:

```bash
docker compose --profile dev up -d
```

### 4. Start Production Simulation Services

To validate the optimized production build and container topology:

```bash
docker compose --profile production up --build
```

---

## Failure Paths & Troubleshooting

### Port Conflicts (`EADDRINUSE`)
- **Symptom:** Preflight check or Docker reports `port is already allocated`.
- **Remedy:** Check running services on that port:
  ```bash
  # Windows PowerShell
  Get-NetTCPConnection -LocalPort 4000, 6379, 5173
  # Linux/macOS
  lsof -i :4000,6379,5173
  ```
  Alternatively, customize ports in `.env` (e.g., `API_PORT=4005`, `WEB_PORT=5174`).

### Redis Service Unhealthy
- **Symptom:** `api` container waits or exits because `redis` condition `service_healthy` is not met.
- **Remedy:** Ensure the Redis volume has appropriate permissions and inspect logs:
  ```bash
  docker compose logs redis
  ```

### API Connection Failures
- **Symptom:** Frontend cannot reach `http://localhost:4000`.
- **Remedy:** Verify API liveness probe:
  ```bash
  curl http://localhost:4000/health
  ```
  If running inside Docker network, verify `VITE_API_URL` points to `http://localhost:4000` (from browser context).

---

## Security Notes

1. **Redis Authentication:** The default local setup binds Redis to `127.0.0.1:6379` without a password for development convenience. In staging and production environments, configure `requirepass` and supply credentials via environment secrets.
2. **Container Privileges:** Services execute in non-root or unprivileged containers in accordance with CIS Docker benchmarks.
