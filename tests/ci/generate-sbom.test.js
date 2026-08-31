/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  generateSbom,
  ensureNpmSbomAvailable,
  SUPPORTED_FORMATS,
} from '../../scripts/generate-sbom.mjs';

describe('generate-sbom script', () => {
  it('parses default output and format', () => {
    const args = parseArgs([]);
    expect(args.output).toBe('dist/sbom.cyclonedx.json');
    expect(args.format).toBe('cyclonedx');
  });

  it('accepts explicit output and format flags', () => {
    const args = parseArgs(['--output', 'tmp/custom.json', '--format', 'spdx']);
    expect(args.output).toBe('tmp/custom.json');
    expect(args.format).toBe('spdx');
  });

  it('rejects unsupported formats', () => {
    expect(() => parseArgs(['--format', 'invalid'])).toThrow(/unsupported format/i);
  });

  it('generates a CycloneDX document when npm sbom is available', () => {
    if (!ensureNpmSbomAvailable()) {
      expect(SUPPORTED_FORMATS.has('cyclonedx')).toBe(true);
      return;
    }

    const sbom = generateSbom('cyclonedx');
    expect(sbom).toBeTypeOf('object');
    expect(sbom.bomFormat || sbom.specVersion || sbom.components).toBeTruthy();
  });

  it('fails fast on unknown CLI arguments', () => {
    expect(() => parseArgs(['--unexpected'])).toThrow(/unknown argument/i);
  });
});
