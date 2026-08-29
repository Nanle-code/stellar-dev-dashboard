import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SUPPORTED_NODE_RANGE = { min: 18, max: 20 }

export function resolvePackageManager(requestedManager, env = {}) {
  const managerName = String(requestedManager ?? '').trim().toLowerCase()
  const nodeVersion = env.nodeVersion ?? process.versions.node
  const hasWorkspaceFile = env.hasWorkspaceFile ?? fs.existsSync(path.resolve(process.cwd(), 'pnpm-workspace.yaml'))
  const hasLockfile = env.hasLockfile ?? fs.existsSync(path.resolve(process.cwd(), 'pnpm-lock.yaml'))
  const majorVersion = Number.parseInt(String(nodeVersion).split('.')[0], 10)

  if (!managerName) {
    throw new Error('Package manager is required. Use pnpm for this repository.')
  }

  if (managerName !== 'pnpm') {
    throw new Error('Unsupported package manager: only pnpm is supported in this repository.')
  }

  if (Number.isNaN(majorVersion) || majorVersion < SUPPORTED_NODE_RANGE.min || majorVersion > SUPPORTED_NODE_RANGE.max) {
    throw new Error(`Unsupported Node.js version ${nodeVersion}. Use Node.js ${SUPPORTED_NODE_RANGE.min} or ${SUPPORTED_NODE_RANGE.max} LTS.`)
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(msg)
    process.exitCode = 1
  }
}
