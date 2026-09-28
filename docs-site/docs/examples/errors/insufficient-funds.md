---
id: insufficient-funds
title: Handling Insufficient Funds
sidebar_label: Insufficient Funds
---

# Handling Insufficient Funds

Stellar accounts must maintain a **minimum XLM balance** at all times. Sending too much or adding subentries (trustlines, offers, data entries) can push an account below its reserve.

## Minimum balance formula

```
min_balance = (2 + subentry_count) * 0.5 XLM
```

| Subentries | Min balance |
|---|---|
| 0 | 1.0 XLM |
| 1 trustline | 1.5 XLM |
| 2 trustlines | 2.0 XLM |
| 5 trustlines + 1 offer | 4.0 XLM |

## JavaScript — check before sending

```js title="check-balance.mjs"
import { Horizon, Asset } from '@stellar/stellar-sdk';

const BASE_RESERVE = 0.5; // XLM

async function getAccountInfo(publicKey, network = 'testnet') {
  const server = new Horizon.Server(
    network === 'testnet'
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org'
  );
  const account = await server.loadAccount(publicKey);

  const xlmBalance = parseFloat(
    account.balances.find(b => b.asset_type === 'native')?.balance ?? '0'
  );

  const minBalance = (2 + account.subentry_count) * BASE_RESERVE;
  const spendable = Math.max(0, xlmBalance - minBalance);

  return { xlmBalance, minBalance, spendable, subentries: account.subentry_count };
}

async function canAffordPayment(publicKey, amountXlm, feeStoops = 100) {
  const { spendable } = await getAccountInfo(publicKey);
  const feeXlm = feeStoops / 10_000_000;
  const total = parseFloat(amountXlm) + feeXlm;

  if (total > spendable) {
    throw new Error(
      `Insufficient spendable balance. ` +
      `Need ${total.toFixed(7)} XLM but only ${spendable.toFixed(7)} XLM available ` +
      `(after minimum reserve).`
    );
  }

  return true;
}

// Usage
try {
  await canAffordPayment('GABC...PUBLIC_KEY', '100');
  console.log('Account has enough balance. Proceeding with payment...');
} catch (err) {
  console.error(err.message);
}
```

## JavaScript — handle op_underfunded and op_low_reserve

```js
try {
  await server.submitTransaction(tx);
} catch (err) {
  const opCodes = err.response?.data?.extras?.result_codes?.operations ?? [];

  for (const code of opCodes) {
    if (code === 'op_underfunded') {
      console.error('Insufficient asset balance for this operation.');
      console.error('→ Check the account balance or reduce the amount.');
    }
    if (code === 'op_low_reserve') {
      console.error('Operation would drop account below minimum XLM reserve.');
      console.error('→ Fund the account or remove some subentries to free up reserve.');
    }
  }
}
```

## Python

```python title="check_balance.py"
BASE_RESERVE = 0.5  # XLM per subentry


def get_spendable_xlm(server, public_key: str) -> dict:
    """Return XLM balance breakdown for an account."""
    account = server.accounts().account_id(public_key).call()
    xlm = next(
        float(b["balance"]) for b in account["balances"]
        if b["asset_type"] == "native"
    )
    subentries = account["subentry_count"]
    min_balance = (2 + subentries) * BASE_RESERVE
    spendable = max(0.0, xlm - min_balance)

    return {
        "xlm_balance": xlm,
        "min_balance": min_balance,
        "spendable": spendable,
        "subentries": subentries,
    }


def can_afford_payment(server, public_key: str, amount: float, fee_stroops: int = 100) -> bool:
    info = get_spendable_xlm(server, public_key)
    fee_xlm = fee_stroops / 10_000_000
    total_needed = amount + fee_xlm

    if total_needed > info["spendable"]:
        raise ValueError(
            f"Insufficient funds. Need {total_needed:.7f} XLM, "
            f"have {info['spendable']:.7f} XLM spendable."
        )
    return True
```

## Fund via Friendbot (testnet only)

```js
async function fundTestnetAccount(publicKey) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${res.statusText}`);
  const data = await res.json();
  console.log('Funded with 10,000 XLM. Hash:', data.hash);
  return data.hash;
}
```

```python
import urllib.request, json

def fund_testnet_account(public_key: str) -> str:
    url = f"https://friendbot.stellar.org?addr={public_key}"
    with urllib.request.urlopen(url) as r:
        data = json.loads(r.read())
    print(f"Funded with 10,000 XLM. Hash: {data['hash']}")
    return data["hash"]
```
