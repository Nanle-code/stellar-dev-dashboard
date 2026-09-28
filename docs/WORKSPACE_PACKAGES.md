# Workspace Packages: web, api and ml

This repository is a single pnpm workspace with three packages. The split keeps
browser dependencies and Node-only dependencies apart so a frontend install and
build never has to download or compile native server modules
([issue #963](https://github.com/Nanle-code/stellar-dev-dashboard/issues/963)).

| Package | Location | Role | Runtime |
|---------|----------|------|---------|
| `stellar-dev-dashboard` (web) | `/` | React + Vite SPA and shared browser libraries in `src/` | Browser only |
| `api` | `/api` | Express HTTP API, WebSocket server, route middleware | Node only |
| `ml` | `/src/ml` | TensorFlow.js training scripts and model servers | Node only |

## Dependency ownership

| Dependency | Owner | Notes |
|------------|-------|-------|
| `express`, `ws` | `api` | HTTP + WebSocket transport |
| `ioredis` | `api` (optional) | Distributed rate-limit / idempotency store |
| `@tensorflow/tfjs-node` | `ml` | Native TensorFlow binary, never installed by web |
| `@tensorflow/tfjs` | `stellar-dev-dashboard` + `ml` | Browser backend used by the SPA, Node backend used by ML scripts |

The web package (`stellar-dev-dashboard`) must not declare any of `express`,
`ws`, `@tensorflow/tfjs-node` or `ioredis` in **any** dependency section. This is
enforced by `pnpm run check:workspace-boundaries` and by
`tests/unit/workspace-boundaries.test.ts`.

## pnpm filter commands

Run a script in a single package with `--filter`. The **web** package is the
workspace *root*, so filtering it also requires `--include-workspace-root`:

```bash
# web — dev server, production build, type-check and unit tests
pnpm --filter stellar-dev-dashboard --include-workspace-root run dev
pnpm --filter stellar-dev-dashboard --include-workspace-root run build
pnpm --filter stellar-dev-dashboard --include-workspace-root run type-check
pnpm --filter stellar-dev-dashboard --include-workspace-root run test

# api — start the Node API and run its tests
pnpm --filter api run start
pnpm --filter api run dev
pnpm --filter api run test

# ml — training jobs and model servers
pnpm --filter ml run train:liquidity
pnpm --filter ml run train:phishing
pnpm --filter ml run server:liquidity
pnpm --filter ml run build:server
```

For convenience the root package exposes the same entry points as
`api:start`, `api:test` and the `ml:*` scripts, each of which delegates to the
matching `--filter` command.

## Browser-only install

If you only work on the frontend, install just the web package's tree — this
skips `express`, `ws`, `ioredis` and the `@tensorflow/tfjs-node` native build:

```bash
corepack enable
pnpm install --filter stellar-dev-dashboard --include-workspace-root
pnpm --filter stellar-dev-dashboard --include-workspace-root run dev
```

A full `pnpm install` still installs every workspace member and is what CI uses.

## Compatibility

- Node.js `>=22 <27` and pnpm `>=9.0.0` (see each package's `engines` field).
- The `api` package reuses browser-safe modules from `src/` (for example
  `src/lib/behaviorPrediction`); those modules must stay free of Node-only
  imports.
- `ml` scripts require a downloadable TensorFlow native binary. On constrained
  networks prefer `pnpm install --filter stellar-dev-dashboard --include-workspace-root`
  for frontend work.

## Security

- Keeping native server modules out of the web dependency tree removes them from
  the browser bundle audit surface: a bundler misconfiguration can no longer pull
  `@tensorflow/tfjs-node` (or `express`) into client code.
- `--prod` is used in the Docker API stage so dev tooling is not shipped.
- The boundary check runs in CI, so a regression that re-adds a server-only
  dependency to the web package fails the pull request instead of shipping.

## Migration notes

- Server-only modules moved out of the browser `src/lib` tree:
  `src/lib/liquidityModel.ts` and `src/lib/liquidityEngine.ts` now live under
  `src/ml/`. Import them from `src/ml/liquidityModel` / `src/ml/liquidityEngine`.
- API tests moved from `tests/api/` into `api/tests/` and run with
  `pnpm --filter api run test`. The live canary probe integration test moved to
  `api/tests/canaryDeploymentProbes.test.js`.
- If you previously ran `node src/ml/<script>` or `node api/server.js` directly,
  use the `pnpm --filter` commands above so dependencies resolve from the correct
  package.
- `pnpm-workspace.yaml` now lists `api` and `src/ml` as workspace members; run
  `pnpm install` after pulling to refresh the lockfile and package links.
