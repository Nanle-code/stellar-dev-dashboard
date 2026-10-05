# SEP-0010 Stellar Web Authentication Guide

This guide documents the implementation and usage of the **SEP-0010 Web Authentication** challenge helper in the Stellar Developer Dashboard.

---

## Overview

[SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) defines a standard authentication flow between a Stellar client (wallet or app) and a server (anchor, custodian, or API server) using Stellar transaction signatures instead of passwords.

### Authentication Flow

```
+------------+                                      +------------+
|   Client   |                                      |   Server   |
+------------+                                      +------------+
      |                                                    |
      | 1. Request challenge (client public key)           |
      |--------------------------------------------------->|
      |                                                    |
      | 2. Build & sign challenge transaction              |
      |    (sequence=0, timebounds, manageData auth op)    |
      |    Return challenge XDR                            |
      |<---------------------------------------------------|
      |                                                    |
      | 3. Validate server signature & timebounds          |
      |    Sign challenge with client keypair              |
      |                                                    |
      | 4. Submit signed challenge XDR                     |
      |--------------------------------------------------->|
      |                                                    |
      | 5. Validate client signature & time validity       |
      |    Issue SEP-0010 JWT Bearer Token                 |
      |<---------------------------------------------------|
      |                                                    |
      | 6. Use Token in HTTP Authorization: Bearer <token> |
      |--------------------------------------------------->|
```

---

## Developer Helpers API (`src/lib/sep10Auth.ts`)

### `createSep10Challenge(params)`
Builds a cryptographic challenge transaction:
- **Sequence Number:** Set to `"0"` (using Account sequence `"-1"` in `TransactionBuilder`).
- **Source Account:** Server signing account.
- **Timebounds:** `[now, now + timeout]` (default: 300 seconds, max: 86400 seconds).
- **Operation:** `manageData` with name `"${homeDomain} auth"`, source `clientAccountId`, and a 48-byte cryptographic random nonce.
- **Server Signature:** Cryptographically signed by the server's Keypair.

### `validateSep10Challenge(transactionXDR, serverPublicKey, homeDomain, networkPassphrase, nowEpoch)`
Validates that:
1. Transaction deserializes cleanly.
2. Sequence number is `"0"`.
3. Source account matches expected server public key.
4. Timebounds are active (`now >= minTime` and `now <= maxTime`).
5. Operation is `manageData` with matching `${homeDomain} auth` and valid client public key.
6. Server signature is valid.

### `signSep10Challenge(transactionXDR, clientKeypair, networkPassphrase)`
Appends the client's cryptographic signature to the challenge transaction.

### `verifyChallengeAndIssueToken(signedXDR, serverPublicKey, homeDomain, networkPassphrase, nowEpoch)`
Verifies both server and client signatures and issues a verifiable JWT payload:
- **`sub`**: Client account ID (`G...`).
- **`iss`**: `https://${homeDomain}/auth`.
- **`iat`** / **`exp`**: Issuance and expiration timestamps.
- **`token`**: JWT formatted token for use in `Authorization: Bearer <token>` headers.

---

## Interactive UI Helper (`ConnectPanel`)

The `ConnectPanel` includes an expandable **SEP-0010 Web Authentication Helper** card:
1. **Interactive Keypair Generation:** Generate test client keypairs with 1-click.
2. **Challenge Creation:** Generate and inspect challenge XDR, timebounds, and nonce.
3. **Sign Challenge:** Sign the challenge transaction.
4. **Token Verification:** Verify signatures and inspect the issued JWT and Authorization headers.

---

## Security & Best Practices

1. **Replay Prevention:** Challenge nonces are cryptographically unique and time-bounded.
2. **Clock Drift:** When validating timebounds in production, allow a grace period of ±30 seconds for NTP clock drift.
3. **Network Isolation:** Ensure network passphrase matches the target network (`Testnet` vs `Public`).
4. **TLS Requirement:** In production, SEP-0010 challenge endpoints must strictly require HTTPS.
