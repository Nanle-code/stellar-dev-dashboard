# Stellar Dev Dashboard — Documentation Site

Docusaurus 3.5 documentation site for the [Stellar Dev Dashboard](https://github.com/damiedee96/stellar-dev-dashboard).

## Live site

https://damiedee96.github.io/stellar-dev-dashboard/

## Local development

```bash
# From the repo root, install docs-site deps
cd docs-site
npm install

# Start dev server (hot reload)
npm start
# → http://localhost:3000

# Generate interactive API reference from openapi.yaml
npm run gen-api-docs

# Build for production
npm run build

# Preview the production build
npm run serve
```

## Regenerate the auto-generated API reference

The `docs/api/generated/API_REFERENCE.md` is generated from JSDoc comments in `src/lib/**`. Run from the **repo root**:

```bash
npm run docs:api:generate
```

## Structure

```
docs-site/
├── docs/
│   ├── getting-started/    # Introduction, Quick Start, Auth, Networks
│   ├── api-reference/      # Horizon, Soroban, SDK modules, External APIs
│   ├── guides/             # Step-by-step workflow guides
│   ├── examples/           # JS/TS and Python code examples
│   └── api-explorer.md     # Interactive API Explorer page
├── src/
│   ├── pages/index.jsx     # Landing page
│   └── css/custom.css      # Theme overrides
├── docusaurus.config.js
├── sidebars.js
└── package.json
```

## Deployment

Docs deploy automatically to GitHub Pages via `.github/workflows/docs.yml` on every push to `master`.
