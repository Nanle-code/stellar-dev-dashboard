# Subresource Integrity (SRI) checks

Third-party scripts and styles loaded into the dashboard are a supply-chain
risk: if a CDN is compromised it can serve modified code. Subresource Integrity
lets the browser refuse any file whose `sha256`/`sha384`/`sha512` digest does
not match the `integrity` attribute pinned in our HTML.

## The checker

`scripts/verify-sri.mjs` scans HTML documents for cross-origin `<script src>` and
`<link rel="stylesheet" | rel="preload" as="script|style">` tags and enforces:

- every cross-origin subresource has an `integrity` attribute;
- the attribute is a well-formed `sha256-`/`sha384-`/`sha512-` digest;
- (recommended) a `crossorigin` attribute accompanies it;
- optionally, the digest matches the locally-mapped build output.

First-party assets (same origin) are skipped — SRI is not required for them.

## Usage

```bash
# Validate index.html (warnings for missing integrity)
node scripts/verify-sri.mjs --html index.html --base-url https://dashboard.example/

# Validate a built document and fail on any missing integrity
node scripts/verify-sri.mjs --html dist/index.html --strict

# Recompute digests from local build output (no network)
node scripts/verify-sri.mjs --html index.html --assets sri-map.json
```

`sri-map.json` maps a subresource URL to a local file:

```json
{ "https://cdn.vendor.test/lib.js": "node_modules/@vendor/lib/dist/lib.js" }
```

## Exit codes

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| `0`  | All checks passed (warnings may still be printed)    |
| `1`  | Invalid CLI input                                    |
| `2`  | No readable HTML document / assets map               |
| `3`  | Verification failed (malformed or mismatched digest) |

## Notes and limitations

- Missing integrity is a **warning** by default so existing pages are not broken
  on introduction; use `--strict` in CI to make it an error.
- Malformed digests always fail, with or without `--strict`.
- Digest recomputation is opt-in (`--assets` / `--fetch`) so the default run is
  deterministic and network-free.
- The parser is regex-based and intentionally scoped to `<script>`/`<link>`
  tags; it ignores `preconnect`, `dns-prefetch`, icons, and manifests.

## Automated coverage

`tests/ci/verify-sri.test.mjs` covers parsing, origin comparison, attribute
validation, strict vs non-strict behaviour, malformed digests, and local digest
matching. Run `pnpm run test -- verify-sri`.
