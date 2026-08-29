import { describe, it, expect } from 'vitest'
import { stroopsToXLM, xlmToStroops, formatStroops, parseStroops, STROOPS_PER_XLM } from '../stroopConversion'

describe('stroopConversion', () => {
  it('converts stroops to XLM string with 7 decimal places', () => {
    expect(stroopsToXLM(15000000)).toBe('1.5000000')
  })

  it('converts 1 stroop to XLM', () => {
    expect(stroopsToXLM(1n)).toBe('0.0000001')
  })

  it('converts XLM string to stroops bigint', () => {
    expect(xlmToStroops('1')).toBe(10000000n)
  })

  it('converts 0.0000001 XLM to stroops', () => {
    expect(xlmToStroops('0.0000001')).toBe(1n)
  })

  it('formats stroops as "X.X XLM (Y stroops)"', () => {
    expect(formatStroops(15000000n)).toBe('1.5000000 XLM (15,000,000 stroops)')
  })

  it('parses "1.5 XLM" into stroops', () => {
    expect(parseStroops('1.5 XLM')).toBe(15000000n)
  })

  it('parses "15000000" into stroops', () => {
    expect(parseStroops('15000000')).toBe(15000000n * STROOPS_PER_XLM)
  })

  it('handles maximum valid XLM value (max supply)', () => {
    const maxXlm = '100000000000'
    expect(xlmToStroops(maxXlm)).toBe(100000000000n * STROOPS_PER_XLM)
    expect(stroopsToXLM(100000000000n * STROOPS_PER_XLM)).toBe(maxXlm)
  })

  it('throws on invalid string input', () => {
    expect(() => xlmToStroops('abc')).toThrow('Invalid XLM value: "abc" is not numeric')
  })

  it('throws on negative values', () => {
    expect(() => stroopsToXLM(-1n)).toThrow('Stroop value cannot be negative')
  })

  it('throws on too many decimal places', () => {
    expect(() => xlmToStroops('0.00000001')).toThrow('has more than 7 decimal places')
  })

  it('throws on invalid stroops format', () => {
    expect(() => parseStroops('invalid')).toThrow('Invalid stroops format')
  })
})
