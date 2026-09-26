import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PORTS,
  SUPPORTED_PROFILES,
  validatePort,
  isPortAvailable,
  resolveBootstrapEnv,
  validateComposeFile,
  generateBootstrapCommand,
  runPreflightChecks,
} from '../../scripts/docker-compose-bootstrap.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

test('validatePort accepts valid ports and throws on invalid ports', () => {
  // Primary flow
  assert.equal(validatePort(5173), 5173);
  assert.equal(validatePort('4000'), 4000);
  assert.equal(validatePort(6379), 6379);

  // Boundary cases
  assert.equal(validatePort(1), 1);
  assert.equal(validatePort(65535), 65535);

  // Failure cases
  assert.throws(() => validatePort(0), RangeError);
  assert.throws(() => validatePort(65536), RangeError);
  assert.throws(() => validatePort(-10), RangeError);
  assert.throws(() => validatePort('invalid'), RangeError);
});

test('isPortAvailable detects free ports and bound ports correctly', async () => {
  // Primary flow: bind a temporary server on an ephemeral port
  const tempServer = net.createServer();
  await new Promise((resolve) => tempServer.listen(0, '127.0.0.1', resolve));
  const boundPort = tempServer.address().port;

  // Boundary / Failure case: port is occupied
  const occupied = await isPortAvailable(boundPort);
  assert.equal(occupied, false);

  // Close server and verify it becomes free
  await new Promise((resolve) => tempServer.close(resolve));
  const free = await isPortAvailable(boundPort);
  assert.equal(free, true);
});

test('resolveBootstrapEnv handles default resolution and custom overrides', () => {
  // Primary flow: default resolution
  const defaultEnv = resolveBootstrapEnv({});
  assert.equal(defaultEnv.NODE_ENV, 'development');
  assert.equal(defaultEnv.PORT, DEFAULT_PORTS.API);
  assert.equal(defaultEnv.API_PORT, DEFAULT_PORTS.API);
  assert.equal(defaultEnv.WEB_PORT, DEFAULT_PORTS.WEB_DEV);
  assert.equal(defaultEnv.REDIS_PORT, DEFAULT_PORTS.REDIS);
  assert.equal(defaultEnv.REDIS_URL, 'redis://redis:6379');
  assert.equal(defaultEnv.VITE_API_URL, 'http://localhost:4000');

  // Boundary case: environment overrides
  const custom = resolveBootstrapEnv(
    {},
    {
      NODE_ENV: 'staging',
      API_PORT: 4005,
      WEB_PORT: 8081,
      REDIS_PORT: 6380,
    }
  );
  assert.equal(custom.NODE_ENV, 'staging');
  assert.equal(custom.API_PORT, 4005);
  assert.equal(custom.WEB_PORT, 8081);
  assert.equal(custom.REDIS_PORT, 6380);
  assert.equal(custom.VITE_API_URL, 'http://localhost:4005');

  // Failure case: invalid port override throws RangeError
  assert.throws(
    () => resolveBootstrapEnv({}, { API_PORT: 999999 }),
    RangeError
  );
});

test('validateComposeFile validates required service declarations and healthchecks', () => {
  // Primary flow: valid compose content
  const validContent = `
services:
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
  api:
    build: .
`;
  assert.equal(validateComposeFile(validContent), true);

  // Failure case: missing required service (redis)
  const missingRedis = `
services:
  api:
    build: .
`;
  assert.throws(() => validateComposeFile(missingRedis), /missing required service definitions: redis/);

  // Failure case: missing healthcheck on redis
  const missingHealth = `
services:
  redis:
    image: redis:7-alpine
  api:
    build: .
`;
  assert.throws(() => validateComposeFile(missingHealth), /requires a valid healthcheck definition/);

  // Failure case: invalid type
  assert.throws(() => validateComposeFile(null), TypeError);
});

test('generateBootstrapCommand builds correct command string for dev and production', () => {
  // Primary flow: dev profile
  const devCmd = generateBootstrapCommand({ profile: 'dev', detach: false });
  assert.equal(devCmd, 'docker compose --profile dev up');

  // Boundary case: production profile with build and detach
  const prodCmd = generateBootstrapCommand({ profile: 'production', build: true, detach: true });
  assert.equal(prodCmd, 'docker compose --profile production up --build -d');

  // Failure case: unsupported profile
  assert.throws(() => generateBootstrapCommand({ profile: 'unknown' }), RangeError);
});

test('runPreflightChecks validates local repository compose configuration', async () => {
  const result = await runPreflightChecks({
    root: REPO_ROOT,
    composeFile: 'docker-compose.yml',
    checkPorts: false,
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});
