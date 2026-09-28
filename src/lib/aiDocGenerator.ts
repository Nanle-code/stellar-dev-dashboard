/**
 * AI-Powered Documentation Generator
 *
 * Automatically generates comprehensive documentation from code comments,
 * function signatures, and usage patterns. Keeps documentation in sync with code.
 *
 * @module aiDocGenerator
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocType = 'function' | 'class' | 'interface' | 'module' | 'constant'

export interface ParsedParam {
  name: string
  type: string
  description: string
  optional: boolean
  defaultValue?: string
}

export interface ParsedReturn {
  type: string
  description: string
}

export interface ParsedThrows {
  type: string
  description: string
}

export interface ParsedExample {
  code: string
  caption?: string
}

export interface ExtractedDoc {
  name: string
  type: DocType
  description: string
  params: ParsedParam[]
  returns: ParsedReturn | null
  throws: ParsedThrows[]
  examples: ParsedExample[]
  deprecated: boolean
  since?: string
  tags: Record<string, string>
  signature: string
  lineNumber?: number
}

export interface QualityReport {
  score: number                // 0–100
  pass: boolean                // score >= 85
  issues: QualityIssue[]
  suggestions: string[]
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  field?: string
}

export interface SyncResult {
  inSync: boolean
  added: string[]
  removed: string[]
  changed: string[]
}

export type TemplateType = 'markdown' | 'html' | 'jsdoc' | 'tsdoc'

export interface GenerateOptions {
  template?: TemplateType
  includePrivate?: boolean
  includeExamples?: boolean
  includeTypes?: boolean
}

// ── JSDoc / TSDoc parser ──────────────────────────────────────────────────────

const TAG_PATTERN = /@(\w+)\s*(.*?)(?=\n@|\s*$)/gs
const PARAM_PATTERN = /\{([^}]+)\}\s+(\[)?(\w+)(?:=([^\]]+))?]?\s*(.*)/
const RETURN_PATTERN = /\{([^}]+)\}\s*(.*)/

/**
 * Normalises raw comment text by stripping leading `*` characters and
 * collapsing excess whitespace.
 */
export function normaliseComment(raw: string): string {
  return raw
    .replace(/^\s*\/\*\*?\s*/m, '')
    .replace(/\s*\*\/\s*$/m, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
}

/**
 * Parses a JSDoc/TSDoc `@param` tag string into a structured `ParsedParam`.
 *
 * @param raw - The raw text of a single @param tag (without the leading `@param`)
 * @returns Parsed parameter object
 *
 * @example
 * parseParam('{string} [name="world"] The name to greet')
 * // → { name: 'name', type: 'string', description: 'The name to greet', optional: true, defaultValue: '"world"' }
 */
export function parseParam(raw: string): ParsedParam {
  const match = PARAM_PATTERN.exec(raw.trim())
  if (!match) {
    return { name: raw.trim(), type: 'unknown', description: '', optional: false }
  }

  const [, type, optBracket, name, defaultValue, description] = match
  return {
    name: name ?? '',
    type: type ?? 'unknown',
    description: (description ?? '').trim(),
    optional: !!optBracket,
    ...(defaultValue !== undefined && { defaultValue }),
  }
}

/**
 * Parses a JSDoc/TSDoc `@returns` or `@return` tag string.
 *
 * @param raw - Raw text after `@returns`
 * @returns Parsed return object, or null if empty
 */
export function parseReturn(raw: string): ParsedReturn | null {
  if (!raw.trim()) return null
  const match = RETURN_PATTERN.exec(raw.trim())
  if (!match) return { type: 'unknown', description: raw.trim() }
  const [, type, description] = match
  return { type: type ?? 'unknown', description: (description ?? '').trim() }
}

/**
 * Extracts all JSDoc/TSDoc tags from a comment block.
 *
 * @param comment - Normalised comment string
 * @returns Record mapping tag name to raw tag text (last wins for duplicates
 *   that aren't `@param` or `@throws`; those are accumulated as JSON arrays)
 */
export function extractTags(comment: string): {
  tags: Record<string, string>
  params: string[]
  returns: string | null
  throws: string[]
  examples: string[]
  deprecated: boolean
  since?: string
} {
  const params: string[] = []
  const throwsList: string[] = []
  const examples: string[] = []
  const tags: Record<string, string> = {}
  let returns: string | null = null
  let deprecated = false
  let since: string | undefined

  // Reset lastIndex for global regex
  TAG_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG_PATTERN.exec(comment)) !== null) {
    const [, name, text] = match
    const trimmed = (text ?? '').trim()

    switch (name) {
      case 'param':
        params.push(trimmed)
        break
      case 'returns':
      case 'return':
        returns = trimmed
        break
      case 'throws':
      case 'exception':
        throwsList.push(trimmed)
        break
      case 'example':
        examples.push(trimmed)
        break
      case 'deprecated':
        deprecated = true
        tags['deprecated'] = trimmed || 'true'
        break
      case 'since':
        since = trimmed
        break
      default:
        tags[name] = trimmed
    }
  }

  return { tags, params, returns, throws: throwsList, examples, deprecated, since }
}

/**
 * Extracts the description portion from a normalised comment (the text before
 * the first `@tag`).
 *
 * @param comment - Normalised comment string
 */
export function extractDescription(comment: string): string {
  const tagStart = comment.search(/@\w+/)
  return (tagStart === -1 ? comment : comment.slice(0, tagStart)).trim()
}

/**
 * Infers a rough `DocType` from a source-code signature string.
 *
 * @param signature - A single-line representation of the code entity
 * @returns Inferred doc type
 */
export function inferDocType(signature: string): DocType {
  const sig = signature.trim()
  if (/^(export\s+)?(abstract\s+)?class\s+/.test(sig)) return 'class'
  if (/^(export\s+)?interface\s+/.test(sig)) return 'interface'
  if (/^(export\s+)?(const|let|var)\s+/.test(sig) && !/=>/.test(sig)) return 'constant'
  if (/^(export\s+)?(default\s+)?function\s+/.test(sig)) return 'function'
  if (/^(export\s+)?(const|let|var)\s+\w+\s*=\s*(\(|async\s*\()/.test(sig)) return 'function'
  if (/^(export\s+)?(const|let|var)\s+\w+\s*=\s*function/.test(sig)) return 'function'
  if (/\(.*\)\s*(:\s*\S+)?\s*\{?$/.test(sig)) return 'function'
  return 'module'
}

// ── Core parser ───────────────────────────────────────────────────────────────

const COMMENT_AND_SIG = /\/\*\*([\s\S]*?)\*\/\s*\n?(.*)/g

/**
 * Parses all JSDoc/TSDoc comment blocks from a source-code string and returns
 * structured `ExtractedDoc` objects.
 *
 * @param source - Raw source code text
 * @param options - Generation options
 * @returns Array of extracted documentation objects
 */
export function parseSourceDocs(
  source: string,
  options: GenerateOptions = {},
): ExtractedDoc[] {
  const { includePrivate = false } = options
  const docs: ExtractedDoc[] = []
  const lines = source.split('\n')

  COMMENT_AND_SIG.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = COMMENT_AND_SIG.exec(source)) !== null) {
    const [fullMatch, rawComment, signatureLine] = match
    const signature = (signatureLine ?? '').trim()

    // Skip private members unless explicitly included
    if (!includePrivate && /private\s+/.test(signature)) continue

    const normalised = normaliseComment(rawComment ?? '')
    const description = extractDescription(normalised)
    const { tags, params, returns, throws, examples, deprecated, since } =
      extractTags(normalised)

    // Determine line number
    const charsBefore = source.indexOf(fullMatch)
    const lineNumber = source.slice(0, charsBefore).split('\n').length

    // Extract name from signature
    const nameMatch =
      /(?:function|class|interface|const|let|var)\s+(\w+)/.exec(signature) ??
      /^(\w+)\s*[:=(]/.exec(signature)
    const name = nameMatch ? nameMatch[1] : signature.slice(0, 40)

    // Resolve line-based name from surrounding context
    const contextLine = lines[lineNumber] ?? ''
    const ctxName =
      /(?:function|class|interface|const|let|var)\s+(\w+)/.exec(contextLine)?.[1]

    const doc: ExtractedDoc = {
      name: ctxName ?? name,
      type: inferDocType(signature),
      description,
      params: params.map(parseParam),
      returns: returns ? parseReturn(returns) : null,
      throws: throws.map((t) => {
        const m = RETURN_PATTERN.exec(t)
        return m
          ? { type: m[1] ?? 'Error', description: (m[2] ?? '').trim() }
          : { type: 'Error', description: t }
      }),
      examples: examples.map((e) => {
        const captionMatch = /^(.+)\n([\s\S]+)/.exec(e)
        return captionMatch
          ? { caption: captionMatch[1].trim(), code: captionMatch[2].trim() }
          : { code: e }
      }),
      deprecated,
      ...(since && { since }),
      tags,
      signature,
      lineNumber,
    }

    docs.push(doc)
  }

  return docs
}

// ── Template engine ───────────────────────────────────────────────────────────

/**
 * Renders a single `ExtractedDoc` into Markdown format.
 *
 * @param doc - The extracted documentation object
 * @param options - Rendering options
 * @returns Markdown string
 */
export function renderMarkdown(doc: ExtractedDoc, options: GenerateOptions = {}): string {
  const { includeExamples = true, includeTypes = true } = options
  const lines: string[] = []

  // Heading
  const badge = doc.deprecated ? ' ⚠️ *deprecated*' : ''
  lines.push(`### \`${doc.name}\`${badge}`)
  lines.push('')

  if (doc.since) lines.push(`*Since: ${doc.since}*\n`)

  // Description
  if (doc.description) {
    lines.push(doc.description)
    lines.push('')
  }

  // Signature
  if (doc.signature) {
    lines.push('```typescript')
    lines.push(doc.signature)
    lines.push('```')
    lines.push('')
  }

  // Parameters
  if (doc.params.length > 0) {
    lines.push('**Parameters**\n')
    lines.push('| Name | Type | Optional | Description |')
    lines.push('|------|------|----------|-------------|')
    for (const p of doc.params) {
      const type = includeTypes ? `\`${p.type}\`` : p.type
      const opt = p.optional ? `Yes${p.defaultValue ? ` (default: \`${p.defaultValue}\`)` : ''}` : 'No'
      lines.push(`| \`${p.name}\` | ${type} | ${opt} | ${p.description} |`)
    }
    lines.push('')
  }

  // Returns
  if (doc.returns) {
    lines.push('**Returns**\n')
    const type = includeTypes ? `\`${doc.returns.type}\`` : doc.returns.type
    lines.push(`${type} — ${doc.returns.description}`)
    lines.push('')
  }

  // Throws
  if (doc.throws.length > 0) {
    lines.push('**Throws**\n')
    for (const t of doc.throws) {
      lines.push(`- \`${t.type}\` — ${t.description}`)
    }
    lines.push('')
  }

  // Examples
  if (includeExamples && doc.examples.length > 0) {
    lines.push('**Examples**\n')
    for (const ex of doc.examples) {
      if (ex.caption) lines.push(`*${ex.caption}*\n`)
      lines.push('```typescript')
      lines.push(ex.code)
      lines.push('```')
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd()
}

/**
 * Renders a single `ExtractedDoc` into TSDoc format.
 *
 * @param doc - Extracted doc
 * @returns TSDoc comment string
 */
export function renderTSDoc(doc: ExtractedDoc): string {
  const lines: string[] = ['/**']

  if (doc.description) {
    for (const line of doc.description.split('\n')) {
      lines.push(` * ${line}`)
    }
    lines.push(' *')
  }

  for (const p of doc.params) {
    const optMark = p.optional ? `[${p.name}]` : p.name
    lines.push(` * @param ${optMark} - ${p.description}`)
  }

  if (doc.returns) {
    lines.push(` * @returns ${doc.returns.description}`)
  }

  for (const t of doc.throws) {
    lines.push(` * @throws {@link ${t.type}} ${t.description}`)
  }

  for (const ex of doc.examples) {
    lines.push(` * @example`)
    for (const l of ex.code.split('\n')) {
      lines.push(` * ${l}`)
    }
  }

  if (doc.deprecated) lines.push(' * @deprecated')
  if (doc.since) lines.push(` * @since ${doc.since}`)

  for (const [key, val] of Object.entries(doc.tags)) {
    if (!['deprecated', 'since'].includes(key)) {
      lines.push(` * @${key} ${val}`)
    }
  }

  lines.push(' */')
  return lines.join('\n')
}

/**
 * Generates documentation for an array of `ExtractedDoc` objects using the
 * specified template type.
 *
 * @param docs - Array of extracted documentation objects
 * @param template - Output format
 * @param options - Generation options
 * @returns Rendered documentation string
 */
export function generateDocumentation(
  docs: ExtractedDoc[],
  template: TemplateType = 'markdown',
  options: GenerateOptions = {},
): string {
  if (docs.length === 0) return ''

  switch (template) {
    case 'markdown': {
      const sections = docs.map((d) => renderMarkdown(d, options))
      return `# API Documentation\n\n${sections.join('\n\n---\n\n')}`
    }
    case 'tsdoc':
      return docs.map(renderTSDoc).join('\n\n')
    case 'html': {
      const inner = docs
        .map((d) => {
          const md = renderMarkdown(d, options)
          return `<section class="doc-entry">\n${md}\n</section>`
        })
        .join('\n\n')
      return `<!DOCTYPE html>\n<html>\n<body>\n${inner}\n</body>\n</html>`
    }
    case 'jsdoc':
      return docs.map(renderTSDoc).join('\n\n')
    default:
      return docs.map((d) => renderMarkdown(d, options)).join('\n\n')
  }
}

// ── Quality assessment ────────────────────────────────────────────────────────

/**
 * Assesses the quality of a documentation entry and returns a scored report.
 * A passing score is >= 85.
 *
 * @param doc - Extracted documentation object
 * @returns Quality report with score, issues, and suggestions
 */
export function assessQuality(doc: ExtractedDoc): QualityReport {
  const issues: QualityIssue[] = []
  const suggestions: string[] = []
  let score = 100

  // Description
  if (!doc.description || doc.description.trim().length === 0) {
    issues.push({ severity: 'error', message: 'Missing description', field: 'description' })
    score -= 30
  } else if (doc.description.trim().split(/\s+/).length < 5) {
    issues.push({ severity: 'warning', message: 'Description is too brief (< 5 words)', field: 'description' })
    suggestions.push('Expand the description to clearly explain what this entity does.')
    score -= 10
  }

  // Parameters
  const sigParamCount = (doc.signature.match(/\w+\s*:/g) ?? []).length
  if (doc.params.length === 0 && sigParamCount > 0) {
    issues.push({ severity: 'warning', message: 'Function has parameters but none are documented', field: 'params' })
    suggestions.push('Add @param tags for each parameter.')
    score -= 15
  }

  for (const p of doc.params) {
    if (!p.description || p.description.trim().length === 0) {
      issues.push({ severity: 'warning', message: `Parameter \`${p.name}\` is missing a description`, field: 'params' })
      suggestions.push(`Add a description for the \`${p.name}\` parameter.`)
      score -= 5
    }
    if (p.type === 'unknown') {
      issues.push({ severity: 'info', message: `Parameter \`${p.name}\` has no type annotation`, field: 'params' })
      score -= 3
    }
  }

  // Return value
  if (
    doc.type === 'function' &&
    doc.returns === null &&
    !/:\s*void/.test(doc.signature) &&
    !/:\s*Promise<void>/.test(doc.signature)
  ) {
    issues.push({ severity: 'info', message: 'Missing @returns tag for non-void function', field: 'returns' })
    suggestions.push('Add an @returns tag describing the return value.')
    score -= 5
  }

  // Examples
  if (doc.examples.length === 0) {
    issues.push({ severity: 'info', message: 'No usage examples provided', field: 'examples' })
    suggestions.push('Add at least one @example showing typical usage.')
    score -= 5
  }

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    pass: score >= 85,
    issues,
    suggestions,
  }
}

/**
 * Assesses the quality of a collection of docs and returns the aggregate
 * score (average) and per-doc reports.
 *
 * @param docs - Array of extracted documentation objects
 * @returns Aggregate score (0–100) and individual reports keyed by name
 */
export function assessCollectionQuality(docs: ExtractedDoc[]): {
  averageScore: number
  passRate: number
  reports: Record<string, QualityReport>
} {
  if (docs.length === 0) return { averageScore: 0, passRate: 0, reports: {} }

  const reports: Record<string, QualityReport> = {}
  let total = 0
  let passing = 0

  for (const doc of docs) {
    const report = assessQuality(doc)
    reports[doc.name] = report
    total += report.score
    if (report.pass) passing++
  }

  return {
    averageScore: Math.round(total / docs.length),
    passRate: Math.round((passing / docs.length) * 100),
    reports,
  }
}

// ── Sync detection ────────────────────────────────────────────────────────────

/**
 * Compares two sets of documentation (e.g. current source vs. a previously
 * generated snapshot) and reports whether they are in sync.
 *
 * @param current - Docs extracted from the current source
 * @param previous - Docs from the previous generation snapshot
 * @returns Sync result detailing added, removed, and changed entities
 */
export function detectSyncDrift(
  current: ExtractedDoc[],
  previous: ExtractedDoc[],
): SyncResult {
  const currentMap = new Map(current.map((d) => [d.name, d]))
  const previousMap = new Map(previous.map((d) => [d.name, d]))

  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  for (const [name] of currentMap) {
    if (!previousMap.has(name)) {
      added.push(name)
    }
  }

  for (const [name, prev] of previousMap) {
    if (!currentMap.has(name)) {
      removed.push(name)
    } else {
      const curr = currentMap.get(name)!
      if (
        curr.description !== prev.description ||
        curr.params.length !== prev.params.length ||
        curr.signature !== prev.signature
      ) {
        changed.push(name)
      }
    }
  }

  return {
    inSync: added.length === 0 && removed.length === 0 && changed.length === 0,
    added,
    removed,
    changed,
  }
}

// ── NLG description enhancer ─────────────────────────────────────────────────

const VERB_MAP: Record<string, string> = {
  get: 'Retrieves',
  set: 'Sets',
  fetch: 'Fetches',
  create: 'Creates',
  build: 'Builds',
  parse: 'Parses',
  format: 'Formats',
  validate: 'Validates',
  check: 'Checks',
  is: 'Returns true if',
  has: 'Returns true if the entity has',
  update: 'Updates',
  delete: 'Deletes',
  remove: 'Removes',
  add: 'Adds',
  generate: 'Generates',
  render: 'Renders',
  transform: 'Transforms',
  calculate: 'Calculates',
  compute: 'Computes',
  convert: 'Converts',
  extract: 'Extracts',
  merge: 'Merges',
  filter: 'Filters',
  sort: 'Sorts',
  map: 'Maps',
  reduce: 'Reduces',
  find: 'Finds',
  search: 'Searches for',
  load: 'Loads',
  save: 'Saves',
  export: 'Exports',
  import: 'Imports',
  init: 'Initialises',
  reset: 'Resets',
  clear: 'Clears',
  send: 'Sends',
  receive: 'Receives',
  connect: 'Connects',
  disconnect: 'Disconnects',
  subscribe: 'Subscribes to',
  unsubscribe: 'Unsubscribes from',
  emit: 'Emits',
  handle: 'Handles',
  process: 'Processes',
  run: 'Runs',
  execute: 'Executes',
  apply: 'Applies',
  notify: 'Notifies',
  assess: 'Assesses',
  detect: 'Detects',
  infer: 'Infers',
  normalise: 'Normalises',
  normalize: 'Normalizes',
}

/**
 * Generates a natural-language description for a function name using
 * camelCase decomposition and a curated verb map.
 *
 * @param name - The function/method name
 * @returns A human-readable description sentence
 *
 * @example
 * generateNLDescription('getUserById')
 * // → 'Retrieves user by id.'
 */
export function generateNLDescription(name: string): string {
  // Split camelCase/PascalCase into words
  const words = name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .split(/\s+/)

  if (words.length === 0) return `Performs the ${name} operation.`

  const firstWord = words[0]
  const rest = words.slice(1)

  const verb = VERB_MAP[firstWord] ?? `${firstWord.charAt(0).toUpperCase()}${firstWord.slice(1)}s`
  return rest.length > 0
    ? `${verb} ${rest.join(' ')}.`
    : `${verb}.`
}

/**
 * Enhances extracted docs that have missing or very short descriptions by
 * generating NL descriptions from the function name.
 *
 * @param docs - Extracted documentation objects
 * @returns New array with enhanced descriptions (originals unchanged)
 */
export function enhanceDescriptions(docs: ExtractedDoc[]): ExtractedDoc[] {
  return docs.map((doc) => {
    if (!doc.description || doc.description.trim().split(/\s+/).length < 3) {
      return { ...doc, description: generateNLDescription(doc.name) }
    }
    return doc
  })
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export interface PipelineResult {
  docs: ExtractedDoc[]
  documentation: string
  quality: {
    averageScore: number
    passRate: number
    reports: Record<string, QualityReport>
  }
}

/**
 * Runs the full documentation generation pipeline on source code:
 * parse → enhance → generate → assess quality.
 *
 * @param source - Raw source code string
 * @param options - Generation options
 * @returns Pipeline result with docs, rendered output, and quality report
 */
export function runDocPipeline(
  source: string,
  options: GenerateOptions = {},
): PipelineResult {
  const { template = 'markdown', includePrivate = false } = options

  const raw = parseSourceDocs(source, { includePrivate })
  const docs = enhanceDescriptions(raw)
  const documentation = generateDocumentation(docs, template, options)
  const quality = assessCollectionQuality(docs)

  return { docs, documentation, quality }
}
