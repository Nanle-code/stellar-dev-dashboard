#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { generateMarkdownFromPayload, generateAndSave } from '../src/lib/contractDocs.js';

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: generate-contract-docs.mjs <contractId|payload.json> [network] [outPath]');
    process.exit(2);
  }

  const first = argv[0];
  const network = argv[1] || 'testnet';
  const outPath = argv[2] || null;

  // If first looks like a JSON file path, load payload
  if (first.endsWith('.json') && fs.existsSync(first)) {
    const raw = fs.readFileSync(first, 'utf8');
    const payload = JSON.parse(raw);
    const md = generateMarkdownFromPayload(payload);
    if (outPath) fs.writeFileSync(outPath, md, 'utf8');
    else console.log(md);
    return;
  }

  // Otherwise, treat as a contractId and fetch via parseContractWasm
  try {
    const filename = await generateAndSave(first, network, outPath);
    console.log(`Generated documentation at ${filename}`);
  } catch (err) {
    console.error('Failed to generate docs:', err?.message || String(err));
    process.exit(1);
  }
}

main();
