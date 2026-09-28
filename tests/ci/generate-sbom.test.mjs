import { describe, it, expect } from 'vitest';
import * as sbom from '../../scripts/generate-sbom.mjs';

describe('generate-sbom script', () => {
  it('parses default output and format', () => {
    const args = sbom.parseArgs([]);
    expect(args.output).toBe('dist/sbom.cyclonedx.json');
    expect(args.format).toBe('cyclonedx');
  });

  it('accepts explicit output and format flags', () => {
    const args = sbom.parseArgs(['--output', 'tmp/custom.json', '--format', 'spdx']);
    expect(args.output).toBe('tmp/custom.json');
    expect(args.format).toBe('spdx');
  });

  it('rejects unsupported formats', () => {
    expect(() => sbom.parseArgs(['--format', 'invalid'])).toThrow(/unsupported format/i);
  });

  it('generates a CycloneDX document from pnpm-lock.yaml', () => {
    if (!sbom.ensureSbomSourceAvailable()) {
      expect(sbom.SUPPORTED_FORMATS.has('cyclonedx')).toBe(true);
      return;
    }

    const result = sbom.generateSbom('cyclonedx');
    expect(result.bomFormat).toBe('CycloneDX');
    expect(result.components.length).toBeGreaterThan(0);
    expect(result.components[0]).toMatchObject({
      type: 'library',
      purl: expect.stringMatching(/^pkg:npm\/.+@.+$/),
    });
  });

  it('generates an SPDX document from pnpm-lock.yaml', () => {
    if (!sbom.ensureSbomSourceAvailable()) {
      return;
    }

    const result = sbom.generateSbom('spdx');
    expect(result.spdxVersion).toBe('SPDX-2.3');
    expect(result.packages.length).toBeGreaterThan(0);
  });

  it('fails fast on unknown CLI arguments', () => {
    expect(() => sbom.parseArgs(['--unexpected'])).toThrow(/unknown argument/i);
  });
});
