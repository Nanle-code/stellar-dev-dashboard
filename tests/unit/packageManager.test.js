import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePackageManager } from '../../scripts/validate-package-manager.mjs'

test('accepts the repo-standard pnpm flow', () => {
  const result = resolvePackageManager('pnpm', {
    nodeVersion: '20.11.1',
    hasWorkspaceFile: true,
    hasLockfile: true,
  })

  assert.deepStrictEqual(result, {
    packageManager: 'pnpm',
    lockfile: 'pnpm-lock.yaml',
    workspaceFile: 'pnpm-workspace.yaml',
  })
})

test('rejects invalid or unsupported manager input', () => {
  assert.throws(() => resolvePackageManager('yarn', {
    nodeVersion: '20.11.1',
    hasWorkspaceFile: true,
    hasLockfile: true,
  }), /pnpm|unsupported/i)

  assert.throws(() => resolvePackageManager('', {
    nodeVersion: '20.11.1',
    hasWorkspaceFile: true,
    hasLockfile: true,
  }), /required|pnpm/i)
})

test('fails when the environment is unsupported or config is incomplete', () => {
  assert.throws(() => resolvePackageManager('pnpm', {
    nodeVersion: '16.20.0',
    hasWorkspaceFile: true,
    hasLockfile: true,
  }), /node\.js|18|unsupported/i)

  assert.throws(() => resolvePackageManager('pnpm', {
    nodeVersion: '20.11.1',
    hasWorkspaceFile: false,
    hasLockfile: true,
  }), /pnpm-workspace\.yaml|missing/i)
})
