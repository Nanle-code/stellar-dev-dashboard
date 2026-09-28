import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(repoRoot, 'docs');
const rootPackage = path.join(repoRoot, 'package.json');

const externalLinkPattern = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/;
const markdownLinkPattern = /!?\[[^\]]*\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/g;
const npmRunPattern = /npm run\s+([\w:-]+)/g;

async function collectMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseMarkdownLinks(content) {
  const links = [];
  let match;
  while ((match = markdownLinkPattern.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function parseNpmRunCommands(content) {
  const scripts = [];
  let match;
  while ((match = npmRunPattern.exec(content)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

function isExternalLink(href) {
  return externalLinkPattern.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
}

function normalizeLinkHref(href) {
  return href.replace(/^\.+\//, '').replace(/#.*$/, '');
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
  if (!href || href.startsWith('#')) {
    return null;
  }

  const candidates = [];
  const isAbsoluteDocs = href.startsWith('docs/') || href.startsWith('/docs/') || href.startsWith('./docs/') || href.startsWith('../docs/');

  const sourceDir = path.dirname(sourceFile);
  const referenced = path.normalize(href);

  if (!path.isAbsolute(referenced)) {
    candidates.push(path.join(sourceDir, referenced));
    if (isAbsoluteDocs) {
      const relativeToRoot = path.join(repoRoot, referenced.replace(/^\/*/, ''));
      candidates.push(relativeToRoot);
    }
  } else {
    candidates.push(path.join(repoRoot, referenced));
  }

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (await fileExists(normalized)) return normalized;
    const withMd = `${normalized}.md`;
    const withMdx = `${normalized}.mdx`;
    const indexMd = path.join(normalized, 'index.md');
    const readmeMd = path.join(normalized, 'README.md');
    if (await fileExists(withMd)) return withMd;
    if (await fileExists(withMdx)) return withMdx;
    if (await fileExists(indexMd)) return indexMd;
    if (await fileExists(readmeMd)) return readmeMd;
  }

  return null;
}

async function loadPackageScripts() {
  try {
    const pkgJson = JSON.parse(await fs.readFile(rootPackage, 'utf8'));
    return new Set(Object.keys(pkgJson.scripts || {}));
  } catch (error) {
    console.error('Unable to read package.json for npm script validation:', error.message);
    return new Set();
  }
}

async function main() {
  const files = await collectMarkdownFiles(docsRoot);
  const packageScripts = await loadPackageScripts();
  const errors = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const links = parseMarkdownLinks(content);
    for (const link of links) {
      if (isExternalLink(link) || link.startsWith('#')) continue;
      const resolved = await resolveLink(file, link);
      if (!resolved) {
        errors.push({ type: 'missing-file', file, link, resolved: path.join(path.dirname(file), link) });
      }
    }

    const scripts = parseNpmRunCommands(content);
    for (const script of scripts) {
      if (!packageScripts.has(script)) {
        errors.push({ type: 'missing-script', file, script });
      }
    }
  }

  if (errors.length === 0) {
    console.log('=== Documentation Drift Detection ===');
    console.log(`Scanned ${files.length} documentation files.`);
    console.log('No missing docs links or npm scripts were found.');
    process.exit(0);
  }

  console.log('=== Documentation Drift Detection ===');
  console.log(`Scanned ${files.length} documentation files.`);
  console.log();
  for (const error of errors) {
    if (error.type === 'missing-file') {
      console.log(`ERROR: File not found: "${error.link}" (resolved: ${error.resolved}) â€” referenced from ${path.relative(repoRoot, error.file)}`);
    } else if (error.type === 'missing-script') {
      console.log(`ERROR: Script not found: "npm run ${error.script}" â€” referenced from ${path.relative(repoRoot, error.file)}`);
    }
  }
  console.log();
  console.log(`Errors: ${errors.length}`);
  process.exit(1);
}

main().catch((error) => {
  console.error('Unexpected error during docs drift validation:', error);
  process.exit(1);
});
