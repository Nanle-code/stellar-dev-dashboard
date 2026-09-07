# Release SBOM Artifacts

Every tagged release publishes a **Software Bill of Materials (SBOM)** so security and compliance teams can review third-party dependencies included in the dashboard.

---

## What is generated

| Asset | Format | Location |
|-------|--------|----------|
| `sbom.cyclonedx.json` | CycloneDX JSON | GitHub Release attachment + workflow artifact |

Generation uses `npm sbom` (npm 9+) wrapped by `scripts/generate-sbom.mjs`.

---

## Triggering a release

The `.github/workflows/release.yml` workflow runs automatically when a version tag matching `v*` is pushed:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Operators can also run the workflow manually from GitHub Actions and supply a tag name.

---

## Local generation

```bash
npm ci
node scripts/generate-sbom.mjs --output dist/sbom.cyclonedx.json --format cyclonedx
```

Optional SPDX output:

```bash
node scripts/generate-sbom.mjs --output dist/sbom.spdx.json --format spdx
```

---

## Failure handling

| Condition | Behaviour |
|-----------|-----------|
| Missing `package-lock.json` | Script exits with code `3` and prints guidance to run `npm ci` |
| npm < 9 (no `npm sbom`) | Script exits with code `2` — unsupported environment |
| Invalid CLI flags | Script exits with code `1` |
| Release tag missing on manual dispatch | Workflow input validation prevents empty tags |
| SBOM file missing at upload time | Release step fails (`fail_on_unmatched_files: true`) |

---

## Security notes

- SBOMs list **direct and transitive** npm dependencies resolved from `package-lock.json`.
- Treat SBOM files as public supply-chain metadata; they do not contain secrets.
- Compare SBOMs across releases to detect unexpected dependency changes during upgrades.

---

## Automated coverage

- `tests/ci/generate-sbom.test.js` — CLI parsing, format validation, and generation smoke test
- `release.yml` `validate-sbom-script` job — runs the test suite on every tagged release workflow
