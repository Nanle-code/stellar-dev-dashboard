# SDK Examples

This page collects all runnable examples for JavaScript, TypeScript, and Python developers.

## Quick start

```bash
# JavaScript / TypeScript (Node.js ≥ 18)
npm install @stellar/stellar-sdk

# Python (≥ 3.9)
pip install stellar-sdk
```

---

## JavaScript / TypeScript examples

All examples live in `docs/api/examples/js/` and run with Node.js ≥ 18.

### Fetch account

```bash
node docs/api/examples/js/stellar-horizon-account-example.js GABC...PUBLIC_KEY
```

### Send XLM payment

```bash
node docs/api/examples/js/send-payment.mjs SXXX...SECRET GDEST...RECIPIENT 10 "Hello"
```

### Create trustline

```bash
# Add USDC trustline
node docs/api/examples/js/create-trustline.mjs \
  SXXX...SECRET \
  USDC \
  GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

### Invoke a Soroban contract

```bash
node docs/api/examples/js/invoke-contract.mjs SXXX...SECRET CBXG...CONTRACT_ID increment
```

---

## Python examples

All examples live in `docs/api/examples/python/` and require `pip install stellar-sdk`.

### Fetch account

```bash
python docs/api/examples/python/horizon_account_example.py GABC...PUBLIC_KEY
```

### Send XLM payment

```bash
python docs/api/examples/python/send_payment.py SXXX...SECRET GDEST...RECIPIENT 10 "Hello"
```

### Create trustline

```bash
python docs/api/examples/python/create_trustline.py \
  SXXX...SECRET \
  USDC \
  GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

### Invoke a Soroban contract

```bash
python docs/api/examples/python/invoke_contract.py SXXX...SECRET CBXG...CONTRACT_ID increment
```

---

## Get a testnet account

1. Generate a keypair:

```bash
node -e "
import('@stellar/stellar-sdk').then(({ Keypair }) => {
  const kp = Keypair.random();
  console.log('Public:', kp.publicKey());
  console.log('Secret:', kp.secret());
});
"
```

2. Fund via Friendbot:

```bash
curl "https://friendbot.stellar.org?addr=GABC...YOUR_PUBLIC_KEY"
```

---

## Full interactive documentation

See the [Docusaurus docs site](https://damiedee96.github.io/stellar-dev-dashboard/) for the full interactive API reference, guides, and live endpoint explorer.

- [Getting Started](https://damiedee96.github.io/stellar-dev-dashboard/docs/getting-started)
- [API Reference](https://damiedee96.github.io/stellar-dev-dashboard/docs/api-reference/overview)
- [Interactive Explorer](https://damiedee96.github.io/stellar-dev-dashboard/docs/api-explorer)
