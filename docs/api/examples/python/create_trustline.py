"""
Add a trustline so an account can hold a custom Stellar asset.

Usage:
    pip install stellar-sdk
    python docs/api/examples/python/create_trustline.py <SECRET_KEY> <ASSET_CODE> <ASSET_ISSUER> [LIMIT]

Example:
    python docs/api/examples/python/create_trustline.py SXXX... USDC GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
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
    """Add a trustline. Returns the transaction hash."""
    server = Server(HORIZON_URL)
    keypair = Keypair.from_secret(secret_key)
    account = server.load_account(keypair.public_key)
    asset = Asset(asset_code, asset_issuer)

    # Check reserve
    xlm_balance = next(
        float(b["balance"]) for b in account.raw_data["balances"]
        if b["asset_type"] == "native"
    )
    subentries = account.raw_data["subentry_count"]
    min_balance = (2 + subentries + 1) * 0.5
    if xlm_balance < min_balance:
        raise ValueError(
            f"Insufficient XLM. Need at least {min_balance:.1f} XLM "
            f"(have {xlm_balance:.7f} XLM)."
        )

    builder = (
        TransactionBuilder(
            source_account=account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .set_timeout(180)
    )

    if limit is not None:
        builder.append_change_trust_op(asset=asset, limit=limit)
    else:
        builder.append_change_trust_op(asset=asset)

    tx = builder.build()
    tx.sign(keypair)

    response = server.submit_transaction(tx)
    return response["hash"]


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
        print("✓ Trustline created!")
        print(f"  Asset: {code}:{issuer[:8]}...")
        print(f"  Limit: {limit or 'maximum'}")
        print(f"  Hash : {tx_hash}")
    except Exception as exc:
        print(f"✗ Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
