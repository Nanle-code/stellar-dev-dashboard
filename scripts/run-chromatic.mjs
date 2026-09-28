#!/usr/bin/env node
/**
 * Optional Chromatic visual regression for Storybook components.
 * Skips gracefully when CHROMATIC_PROJECT_TOKEN is not set.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const token = process.env.CHROMATIC_PROJECT_TOKEN;

if (!token) {
  console.log(
    'CHROMATIC_PROJECT_TOKEN not set — skipping Chromatic visual tests.\n' +
      'Playwright visual regression (pnpm run test:visual) is the primary visual test runner.'
  );
  process.exit(0);
}

if (!existsSync('.storybook')) {
  console.error('Storybook config not found.');
  process.exit(1);
}

console.log('Building Storybook and running Chromatic...');
execSync('pnpm run build-storybook', { stdio: 'inherit' });
execSync(
  `pnpm exec chromatic --project-token="${token}" --storybook-build-dir=storybook-static --exit-zero-on-changes`,
  { stdio: 'inherit' }
);
