export const MIN_NODE_MAJOR = 22
export const MAX_NODE_MAJOR = 26

export function parseNodeMajor(version) {
  const match = /^(?:v)?(\d+)(?:\.\d+){0,2}$/.exec(String(version).trim())
  if (!match) {
    throw new TypeError(`Invalid Node.js version: ${version}`)
  }

  return Number(match[1])
}

export function assertSupportedNode(version) {
  const major = parseNodeMajor(version)
  if (major < MIN_NODE_MAJOR || major > MAX_NODE_MAJOR) {
    throw new RangeError(
      `Unsupported Node.js ${major}. Use a release from ${MIN_NODE_MAJOR} through ${MAX_NODE_MAJOR}.`,
    )
  }

  return major
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try {
    const major = assertSupportedNode(process.version)
    console.log(`Node.js ${major} is supported.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
