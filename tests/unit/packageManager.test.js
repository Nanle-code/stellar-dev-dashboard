import { expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { findForeignLockfiles, resolvePackageManager } from '../../scripts/validate-package-manager.mjs'

const supported = { nodeVersion: '24.11.1', hasWorkspaceFile: true, hasLockfile: true }

it('accepts the repo-standard pnpm flow', () => {
  const result = resolvePackageManager('pnpm', supported)

  expect(result).toEqual({
    packageManager: 'pnpm',
    lockfile: 'pnpm-lock.yaml',
    workspaceFile: 'pnpm-workspace.yaml',
  })
})

it('rejects invalid or unsupported manager input', () => {
  expect(() => resolvePackageManager('yarn', {
    nodeVersion: '24.11.1',
    hasWorkspaceFile: true,
    hasLockfile: true,
  })).toThrow(/pnpm|unsupported/i)

  expect(() => resolvePackageManager('', {
    nodeVersion: '24.11.1',
    hasWorkspaceFile: true,
    hasLockfile: true,
  })).toThrow(/required|pnpm/i)
})

it('fails when the environment is unsupported or config is incomplete', () => {
  expect(() => resolvePackageManager('pnpm', {
    ...supported,
    nodeVersion: '16.20.0',
  })).toThrow(/node\.js|18|unsupported/i)

  expect(() => resolvePackageManager('pnpm', {
    ...supported,
    hasWorkspaceFile: false,
  })).toThrow(/pnpm-workspace\.yaml|missing/i)
})

it('rejects a second lockfile from another package manager', () => {
  const dir = mkdtempSync(join(tmpdir(), 'package-manager-'))
  try {
    writeFileSync(join(dir, 'package-lock.json'), '{}\n')

    const found = findForeignLockfiles(dir)
    expect(found).toEqual(['package-lock.json'])
    expect(() => resolvePackageManager('pnpm', { ...supported, foreignLockfiles: found })).toThrow(/package-lock\.json/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it('leaves a pnpm-only tree alone, including nested projects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'package-manager-'))
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n")
    const nested = join(dir, 'docs-site')
    mkdirSync(nested)
    writeFileSync(join(nested, 'package-lock.json'), '{}\n')

    expect(findForeignLockfiles(dir)).toEqual([])
    expect(() => resolvePackageManager('pnpm', {
      ...supported,
      foreignLockfiles: findForeignLockfiles(dir),
    })).not.toThrow()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
