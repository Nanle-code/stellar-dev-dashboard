# stellar.toml Inspector (SEP-1)

**Issue:** #972 — Add a SEP-0001 stellar.toml inspector and validator for any home domain

## What it does

Given a home domain, this tool:

1. Fetches `/.well-known/stellar.toml` and reports transport diagnostics:
   HTTPS use, the `Access-Control-Allow-Origin` (CORS) header, content
   type, and payload size.
2. Parses the file (reusing `anchorService.parseToml()` from
   `src/lib/anchors.ts`) and validates it against the SEP-1 fields this
   inspector understands: `NETWORK_PASSPHRASE`, `SIGNING_KEY` (checked
   against the Stellar public-key format), `VERSION`, and `[[CURRENCIES]]`
   entries (each requiring a `code` and a valid `issuer` public key).
3. Validates every known SEP endpoint field (`WEB_AUTH_ENDPOINT`,
   `TRANSFER_SERVER`, `TRANSFER_SERVER_SEP0024`, `KYC_SERVER`,
   `DIRECT_PAYMENT_SERVER`, `ANCHOR_QUOTE_SERVER`) against the #836
   anti-phishing allowlist (`validateEndpointUrl()` from
   `src/lib/endpointAllowlist.ts`) — an endpoint on an unrelated or
   lookalike domain is flagged, not silently trusted.
4. Cross-checks each `[[CURRENCIES]]` issuer against Horizon
   (`fetchAccount()` from `src/lib/stellar.ts`): confirms the issuer
   account exists and that its `home_domain` matches the domain being
   inspected.
5. Lets the result be exported as JSON.

## Where it lives

- `src/lib/stellarTomlInspector.ts` — core logic, no UI dependency.
- `src/components/dashboard/StellarTomlInspector.tsx` — the view, registered
  under the **Explore** sidebar group as `stellarTomlInspector`
  (`src/routes/routes.ts`).
- `src/lib/__tests__/stellarTomlInspector.test.ts` — unit tests.

## Design notes / compatibility

- **TOML parsing is intentionally reused, not replaced.** `anchors.ts`'s
  `parseToml()` is a hand-rolled, line-based parser — not a full TOML
  spec implementation. It handles simple `KEY = "value"` pairs and
  `[[CURRENCIES]]` arrays of tables correctly, which covers every field
  this inspector needs. It does **not** handle multi-line strings,
  arrays, booleans, or numeric values other than as raw strings. A
  `stellar.toml` using those TOML features will parse those fields as
  `undefined` or malformed rather than throwing — this inspector reports
  what it can validate and does not claim full SEP-1 coverage of every
  possible TOML construct.
- **HTTPS is enforced by construction, not detected.** The inspector only
  ever requests `https://<domain>/.well-known/stellar.toml` — it does not
  attempt an `http://` fallback. The `transport.https` field is therefore
  always `true` on a successful fetch; a domain with no working HTTPS
  endpoint will fail at the fetch step instead, and the inspector reports
  that failure clearly rather than silently trying an insecure fallback.
- **Endpoint checks are allowlist-based, not merely "is it HTTPS."** An
  endpoint pointing to `https://<home-domain>.evil.test/auth` is valid
  HTTPS but is correctly rejected here, since it isn't on the home domain
  or its subdomains (or an explicitly configured cross-domain allowance).
- **The Horizon cross-check needs network access to Horizon.** In tests,
  `fetchAccount` is mocked. In the running app, a currency issuer that
  Horizon can't reach (rate limiting, network issues) is reported as
  "not found," which is indistinguishable from a genuinely nonexistent
  issuer at this layer — this is a known limitation worth improving if
  Horizon reliability becomes an issue in practice.

## Security, rollout, and migration notes

- No new endpoints are ever fetched outside of the domain's own
  `stellar.toml` and the endpoints it declares — those are filtered
  through the existing #836 allowlist before being reported as valid.
- No secrets or credentials are read or transmitted; this is a read-only
  diagnostic tool.
- Nothing here changes any existing SEP-10/SEP-24 flow in `anchors.ts` —
  this is a net-new, additive view with no changes to existing exports'
  behavior.
- No database or persisted state is introduced; every inspection is
  fetched live and only exists in component state until the page is
  reloaded or a JSON export is downloaded.
