import fs from 'node:fs';
import path from 'node:path';

export const BASELINE_STRICT_ALLOWLIST = [
  'src/lib/stellar',
  'src/design-system',
  'src/types',
];

export function normalizeAllowlistEntry(entry) {
  return String(entry)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
}

export function validateStrictAllowlist(currentAllowlist, baselineAllowlist = BASELINE_STRICT_ALLOWLIST) {
  const normalizedCurrent = (currentAllowlist ?? []).map(normalizeAllowlistEntry);
  const normalizedBaseline = baselineAllowlist.map(normalizeAllowlistEntry);

  const hasDirectory = (entry, directory) =>
    entry === directory || entry.startsWith(`${directory}/`) || entry.startsWith(`${directory}.`);

  const missing = normalizedBaseline.filter((directory) =>
    !normalizedCurrent.some((entry) => hasDirectory(entry, directory))
  );

  if (missing.length > 0) {
    throw new Error(
      `Strict allowlist regression: missing required baseline directories: ${missing.join(', ')}. ` +
        'The strict allowlist must only grow; existing approved directories cannot be removed.'
    );
  }

  return normalizedCurrent;
}

function main() {
  const configPath = path.resolve(process.cwd(), 'tsconfig.strict.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  const allowlist = Array.isArray(config.files)
    ? config.files
    : Array.isArray(config.include)
      ? config.include
      : [];

  const validated = validateStrictAllowlist(allowlist, BASELINE_STRICT_ALLOWLIST);
  console.log(`Strict TypeScript allowlist OK (${validated.length} entries).`);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  main();
}
