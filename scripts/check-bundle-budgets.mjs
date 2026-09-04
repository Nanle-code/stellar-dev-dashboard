#!/usr/bin/env node
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_ASSETS = join(ROOT, 'dist', 'assets');

// Budgets in KB (compressed)
const BUDGETS = {
  'vendor': 500,
  'react-vendor': 200,
  'charts-vendor': 350,
  'stellar-sdk': 400,
  'index': 100, // Initial shell
  'default': 150 // Route chunks / lazy chunks
};

function checkBudgets() {
  console.log('Checking bundle budgets...');
  
  try {
    const files = readdirSync(DIST_ASSETS).filter(f => f.endsWith('.js'));
    let hasFailures = false;

    for (const file of files) {
      const filePath = join(DIST_ASSETS, file);
      const content = readFileSync(filePath);
      const gzipped = zlib.gzipSync(content);
      const sizeKB = gzipped.length / 1024;

      // Extract chunk name: chunkName-[hash].js (Vite uses base62 hashes)
      const chunkNameMatch = file.match(/^(.+)-[0-9a-zA-Z_-]+\.js$/);
      const chunkName = chunkNameMatch ? chunkNameMatch[1] : 'unknown';

      const budget = BUDGETS[chunkName] || BUDGETS['default'];

      if (sizeKB > budget) {
        console.error(`❌ Budget Exceeded: ${file} is ${sizeKB.toFixed(2)} KB (Limit: ${budget} KB)`);
        hasFailures = true;
      } else {
        console.log(`✅ ${file}: ${sizeKB.toFixed(2)} KB (Limit: ${budget} KB)`);
      }
    }

    if (hasFailures) {
      console.error('\nBundle budget check failed. Please optimize your imports.');
      process.exit(1);
    } else {
      console.log('\nAll bundle budgets passed!');
    }
  } catch (error) {
    console.error('Failed to analyze bundles:', error);
    process.exit(1);
  }
}

checkBudgets();
