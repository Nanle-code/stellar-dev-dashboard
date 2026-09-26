/**
 * Generate a CycloneDX or SPDX SBOM for the pnpm dependency tree.
 *
 * Usage:
 *   node scripts/generate-sbom.mjs [--output path] [--format cyclonedx|spdx]
 *
 * Exit codes:
 *   0 — SBOM written successfully
 *   1 — invalid CLI input
 *   2 — unsupported environment (pnpm-lock.yaml missing or unreadable)
 *   3 — generation failed
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const LOCKFILE = 'pnpm-lock.yaml';
const SUPPORTED_FORMATS = new Set(['cyclonedx', 'spdx']);
const DEFAULT_OUTPUT = 'dist/sbom.cyclonedx.json';

function parseArgs(argv) {
  const args = { output: DEFAULT_OUTPUT, format: 'cyclonedx' };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--output') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --output');
      }
      args.output = value;
      i += 1;
      continue;
    }

    if (token === '--format') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --format');
      }
      args.format = value.toLowerCase();
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!SUPPORTED_FORMATS.has(args.format)) {
    throw new Error(`Unsupported format "${args.format}". Use cyclonedx or spdx.`);
  }

  return args;
}

function splitNameVersion(id) {
  // Ids carry a peer suffix, e.g. react@18.3.1(@types/react@18.3.31)
  const base = id.replace(/\(.*\)$/, '');
  const at = base.lastIndexOf('@');
  if (at <= 0) {
    return { name: base, version: null };
  }
  return { name: base.slice(0, at), version: base.slice(at + 1) };
}

function integrityToHex(integrity) {
  const [algorithm, value] = String(integrity).split('-', 2);
  if (!value) {
    return null;
  }
  return { algorithm: algorithm.toUpperCase().replace('SHA', 'SHA-'), hex: Buffer.from(value, 'base64').toString('hex') };
}

/**
 * Read resolved components from the `packages:` block of pnpm-lock.yaml.
 * The block is machine generated and regular: a two-space indented `name@version`
 * key per package, followed by indented metadata.
 */
export function readLockfileComponents(lockfile = LOCKFILE) {
  const lines = readFileSync(lockfile, 'utf8').split(/\r?\n/);
  const components = [];
  let inPackages = false;
  let current = null;

  for (const line of lines) {
    if (/^\S/.test(line)) {
      inPackages = line === 'packages:';
      continue;
    }
    if (!inPackages) {
      continue;
    }

    const key = line.match(/^ {2}(\S.*):$/);
    if (key) {
      const id = key[1].replace(/^'(.*)'$/, '$1');
      const { name, version } = splitNameVersion(id);
      current = { name, version, integrity: null };
      components.push(current);
      continue;
    }

    const resolution = line.match(/^ {4}resolution: \{integrity: ([^}]+)\}/);
    if (resolution && current) {
      current.integrity = resolution[1].trim();
    }
  }

  return components;
}

export function ensureSbomSourceAvailable() {
  return existsSync(LOCKFILE);
}

function toCycloneDx(components) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    components: components.map(({ name, version, integrity }) => {
      const hash = integrityToHex(integrity);
      const component = {
        type: 'library',
        name,
        version,
        purl: `pkg:npm/${name}@${version}`,
      };
      if (hash) {
        component.hashes = [{ alg: hash.algorithm, content: hash.hex }];
      }
      return component;
    }),
  };
}

function toSpdx(components) {
  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: 'stellar-dev-dashboard',
    documentNamespace: `https://github.com/Nanle-code/stellar-dev-dashboard/${Date.now()}`,
    creationInfo: { created: new Date().toISOString() },
    packages: components.map(({ name, version, integrity }) => {
      const hash = integrityToHex(integrity);
      const entry = {
        SPDXID: `SPDXRef-Package-${name.replace(/[^A-Za-z0-9.-]/g, '-')}-${version}`,
        name,
        versionInfo: version,
        downloadLocation: 'NOASSERTION',
        licenseConcluded: 'NOASSERTION',
        licenseDeclared: 'NOASSERTION',
        copyrightText: 'NOASSERTION',
      };
      if (hash) {
        entry.checksums = [{ algorithm: hash.algorithm, checksumValue: hash.hex }];
      }
      return entry;
    }),
  };
}

export function generateSbom(format) {
  if (!ensureSbomSourceAvailable()) {
    throw new Error(`${LOCKFILE} not found — run "pnpm install" before generating an SBOM.`);
  }

  const components = readLockfileComponents();
  if (components.length === 0) {
    throw new Error(`No resolved packages found in ${LOCKFILE}.`);
  }

  return format === 'spdx' ? toSpdx(components) : toCycloneDx(components);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[sbom] ${err.message}`);
    process.exit(1);
  }

  if (!ensureSbomSourceAvailable()) {
    console.error(`[sbom] ${LOCKFILE} is required. Run pnpm install before generating an SBOM.`);
    process.exit(2);
  }

  try {
    const sbom = generateSbom(args.format);
    const outputPath = path.resolve(args.output);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');

    const componentCount = (sbom.components || sbom.packages || []).length;
    console.log(`[sbom] Wrote ${outputPath} (${componentCount} components)`);
  } catch (err) {
    console.error('[sbom] Generation failed:', err.message || err);
    process.exit(3);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { parseArgs, SUPPORTED_FORMATS };
