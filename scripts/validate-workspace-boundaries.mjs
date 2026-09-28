#!/usr/bin/env node
/**
 * Validates that the pnpm workspace keeps browser and Node dependencies apart
 * (issue #963).
 *
 * The root package is the browser app ("web"). The Node-only runtime
 * dependencies must live in their own workspace packages:
 *   - `express`, `ws`, `ioredis`      -> api/
 *   - `@tensorflow/tfjs-node`         -> src/ml/
 *
 * Runs standalone in CI and is also unit-tested from
 * `tests/unit/workspace-boundaries.test.ts`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Runtime dependencies that must never be declared by the web package. */
export const FORBIDDEN_ROOT_DEPS = ['express', 'ws', '@tensorflow/tfjs-node', 'ioredis']

/** Packages that must exist as pnpm workspace members. */
export const REQUIRED_WORKSPACE_MEMBERS = [
  { glob: 'api', manifest: 'api/package.json', name: 'api', requiredDeps: ['express', 'ws'] },
  {
    glob: 'src/ml',
    manifest: 'src/ml/package.json',
    name: 'ml',
    requiredDeps: ['@tensorflow/tfjs-node'],
  },
]

export class WorkspaceBoundaryError extends Error {}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

/** All dependency sections a package declares, merged into one map. */
export function getDeclaredDeps(pkg) {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  }
}

/** Names from `forbidden` that `pkg` declares in any dependency section. */
export function findForbiddenRootDeps(pkg, forbidden = FORBIDDEN_ROOT_DEPS) {
  const declared = getDeclaredDeps(pkg)
  return forbidden.filter((name) => Object.prototype.hasOwnProperty.call(declared, name))
}

export function assertNoForbiddenRootDeps(pkg, forbidden = FORBIDDEN_ROOT_DEPS) {
  const hits = findForbiddenRootDeps(pkg, forbidden)
  if (hits.length > 0) {
    throw new WorkspaceBoundaryError(
      `Web package must not depend on server-only modules, found: ${hits.join(', ')}`
    )
  }
}

function assertWorkspaceGlob(workspaceSource, glob) {
  const escaped = glob.replace(/[/\\]/g, '[/\\\\]')
  const pattern = new RegExp(`^\\s*-\\s*['"]?${escaped}['"]?\\s*$`, 'm')
  if (!pattern.test(workspaceSource)) {
    throw new WorkspaceBoundaryError(`pnpm-workspace.yaml is missing the '${glob}' package glob`)
  }
}

function assertRequiredDeps(pkg, manifestName, requiredDeps) {
  const declared = getDeclaredDeps(pkg)
  const missing = requiredDeps.filter((name) => !Object.prototype.hasOwnProperty.call(declared, name))
  if (missing.length > 0) {
    throw new WorkspaceBoundaryError(
      `Workspace package '${manifestName}' is missing required server dependencies: ${missing.join(', ')}`
    )
  }
}

/**
 * Verify the on-disk workspace layout.
 * @returns {{ ok: true, root: object, members: object[] }}
 */
export function validateWorkspace({ rootDir = process.cwd() } = {}) {
  const rootPkg = readJson(path.join(rootDir, 'package.json'))
  assertNoForbiddenRootDeps(rootPkg)

  const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspaceFile)) {
    throw new WorkspaceBoundaryError('Missing pnpm-workspace.yaml')
  }
  const workspaceSource = fs.readFileSync(workspaceFile, 'utf8')

  const members = REQUIRED_WORKSPACE_MEMBERS.map((member) => {
    assertWorkspaceGlob(workspaceSource, member.glob)
    const manifestPath = path.join(rootDir, member.manifest)
    if (!fs.existsSync(manifestPath)) {
      throw new WorkspaceBoundaryError(`Missing workspace manifest: ${member.manifest}`)
    }
    const pkg = readJson(manifestPath)
    if (pkg.name !== member.name) {
      throw new WorkspaceBoundaryError(
        `Expected package at ${member.manifest} to be named '${member.name}', found '${pkg.name}'`
      )
    }
    assertRequiredDeps(pkg, member.name, member.requiredDeps)
    return { name: pkg.name, manifest: member.manifest }
  })

  return { ok: true, root: rootPkg, members }
}

function main() {
  try {
    const result = validateWorkspace()
    console.log('=== Workspace Boundary Validation ===')
    console.log(`Web package: ${result.root.name} (no server-only dependencies)`)
    for (const member of result.members) {
      console.log(`Workspace member: ${member.name} (${member.manifest})`)
    }
    console.log('Workspace boundaries are valid.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Workspace boundary validation failed: ${message}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
