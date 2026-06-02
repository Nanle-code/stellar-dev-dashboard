import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve()
const SOURCE_ROOT = path.join(ROOT, 'src', 'lib')
const OUTPUT_DIR = path.join(ROOT, 'docs', 'api', 'generated')
const API_REFERENCE_FILE = path.join(OUTPUT_DIR, 'API_REFERENCE.md')
const VERSION_HISTORY_FILE = path.join(OUTPUT_DIR, 'VERSION_HISTORY.md')
const SOURCE_EXTENSIONS = ['.js', '.ts', '.tsx']
const EXCLUDE_PATTERNS = [/\.test\./, /\.spec\./, /\/tests\//, /__tests__/]

function isSourceFile(fileName) {
  return SOURCE_EXTENSIONS.includes(path.extname(fileName)) && !EXCLUDE_PATTERNS.some((pattern) => pattern.test(fileName))
}

async function collectSourceFiles(dir) {
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)))
      continue
    }

    if (entry.isFile() && isSourceFile(entryPath)) {
      files.push(entryPath)
    }
  }

  return files
}

function normalizeText(text = '') {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
}

function parseJSDoc(comment) {
  const normalized = normalizeText(comment)
  const parts = normalized.split(/\n(?=@)/g)
  const description = parts[0].replace(/@\w+[\s\S]*$/, '').trim()
  const tags = []

  const tagPattern = /@(\w+)([\s\S]*?)(?=@\w+|$)/g
  let tagMatch
  while ((tagMatch = tagPattern.exec(normalized))) {
    tags.push({ name: tagMatch[1], text: normalizeText(tagMatch[2]) })
  }

  return { description, tags }
}

function buildSignature(declaration) {
  const end = declaration.indexOf('{')
  const arrow = declaration.indexOf('=>')
  const semicolon = declaration.indexOf(';')
  const newline = declaration.indexOf('\n')
  const cutPoints = [end, arrow, semicolon, newline].filter((idx) => idx > -1)
  const sliceEnd = cutPoints.length ? Math.min(...cutPoints) : declaration.length
  return normalizeText(declaration.slice(0, sliceEnd)).replace(/\s+/g, ' ')
}

function findNearestComment(commentBlocks, position) {
  const preceding = commentBlocks.filter((block) => block.end <= position)
  if (!preceding.length) return null
  return preceding[preceding.length - 1].comment
}

function extractExports(filePath, content) {
  const exportPattern = /export\s+(?:async\s+)?(function|const|let|var|class|interface|type|enum)\s+([A-Za-z$_][A-Za-z0-9$_]*)/g
  const commentPattern = /\/\*\*([\s\S]*?)\*\//g

  const commentBlocks = []
  let commentMatch
  while ((commentMatch = commentPattern.exec(content))) {
    commentBlocks.push({ comment: commentMatch[1], end: commentMatch.index + commentMatch[0].length })
  }

  const items = []
  let exportMatch
  while ((exportMatch = exportPattern.exec(content))) {
    const kind = exportMatch[1]
    const name = exportMatch[2]
    const signature = buildSignature(content.slice(exportMatch.index, exportMatch.index + 300))
    const rawComment = findNearestComment(commentBlocks, exportMatch.index)
    const { description, tags } = rawComment ? parseJSDoc(rawComment) : { description: '', tags: [] }

    items.push({ name, kind, signature, description, tags, filePath })
  }

  return items
}

function buildMarkdownSection(filePath, exports) {
  const relativeFile = path.relative(ROOT, filePath).replace(/\\/g, '/')
  const lines = [`## ${relativeFile}`, '']

  if (!exports.length) {
    lines.push('_No exported API items found in this source file._', '')
    return lines.join('\n')
  }

  for (const item of exports) {
    lines.push('### `' + item.signature + '`')
    lines.push('')
    lines.push(item.description || '_No description available._')
    lines.push('')

    const paramTags = item.tags.filter((tag) => tag.name === 'param')
    if (paramTags.length) {
      lines.push('**Parameters**')
      lines.push('')
      lines.push('| Name | Description |')
      lines.push('| --- | --- |')
      for (const tag of paramTags) {
        const parts = tag.text.split(/\s+/)
        const name = parts[0] || 'unknown'
        const description = parts.slice(1).join(' ').trim()
        lines.push('| `' + name + '` | ' + description + ' |')
      }
      lines.push('')
    }

    const returnTag = item.tags.find((tag) => tag.name === 'returns' || tag.name === 'return')
    if (returnTag) {
      lines.push('**Returns**: ' + returnTag.text)
      lines.push('')
    }

    const exampleTags = item.tags.filter((tag) => tag.name === 'example')
    if (exampleTags.length) {
      lines.push('**Example**')
      lines.push('')
      for (const tag of exampleTags) {
        lines.push('```js')
        lines.push(tag.text)
        lines.push('```')
        lines.push('')
      }
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

async function generateVersionHistoryMarkdown() {
  const packageJson = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const version = packageJson.version || 'unknown'
  let tags = []

  try {
    tags = execSync('git tag --sort=-creatordate', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split('\n')
      .map((tag) => tag.trim())
      .filter(Boolean)
  } catch {
    tags = []
  }

  const releaseTags = tags.length ? tags.slice(0, 10) : ['No git tags available']
  const lines = [
    '# API Version History',
    '',
    'Generated from `package.json` version **' + version + '** on ' + new Date().toISOString().split('T')[0] + '.',
    '',
    '## Released Versions',
    '',
  ]

  if (Array.isArray(tags) && tags.length) {
    lines.push('| Version | Note |')
    lines.push('| --- | --- |')
    for (const tag of releaseTags) {
      lines.push('| ' + tag + ' | Generated API documentation release |')
    }
  } else {
    lines.push('- No Git tags found. Use `git tag` to add version tags and re-run the generator.')
  }

  lines.push('')
  lines.push('## Current package version')
  lines.push('')
  lines.push('- version: **' + version + '**')
  lines.push('- generated: ' + new Date().toISOString())
  lines.push('')

  return lines.join('\n')
}

async function generate() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const files = await collectSourceFiles(SOURCE_ROOT)

  // Update openapi.yaml version in sync with package.json
  const packageJson = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const version = packageJson.version || '0.1.0'
  const openApiFilePath = path.join(ROOT, 'docs', 'api', 'openapi.yaml')
  try {
    let openApiContent = await fs.readFile(openApiFilePath, 'utf8')
    openApiContent = openApiContent.replace(/(version:\s*['"]?)\d+\.\d+\.\d+(['"]?)/, `$1${version}$2`)
    await fs.writeFile(openApiFilePath, openApiContent, 'utf8')
    console.log('Updated OpenAPI spec version to:', version)
  } catch (err) {
    console.warn('Could not update OpenAPI spec version:', err.message)
  }

  const generatedSections = []
  for (const filePath of files.sort()) {
    const content = await fs.readFile(filePath, 'utf8')
    const exports = extractExports(filePath, content)
    if (exports.length) {
      generatedSections.push({ filePath, exports })
    }
  }

  const markdown = [
    '# API Reference',
    '',
    'This API reference is auto-generated from the `src/lib` source files and JSDoc-style comments.',
    '',
    'Generated on: ' + new Date().toISOString(),
    '',
    '---',
    '',
  ]

  for (const section of generatedSections) {
    markdown.push(buildMarkdownSection(section.filePath, section.exports))
  }

  await fs.writeFile(API_REFERENCE_FILE, markdown.join('\n'), 'utf8')
  await fs.writeFile(VERSION_HISTORY_FILE, await generateVersionHistoryMarkdown(), 'utf8')

  console.log('Generated API reference:', API_REFERENCE_FILE)
  console.log('Generated version history:', VERSION_HISTORY_FILE)
}

generate().catch((error) => {
  console.error('Failed to generate API docs:', error)
  process.exit(1)
})
