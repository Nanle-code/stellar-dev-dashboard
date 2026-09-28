"""
Send an XLM payment on the Stellar testnet.

Usage:
    pip install stellar-sdk
    python docs/api/examples/python/send_payment.py <SECRET_KEY> <DESTINATION> <AMOUNT> [MEMO]

Example:
    python docs/api/examples/python/send_payment.py SXXX... GDEST... 10 "Hello"
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


def send_xlm_payment(
    secret_key: str,
    destination: str,
    amount: str,
    memo: str | None = None,
) -> str:
    """Send XLM and return the transaction hash."""
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
        builder.add_text_memo(memo[:28])  # Stellar memo text max 28 bytes

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
        print("✓ Payment successful!")
        print(f"  Hash: {tx_hash}")
        print(f"  View: https://stellar.expert/explorer/testnet/tx/{tx_hash}")
    except Exception as exc:
        print(f"✗ Payment failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
