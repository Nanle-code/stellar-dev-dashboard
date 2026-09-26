---
id: sep-0007-payment-requests
title: SEP-0007 Payment Requests
sidebar_label: SEP-0007 Payment Requests
---

# SEP-0007 payment requests

[SEP-0007](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md)
defines `web+stellar:` URIs that hand a payment or a transaction to whichever
wallet the user has installed. The same string works as a deep link on mobile
and as the content of a QR code.

`src/lib/sep7.ts` builds, parses, validates, signs and verifies these URIs.
The LOBSTR and Solar connectors use it for their mobile signing links.

## Request a payment (`pay`)

```ts
import { buildSep7PayUri } from 'src/lib/sep7';

const uri = buildSep7PayUri({
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '120.1234567',
  assetCode: 'USD',
  assetIssuer: 'GCRCUE2C5TBNIPYHMEP7NK5RWTT2WBSZ75CMARH7GDOHDDCQH3XANFOB',
  memo: 'order-24',          // memo_type defaults to MEMO_TEXT
  msg: 'Invoice #24',        // shown in the wallet, never put on-chain
  networkPassphrase: 'Test SDF Network ; September 2015', // omit for mainnet
});
```

Leave out `amount` to let the payer choose it (donations). Leave out
`assetCode` to request XLM.

## Request a signature (`tx`)

```ts
import { buildSep7TxUri } from 'src/lib/sep7';

const uri = buildSep7TxUri({
  xdr: transaction.toEnvelope().toXDR('base64'),
  callback: 'https://api.example.com/sep7/callback', // `url:` is added for you
  pubkey: 'GAU2...',                                 // optional: which signer
});
```

Without `callback` the wallet signs and submits the transaction itself. With a
callback the wallet POSTs the signed XDR to that URL instead.

`replace` (SEP-0011 Txrep field substitution) and `chain` (a wrapped earlier
request) are supported and validated as well.

## Validate an incoming URI

```ts
import { validateSep7Uri } from 'src/lib/sep7';

const result = validateSep7Uri(scannedText);
if (!result.valid) {
  for (const issue of result.issues) console.warn(issue.code, issue.param, issue.message);
}
```

`validateSep7Uri` never throws and reports every problem it finds. The builders
run the same checks and throw a `Sep7Error` (with the same `issues` array)
instead of returning a bad URI. Use `parseSep7Uri` when you only need the
decoded parameters.

What gets rejected:

| Field | Rule |
| --- | --- |
| scheme / operation | must be `web+stellar:tx` or `web+stellar:pay` |
| any param | must not repeat; must be valid percent-encoding |
| `xdr` | required for `tx`; must decode as a `TransactionEnvelope` |
| `destination` | required for `pay`; `G...` account, `M...` muxed account or `name*domain` federation address |
| `amount` | positive, at most 7 decimals, at most `922337203685.4775807` |
| `asset_code` / `asset_issuer` | 1–12 alphanumerics; issuer required unless the code is `XLM`; no issuer without a code |
| `memo` / `memo_type` | `MEMO_TEXT` ≤ 28 bytes, `MEMO_ID` fits in uint64, `MEMO_HASH`/`MEMO_RETURN` are base64 of 32 bytes |
| `msg` | at most 300 characters |
| `callback` | `url:` followed by an `https` URL (`http` is accepted for `localhost` only) |
| `pubkey`, `asset_issuer` | valid ed25519 public keys |
| `replace` | identifiers balanced on both sides of `;` |
| `chain` | a valid SEP-0007 URI, nested at most 7 levels |
| `origin_domain` | a fully qualified domain name, and only together with `signature` |
| `signature` | the last parameter, a base64 ed25519 signature |

## Signed requests

To let wallets show your domain as the origin of a request, publish
`URI_REQUEST_SIGNING_KEY` in `https://<your-domain>/.well-known/stellar.toml`
and sign the URI with the matching secret:

```ts
import { Keypair } from '@stellar/stellar-sdk';
import { buildSep7PayUri, signSep7Uri } from 'src/lib/sep7';

const unsigned = buildSep7PayUri({ destination, amount: '10', originDomain: 'example.com' });
const signed = signSep7Uri(unsigned, Keypair.fromSecret(process.env.URI_REQUEST_SIGNING_SECRET));
```

On the receiving side, `verifySep7Signature(uri, signingKey)` returns `true`
only for an untampered URI signed by `signingKey`.

## Opening the wallet

`openSep7Uri(uri)` validates the URI and then navigates to it, which hands it to
the registered `web+stellar:` handler. Outside a browser it throws a
`Sep7Error` with code `UNSUPPORTED_ENVIRONMENT`. For desktop users without a
handler, render the URI as a QR code and let them scan it with a mobile wallet.

## Security notes

- **Keep the signing secret on the server.** `signSep7Uri` needs the secret for
  `URI_REQUEST_SIGNING_KEY`; never ship it to the browser.
- **Validation is not verification.** `validateSep7Uri` checks that a
  `signature` is well formed, not that it is genuine. A wallet-like consumer must
  fetch `stellar.toml` from `origin_domain` itself, call `verifySep7Signature`,
  and only then display the domain. Alert the user if the domain's signing key
  changes between requests.
- **Callbacks receive signed transactions.** Callback URLs must be HTTPS so the
  signed XDR is not exposed in transit.
- **`msg` is untrusted text.** Render it as plain text, never as HTML.

## Compatibility and migration

- Unknown parameters are kept in `parseSep7Uri(...).unknownParams` and do not
  fail validation, so requests from newer SEP-0007 revisions still parse.
- The LOBSTR and Solar mobile links now come from `buildSep7TxUri`. Their
  `callback` value is now fully URL-encoded (`url%3Ahttps%3A...`) as the spec
  requires. Signing from a page served over plain `http` (other than
  `localhost`) now throws instead of asking the wallet to POST the signed
  transaction over an unencrypted connection.
