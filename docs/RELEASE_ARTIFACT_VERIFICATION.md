# Verifying signed release artifacts

Every release publishes a **manifest** describing the artifacts it produced and
their SHA-256 checksums. Anyone can verify that a downloaded build matches the
one CI generated, and — when a signature is attached — that the manifest was
produced by the maintainers.

## Manifest format

```json
{
  "version": "1.2.3",
  "artifacts": [
    {
      "path": "dist/assets/index-abc123.js",
      "sha256": "<64-char lowercase hex>",
      "size": 123456,
      "signature": "dist/assets/index-abc123.js.sig"
    }
  ],
  "signature": "dist/release-manifest.json.sig"
}
```

- `path` — relative to `--dir` (or absolute).
- `sha256` — lower-case hex digest of the file.
- `size` — optional; byte length.
- `signature` — optional detached signature next to the artifact.

## Verifying a release

```bash
# Checksums only
node scripts/verify-release-artifacts.mjs --manifest dist/release-manifest.json --dir .

# Require a signature for every artifact
node scripts/verify-release-artifacts.mjs \
  --manifest dist/release-manifest.json \
  --dir . \
  --require-signature
```

Signature verification uses `gpg --verify` when available, falling back to
`minisign -V`. If neither tool is installed, checksum verification still runs and
the signature check is reported as a warning unless `--require-signature` is set.

## Exit codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| `0`  | All checks passed                                              |
| `1`  | Invalid CLI input (missing/unknown flags)                      |
| `2`  | Unsupported environment — manifest missing or unparsable       |
| `3`  | Verification failed — missing file, checksum/size mismatch, or bad signature |

## Security notes

- Checksums detect corruption and tampering in transit, but only a **signature**
  proves provenance. Use `--require-signature` for production verification.
- Never trust a manifest delivered over the same channel as the artifact without
  a signature.
- Treat manifests as public supply-chain metadata; they contain no secrets.

## Automated coverage

`tests/ci/verify-release-artifacts.test.mjs` covers argument parsing, manifest
validation, checksum matching/mismatch, missing artifacts, and optional vs
required signatures. Run `pnpm run test -- verify-release-artifacts`.

## Related

- [`RELEASE_SBOM.md`](./RELEASE_SBOM.md) — Software Bill of Materials published
  alongside each release.
