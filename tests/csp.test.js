import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nginxConfPath = path.resolve(__dirname, '../nginx.conf');
const indexHtmlPath = path.resolve(__dirname, '../index.html');

console.log('Running CSP tests...');

try {
  // Primary flow: nginx.conf should have a valid CSP header
  const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');
  const cspRegex = /add_header Content-Security-Policy "(.*)" always;/;
  const match = nginxContent.match(cspRegex);
  assert(match, 'CSP header missing in nginx.conf');
  const csp = match[1];

  assert(csp.includes("default-src 'self'"), "CSP missing default-src 'self'");
  assert(csp.includes("script-src 'self'"), "CSP missing script-src 'self'");
  assert(csp.includes("connect-src"), "CSP missing connect-src");
  console.log('✅ Primary flow: nginx.conf valid');

  // Primary flow: index.html should have a valid CSP meta tag
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  const htmlCspRegex = /<meta http-equiv="Content-Security-Policy" content="(.*)" \/>/;
  const htmlMatch = htmlContent.match(htmlCspRegex);
  assert(htmlMatch, 'CSP meta tag missing in index.html');
  const htmlCsp = htmlMatch[1];

  assert(htmlCsp.includes("default-src 'self'"), "HTML CSP missing default-src 'self'");
  assert(htmlCsp.includes("script-src 'self'"), "HTML CSP missing script-src 'self'");
  assert(htmlCsp.includes("connect-src"), "HTML CSP missing connect-src");
  console.log('✅ Primary flow: index.html valid');

  // Boundary case: should allow required Stellar endpoints but not wildcard everything
  assert(csp.includes("https://*.stellar.org"), "Missing stellar.org");
  assert(csp.includes("wss://*.walletconnect.com"), "Missing walletconnect.com");
  assert(!csp.match(/connect-src [^;]*\s\*(?:\s|;)/), "connect-src is too permissive with wildcard");
  console.log('✅ Boundary case: Required endpoints allowed securely');

  // Failure case: should not allow arbitrary domains like http://evil.com
  assert(!csp.includes("evil.com"), "CSP should not allow evil.com");
  assert(!csp.includes("http://"), "CSP should not allow http://");
  console.log('✅ Failure case: Malicious endpoints blocked');

  console.log('All tests passed!');
  process.exit(0);
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}
