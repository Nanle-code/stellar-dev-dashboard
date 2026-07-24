import { describe, it, expect } from 'vitest';
import { analyzeBytecodeDiff } from '../bytecodeDiffAnalyzer';

function makeWasm(sections: Record<number, number[]>): Uint8Array {
  const parts: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  for (const [id, data] of Object.entries(sections)) {
    const sectionId = Number(id);
    parts.push(sectionId);
    let size = data.length;
    while (size > 0x7f) {
      parts.push((size & 0x7f) | 0x80);
      size >>= 7;
    }
    parts.push(size);
    parts.push(...data);
  }

  return new Uint8Array(parts);
}

describe('analyzeBytecodeDiff', () => {
  it('reports perfect similarity for identical WASM', () => {
    const wasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const result = analyzeBytecodeDiff(wasm, wasm);
    expect(result.similarityScore).toBe(1);
    expect(result.totalBytesChanged).toBe(0);
    expect(result.sizeChange).toEqual({ before: wasm.length, after: wasm.length });
  });

  it('detects changes in WASM sections', () => {
    const before = makeWasm({ 1: [0x01, 0x02], 10: [0x03, 0x04, 0x05] });
    const after = makeWasm({ 1: [0x01, 0x02], 10: [0x03, 0x04, 0x99] });

    const result = analyzeBytecodeDiff(before, after);
    expect(result.similarityScore).toBeLessThan(1);
    expect(result.totalBytesChanged).toBeGreaterThan(0);
    expect(result.sectionDiffs.some((d) => d.sectionName === 'Code')).toBe(true);
  });

  it('handles completely empty inputs', () => {
    const result = analyzeBytecodeDiff(new Uint8Array(0), new Uint8Array(0));
    expect(result.similarityScore).toBe(1);
    expect(result.totalBytesChanged).toBe(0);
  });

  it('handles different-sized bytecodes', () => {
    const before = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    const after = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x02, 0x03, 0x04]);

    const result = analyzeBytecodeDiff(before, after);
    expect(result.sizeChange.before).toBe(4);
    expect(result.sizeChange.after).toBe(8);
    expect(result.similarityScore).toBeGreaterThan(0);
    expect(result.similarityScore).toBeLessThanOrEqual(1);
  });

  it('detects added and removed sections', () => {
    const before = makeWasm({ 1: [0x01] });
    const after = makeWasm({ 1: [0x01], 11: [0x02, 0x03] });

    const result = analyzeBytecodeDiff(before, after);
    expect(result.sectionDiffs.some((d) => d.sectionName === 'Data')).toBe(true);
  });

  it('returns low similarity for completely different bytecodes', () => {
    const before = makeWasm({ 10: new Array(64).fill(0x00) });
    const after = makeWasm({ 10: new Array(64).fill(0xff) });

    const result = analyzeBytecodeDiff(before, after);
    expect(result.similarityScore).toBeLessThan(0.5);
    expect(result.totalBytesChanged).toBeGreaterThan(0);
  });
});
