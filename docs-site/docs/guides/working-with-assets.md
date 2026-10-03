---
id: working-with-assets
title: Working with Assets
sidebar_label: Working with Assets
---

# Working with Assets

Every token on Stellar other than XLM is a **custom asset** defined by a code and an issuer account.

## Asset types

| Type | Description | Example |
|---|---|---|
| `native` | XLM — the network's base currency | `Asset.native()` |
| `credit_alphanum4` | 1–4 character code | `USDC`, `BTC`, `ETH` |
| `credit_alphanum12` | 5–12 character code | `LONGASSET` |

## Creating an asset

### Guided testnet issuance

Use **Build → Asset Issuance** to create a testnet issuer and distributor, fund both accounts with Friendbot, configure the issuer, create the distributor trustline, authorize the holder when required, and issue the initial supply. Each signed transaction is built and displayed as XDR before submission. The wizard saves configuration, public addresses, and completed transaction hashes locally so an interrupted flow can resume.

Secret keys are generated and signed in the browser and are never written to the resumable draft. Back them up before continuing. After a reload, enter both keys again; if they are lost, the wizard cannot sign for those accounts. Never use the generated keys on mainnet or send them to another service. Friendbot funding is testnet-only.

The wizard checks asset code, home domain, supply precision, and the generated `[[CURRENCIES]]` entry with the SEP-1 field validator. The hosted `stellar.toml` must still be published over HTTPS at `/.well-known/stellar.toml` and inspected with the dashboard's SEP-1 Inspector; local validation cannot verify hosting, CORS, or the live issuer `home_domain`.

`auth_required` makes new trustlines unauthorized until the issuer approves them; the flow adds a separate `allowTrust` transaction before issuance. `auth_revocable` allows the issuer to freeze/revoke authorization. Clawback enables token recovery and requires revocability, so it presents a material holder risk. Locking sets the generated issuer's master weight to zero and is irreversible; the wizard requires an explicit acknowledgement before signing. Only use it after all issuer actions are complete. The wizard is testnet-only and does not migrate or configure existing mainnet assets.

```js
import { Asset } from '@stellar/stellar-sdk';

const xlm  = Asset.native();
const usdc = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
const btc  = new Asset('BTC',  'GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF');
```

## Add a trustline (required before receiving)

```js
import { Operation } from '@stellar/stellar-sdk';

const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: usdc }))
  .setTimeout(180)
  .build();
```

## Issue your own asset

```js
// The issuing account defines the asset
const issuerKeypair = Keypair.random();
const holderKeypair = Keypair.random();
const myToken = new Asset('MYTKN', issuerKeypair.publicKey());

// 1. Fund both accounts
await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
await fetch(`https://friendbot.stellar.org?addr=${holderKeypair.publicKey()}`);

// 2. Holder creates trustline
const holderAccount = await server.loadAccount(holderKeypair.publicKey());
const trustTx = new TransactionBuilder(holderAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: myToken, limit: '1000000' }))
  .setTimeout(180)
  .build();
trustTx.sign(holderKeypair);
await server.submitTransaction(trustTx);

// 3. Issuer mints tokens to holder
const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
const mintTx = new TransactionBuilder(issuerAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({
    destination: holderKeypair.publicKey(),
    asset: myToken,
    amount: '10000',
  }))
  .setTimeout(180)
  .build();
mintTx.sign(issuerKeypair);
await server.submitTransaction(mintTx);
```

## Search for assets

```ts
import { fetchAllAssets } from '@/lib/dex';

// Search assets by code
const assets = await fetchAllAssets('testnet', 200);
const usdcResults = assets.filter(a => a.asset_code === 'USDC');
```

## Get trustline recommendations

```ts
import { getTrustlineRecommendations } from '@/lib/stellar';

const recommendations = await getTrustlineRecommendations('GABC...', 'testnet');
// Returns popular verified assets the account hasn't added yet
```

## Asset flags (issuer controls)

| Flag | Effect |
|---|---|
| `auth_required` | Holders need explicit approval from issuer |
| `auth_revocable` | Issuer can freeze/unfreeze individual trustlines |
| `auth_immutable` | Flags can never be changed again |
| `auth_clawback_enabled` | Issuer can claw back tokens from any holder |

## Validate issuers and trustline state

The dashboard validates every non-native issuer as a checksummed Stellar ed25519 (`G...`)
public key before requesting issuer metadata. A missing issuer and a malformed issuer are
shown as separate blocking states; neither should be used to create a trustline. If public-key
validation is unavailable or throws, validation fails closed and the issuer is treated as invalid.

Authorization and clawback indicators have distinct meanings:

| Dashboard state | Meaning |
|---|---|
| `VALID ISSUER` | The issuer is structurally valid; this does **not** imply the issuer is trusted or domain-verified |
| `AUTHORIZATION REQUIRED` | A trustline must be approved by the issuer before it can receive the asset |
| `AUTHORIZED` | Horizon reports that the trustline can transact normally |
| `MAINTAIN LIABILITIES ONLY` | Existing offers/liabilities can remain, but the trustline cannot receive new funds |
| `UNAUTHORIZED` | Horizon reports that the issuer has not authorized the trustline |
| `CLAWBACK ENABLED` | The issuer can reclaim tokens from holder trustlines |

Treat these indicators as transaction-safety context, not an endorsement. Verify the asset code,
issuer, home domain, and expected network independently before creating a trustline. Older Horizon
responses may omit trustline authorization fields; in that case the dashboard only reports the
asset-level authorization requirement that is available.

```js
const tx = new TransactionBuilder(issuerAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.setOptions({
    setFlags: 1,    // AUTH_REQUIRED_FLAG = 1
  }))
  .setTimeout(180)
  .build();
```
