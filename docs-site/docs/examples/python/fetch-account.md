---
id: fetch-account
title: Fetch Account (Python)
sidebar_label: Fetch Account
---

# Fetch Account — Python

## Using stellar-sdk

```python title="fetch_account.py"
"""
Fetch Stellar account details using stellar-sdk.

Usage:
    pip install stellar-sdk
    python fetch_account.py GABC...PUBLIC_KEY
"""
import sys
from stellar_sdk import Server


HORIZON_URL = "https://horizon-testnet.stellar.org"


def fetch_account(public_key: str) -> dict:
    server = Server(HORIZON_URL)
    return server.accounts().account_id(public_key).call()


def print_account(account: dict) -> None:
    print(f"Account ID : {account['account_id']}")
    print(f"Sequence   : {account['sequence']}")
    print(f"Subentries : {account['subentry_count']}")
    print()

    print("Balances:")
    for balance in account["balances"]:
        if balance["asset_type"] == "native":
            asset = "XLM"
        else:
            asset = f"{balance['asset_code']}:{balance['asset_issuer'][:8]}..."
        print(f"  {asset:<22} {balance['balance']}")

    print()
    print("Signers:")
    for signer in account["signers"]:
        print(f"  {signer['key']}  weight={signer['weight']}")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python fetch_account.py <PUBLIC_KEY>")
        sys.exit(1)

    public_key = sys.argv[1]
    try:
        account = fetch_account(public_key)
        print_account(account)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## Using stdlib only (no SDK)

```python title="fetch_account_stdlib.py"
"""
Fetch Stellar account using only Python's standard library.
No dependencies required.

Usage:
    python fetch_account_stdlib.py GABC...PUBLIC_KEY
"""
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError


HORIZON_URL = "https://horizon-testnet.stellar.org"


def fetch_account(public_key: str) -> dict:
    url = f"{HORIZON_URL}/accounts/{public_key}"
    req = Request(url, headers={"Accept": "application/json"})

    try:
        with urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = json.loads(exc.read().decode("utf-8"))
        raise RuntimeError(
            f"HTTP {exc.code}: {body.get('title', 'Unknown error')}"
        ) from exc


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python fetch_account_stdlib.py <PUBLIC_KEY>")
        sys.exit(1)

    try:
        account = fetch_account(sys.argv[1])
        print(json.dumps(account, indent=2))
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## Example output

```
Account ID : GABC...PUBLIC_KEY
Sequence   : 125893021482
Subentries : 2

Balances:
  XLM                    1240.4019234
  USDC:GBBD47IF...        500.0000000

Signers:
  GABC...PUBLIC_KEY  weight=1
```
