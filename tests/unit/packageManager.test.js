import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolvePackageManager,
  SUPPORTED_NODE_RANGE,
  FORBIDDEN_LOCKFILES,
} from '../../scripts/validate-package-manager.mjs'

test('accepts the repo-standard pnpm flow on supported Node.js versions', () => {
  // Test intermediate LTS (24)
  const result24 = resolvePackageManager('pnpm', {
    nodeVersion: '24.1.0',
    hasWorkspaceFile: true,
    hasLockfile: true,
    hasPackageLock: false,
    hasYarnLock: false,
  })

  assert.deepStrictEqual(result24, {
    packageManager: 'pnpm',
    lockfile: 'pnpm-lock.yaml',
    workspaceFile: 'pnpm-workspace.yaml',
  })

  // Test case-insensitivity and whitespace trimming
  const resultTrim = resolvePackageManager('  PNPM  ', {
    nodeVersion: '24.0.0',
    hasWorkspaceFile: true,
    hasLockfile: true,
    hasPackageLock: false,
    hasYarnLock: false,
  })

  assert.equal(resultTrim.packageManager, 'pnpm')
})

test('boundary: accepts minimum and maximum supported Node.js major versions', () => {
  // Minimum supported: Node 22
  const minResult = resolvePackageManager('pnpm', {
    nodeVersion: `v${SUPPORTED_NODE_RANGE.min}.0.0`,
    hasWorkspaceFile: true,
    hasLockfile: true,
    hasPackageLock: false,
    hasYarnLock: false,
  })
  assert.equal(minResult.packageManager, 'pnpm')

  // Maximum supported: Node 26
  const maxResult = resolvePackageManager('pnpm', {
    nodeVersion: `${SUPPORTED_NODE_RANGE.max}.99.1`,
    hasWorkspaceFile: true,
    hasLockfile: true,
    hasPackageLock: false,
    hasYarnLock: false,
  })
  assert.equal(maxResult.packageManager, 'pnpm')
})

test('failure: rejects presence of package-lock.json or yarn.lock (#962)', () => {
  // Verify forbidden lockfiles list includes package-lock.json and yarn.lock
  const forbiddenFiles = FORBIDDEN_LOCKFILES.map((entry) => entry.file)
  assert.ok(forbiddenFiles.includes('package-lock.json'))
  assert.ok(forbiddenFiles.includes('yarn.lock'))

  // Rejects package-lock.json
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: true,
      }),
    /package-lock\.json|remove|reject/i
  )

  // Rejects yarn.lock
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
        hasYarnLock: true,
      }),
    /yarn\.lock|remove|reject/i
  )
})

test('failure: rejects invalid or unsupported manager input', () => {
  assert.throws(
    () =>
      resolvePackageManager('npm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /pnpm|unsupported/i
  )

  assert.throws(
    () =>
      resolvePackageManager('yarn', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /pnpm|unsupported/i
  )

  assert.throws(
    () =>
      resolvePackageManager('bun', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /pnpm|unsupported/i
  )

  assert.throws(
    () =>
      resolvePackageManager('', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /required|pnpm/i
  )
})

test('failure: rejects Node.js versions outside published support range (22-26)', () => {
  // Legacy Node 18
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '18.20.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /unsupported Node\.js/i
  )

  // Legacy Node 20
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '20.11.1',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /unsupported Node\.js/i
  )

  // Future unsupported Node 27
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '27.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /unsupported Node\.js/i
  )
})

test('failure: rejects missing pnpm configuration files', () => {
  // Missing workspace file
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: false,
        hasLockfile: true,
        hasPackageLock: false,
      }),
    /pnpm-workspace\.yaml|missing/i
  )

  // Missing lockfile
  assert.throws(
    () =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: false,
        hasPackageLock: false,
      }),
    /pnpm-lock\.yaml|missing|generate/i
  )
})
