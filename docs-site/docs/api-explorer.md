---
id: api-explorer
title: Interactive API Explorer
sidebar_label: API Explorer
---

# Interactive API Explorer

The API Explorer lets you test live Stellar API endpoints directly from the browser — no setup required.

:::tip Try it live
The explorer below connects to the **Stellar Testnet**. Use your testnet public key or generate a fresh one using Friendbot.
:::

## Explore the OpenAPI specification

The complete OpenAPI 3.0.3 spec for all dashboard integrations is published at:

**[`docs/api/openapi.yaml`](https://github.com/damiedee96/stellar-dev-dashboard/blob/master/docs/api/openapi.yaml)**

You can load this file into any API tool for interactive testing:

### Postman

1. Open Postman → Import → Link
2. Paste: `https://raw.githubusercontent.com/damiedee96/stellar-dev-dashboard/master/docs/api/openapi.yaml`
3. A full collection is created automatically

### Insomnia

1. Create → Import → From URL
2. Paste the raw YAML URL above

### Swagger UI (local)

```bash
# Run Swagger UI locally against the spec
npx swagger-ui-cli serve docs/api/openapi.yaml
# Opens at http://localhost:3001
```

### ReDoc (local)

```bash
npx @redocly/cli preview-docs docs/api/openapi.yaml
# Opens at http://localhost:8080
```

---

## Quick test endpoints

Test the most common Horizon endpoints directly with curl:

### Fetch an account

```bash
PUBLIC_KEY="GABC...YOUR_KEY"
curl -s "https://horizon-testnet.stellar.org/accounts/$PUBLIC_KEY" | jq '{
  id: .account_id,
  sequence: .sequence,
  xlm: (.balances[] | select(.asset_type == "native") | .balance)
}'
```

### Get recent ledgers

```bash
curl -s "https://horizon-testnet.stellar.org/ledgers?order=desc&limit=3" \
  | jq '.\_embedded.records[] | {sequence, operation_count, closed_at}'
```

### Simulate a Soroban transaction

```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test",
    "method": "getLatestLedger",
    "params": {}
  }' | jq .
```

### Get XLM price

```bash
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true" \
  | jq .
```

### Fund a testnet account

```bash
NEW_KEY="GABC...NEW_KEY"
curl -s "https://friendbot.stellar.org?addr=$NEW_KEY" | jq '{hash, ledger}'
```

---

## Embedded Swagger UI

The Docusaurus site integrates `docusaurus-plugin-openapi-docs` which generates fully interactive API reference pages from the OpenAPI spec — including a live "Try it out" button for every endpoint.

After running `npm run gen-api-docs` in the `docs-site` directory, the interactive pages are available at `/docs/api-reference/`.

---

## Storybook component explorer

For dashboard UI components, the Storybook instance (running on port 6006) provides interactive component documentation:

```bash
npm run storybook
# Opens at http://localhost:6006
```

All components are documented with controls, accessibility audits, and responsive previews across mobile, tablet, and desktop viewports.
