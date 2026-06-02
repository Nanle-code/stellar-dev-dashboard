# SDK Examples

This page collects runnable examples for JavaScript and Python developers using Horizon, Soroban RPC, and the repository's API helper layer.

## JavaScript Example

The repository includes a runnable JavaScript example at `docs/api/examples/js/stellar-horizon-account-example.js`.

Run it with:

```bash
node docs/api/examples/js/stellar-horizon-account-example.js G...PUBLICKEY...
```

Example output shows Horizon account data returned as JSON.

### JavaScript sample

```js
import { Server } from '@stellar/stellar-sdk'

const server = new Server('https://horizon-testnet.stellar.org')

async function fetchAccount(publicKey) {
  const account = await server.accounts().accountId(publicKey).call()
  console.log(JSON.stringify(account, null, 2))
}

fetchAccount('G...')
```

## Python Example

The repository includes a runnable Python example at `docs/api/examples/python/horizon_account_example.py`.

Run it with:

```bash
python docs/api/examples/python/horizon_account_example.py G...PUBLICKEY...
```

This example uses Python's standard library to fetch Horizon account data and print the parsed response.

## Request/Response Samples

For direct API integration, see `docs/api/REQUEST_RESPONSE_SAMPLES.md` for HTTP request and response payload examples.
