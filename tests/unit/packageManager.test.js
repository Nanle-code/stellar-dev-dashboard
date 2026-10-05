import { describe, expect, it } from 'vitest'

import {
  resolvePackageManager,
  SUPPORTED_NODE_RANGE,
  FORBIDDEN_LOCKFILES,
} from '../../scripts/validate-package-manager.mjs'

describe('packageManager validator', () => {
  it('accepts the repo-standard pnpm flow on supported Node.js versions', () => {
    // Test intermediate LTS (24)
    const result24 = resolvePackageManager('pnpm', {
      nodeVersion: '24.1.0',
      hasWorkspaceFile: true,
      hasLockfile: true,
      hasPackageLock: false,
      hasYarnLock: false,
    })

    expect(result24).toEqual({
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

    expect(resultTrim.packageManager).toBe('pnpm')
  })

  it('boundary: accepts minimum and maximum supported Node.js major versions', () => {
    // Minimum supported: Node 22
    const minResult = resolvePackageManager('pnpm', {
      nodeVersion: `v${SUPPORTED_NODE_RANGE.min}.0.0`,
      hasWorkspaceFile: true,
      hasLockfile: true,
      hasPackageLock: false,
      hasYarnLock: false,
    })
    expect(minResult.packageManager).toBe('pnpm')

    // Maximum supported: Node 26
    const maxResult = resolvePackageManager('pnpm', {
      nodeVersion: `${SUPPORTED_NODE_RANGE.max}.99.1`,
      hasWorkspaceFile: true,
      hasLockfile: true,
      hasPackageLock: false,
      hasYarnLock: false,
    })
    expect(maxResult.packageManager).toBe('pnpm')
  })

  it('failure: rejects presence of package-lock.json or yarn.lock (#962)', () => {
    // Verify forbidden lockfiles list includes package-lock.json and yarn.lock
    const forbiddenFiles = FORBIDDEN_LOCKFILES.map((entry) => entry.file)
    expect(forbiddenFiles).toContain('package-lock.json')
    expect(forbiddenFiles).toContain('yarn.lock')

    // Rejects package-lock.json
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: true,
      })
    ).toThrow(/package-lock\.json|remove|reject/i)

    // Rejects yarn.lock
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
        hasYarnLock: true,
      })
    ).toThrow(/yarn\.lock|remove|reject/i)
  })

  it('failure: rejects invalid or unsupported manager input', () => {
    expect(() =>
      resolvePackageManager('npm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/pnpm|unsupported/i)

    expect(() =>
      resolvePackageManager('yarn', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/pnpm|unsupported/i)

    expect(() =>
      resolvePackageManager('bun', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/pnpm|unsupported/i)

    expect(() =>
      resolvePackageManager('', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/required|pnpm/i)
  })

  it('failure: rejects Node.js versions outside published support range (22-26)', () => {
    // Legacy Node 18
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '18.20.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/unsupported Node\.js/i)

    // Legacy Node 20
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '20.11.1',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/unsupported Node\.js/i)

    // Future unsupported Node 27
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '27.0.0',
        hasWorkspaceFile: true,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/unsupported Node\.js/i)
  })

  it('failure: rejects missing pnpm configuration files', () => {
    // Missing workspace file
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: false,
        hasLockfile: true,
        hasPackageLock: false,
      })
    ).toThrow(/pnpm-workspace\.yaml|missing/i)

    // Missing lockfile
    expect(() =>
      resolvePackageManager('pnpm', {
        nodeVersion: '24.0.0',
        hasWorkspaceFile: true,
        hasLockfile: false,
        hasPackageLock: false,
      })
    ).toThrow(/pnpm-lock\.yaml|missing|generate/i)
  })
})
