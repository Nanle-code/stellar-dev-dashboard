/**
 * Sample dependency inputs for Intelligent Dependency Management (#602).
 * Mirrors this repo's direct dependencies plus intentional vulnerable /
 * conflicting packages so the dashboard can demonstrate real analysis offline.
 */

import type {
  LockfilePackage,
  NpmAuditReport,
  PackageManifest,
  RegistryMeta,
} from '../lib/dependencyManagement'

export const SAMPLE_MANIFEST: PackageManifest = {
  name: 'stellar-dev-dashboard',
  version: '0.1.0',
  dependencies: {
    '@stellar/stellar-sdk': '^12.3.0',
    react: '^18.3.0',
    'react-dom': '^18.3.0',
    'react-router-dom': '^6.30.4',
    zustand: '^4.5.4',
    recharts: '^2.12.7',
    axios: '1.4.0',
    lodash: '4.17.20',
    ws: '8.11.0',
    express: '^4.18.2',
  },
  devDependencies: {
    vite: '^5.4.0',
    vitest: '^2.0.0',
    typescript: '^5.5.0',
  },
}

export const SAMPLE_LOCK_PACKAGES: LockfilePackage[] = [
  { name: '@stellar/stellar-sdk', version: '12.3.0' },
  { name: 'react', version: '18.3.1' },
  { name: 'react-dom', version: '18.3.1' },
  { name: 'react-router-dom', version: '6.30.4' },
  { name: 'zustand', version: '4.5.4' },
  { name: 'recharts', version: '2.12.7' },
  { name: 'axios', version: '1.4.0' },
  { name: 'lodash', version: '4.17.20' },
  { name: 'ws', version: '8.11.0' },
  { name: 'express', version: '4.18.2' },
  { name: 'vite', version: '5.4.0' },
  { name: 'vitest', version: '2.0.0' },
  { name: 'typescript', version: '5.5.0' },
  // Conflicting transitive copies of semver
  {
    name: 'semver',
    version: '6.3.1',
    requiredBy: [
      { parent: 'vite', range: '^6.0.0' },
      { parent: 'npm- Bundled', range: '^6.3.0' },
    ],
  },
  {
    name: 'semver',
    version: '7.5.1',
    requiredBy: [{ parent: 'vitest', range: '^7.0.0' }],
  },
  // Unsatisfied peer-style conflict
  {
    name: 'path-to-regexp',
    version: '0.1.7',
    requiredBy: [
      { parent: 'express', range: '0.1.7' },
      { parent: 'router', range: '>=0.1.12' },
    ],
  },
]

export const SAMPLE_REGISTRY: RegistryMeta[] = [
  { name: '@stellar/stellar-sdk', latestVersion: '12.3.1', license: 'Apache-2.0' },
  { name: 'react', latestVersion: '18.3.1', license: 'MIT' },
  { name: 'react-dom', latestVersion: '18.3.1', license: 'MIT' },
  { name: 'react-router-dom', latestVersion: '6.30.4', license: 'MIT' },
  { name: 'zustand', latestVersion: '4.5.5', license: 'MIT' },
  { name: 'recharts', latestVersion: '2.15.0', license: 'MIT' },
  { name: 'axios', latestVersion: '1.7.9', license: 'MIT' },
  { name: 'lodash', latestVersion: '4.17.21', license: 'MIT' },
  { name: 'ws', latestVersion: '8.18.0', license: 'MIT' },
  { name: 'express', latestVersion: '4.21.2', license: 'MIT' },
  { name: 'vite', latestVersion: '5.4.11', license: 'MIT' },
  { name: 'vitest', latestVersion: '2.1.8', license: 'MIT' },
  { name: 'typescript', latestVersion: '5.7.2', license: 'Apache-2.0' },
  { name: 'semver', latestVersion: '7.6.3', license: 'ISC' },
  { name: 'path-to-regexp', latestVersion: '0.1.12', license: 'MIT' },
]

/** Minimal npm-audit shaped report covering known vulnerable sample packages. */
export const SAMPLE_AUDIT: NpmAuditReport = {
  vulnerabilities: {
    lodash: {
      name: 'lodash',
      severity: 'high',
      via: [
        {
          source: 1065,
          name: 'lodash',
          title: 'Command Injection in lodash',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-35jh-r3h4-6jhm',
          range: '<4.17.21',
        },
      ],
      range: '<4.17.21',
      fixAvailable: { name: 'lodash', version: '4.17.21', isSemVerMajor: false },
    },
    axios: {
      name: 'axios',
      severity: 'high',
      via: [
        {
          source: 2304,
          name: 'axios',
          title: 'Axios Cross-Site Request Forgery Vulnerability',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-wf5p-g6vw-rhxx',
          range: '>=0.8.1 <1.6.0',
        },
      ],
      range: '>=0.8.1 <1.6.0',
      fixAvailable: { name: 'axios', version: '1.7.9', isSemVerMajor: false },
    },
    ws: {
      name: 'ws',
      severity: 'high',
      via: [
        {
          source: 1097683,
          name: 'ws',
          title: 'ws affected by a DoS when handling a request with many HTTP headers',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-3h5v-q93c-6h6q',
          range: '>=8.0.0 <8.17.1',
        },
      ],
      range: '>=8.0.0 <8.17.1',
      fixAvailable: { name: 'ws', version: '8.18.0', isSemVerMajor: false },
    },
    semver: {
      name: 'semver',
      severity: 'high',
      via: [
        {
          source: 1096471,
          name: 'semver',
          title: 'semver vulnerable to Regular Expression Denial of Service',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-c2qf-rxjp-xf27',
          range: '<7.5.2',
        },
      ],
      range: '<7.5.2',
      fixAvailable: { name: 'semver', version: '7.6.3', isSemVerMajor: false },
    },
    'path-to-regexp': {
      name: 'path-to-regexp',
      severity: 'high',
      via: [
        {
          source: 1102339,
          name: 'path-to-regexp',
          title: 'path-to-regexp outputs backtracking regular expressions',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-9wv6-86g4-3258',
          range: '<0.1.12',
        },
      ],
      range: '<0.1.12',
      fixAvailable: { name: 'path-to-regexp', version: '0.1.12', isSemVerMajor: false },
    },
  },
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 5, critical: 0, total: 5 },
  },
}
