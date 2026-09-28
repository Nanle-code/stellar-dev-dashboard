# Path payment quotes

The Path Explorer supports both Stellar path-payment modes:

- **Strict send** fixes the source amount and finds the greatest destination
  amount. Use it when the sender has an exact amount available.
- **Strict receive** fixes the destination amount and finds the smallest source
  amount. Use it when the recipient must receive an exact amount.

Select the network, enter native XLM or a credit asset code and issuer, and
choose the amount for the selected mode. Results show both source and
destination amounts, intermediate assets, and each quote's percentage
difference from the best result. This percentage compares Horizon quotes; it
is not a guaranteed execution-price tolerance.

Amounts must be positive Stellar decimals with no more than seven fractional
digits. Credit assets require an alphanumeric code of at most 12 characters and
a valid Stellar `G...` issuer. Invalid input is rejected before a network
request. Unsupported networks, Horizon errors, malformed responses, and
connectivity failures are presented as explicit errors rather than empty quote
results.

Quotes can change between discovery and transaction submission as liquidity
changes. Applications should refresh stale quotes and apply their own source or
destination bounds when constructing the final path-payment operation.

## Amount Conservation and Rounding Invariants

When constructing path payments from discovered quotes, always enforce Stellar's mathematical invariants:

- **Precision & Stroops**: Amounts are quantized to 7 decimal places ($10^7$ stroops). Internal calculations use integer stroops to eliminate floating-point drift.
- **Strict Send (`destMin`)**: Always use **floor** rounding for `destMin` ($\text{destMin} \le \text{expectedDestAmount}$) so the recipient never receives less than the specified floor.
- **Strict Receive (`sendMax`)**: Always use **ceiling** rounding for `sendMax` ($\text{sendMax} \ge \text{expectedSourceAmount}$) so the sender provides sufficient headroom for execution.
- **Intermediate Hops**: Stellar transactions support a maximum of 5 intermediate hops (`MAX_PATH_HOPS = 5`).
- **AMM Conservation**: Liquidity pool hops preserve constant-product invariant $(R_A + \Delta A \cdot (1-f))(R_B - \Delta B) \ge R_A \cdot R_B$.

For developer details and property testing instructions, see the [Path Payment Invariants Guide](../../../docs/features/PATH_PAYMENT_INVARIANTS.md).
