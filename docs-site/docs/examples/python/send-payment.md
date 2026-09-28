---
id: send-payment
title: Send Payment (Python)
sidebar_label: Send Payment
---

# Send Payment — Python

## XLM payment

```python title="send_payment.py"
"""
Send an XLM payment on the Stellar testnet.

Usage:
    pip install stellar-sdk
    python send_payment.py <SECRET_KEY> <DESTINATION> <AMOUNT> [MEMO]
"""
import sys
from stellar_sdk import (
    Server,
    TransactionBuilder,
    Network,
    Asset,
    Keypair,
    Memo,
)


HORIZON_URL = "https://horizon-testnet.stellar.org"


def send_xlm_payment(
    secret_key: str,
    destination: str,
    amount: str,
    memo: str | None = None,
) -> str:
    """Submit an XLM payment. Returns the transaction hash."""
    server = Server(HORIZON_URL)
    keypair = Keypair.from_secret(secret_key)
    source_account = server.load_account(keypair.public_key)

    builder = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .append_payment_op(
            destination=destination,
            asset=Asset.native(),
            amount=amount,
        )
        .set_timeout(180)
    )

    if memo:
        builder.add_text_memo(memo)

    tx = builder.build()
    tx.sign(keypair)

    response = server.submit_transaction(tx)
    return response["hash"]


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python send_payment.py <SECRET> <DESTINATION> <AMOUNT> [MEMO]")
        sys.exit(1)

    secret = sys.argv[1]
    destination = sys.argv[2]
    amount = sys.argv[3]
    memo = sys.argv[4] if len(sys.argv) > 4 else None

    try:
        tx_hash = send_xlm_payment(secret, destination, amount, memo)
        print(f"Success! Transaction hash: {tx_hash}")
        print(f"View on explorer: https://stellar.expert/explorer/testnet/tx/{tx_hash}")
    except Exception as exc:
        print(f"Payment failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## Custom asset payment

```python title="send_asset_payment.py"
"""
Send a custom asset (e.g. USDC) payment on the Stellar testnet.
The sending account must already have a trustline for the asset.
"""
from stellar_sdk import Server, TransactionBuilder, Network, Asset, Keypair


def send_asset_payment(
    secret_key: str,
    destination: str,
    asset_code: str,
    asset_issuer: str,
    amount: str,
) -> str:
    server = Server("https://horizon-testnet.stellar.org")
    keypair = Keypair.from_secret(secret_key)
    source_account = server.load_account(keypair.public_key)
    asset = Asset(asset_code, asset_issuer)

    tx = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .append_payment_op(
            destination=destination,
            asset=asset,
            amount=amount,
        )
        .set_timeout(180)
        .build()
    )

    tx.sign(keypair)
    response = server.submit_transaction(tx)
    return response["hash"]


# Example: send 50 USDC
# hash = send_asset_payment(
#     secret_key="SXXX...",
#     destination="GDEST...",
#     asset_code="USDC",
#     asset_issuer="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
#     amount="50",
# )
```

## Error handling

```python
from stellar_sdk.exceptions import BadRequestError

try:
    tx_hash = send_xlm_payment(secret, destination, amount)
    print("Hash:", tx_hash)
except BadRequestError as exc:
    # Horizon 400 — transaction rejected
    result_codes = exc.extras.get("result_codes", {})
    print("Transaction code:", result_codes.get("transaction"))
    print("Operation codes: ", result_codes.get("operations"))
except Exception as exc:
    print("Network or SDK error:", exc)
```
