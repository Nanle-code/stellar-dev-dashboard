import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MIN_NODE_MAJOR, MAX_NODE_MAJOR } from './node-version-policy.mjs'

export const SUPPORTED_NODE_RANGE = { min: MIN_NODE_MAJOR, max: MAX_NODE_MAJOR }

export const FORBIDDEN_LOCKFILES = [
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'npm-shrinkwrap.json', manager: 'npm' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'bun.lock', manager: 'bun' },
]

export function resolvePackageManager(requestedManager, env = {}) {
  const managerName = String(requestedManager ?? '').trim().toLowerCase()
  const rootDir = env.rootDir ?? process.cwd()
  const nodeVersion = env.nodeVersion ?? process.versions.node
  const hasWorkspaceFile = env.hasWorkspaceFile ?? fs.existsSync(path.resolve(rootDir, 'pnpm-workspace.yaml'))
  const hasLockfile = env.hasLockfile ?? fs.existsSync(path.resolve(rootDir, 'pnpm-lock.yaml'))
  const majorVersion = Number.parseInt(String(nodeVersion).replace(/^v/, '').split('.')[0], 10)

  if (!managerName) {
    throw new Error('Package manager is required. Use pnpm for this repository.')
  }

  if (managerName !== 'pnpm') {
    throw new Error(`Unsupported package manager "${requestedManager}": only pnpm is supported in this repository.`)
  }

  // Check for forbidden lockfiles
  if (env.hasPackageLock === true || (env.hasPackageLock === undefined && fs.existsSync(path.resolve(rootDir, 'package-lock.json')))) {
    throw new Error('Found package-lock.json. This repository standardizes exclusively on pnpm and rejects package-lock.json. Please remove package-lock.json.')
  }

  if (env.hasYarnLock === true || (env.hasYarnLock === undefined && fs.existsSync(path.resolve(rootDir, 'yarn.lock')))) {
    throw new Error('Found yarn.lock. This repository standardizes exclusively on pnpm and rejects yarn.lock. Please remove yarn.lock.')
  }

  for (const { file, manager } of FORBIDDEN_LOCKFILES) {
    const envKey = `has${file.replace(/[^a-zA-Z0-9]/g, '')}`
    if (env[envKey] === true || (env[envKey] === undefined && fs.existsSync(path.resolve(rootDir, file)))) {
      throw new Error(`Found ${file}. This repository standardizes exclusively on pnpm and rejects ${manager} lockfiles. Please remove ${file}.`)
    }
  }

  if (Number.isNaN(majorVersion) || majorVersion < SUPPORTED_NODE_RANGE.min || majorVersion > SUPPORTED_NODE_RANGE.max) {
    throw new Error(`Unsupported Node.js version ${nodeVersion}. Use Node.js ${SUPPORTED_NODE_RANGE.min} through ${SUPPORTED_NODE_RANGE.max}.`)
  }

  if (!hasWorkspaceFile) {
    throw new Error('Missing pnpm-workspace.yaml. This repository requires the pnpm workspace configuration.')
  }

  if (!hasLockfile) {
    throw new Error('Missing pnpm-lock.yaml. Run "pnpm install" to generate the lockfile before continuing.')
  }

  return {
    packageManager: 'pnpm',
    lockfile: 'pnpm-lock.yaml',
    workspaceFile: 'pnpm-workspace.yaml',
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = resolvePackageManager('pnpm')
    console.log(`Package manager: ${result.packageManager}`)
    console.log(`Lockfile: ${result.lockfile}`)
    console.log(`Workspace: ${result.workspaceFile}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(msg)
    process.exitCode = 1
  }
}
