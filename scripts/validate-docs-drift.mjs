import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const rootPackage = path.join(repoRoot, 'package.json');

/** Documentation roots after #966 consolidation */
const DOCS_ROOTS = [
  path.join(repoRoot, 'docs-site', 'docs'),
  path.join(repoRoot, 'docs'),
];

const externalLinkPattern = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/;
const markdownLinkPattern = /!?\[[^\]]*\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/g;
const npmRunPattern = /(?:npm|pnpm) run\s+([\w:-]+)/g;

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseMarkdownLinks(content) {
  const links = [];
  let match;
  markdownLinkPattern.lastIndex = 0;
  while ((match = markdownLinkPattern.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function parseRunCommands(content) {
  const scripts = [];
  let match;
  npmRunPattern.lastIndex = 0;
  while ((match = npmRunPattern.exec(content)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

function isExternalLink(href) {
  return (
    externalLinkPattern.test(href) ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  );
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveLink(sourceFile, rawHref) {
  const href = rawHref.split('#', 1)[0];
  if (!href || href.startsWith('#')) return null;

  const sourceDir = path.dirname(sourceFile);
  const candidates = [];

  if (!path.isAbsolute(href)) {
    candidates.push(path.join(sourceDir, href));
    const cleaned = href.replace(/^\/*/, '');
    candidates.push(path.join(repoRoot, cleaned));
    if (cleaned.startsWith('docs/')) {
      candidates.push(path.join(repoRoot, cleaned));
    }
    if (cleaned.startsWith('docs-site/')) {
      candidates.push(path.join(repoRoot, cleaned));
    }
  } else {
    candidates.push(path.join(repoRoot, href));
  }

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (await fileExists(normalized)) return normalized;
    if (await fileExists(`\( {normalized}.md`)) return ` \){normalized}.md`;
    if (await fileExists(`\( {normalized}.mdx`)) return ` \){normalized}.mdx`;
    if (await fileExists(path.join(normalized, 'index.md'))) {
      return path.join(normalized, 'index.md');
    }
    if (await fileExists(path.join(normalized, 'README.md'))) {
      return path.join(normalized, 'README.md');
    }
  }
  return null;
}

async function loadPackageScripts() {
  try {
    const pkgJson = JSON.parse(await fs.readFile(rootPackage, 'utf8'));
    return new Set(Object.keys(pkgJson.scripts || {}));
  } catch (error) {
    console.error('Unable to read package.json for script validation:', error.message);
    return new Set();
  }
}

/**
 * Assert root is not polluted with guide Markdown (acceptance for #966).
 */
async function assertRootMarkdownPolicy() {
  const allowed = new Set([
    'readme.md',
    'contributing.md',
    'security.md',
    'code_of_conduct.md',
    'changelog.md',
    'license.md',
  ]);
  const entries = await fs.readdir(repoRoot, { withFileTypes: true });
  const offenders = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md') && !entry.name.endsWith('.mdx')) continue;
    if (!allowed.has(entry.name.toLowerCase())) {
      offenders.push(entry.name);
    }
  }
  return offenders;
}

export async function validateDocsDrift(options = {}) {
  const { checkRootPolicy = true } = options;
  const errors = [];
  const files = [];
  for (const root of DOCS_ROOTS) {
    files.push(...(await collectMarkdownFiles(root)));
  }

  const packageScripts = await loadPackageScripts();

  if (checkRootPolicy) {
    const offenders = await assertRootMarkdownPolicy();
    for (const name of offenders) {
      errors.push({ type: 'root-markdown', file: name });
    }
  }

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    for (const link of parseMarkdownLinks(content)) {
      if (isExternalLink(link) || link.startsWith('#')) continue;
      const resolved = await resolveLink(file, link);
      if (!resolved) {
        errors.push({
          type: 'missing-file',
          file,
          link,
          resolved: path.join(path.dirname(file), link),
        });
      }
    }
    for (const script of parseRunCommands(content)) {
      if (!packageScripts.has(script)) {
        errors.push({ type: 'missing-script', file, script });
      }
    }
  }

  return { files, errors };
}

async function main() {
  const { files, errors } = await validateDocsDrift();

  console.log('=== Documentation Drift Detection ===');
  console.log(`Scanned ${files.length} documentation files under docs-site/docs and docs/.`);

  if (errors.length === 0) {
    console.log('No missing docs links, npm/pnpm scripts, or root Markdown policy violations.');
    process.exit(0);
  }

  console.log();
  for (const error of errors) {
    if (error.type === 'missing-file') {
      console.log(
        `ERROR: File not found: "${error.link}" (resolved: ${error.resolved}) — referenced from ${path.relative(repoRoot, error.file)}`,
      );
    } else if (error.type === 'missing-script') {
      console.log(
        `ERROR: Script not found: "run ${error.script}" — referenced from ${path.relative(repoRoot, error.file)}`,
      );
    } else if (error.type === 'root-markdown') {
      console.log(
        `ERROR: Root Markdown not allowed: "${error.file}" — move into docs-site/docs/ (see #966)`,
      );
    }
  }
  console.log();
  console.log(`Errors: ${errors.length}`);
  process.exit(1);
}

const isMain =
  process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;

if (isMain) {
  main().catch((error) => {
    console.error('Unexpected error during docs drift validation:', error);
    process.exit(1);
  });
}
