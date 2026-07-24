import type { BytecodeDiffResult, SectionDiff } from './types';

const WASM_SECTIONS: Record<number, string> = {
  0: 'Custom',
  1: 'Type',
  2: 'Import',
  3: 'Function',
  4: 'Table',
  5: 'Memory',
  6: 'Global',
  7: 'Export',
  8: 'Start',
  9: 'Element',
  10: 'Code',
  11: 'Data',
  12: 'DataCount',
};

function parseWasmSections(bytes: Uint8Array): Map<string, Uint8Array> {
  const sections = new Map<string, Uint8Array>();
  if (bytes.length < 8) return sections;

  let offset = 8;
  while (offset < bytes.length) {
    const sectionId = bytes[offset];
    offset++;

    const { value: sectionSize, bytesRead } = readLEB128(bytes, offset);
    offset += bytesRead;

    const start = offset;
    const end = Math.min(offset + Number(sectionSize), bytes.length);
    const sectionBytes = bytes.slice(start, end);

    const name = WASM_SECTIONS[sectionId] ?? `Section_${sectionId}`;
    sections.set(name, sectionBytes);

    offset = end;
  }

  return sections;
}

function readLEB128(bytes: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < bytes.length) {
    const byte = bytes[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return { value: result, bytesRead };
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let dist = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const byteA = i < a.length ? a[i] : 0;
    const byteB = i < b.length ? b[i] : 0;
    let xor = byteA ^ byteB;
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

function levenshteinSimilarity(a: Uint8Array, b: Uint8Array): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;

  const maxLen = Math.max(lenA, lenB);
  const limitedA = lenA > 1024 ? a.slice(0, 1024) : a;
  const limitedB = lenB > 1024 ? b.slice(0, 1024) : b;
  const lA = limitedA.length;
  const lB = limitedB.length;

  let prev = new Array<number>(lB + 1);
  let curr = new Array<number>(lB + 1);

  for (let j = 0; j <= lB; j++) prev[j] = j;

  for (let i = 1; i <= lA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lB; j++) {
      const cost = limitedA[i - 1] === limitedB[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  const editDistance = prev[lB];
  return 1 - editDistance / maxLen;
}

export function analyzeBytecodeDiff(
  beforeBytes: Uint8Array,
  afterBytes: Uint8Array,
): BytecodeDiffResult {
  const beforeSections = parseWasmSections(beforeBytes);
  const afterSections = parseWasmSections(afterBytes);

  const allSectionNames = new Set([...beforeSections.keys(), ...afterSections.keys()]);
  const sectionDiffs: SectionDiff[] = [];

  let totalChanged = 0;

  for (const sectionName of allSectionNames) {
    const beforeSection = beforeSections.get(sectionName) ?? new Uint8Array(0);
    const afterSection = afterSections.get(sectionName) ?? new Uint8Array(0);

    if (beforeSection.length === 0 || afterSection.length === 0) {
      const changed = Math.max(beforeSection.length, afterSection.length);
      totalChanged += changed;
      sectionDiffs.push({
        sectionName,
        bytesChanged: changed,
        percentageChanged: 100,
      });
      continue;
    }

    const dist = hammingDistance(beforeSection, afterSection);
    if (dist > 0) {
      const maxLen = Math.max(beforeSection.length, afterSection.length);
      totalChanged += dist;
      sectionDiffs.push({
        sectionName,
        bytesChanged: dist,
        percentageChanged: Math.round((dist / maxLen) * 100),
      });
    }
  }

  const similarityScore = beforeBytes.length === 0 && afterBytes.length === 0
    ? 1
    : levenshteinSimilarity(beforeBytes, afterBytes);

  return {
    totalBytesChanged: totalChanged,
    sizeChange: { before: beforeBytes.length, after: afterBytes.length },
    similarityScore: Math.round(similarityScore * 100) / 100,
    sectionDiffs: sectionDiffs.filter((d) => d.bytesChanged > 0),
  };
}
