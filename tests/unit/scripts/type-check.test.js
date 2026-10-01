// tests/unit/scripts/type-check.test.js
// Run with: node --test tests/unit/scripts/type-check.test.js
// (vitest excludes tests/ci/**, and .mjs scripts are tested via node --test)
import assert from 'node:assert/strict'
import test from 'node:test'

import * as typeCheck from '../../../scripts/type-check.mjs'

const {
  main,
  resetOptions,
  EXIT_PASS,
  EXIT_SCRIPT_ERROR,
  validateNodeVersion,
  findTsc,
} = typeCheck

test('type-check.mjs CLI', async (t) => {
  await t.test('--help exits with code 0', () => {
    resetOptions()
    assert.strictEqual(main(['--help']), EXIT_PASS)
  })

  await t.test('unknown option exits with code 2', () => {
    resetOptions()
    assert.strictEqual(main(['--bogus']), EXIT_SCRIPT_ERROR)
  })

  await t.test('rejects unsupported Node.js version', () => {
    const result = validateNodeVersion('16.0.0')
    assert.strictEqual(result.ok, false)
    assert.match(result.message, /Minimum supported version is 18/)
  })

  await t.test('accepts the minimum supported Node.js version', () => {
    const result = validateNodeVersion('18.0.0')
    assert.strictEqual(result.ok, true)
  })

  await t.test('primary flow: --dry-run returns exit 0', () => {
    resetOptions()
    assert.strictEqual(main(['--dry-run']), EXIT_PASS)
  })

  await t.test('failure path: missing tsconfig returns exit 2', () => {
    resetOptions()
    assert.strictEqual(main(['--project=does-not-exist.json']), EXIT_SCRIPT_ERROR)
  })

  await t.test('failure path: missing tsc returns exit 2', () => {
    const result = findTsc(() => false)
    assert.strictEqual(result.ok, false)
    assert.match(result.message, /tsc/)
  })
})