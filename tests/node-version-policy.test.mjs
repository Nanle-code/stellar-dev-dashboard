import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_NODE_MAJOR,
  MIN_NODE_MAJOR,
  assertSupportedNode,
  parseNodeMajor,
} from '../scripts/node-version-policy.mjs'

test('accepts the minimum and current supported Node releases', () => {
  assert.equal(assertSupportedNode(`v${MIN_NODE_MAJOR}.0.0`), MIN_NODE_MAJOR)
  assert.equal(assertSupportedNode(`${MAX_NODE_MAJOR}.99.1`), MAX_NODE_MAJOR)
})

test('accepts an intermediate supported LTS release', () => {
  assert.equal(assertSupportedNode('24.1.0'), 24)
})

test('rejects releases outside the published support range', () => {
  assert.throws(() => assertSupportedNode('v21.9.0'), RangeError)
  assert.throws(() => assertSupportedNode('27.0.0'), RangeError)
})

test('rejects malformed version input', () => {
  assert.throws(() => parseNodeMajor('current'), TypeError)
  assert.throws(() => parseNodeMajor(''), TypeError)
})
