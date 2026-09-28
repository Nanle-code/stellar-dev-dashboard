---
id: create-trustline
title: Create Trustline (Python)
sidebar_label: Create Trustline
---

# Create Trustline — Python

```python title="create_trustline.py"
"""
Add a trustline so an account can hold a custom Stellar asset.

Usage:
    pip install stellar-sdk
    python create_trustline.py <SECRET_KEY> <ASSET_CODE> <ASSET_ISSUER> [LIMIT]
"""
import sys
from stellar_sdk import (
    Server,
    TransactionBuilder,
    Network,
    Asset,
    Keypair,
)


HORIZON_URL = "https://horizon-testnet.stellar.org"


def create_trustline(
    secret_key: str,
    asset_code: str,
    asset_issuer: str,
    limit: str | None = None,
) -> str:
    """
    Add a trustline for asset_code:asset_issuer.
    Returns the transaction hash.

    limit: Maximum asset amount to trust. Defaults to max if None.
    """
    server = Server(HORIZON_URL)
    keypair = Keypair.from_secret(secret_key)
    account = server.load_account(keypair.public_key)
    asset = Asset(asset_code, asset_issuer)

    builder = TransactionBuilder(
        source_account=account,
        network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
        base_fee=100,
    ).set_timeout(180)

    if limit is not None:
        builder.append_change_trust_op(asset=asset, limit=limit)
    else:
        builder.append_change_trust_op(asset=asset)

    tx = builder.build()
    tx.sign(keypair)

    response = server.submit_transaction(tx)
    return response["hash"]


def remove_trustline(secret_key: str, asset_code: str, asset_issuer: str) -> str:
    """
    Remove a trustline by setting limit to '0'.
    Account balance for this asset must be zero first.
    """
    return create_trustline(secret_key, asset_code, asset_issuer, limit="0")


def has_trustline(public_key: str, asset_code: str, asset_issuer: str) -> bool:
    """Check whether an account already has a trustline for an asset."""
    server = Server(HORIZON_URL)
    account = server.accounts().account_id(public_key).call()
    return any(
        b.get("asset_code") == asset_code and b.get("asset_issuer") == asset_issuer
        for b in account["balances"]
    )


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python create_trustline.py <SECRET> <ASSET_CODE> <ISSUER> [LIMIT]")
        sys.exit(1)

    secret = sys.argv[1]
    code = sys.argv[2]
    issuer = sys.argv[3]
    limit = sys.argv[4] if len(sys.argv) > 4 else None

    try:
        tx_hash = create_trustline(secret, code, issuer, limit)
        print(f"Trustline created! Hash: {tx_hash}")
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## Reserve note

Each trustline increases the account's minimum XLM reserve by **0.5 XLM** (one subentry). Make sure the account holds enough XLM before adding trustlines.

```python
def check_reserve(public_key: str, trustlines_to_add: int = 1) -> dict:
    """Calculate whether account has enough XLM to add more trustlines."""
    server = Server("https://horizon-testnet.stellar.org")
    account = server.accounts().account_id(public_key).call()

    base_reserve = 0.5
    subentries = account["subentry_count"]
    current_xlm = next(
        float(b["balance"]) for b in account["balances"]
        if b["asset_type"] == "native"
    )

    min_balance = (2 + subentries) * base_reserve
    required = (2 + subentries + trustlines_to_add) * base_reserve

    return {
        "current_xlm": current_xlm,
        "min_balance_now": min_balance,
        "min_balance_after": required,
        "can_add_trustlines": current_xlm >= required,
        "shortfall": max(0.0, required - current_xlm),
    }
```
