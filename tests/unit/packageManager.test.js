import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { findForeignLockfiles, resolvePackageManager } from '../../scripts/validate-package-manager.mjs'

const supported = { nodeVersion: '20.11.1', hasWorkspaceFile: true, hasLockfile: true }

test('accepts the repo-standard pnpm flow', () => {
  const result = resolvePackageManager('pnpm', supported)

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
    ...supported,
    nodeVersion: '16.20.0',
  }), /node\.js|18|unsupported/i)

  assert.throws(() => resolvePackageManager('pnpm', {
    ...supported,
    hasWorkspaceFile: false,
  }), /pnpm-workspace\.yaml|missing/i)
})

test('rejects a second lockfile from another package manager', () => {
  const dir = mkdtempSync(join(tmpdir(), 'package-manager-'))
  try {
    writeFileSync(join(dir, 'package-lock.json'), '{}\n')

    const found = findForeignLockfiles(dir)
    assert.deepStrictEqual(found, ['package-lock.json'])
    assert.throws(() => resolvePackageManager('pnpm', { ...supported, foreignLockfiles: found }), /package-lock\.json/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('leaves a pnpm-only tree alone, including nested projects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'package-manager-'))
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n")
    const nested = join(dir, 'docs-site')
    mkdirSync(nested)
    writeFileSync(join(nested, 'package-lock.json'), '{}\n')

    assert.deepStrictEqual(findForeignLockfiles(dir), [])
    assert.doesNotThrow(() => resolvePackageManager('pnpm', {
      ...supported,
      foreignLockfiles: findForeignLockfiles(dir),
    }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
