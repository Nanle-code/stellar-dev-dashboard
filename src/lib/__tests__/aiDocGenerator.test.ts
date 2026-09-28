/**
 * Tests for the AI-Powered Documentation Generator
 */

import { describe, it, expect } from 'vitest'
import {
  normaliseComment,
  parseParam,
  parseReturn,
  extractTags,
  extractDescription,
  inferDocType,
  parseSourceDocs,
  renderMarkdown,
  renderTSDoc,
  generateDocumentation,
  assessQuality,
  assessCollectionQuality,
  detectSyncDrift,
  generateNLDescription,
  enhanceDescriptions,
  runDocPipeline,
  type ExtractedDoc,
  type GenerateOptions,
} from '../aiDocGenerator'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SIMPLE_DOC: ExtractedDoc = {
  name: 'greet',
  type: 'function',
  description: 'Returns a greeting string for the given name.',
  params: [{ name: 'name', type: 'string', description: 'The name to greet', optional: false }],
  returns: { type: 'string', description: 'A greeting message' },
  throws: [],
  examples: [{ code: 'greet("Alice") // → "Hello, Alice!"' }],
  deprecated: false,
  tags: {},
  signature: 'function greet(name: string): string',
  lineNumber: 1,
}

const FULL_SOURCE = `
/**
 * Adds two numbers together.
 *
 * @param {number} a - First operand
 * @param {number} b - Second operand
 * @returns {number} The sum
 * @example
 * add(1, 2) // 3
 */
function add(a: number, b: number): number {
  return a + b
}

/**
 * Subtracts b from a.
 *
 * @param {number} a - Minuend
 * @param {number} [b=0] - Subtrahend (optional)
 * @returns {number} The difference
 * @deprecated Use subtract2 instead
 * @since 1.2.0
 */
function subtract(a: number, b: number = 0): number {
  return a - b
}
`

// ── normaliseComment ──────────────────────────────────────────────────────────

describe('normaliseComment', () => {
  it('strips leading /** and trailing */', () => {
    const result = normaliseComment('/** Hello world */')
    expect(result).toBe('Hello world')
  })

  it('strips leading * from each line', () => {
    const raw = `/**
 * Line one
 * Line two
 */`
    const result = normaliseComment(raw)
    expect(result).toContain('Line one')
    expect(result).toContain('Line two')
    expect(result).not.toContain('*')
  })

  it('trims surrounding whitespace', () => {
    expect(normaliseComment('/**   spaced   */')).toBe('spaced')
  })

  it('handles single-line comments', () => {
    expect(normaliseComment('/** A brief note */')).toBe('A brief note')
  })
})

// ── parseParam ────────────────────────────────────────────────────────────────

describe('parseParam', () => {
  it('parses a required parameter with type and description', () => {
    const result = parseParam('{string} name The user name')
    expect(result.name).toBe('name')
    expect(result.type).toBe('string')
    expect(result.description).toBe('The user name')
    expect(result.optional).toBe(false)
  })

  it('parses an optional parameter with brackets', () => {
    const result = parseParam('{number} [timeout] Request timeout')
    expect(result.name).toBe('timeout')
    expect(result.optional).toBe(true)
    expect(result.type).toBe('number')
  })

  it('parses an optional parameter with a default value', () => {
    const result = parseParam('{string} [name="world"] The name')
    expect(result.name).toBe('name')
    expect(result.optional).toBe(true)
    expect(result.defaultValue).toBe('"world"')
    expect(result.description).toBe('The name')
  })

  it('returns unknown type for untyped params', () => {
    const result = parseParam('bareParam some description')
    expect(result.type).toBe('unknown')
  })

  it('handles raw name-only param string gracefully', () => {
    const result = parseParam('justName')
    expect(result.name).toBe('justName')
  })
})

// ── parseReturn ───────────────────────────────────────────────────────────────

describe('parseReturn', () => {
  it('parses type and description', () => {
    const result = parseReturn('{Promise<string>} The resolved value')
    expect(result).not.toBeNull()
    expect(result!.type).toBe('Promise<string>')
    expect(result!.description).toBe('The resolved value')
  })

  it('returns null for empty string', () => {
    expect(parseReturn('')).toBeNull()
    expect(parseReturn('  ')).toBeNull()
  })

  it('returns unknown type when no type annotation is present', () => {
    const result = parseReturn('just a description with no type')
    expect(result!.type).toBe('unknown')
    expect(result!.description).toBe('just a description with no type')
  })
})

// ── extractTags ───────────────────────────────────────────────────────────────

describe('extractTags', () => {
  it('extracts @param tags into the params array', () => {
    const comment = '@param {string} name The name\n@param {number} age The age'
    const { params } = extractTags(comment)
    expect(params).toHaveLength(2)
    expect(params[0]).toContain('name')
    expect(params[1]).toContain('age')
  })

  it('extracts @returns tag', () => {
    const comment = '@returns {boolean} True on success'
    const { returns } = extractTags(comment)
    expect(returns).toContain('boolean')
  })

  it('extracts @throws tags', () => {
    const comment = '@throws {TypeError} When input is invalid\n@throws {RangeError} When out of range'
    const { throws } = extractTags(comment)
    expect(throws).toHaveLength(2)
  })

  it('extracts @example tags', () => {
    const comment = '@example\nfoo(1, 2) // 3'
    const { examples } = extractTags(comment)
    expect(examples).toHaveLength(1)
    expect(examples[0]).toContain('foo(1, 2)')
  })

  it('detects @deprecated tag', () => {
    const { deprecated } = extractTags('@deprecated Use newFn instead')
    expect(deprecated).toBe(true)
  })

  it('extracts @since tag', () => {
    const { since } = extractTags('@since 2.0.0')
    expect(since).toBe('2.0.0')
  })

  it('collects unknown tags into the tags record', () => {
    const { tags } = extractTags('@author Alice\n@license MIT')
    expect(tags['author']).toBe('Alice')
    expect(tags['license']).toBe('MIT')
  })
})

// ── extractDescription ────────────────────────────────────────────────────────

describe('extractDescription', () => {
  it('returns text before the first @ tag', () => {
    const comment = 'Does something useful.\n\n@param {string} x Input'
    expect(extractDescription(comment)).toBe('Does something useful.')
  })

  it('returns the entire string when no tags are present', () => {
    const comment = 'A plain description without tags.'
    expect(extractDescription(comment)).toBe(comment)
  })

  it('returns empty string for comments that start immediately with a tag', () => {
    expect(extractDescription('@param x Value')).toBe('')
  })
})

// ── inferDocType ──────────────────────────────────────────────────────────────

describe('inferDocType', () => {
  it('identifies function declarations', () => {
    expect(inferDocType('function greet(name: string): string')).toBe('function')
    expect(inferDocType('export function greet(): void')).toBe('function')
    expect(inferDocType('export default function(): void')).toBe('function')
  })

  it('identifies arrow function constants', () => {
    expect(inferDocType('const greet = (name: string) => string')).toBe('function')
    expect(inferDocType('const fn = async () => Promise<void>')).toBe('function')
  })

  it('identifies class declarations', () => {
    expect(inferDocType('class MyClass {')).toBe('class')
    expect(inferDocType('export abstract class Base {')).toBe('class')
  })

  it('identifies interface declarations', () => {
    expect(inferDocType('interface IUser {')).toBe('interface')
    expect(inferDocType('export interface Options {')).toBe('interface')
  })

  it('identifies constants', () => {
    expect(inferDocType('const MAX_SIZE = 100')).toBe('constant')
    expect(inferDocType('export const API_URL = "https://api.example.com"')).toBe('constant')
  })

  it('defaults to module for unrecognised signatures', () => {
    expect(inferDocType('')).toBe('module')
    expect(inferDocType('someRandomText')).toBe('module')
  })
})

// ── parseSourceDocs ───────────────────────────────────────────────────────────

describe('parseSourceDocs', () => {
  it('extracts docs from well-formed source code', () => {
    const docs = parseSourceDocs(FULL_SOURCE)
    expect(docs.length).toBeGreaterThanOrEqual(2)
  })

  it('parses parameter descriptions correctly', () => {
    const docs = parseSourceDocs(FULL_SOURCE)
    const addDoc = docs.find((d) => d.description.toLowerCase().includes('adds'))
    expect(addDoc).toBeDefined()
    expect(addDoc!.params.length).toBeGreaterThanOrEqual(2)
  })

  it('captures @deprecated flag', () => {
    const docs = parseSourceDocs(FULL_SOURCE)
    const subtractDoc = docs.find((d) => d.deprecated)
    expect(subtractDoc).toBeDefined()
  })

  it('captures @since tag', () => {
    const docs = parseSourceDocs(FULL_SOURCE)
    const subtractDoc = docs.find((d) => d.since)
    expect(subtractDoc?.since).toBe('1.2.0')
  })

  it('returns empty array for source with no JSDoc comments', () => {
    const docs = parseSourceDocs('const x = 42\nfunction foo() {}')
    expect(docs).toHaveLength(0)
  })

  it('excludes private members when includePrivate is false', () => {
    const source = `
/**
 * A private helper.
 */
private function _helper(): void {}
`
    const docs = parseSourceDocs(source, { includePrivate: false })
    expect(docs).toHaveLength(0)
  })

  it('includes private members when includePrivate is true', () => {
    const source = `
/**
 * A private helper.
 */
private function _helper(): void {}
`
    const docs = parseSourceDocs(source, { includePrivate: true })
    expect(docs.length).toBeGreaterThanOrEqual(1)
  })
})

// ── renderMarkdown ────────────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('includes the function name as a heading', () => {
    const md = renderMarkdown(SIMPLE_DOC)
    expect(md).toContain('### `greet`')
  })

  it('includes the description', () => {
    const md = renderMarkdown(SIMPLE_DOC)
    expect(md).toContain('Returns a greeting string')
  })

  it('renders a parameter table', () => {
    const md = renderMarkdown(SIMPLE_DOC)
    expect(md).toContain('| Name |')
    expect(md).toContain('`name`')
    expect(md).toContain('The name to greet')
  })

  it('renders return type', () => {
    const md = renderMarkdown(SIMPLE_DOC)
    expect(md).toContain('**Returns**')
    expect(md).toContain('`string`')
    expect(md).toContain('A greeting message')
  })

  it('renders examples when includeExamples is true', () => {
    const md = renderMarkdown(SIMPLE_DOC, { includeExamples: true })
    expect(md).toContain('**Examples**')
    expect(md).toContain('greet("Alice")')
  })

  it('omits examples when includeExamples is false', () => {
    const md = renderMarkdown(SIMPLE_DOC, { includeExamples: false })
    expect(md).not.toContain('**Examples**')
  })

  it('adds a deprecated badge for deprecated docs', () => {
    const deprecated = { ...SIMPLE_DOC, deprecated: true }
    const md = renderMarkdown(deprecated)
    expect(md).toContain('deprecated')
  })

  it('renders throws section', () => {
    const withThrows: ExtractedDoc = {
      ...SIMPLE_DOC,
      throws: [{ type: 'TypeError', description: 'When name is not a string' }],
    }
    const md = renderMarkdown(withThrows)
    expect(md).toContain('**Throws**')
    expect(md).toContain('TypeError')
  })
})

// ── renderTSDoc ───────────────────────────────────────────────────────────────

describe('renderTSDoc', () => {
  it('produces a valid TSDoc comment block', () => {
    const tsdoc = renderTSDoc(SIMPLE_DOC)
    expect(tsdoc).toMatch(/^\/\*\*/)
    expect(tsdoc).toMatch(/\*\/$/)
  })

  it('includes @param tags', () => {
    const tsdoc = renderTSDoc(SIMPLE_DOC)
    expect(tsdoc).toContain('@param name')
  })

  it('includes @returns tag', () => {
    const tsdoc = renderTSDoc(SIMPLE_DOC)
    expect(tsdoc).toContain('@returns')
  })

  it('includes @deprecated tag when applicable', () => {
    const dep = { ...SIMPLE_DOC, deprecated: true }
    expect(renderTSDoc(dep)).toContain('@deprecated')
  })

  it('includes @since tag when present', () => {
    const withSince = { ...SIMPLE_DOC, since: '2.0.0' }
    expect(renderTSDoc(withSince)).toContain('@since 2.0.0')
  })

  it('includes @example blocks', () => {
    const tsdoc = renderTSDoc(SIMPLE_DOC)
    expect(tsdoc).toContain('@example')
    expect(tsdoc).toContain('greet("Alice")')
  })
})

// ── generateDocumentation ─────────────────────────────────────────────────────

describe('generateDocumentation', () => {
  it('returns empty string for no docs', () => {
    expect(generateDocumentation([])).toBe('')
  })

  it('generates markdown by default', () => {
    const out = generateDocumentation([SIMPLE_DOC])
    expect(out).toContain('# API Documentation')
    expect(out).toContain('### `greet`')
  })

  it('generates tsdoc format', () => {
    const out = generateDocumentation([SIMPLE_DOC], 'tsdoc')
    expect(out).toMatch(/^\/\*\*/)
  })

  it('generates html format', () => {
    const out = generateDocumentation([SIMPLE_DOC], 'html')
    expect(out).toContain('<!DOCTYPE html>')
    expect(out).toContain('<section class="doc-entry">')
  })

  it('generates jsdoc format (alias for tsdoc)', () => {
    const out = generateDocumentation([SIMPLE_DOC], 'jsdoc')
    expect(out).toMatch(/^\/\*\*/)
  })

  it('separates multiple docs with a divider in markdown', () => {
    const doc2 = { ...SIMPLE_DOC, name: 'farewell' }
    const out = generateDocumentation([SIMPLE_DOC, doc2], 'markdown')
    expect(out).toContain('---')
    expect(out).toContain('`farewell`')
  })
})

// ── assessQuality ─────────────────────────────────────────────────────────────

describe('assessQuality', () => {
  it('gives a passing score for a well-documented entity', () => {
    const report = assessQuality(SIMPLE_DOC)
    expect(report.score).toBeGreaterThanOrEqual(85)
    expect(report.pass).toBe(true)
  })

  it('penalises missing description', () => {
    const doc = { ...SIMPLE_DOC, description: '' }
    const report = assessQuality(doc)
    expect(report.score).toBeLessThan(85)
    expect(report.issues.some((i) => i.field === 'description')).toBe(true)
  })

  it('penalises very short description', () => {
    const doc = { ...SIMPLE_DOC, description: 'Greets.' }
    const report = assessQuality(doc)
    expect(report.issues.some((i) => i.field === 'description' && i.severity === 'warning')).toBe(true)
  })

  it('flags params with no description', () => {
    const doc: ExtractedDoc = {
      ...SIMPLE_DOC,
      params: [{ name: 'x', type: 'number', description: '', optional: false }],
    }
    const report = assessQuality(doc)
    expect(report.issues.some((i) => i.field === 'params')).toBe(true)
  })

  it('flags missing @returns for non-void functions', () => {
    const doc = { ...SIMPLE_DOC, returns: null }
    const report = assessQuality(doc)
    expect(report.issues.some((i) => i.field === 'returns')).toBe(true)
  })

  it('does not flag missing @returns for void functions', () => {
    const doc: ExtractedDoc = {
      ...SIMPLE_DOC,
      returns: null,
      signature: 'function doStuff(): void',
    }
    const report = assessQuality(doc)
    expect(report.issues.filter((i) => i.field === 'returns')).toHaveLength(0)
  })

  it('flags missing examples', () => {
    const doc = { ...SIMPLE_DOC, examples: [] }
    const report = assessQuality(doc)
    expect(report.issues.some((i) => i.field === 'examples')).toBe(true)
  })

  it('score is always between 0 and 100', () => {
    const emptyDoc: ExtractedDoc = {
      name: 'x',
      type: 'function',
      description: '',
      params: [],
      returns: null,
      throws: [],
      examples: [],
      deprecated: false,
      tags: {},
      signature: 'function x(): string',
    }
    const report = assessQuality(emptyDoc)
    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
  })
})

// ── assessCollectionQuality ───────────────────────────────────────────────────

describe('assessCollectionQuality', () => {
  it('returns zeroes for an empty array', () => {
    const result = assessCollectionQuality([])
    expect(result.averageScore).toBe(0)
    expect(result.passRate).toBe(0)
    expect(result.reports).toEqual({})
  })

  it('returns a report for each doc', () => {
    const docs = [SIMPLE_DOC, { ...SIMPLE_DOC, name: 'farewell' }]
    const result = assessCollectionQuality(docs)
    expect(Object.keys(result.reports)).toHaveLength(2)
  })

  it('computes averageScore correctly', () => {
    const docs = [SIMPLE_DOC, { ...SIMPLE_DOC, name: 'farewell' }]
    const result = assessCollectionQuality(docs)
    expect(result.averageScore).toBeGreaterThan(0)
    expect(result.averageScore).toBeLessThanOrEqual(100)
  })

  it('computes passRate as a percentage', () => {
    const docs = [SIMPLE_DOC, { ...SIMPLE_DOC, name: 'empty', description: '' }]
    const result = assessCollectionQuality(docs)
    expect(result.passRate).toBeGreaterThanOrEqual(0)
    expect(result.passRate).toBeLessThanOrEqual(100)
  })
})

// ── detectSyncDrift ───────────────────────────────────────────────────────────

describe('detectSyncDrift', () => {
  it('reports inSync when current and previous are identical', () => {
    const result = detectSyncDrift([SIMPLE_DOC], [SIMPLE_DOC])
    expect(result.inSync).toBe(true)
    expect(result.added).toHaveLength(0)
    expect(result.removed).toHaveLength(0)
    expect(result.changed).toHaveLength(0)
  })

  it('reports added when a doc exists in current but not previous', () => {
    const result = detectSyncDrift([SIMPLE_DOC], [])
    expect(result.inSync).toBe(false)
    expect(result.added).toContain('greet')
  })

  it('reports removed when a doc exists in previous but not current', () => {
    const result = detectSyncDrift([], [SIMPLE_DOC])
    expect(result.inSync).toBe(false)
    expect(result.removed).toContain('greet')
  })

  it('reports changed when the description changes', () => {
    const updated = { ...SIMPLE_DOC, description: 'Updated description text here.' }
    const result = detectSyncDrift([updated], [SIMPLE_DOC])
    expect(result.inSync).toBe(false)
    expect(result.changed).toContain('greet')
  })

  it('reports changed when the signature changes', () => {
    const updated = { ...SIMPLE_DOC, signature: 'function greet(name: string, locale: string): string' }
    const result = detectSyncDrift([updated], [SIMPLE_DOC])
    expect(result.changed).toContain('greet')
  })

  it('reports changed when param count changes', () => {
    const updated = {
      ...SIMPLE_DOC,
      params: [
        ...SIMPLE_DOC.params,
        { name: 'locale', type: 'string', description: 'Locale code', optional: true },
      ],
    }
    const result = detectSyncDrift([updated], [SIMPLE_DOC])
    expect(result.changed).toContain('greet')
  })
})

// ── generateNLDescription ─────────────────────────────────────────────────────

describe('generateNLDescription', () => {
  it('generates a readable description from a camelCase name', () => {
    const desc = generateNLDescription('getUserById')
    expect(desc).toContain('Retrieves')
    expect(desc.toLowerCase()).toContain('user')
    expect(desc.toLowerCase()).toContain('by')
    expect(desc.toLowerCase()).toContain('id')
  })

  it('handles known verb prefixes', () => {
    expect(generateNLDescription('fetchTransactions')).toContain('Fetches')
    expect(generateNLDescription('createAccount')).toContain('Creates')
    expect(generateNLDescription('validateInput')).toContain('Validates')
    expect(generateNLDescription('generateReport')).toContain('Generates')
    expect(generateNLDescription('parseSource')).toContain('Parses')
    expect(generateNLDescription('renderMarkdown')).toContain('Renders')
    expect(generateNLDescription('detectDrift')).toContain('Detects')
  })

  it('capitalises unknown verbs and appends s', () => {
    const desc = generateNLDescription('frobnicateWidget')
    expect(desc).toMatch(/^Frobnicate/)
  })

  it('handles single-word names', () => {
    const desc = generateNLDescription('connect')
    expect(desc).toContain('Connects')
  })

  it('ends with a full stop', () => {
    expect(generateNLDescription('getUser')).toMatch(/\.$/)
    expect(generateNLDescription('fetchData')).toMatch(/\.$/)
  })
})

// ── enhanceDescriptions ───────────────────────────────────────────────────────

describe('enhanceDescriptions', () => {
  it('fills in missing descriptions using NL generation', () => {
    const doc: ExtractedDoc = { ...SIMPLE_DOC, description: '' }
    const [enhanced] = enhanceDescriptions([doc])
    expect(enhanced.description.length).toBeGreaterThan(0)
  })

  it('fills in very short descriptions', () => {
    const doc: ExtractedDoc = { ...SIMPLE_DOC, description: 'Ok' }
    const [enhanced] = enhanceDescriptions([doc])
    expect(enhanced.description).not.toBe('Ok')
  })

  it('leaves adequate descriptions unchanged', () => {
    const [enhanced] = enhanceDescriptions([SIMPLE_DOC])
    expect(enhanced.description).toBe(SIMPLE_DOC.description)
  })

  it('does not mutate the original array', () => {
    const original = { ...SIMPLE_DOC, description: '' }
    enhanceDescriptions([original])
    expect(original.description).toBe('')
  })
})

// ── runDocPipeline ────────────────────────────────────────────────────────────

describe('runDocPipeline', () => {
  it('returns docs, documentation string, and quality report', () => {
    const result = runDocPipeline(FULL_SOURCE)
    expect(result.docs).toBeDefined()
    expect(typeof result.documentation).toBe('string')
    expect(result.quality).toBeDefined()
    expect(typeof result.quality.averageScore).toBe('number')
  })

  it('returns non-empty documentation for source with JSDoc', () => {
    const result = runDocPipeline(FULL_SOURCE)
    expect(result.documentation.length).toBeGreaterThan(0)
  })

  it('returns empty documentation for source with no JSDoc', () => {
    const result = runDocPipeline('const x = 1')
    expect(result.documentation).toBe('')
  })

  it('respects the template option', () => {
    const result = runDocPipeline(FULL_SOURCE, { template: 'tsdoc' })
    expect(result.documentation).toMatch(/^\/\*\*/)
  })

  it('quality averageScore is between 0 and 100', () => {
    const result = runDocPipeline(FULL_SOURCE)
    expect(result.quality.averageScore).toBeGreaterThanOrEqual(0)
    expect(result.quality.averageScore).toBeLessThanOrEqual(100)
  })

  it('passes the acceptance criterion: average quality >= 85 for well-documented source', () => {
    const wellDocumented = `
/**
 * Multiplies two numbers and returns the product.
 *
 * @param {number} a - The first factor, a non-zero integer.
 * @param {number} b - The second factor, a non-zero integer.
 * @returns {number} The product of a and b.
 * @example
 * multiply(3, 4) // 12
 */
function multiply(a: number, b: number): number {
  return a * b
}
`
    const result = runDocPipeline(wellDocumented)
    expect(result.quality.averageScore).toBeGreaterThanOrEqual(85)
  })
})
