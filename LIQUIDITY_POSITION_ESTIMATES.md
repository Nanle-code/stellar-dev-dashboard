# Liquidity-pool position estimates

The DEX Explorer's **Liquidity Pools** view turns an account's LP share balance into an estimated ownership percentage and underlying asset amounts. The **Manage → Withdraw** view also previews the assets returned, the percentage of pool reserves removed, and the position remaining after a proposed withdrawal.

## Using the estimates

1. Connect an account and select `DEX Explorer → Liquidity Pools`.
2. Search for an asset pair and select a pool.
3. Review **Your Position** for LP shares, pool ownership, reserves, and estimated underlying assets.
4. Open **Manage → Withdraw** and enter an LP share amount to preview the withdrawal impact before copying transaction parameters.

The preview is read-only. It does not submit or sign a transaction, and the displayed amounts are not slippage-protection minimums. Horizon reserve changes, ledger rounding, fees, and activity between preview and submission can change the final result. Set transaction minimum amounts based on the user's own tolerance and verify all values in a trusted signer.

## Compatibility and failure states

Estimates are available for Stellar mainnet, testnet, and futurenet. Local and custom environments are reported as unsupported because they are not guaranteed to expose Horizon liquidity-pool endpoints. Invalid pool data, malformed or excessive share input, missing positions, and Horizon/account request failures are shown explicitly instead of being rendered as zero balances.

The calculation uses proportional constant-product pool ownership:

- `ownership = account shares / total pool shares`
- `estimated asset amount = reserve × ownership`
- `pool reserve impact = withdrawal shares / total pool shares`

These values are informational estimates only and should never be treated as guaranteed execution output.
