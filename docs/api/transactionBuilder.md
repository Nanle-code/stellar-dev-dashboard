````markdown
# transactionBuilder.js

Multi-operation Stellar transaction builder and simulator.

## `OPERATION_TYPES`

Array of `{ value, label }` objects listing all supported operation types for use in UI selects.

```js
import { OPERATION_TYPES } from './src/lib/transactionBuilder';
// [{ value: 'payment', label: 'Payment' }, ...]
```

## `createOperation(type, params)`

Build a single `StellarSdk.Operation` from a type string and a params object.

| Parameter | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `type`    | `string` | One of the values in `OPERATION_TYPES` |
| `params`  | `Object` | Operation-specific fields (see below)  |

**Returns:** `StellarSdk.xdr.Operation`

### Supported operation types

| type                            | Required params                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `payment`                       | `destination`, `assetType`, `amount` (+ `assetCode`/`assetIssuer` for non-native) |
| `createAccount`                 | `destination`, `startingBalance`                                                  |
| `changeTrust`                   | `assetCode`, `assetIssuer`, `limit?`                                              |
| `manageSellOffer`               | `sellingAsset*`, `buyingAsset*`, `amount`, `price`                                |
| `manageBuyOffer`                | `sellingAsset*`, `buyingAsset*`, `buyAmount`, `price`                             |
| `setOptions`                    | `homeDomain?`, `setFlags?`, `clearFlags?`                                         |
| `accountMerge`                  | `destination`                                                                     |
| `manageData`                    | `name`, `value?`                                                                  |
| `pathPaymentStrictSend`         | `sendAsset*`, `sendAmount`, `destination`, `destAsset*`, `destMin`, `path?`       |
| `pathPaymentStrictReceive`      | `sendAsset*`, `sendMax`, `destination`, `destAsset*`, `destAmount`, `path?`       |
| `claimClaimableBalance`         | `balanceId`                                                                       |
| `createClaimableBalance`        | `asset*`, `amount`, `claimants`                                                   |
| `bumpSequence`                  | `bumpTo`                                                                          |
| `revokeSponsorship`             | `account`                                                                         |
| `beginSponsoringFutureReserves` | `sponsoredId`                                                                     |
| `endSponsoringFutureReserves`   | _(none)_                                                                          |
| `feeBump`                       | `feeSource`, `baseFee`, `innerTransaction`                                        |
| `clawback`                      | `assetCode`, `assetIssuer`, `from`, `amount`                                      |

## `buildTransaction(params)`

Async. Loads the source account from Horizon and builds a signed-ready `Transaction` object.

```js
const tx = await buildTransaction({
  sourceAccount: 'G...',
  operations: [
    { type: 'payment', params: { destination: 'G...', assetType: 'native', amount: '10' } },
  ],
  memo: 'Hello',
  memoType: 'text', // 'text' | 'id' | 'hash' | 'return'
  baseFee: 100,
  timeout: 180,
  network: 'testnet',
});
```

## `simulateTransaction(params)`

Async. Builds and validates a transaction without submitting it.

**Returns:**

```js
{
  success: boolean,
  errors: string[],
  fee: number,
  operationCount: number,
  xdr: string,
  hash: string,
}
```

## `signAndSubmitTransaction(transaction, secretKey, network?)`

Sign a built transaction with a secret key and submit it to the network.

**Returns:**

```js
{ hash: string, ledger: number, successful: boolean }
```

## `feeBump(params)`

Build a fee-bump transaction wrapping a previously signed inner transaction.

**Parameters:**

| Parameter          | Type     | Required | Description                                                                                            |
| ------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `feeSource`        | `string` | ✓        | Account public key (G...) that pays the fee-bump fee. Must be able to authorize fee-bump transactions. |
| `baseFee`          | `number` | ✓        | Fee per operation in stroops (must be positive). Applies to the entire wrapped transaction.            |
| `innerTransaction` | `string` | ✓        | The signed inner transaction as XDR envelope string. Must be a valid, signed Stellar transaction.      |
| `network`          | `string` | —        | Network name: `'testnet'`, `'mainnet'`, `'futurenet'`, or `'local'` (default: `'testnet'`).            |

**Returns:** `FeeBumpTransaction` — Fee-bump transaction envelope ready for simulation or submission.

**Throws:** Error if `feeSource` is invalid, `baseFee` is not positive, or `innerTransaction` XDR is malformed.

**Example:**

```js
import { feeBump } from './src/lib/transactionBuilder';

// Step 1: Build and sign an inner transaction
const innerTx = await buildTransaction({
  sourceAccount: 'G...',
  operations: [
    {
      type: 'payment',
      params: {
        /* ... */
      },
    },
  ],
  baseFee: 100,
  network: 'testnet',
});
const innerXDR = innerTx.toXDR();

// Step 2: Wrap it in a fee-bump from a different account
const feeBumpTx = feeBump({
  feeSource: 'G...fee-bump-account',
  baseFee: 200, // Higher fee per operation
  innerTransaction: innerXDR,
  network: 'testnet',
});

// Step 3: Export or submit
const xdr = feeBumpTx.toXDR();
```

**Notes:**

- Fee-bump transactions allow a different account to pay higher fees for an already-constructed transaction.
- The `feeSource` must authorize the fee-bump transaction (typically via signature).
- The `baseFee` is per operation in the inner transaction, not a total fee.
- The estimated fee for a fee-bump transaction is calculated as `baseFee * (inner transaction operation count + 1)`.
- In the advanced transaction builder UI, fee-bump transactions are built as standalone operations and the sponsor account is selected with `feeSource`.
- Common use case: sponsor or re-submit transactions with insufficient fees.

## Operation Type: `clawback`

Initiate a clawback of an issued custom asset from a designated holder.

**Required params:**

- `assetCode` (string): The code of the clawbackable asset (1–12 uppercase alphanumerics)
- `assetIssuer` (string): The issuer's public key (G...)
- `from` (string): The account from which to claw back (G...)
- `amount` (string): The amount to claw back (numeric, must be positive)

**Example params:**

```js
{
  assetCode: 'TEST',
  assetIssuer: 'GBZ...',
  from: 'GAP...',
  amount: '100.50',
}
```

**Notes:**

- Only the asset issuer can clawback.
- The asset must have the clawback flag enabled on the issuer's account.
- Clawed-back amounts are removed from the holder's balance.
- Common use case: reclaim restricted or non-compliant assets.

## Operation Type: `beginSponsoringFutureReserves`

Begin sponsoring future reserve requirements for another account.

**Required params:**

- `sponsoredId` (string): The public key (G...) of the account to be sponsored

**Notes:**

- Must be followed by `endSponsoringFutureReserves` from the sponsored account to complete the sponsorship pair.
- The sponsoring account pays for the sponsored account's reserve requirements.
- Useful for onboarding and account management workflows.

## Operation Type: `endSponsoringFutureReserves`

End sponsorship of future reserves (must be called by the sponsored account).

**Required params:** None

**Notes:**

- Terminates the active sponsorship relationship initiated by `beginSponsoringFutureReserves`.
- The sponsored account must execute this operation to end the sponsorship.
- If sponsorship ends, the sponsored account becomes responsible for its own reserve requirements.
````
