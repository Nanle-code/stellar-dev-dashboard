---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
---

# Troubleshooting

## Transaction errors

### `tx_bad_seq` — Sequence number mismatch

**Cause:** The transaction's sequence number doesn't match the current on-chain sequence.

**Fix:** Always reload the account immediately before building a transaction:

```js
// Wrong — account may be stale
const tx = new TransactionBuilder(cachedAccount, ...);

// Correct — fresh sequence number every time
const account = await server.loadAccount(keypair.publicKey());
const tx = new TransactionBuilder(account, ...);
```

---

### `tx_bad_auth` — Bad signature

**Causes:**
- Signed with the wrong keypair
- Account uses multi-sig and signature weight is below threshold
- Wrong network passphrase used when building

```js
// Check you're using the right passphrase
const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET, // or Networks.PUBLIC for mainnet
});
```

---

### `op_no_destination` — Destination account not found

**Cause:** The recipient account doesn't exist on this network yet.

**Fix:** Create the account first with `createAccount`:

```js
Operation.createAccount({
  destination: newAccountPublicKey,
  startingBalance: '1', // minimum 1 XLM
})
```

---

### `op_no_trust` — No trustline

**Cause:** The destination account has no trustline for the asset being sent.

**Fix:** The recipient must run `changeTrust` for the asset before receiving it.

---

### `op_low_reserve` — Below minimum balance

**Cause:** The operation would drop the account's XLM balance below `(2 + subentries) * 0.5 XLM`.

**Fix:** Fund the account or remove unused subentries (trustlines, offers, data entries).

---

## Soroban errors

### `Simulation failed: HostError`

The contract execution failed during dry-run. Common causes:

| HostError | Meaning |
|---|---|
| `Value(InvalidInput)` | Wrong argument type or value |
| `Auth(InvalidAction)` | Caller not authorized |
| `Storage(MissingValue)` | Contract tried to read a key that doesn't exist |
| `Budget(CpuLimitExceeded)` | Contract uses too much CPU |

Increase contract log verbosity or use `getEvents` to inspect diagnostic events.

---

### Transaction stuck on `PENDING`

Soroban transactions expire if not included in a ledger within a few ledger closes. If polling returns `NOT_FOUND` after 60+ seconds, the transaction was likely dropped.

**Fix:** Rebuild and resubmit. The previous sequence number is now consumed — reload account first.

---

## Network errors

### `ECONNREFUSED` / `Network Error`

- Ensure the correct Horizon/RPC URL for your target network
- Check for VPN or firewall blocking outbound HTTPS
- Try `https://horizon-testnet.stellar.org` directly in a browser

### `429 Too Many Requests`

You are being rate-limited by Horizon. See the [Rate Limit guide](./rate-limiting) and example for proper backoff handling.

---

## Common account issues

### Account not found on mainnet after testing on testnet

Testnet and Mainnet are completely separate ledgers. Accounts and balances do not transfer. You need to create a new account on Mainnet and fund it.

### Balance shows 0 after Friendbot

Friendbot funding is a transaction that takes a few seconds to be included in a ledger. Wait 5–10 seconds then reload the account.

### CoinGecko price returns `null`

The free CoinGecko tier is rate-limited to 10–30 calls/min. The dashboard caches prices for 5 minutes. If you're seeing nulls, you may be hitting the rate limit — add a `VITE_COINGECKO_API_KEY` for higher limits.

---

## Diagnostic tools

```js
// Print full error details
function debugError(err) {
  console.error('Status:', err.response?.status);
  console.error('Data:', JSON.stringify(err.response?.data, null, 2));
  console.error('Result codes:', err.response?.data?.extras?.result_codes);
}
```

```bash
# Check the Horizon API directly
curl -s "https://horizon-testnet.stellar.org/accounts/GABC...KEY" | jq .

# Check a transaction
curl -s "https://horizon-testnet.stellar.org/transactions/TX_HASH" | jq .result_codes
```
