# Contributing to the Stellar Dev Dashboard Docs

## Adding a new page

1. Create a `.md` file in the appropriate `docs/` subdirectory
2. Add a front-matter block with `id`, `title`, and `sidebar_label`
3. Register the `id` in `sidebars.js` under the correct category
4. Run `npm start` locally to preview — Docusaurus hot-reloads

```md
---
id: my-new-page
title: My New Page
sidebar_label: My Page
---

# My New Page
Content here...
```

## Adding a code example

1. Write the doc page in `docs/examples/js/` or `docs/examples/python/`
2. Add a runnable script in `docs/api/examples/js/` or `docs/api/examples/python/`
3. Link to the runnable script from the doc page
4. Register the page in `sidebars.js` under `examples`

All JavaScript examples must pass `node --check <file>`.  
All Python examples must pass `python -m py_compile <file>`.

## Updating the API reference

The API reference in `docs/api/generated/API_REFERENCE.md` is **auto-generated** from JSDoc comments in `src/lib/**`. To update it:

```bash
# From the repo root
npm run docs:api:generate
```

Do not edit `API_REFERENCE.md` manually — changes will be overwritten.

## Running the docs site locally

```bash
cd docs-site
npm install
npm start   # http://localhost:3000
```

## Building for production

```bash
cd docs-site
npm run build
npm run serve   # preview at http://localhost:3000
```

## OpenAPI spec

The interactive API explorer is driven by `docs/api/openapi.yaml`. Edit that file to add or update endpoint documentation. After editing, run:

```bash
cd docs-site
npm run gen-api-docs
```

This regenerates the interactive endpoint pages from the spec.

## Style guide

- Use `:::tip`, `:::caution`, and `:::danger` admonitions sparingly for important callouts
- Code blocks must specify a language: ` ```js `, ` ```python `, ` ```bash `
- Use `title="filename.js"` on code blocks that should show a filename
- Keep prose concise — show code over explaining it
- All public keys in examples use `GABC...` placeholders; secret keys use `SXXX...`

## Deployment

Docs deploy automatically to GitHub Pages via `.github/workflows/docs.yml` on every merge to `master`. No manual steps needed.
