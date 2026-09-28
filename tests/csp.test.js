import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const nginxConfPath = path.join(repoRoot, 'nginx.conf');
const indexHtmlPath = path.join(repoRoot, 'index.html');

// Same-origin collector declared by `report-uri` / `Reporting-Endpoints`.
const CSP_ENDPOINT = '/api/security/csp-report';

const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');
const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

function extract(pattern, content) {
  const match = content.match(pattern);
  return match ? match[1] : null;
}

const csp = extract(/add_header Content-Security-Policy "(.*)" always;/, nginxContent);
const htmlCsp = extract(
  /<meta http-equiv="Content-Security-Policy" content="(.*)" \/>/,
  htmlContent,
);

describe('Content Security Policy configuration', () => {
  describe('primary flow', () => {
    it('defines a valid policy header in nginx.conf', () => {
      expect(csp, 'CSP header missing in nginx.conf').toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain('connect-src');
    });

    it('defines a valid policy meta tag in index.html', () => {
      expect(htmlCsp, 'CSP meta tag missing in index.html').toBeTruthy();
      expect(htmlCsp).toContain("default-src 'self'");
      expect(htmlCsp).toContain("script-src 'self'");
      expect(htmlCsp).toContain('connect-src');
    });

    it('declares the CSP reporting endpoint in both configurations', () => {
      expect(csp).toContain(`report-uri ${CSP_ENDPOINT}`);
      expect(csp).toContain('report-to csp-endpoint');
      expect(nginxContent).toMatch(
        /add_header Reporting-Endpoints 'csp-endpoint="\/api\/security\/csp-report"' always;/,
      );
      expect(htmlCsp).toContain(`report-uri ${CSP_ENDPOINT}`);
    });
  });

  describe('boundary cases', () => {
    it('allows required Stellar and WalletConnect endpoints', () => {
      expect(csp).toContain('https://*.stellar.org');
      expect(csp).toContain('wss://*.walletconnect.com');
    });

    it('does not use a bare wildcard in connect-src', () => {
      expect(csp).not.toMatch(/connect-src [^;]*\s\*(?:\s|;)/);
    });

    it('keeps the reporting endpoint same-origin', () => {
      const endpoint = extract(/report-uri (\S+);/, csp ?? '');
      expect(endpoint).toBe(CSP_ENDPOINT);
      expect(endpoint.startsWith('/')).toBe(true);
      expect(endpoint).not.toMatch(/^https?:\/\//);
    });
  });

  describe('failure cases', () => {
    it('does not allow malicious domains or plaintext http', () => {
      expect(csp).not.toContain('evil.com');
      expect(csp).not.toContain('http://');
    });

    it('never enables report-sample, which would leak page content', () => {
      expect(csp).not.toContain('report-sample');
      expect(htmlCsp).not.toContain('report-sample');
    });
  });
});
