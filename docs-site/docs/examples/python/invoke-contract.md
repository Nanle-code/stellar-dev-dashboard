---
id: invoke-contract
title: Invoke Soroban Contract (Python)
sidebar_label: Invoke Contract
---

# Invoke Soroban Contract — Python

Full simulate → prepare → sign → send → poll flow using `stellar-sdk`.

```python title="invoke_contract.py"
"""
Invoke a Soroban smart contract function on the Stellar testnet.

Usage:
    pip install stellar-sdk
    python invoke_contract.py <SECRET_KEY> <CONTRACT_ID> <FUNCTION_NAME>
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
POLL_INTERVAL_SECONDS = 3


def invoke_contract(
    secret_key: str,
    contract_id: str,
    function_name: str,
    args: list | None = None,
) -> object:
    """
    Invoke a Soroban contract function and return the native Python return value.

    Steps:
      1. Load account from RPC
      2. Build unsigned transaction
      3. Simulate to get fee + footprint
      4. Prepare (inject footprint + auth)
      5. Sign
      6. Send
      7. Poll until SUCCESS or FAILED
    """
    server = SorobanServer(RPC_URL)
    keypair = Keypair.from_secret(secret_key)

    # 1. Load source account
    source_account = server.load_account(keypair.public_key)

    # 2. Build unsigned transaction
    builder = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .set_timeout(30)
    )

    if args:
        builder.append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name=function_name,
            parameters=args,
        )
    else:
        builder.append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name=function_name,
        )

    tx = builder.build()

    # 3. Simulate
    sim_response = server.simulate_transaction(tx)
    print(f"Min resource fee : {sim_response.min_resource_fee} stroops")

    if sim_response.error:
        raise RuntimeError(f"Simulation failed: {sim_response.error}")

    # 4. Prepare (inject footprint + auth + fee)
    prepared_tx = server.prepare_transaction(tx, sim_response)

    # 5. Sign
    prepared_tx.sign(keypair)

    # 6. Send
    send_response = server.send_transaction(prepared_tx)
    print(f"Submitted. Hash   : {send_response.hash}")
    print(f"Initial status    : {send_response.status}")

    if send_response.status == "ERROR":
        raise RuntimeError(f"Send failed: {send_response.error_result_xdr}")

    # 7. Poll
    for attempt in range(MAX_POLL_ATTEMPTS):
        time.sleep(POLL_INTERVAL_SECONDS)
        tx_response = server.get_transaction(send_response.hash)

        print(f"  Poll {attempt + 1}: {tx_response.status}")

        if tx_response.status == GetTransactionStatus.SUCCESS:
            print("Contract call succeeded!")
            return tx_response.return_value
        if tx_response.status == GetTransactionStatus.FAILED:
            raise RuntimeError(
                f"Contract call failed. Result XDR: {tx_response.result_xdr}"
            )

    raise TimeoutError(
        f"Transaction not confirmed after {MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECONDS}s"
    )


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python invoke_contract.py <SECRET> <CONTRACT_ID> <FUNCTION>")
        sys.exit(1)

    secret = sys.argv[1]
    contract_id = sys.argv[2]
    function_name = sys.argv[3]

    try:
        result = invoke_contract(secret, contract_id, function_name)
        print(f"\nReturn value: {result}")
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## Passing arguments to the contract

```python
from stellar_sdk import scVal

# u32 integer
args = [scVal.to_uint32(42)]

# i128 (large integer)
args = [scVal.to_int128(1_000_000)]

# Address (account or contract)
from stellar_sdk import Address
args = [Address("GABC...PUBLIC_KEY").to_xdr_sc_val()]

# Symbol
args = [scVal.to_symbol("Counter")]

# Boolean
args = [scVal.to_bool(True)]
```

## Poll status values

| Status | Meaning |
|---|---|
| `NOT_FOUND` | Not yet in a ledger — keep polling |
| `SUCCESS` | Confirmed and execution succeeded |
| `FAILED` | Confirmed but contract execution failed |
