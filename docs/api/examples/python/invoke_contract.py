"""
Invoke a Soroban smart contract function on the Stellar testnet.

Full flow: build → simulate → prepare → sign → send → poll.

Usage:
    pip install stellar-sdk
    python docs/api/examples/python/invoke_contract.py <SECRET_KEY> <CONTRACT_ID> <FUNCTION_NAME>

Example:
    python docs/api/examples/python/invoke_contract.py SXXX... CBXG... increment
"""
import sys
import time
from stellar_sdk import (
    SorobanServer,
    TransactionBuilder,
    Network,
    Keypair,
)
from stellar_sdk.soroban_rpc import GetTransactionStatus

RPC_URL = "https://soroban-testnet.stellar.org"
MAX_POLL_ATTEMPTS = 20
POLL_INTERVAL = 3  # seconds


def invoke_contract(
    secret_key: str,
    contract_id: str,
    function_name: str,
    args: list | None = None,
) -> object:
    """
    Invoke a Soroban contract function.
    Returns the raw return value from the RPC response.
    """
    server = SorobanServer(RPC_URL)
    keypair = Keypair.from_secret(secret_key)

    print("Loading account...")
    source_account = server.load_account(keypair.public_key)

    builder = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .set_timeout(30)
    )

    builder.append_invoke_contract_function_op(
        contract_id=contract_id,
        function_name=function_name,
        parameters=args or [],
    )

    tx = builder.build()

    # Simulate
    print("Simulating...")
    sim = server.simulate_transaction(tx)

    if sim.error:
        raise RuntimeError(f"Simulation failed: {sim.error}")

    print(f"  Min resource fee : {sim.min_resource_fee} stroops")

    # Prepare
    prepared_tx = server.prepare_transaction(tx, sim)

    # Sign
    prepared_tx.sign(keypair)

    # Send
    print("Sending...")
    send = server.send_transaction(prepared_tx)
    print(f"  Hash  : {send.hash}")
    print(f"  Status: {send.status}")

    if send.status == "ERROR":
        raise RuntimeError(f"Send failed: {send.error_result_xdr}")

    # Poll
    print("Polling for confirmation...")
    for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
        time.sleep(POLL_INTERVAL)
        result = server.get_transaction(send.hash)
        print(f"  Attempt {attempt}: {result.status}")

        if result.status == GetTransactionStatus.SUCCESS:
            print("✓ Contract call succeeded!")
            return result.return_value

        if result.status == GetTransactionStatus.FAILED:
            raise RuntimeError(f"Contract call failed: {result.result_xdr}")

    raise TimeoutError(
        f"Transaction not confirmed after {MAX_POLL_ATTEMPTS * POLL_INTERVAL}s"
    )


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python invoke_contract.py <SECRET> <CONTRACT_ID> <FUNCTION_NAME>")
        sys.exit(1)

    secret = sys.argv[1]
    contract_id = sys.argv[2]
    function_name = sys.argv[3]

    try:
        return_value = invoke_contract(secret, contract_id, function_name)
        print(f"\n  Return value: {return_value}")
    except Exception as exc:
        print(f"✗ Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
