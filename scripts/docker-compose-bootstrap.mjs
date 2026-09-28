#!/usr/bin/env node
/**
 * Developer Bootstrap & Validation Utility for Docker Compose.
 *
 * Provides a single validated path to run web, API, and dependent services (Redis)
 * locally via Docker Compose, including prerequisite checks, port conflict detection,
 * environment generation, and health validation.
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export const DEFAULT_PORTS = {
  WEB_DEV: 5173,
  WEB_PROD: 8080,
  API: 4000,
  REDIS: 6379,
};

export const SUPPORTED_PROFILES = ['dev', 'production'];

/**
 * Validate port number range.
 */
export function validatePort(port, name = 'Port') {
  const num = Number(port);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new RangeError(`${name} must be an integer between 1 and 65535. Received: "${port}"`);
  }
  return num;
}

/**
 * Check if a TCP port is currently free on localhost.
 */
export function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Any other bind error also indicates unavailable
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Parse environment variables and ensure defaults.
 */
export function resolveBootstrapEnv(env = process.env, overrides = {}) {
  const resolved = {
    NODE_ENV: overrides.NODE_ENV || env.NODE_ENV || 'development',
    PORT: validatePort(overrides.PORT || env.PORT || DEFAULT_PORTS.API, 'PORT'),
    API_PORT: validatePort(overrides.API_PORT || env.API_PORT || DEFAULT_PORTS.API, 'API_PORT'),
    WEB_PORT: validatePort(
      overrides.WEB_PORT || env.WEB_PORT || DEFAULT_PORTS.WEB_DEV,
      'WEB_PORT'
    ),
    REDIS_PORT: validatePort(
      overrides.REDIS_PORT || env.REDIS_PORT || DEFAULT_PORTS.REDIS,
      'REDIS_PORT'
    ),
    REDIS_URL: overrides.REDIS_URL || env.REDIS_URL || 'redis://redis:6379',
    VITE_API_URL:
      overrides.VITE_API_URL ||
      env.VITE_API_URL ||
      `http://localhost:${overrides.API_PORT || env.API_PORT || DEFAULT_PORTS.API}`,
  };

  return resolved;
}

/**
 * Validate Docker Compose file content structure.
 */
export function validateComposeFile(composeContent) {
  if (!composeContent || typeof composeContent !== 'string') {
    throw new TypeError('Compose content must be a non-empty string.');
  }

  const requiredServices = ['redis', 'api'];
  const missing = requiredServices.filter((svc) => !composeContent.includes(`${svc}:`));
  if (missing.length > 0) {
    throw new Error(
      `docker-compose configuration is missing required service definitions: ${missing.join(', ')}`
    );
  }

  // Ensure healthcheck is defined for dependent services
  if (!composeContent.includes('redis-cli') || !composeContent.includes('healthcheck:')) {
    throw new Error('Redis service requires a valid healthcheck definition for safe API startup.');
  }

  return true;
}

/**
 * Generate bootstrap CLI invocation command based on profile.
 */
export function generateBootstrapCommand(options = {}) {
  const profile = options.profile || 'dev';
  if (!SUPPORTED_PROFILES.includes(profile)) {
    throw new RangeError(
      `Unsupported profile: "${profile}". Supported profiles are: ${SUPPORTED_PROFILES.join(', ')}`
    );
  }

  const baseArgs = ['compose'];
  if (options.file) {
    baseArgs.push('-f', options.file);
  }

  if (profile === 'dev') {
    baseArgs.push('--profile', 'dev', 'up');
  } else {
    baseArgs.push('--profile', 'production', 'up');
  }

  if (options.build) {
    baseArgs.push('--build');
  }

  if (options.detach) {
    baseArgs.push('-d');
  }

  return `docker ${baseArgs.join(' ')}`;
}

/**
 * Run diagnostic checks on local environment.
 */
export async function runPreflightChecks(options = {}) {
  const root = options.root || REPO_ROOT;
  const composePath = path.join(root, options.composeFile || 'docker-compose.yml');

  const diagnostics = {
    valid: true,
    warnings: [],
    errors: [],
    portsChecked: {},
  };

  // 1. Compose file verification
  if (!fs.existsSync(composePath)) {
    diagnostics.errors.push(`docker-compose file not found at: ${composePath}`);
    diagnostics.valid = false;
    return diagnostics;
  }

  try {
    const content = fs.readFileSync(composePath, 'utf8');
    validateComposeFile(content);
  } catch (err) {
    diagnostics.errors.push(`Compose validation failed: ${err.message}`);
    diagnostics.valid = false;
  }

  // 2. Environment resolution
  let env;
  try {
    env = resolveBootstrapEnv(process.env, options.envOverrides);
  } catch (err) {
    diagnostics.errors.push(`Environment resolution error: ${err.message}`);
    diagnostics.valid = false;
    return diagnostics;
  }

  // 3. Port conflict verification (if requested)
  if (options.checkPorts !== false) {
    const portsToCheck = [
      { name: 'API', port: env.API_PORT },
      { name: 'Redis', port: env.REDIS_PORT },
      { name: 'Web', port: env.WEB_PORT },
    ];

    for (const { name, port } of portsToCheck) {
      const free = await isPortAvailable(port);
      diagnostics.portsChecked[port] = { name, free };
      if (!free) {
        diagnostics.warnings.push(
          `Port ${port} (${name}) is currently occupied by another process. Ensure it is released or remapped before launching.`
        );
      }
    }
  }

  return diagnostics;
}

// CLI runner when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isCheckOnly = args.includes('--check');
  const profileIndex = args.indexOf('--profile');
  const profile = profileIndex !== -1 ? args[profileIndex + 1] : 'dev';

  console.log('🚀 Running Docker Compose Developer Bootstrap Preflight...');
  runPreflightChecks({ profile })
    .then((result) => {
      if (!result.valid) {
        console.error('❌ Preflight checks failed:');
        result.errors.forEach((err) => console.error(`  - ${err}`));
        process.exit(1);
      }

      if (result.warnings.length > 0) {
        console.warn('⚠️  Preflight warnings:');
        result.warnings.forEach((warn) => console.warn(`  - ${warn}`));
      }

      const cmd = generateBootstrapCommand({ profile, detach: !isDryRun });
      console.log(`\n✅ Ready to launch services.`);
      console.log(`Command: ${cmd}`);

      if (isCheckOnly || isDryRun) {
        console.log('🏁 Dry run / check completed successfully.');
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Unexpected error during preflight:', err);
      process.exit(1);
    });
}
