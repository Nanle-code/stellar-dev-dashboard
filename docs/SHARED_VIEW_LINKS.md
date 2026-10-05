# Shareable view links

Debugging a dashboard view usually means sending a screenshot. A screenshot
describes what you saw but cannot be acted on: the recipient has to guess which
network, which tab, which account, and which filters produced it.

A **share link** encodes those inputs instead. Opening the link rebuilds the
view, so a teammate or a bug reporter lands on the same screen you did.

```
/transactions?v=1&n=testnet&t=transactions&e=account%3AGAAZI4…&at=58123412&f=%7B%22f%22…
```

- **How to use it:** press the **Share** button in the dashboard toolbar, then
  **Copy**. Optionally tick **Pin to ledger N** first.
- **What is in it:** network, tab, the selected entity, active filters, and an
  optional pinned ledger sequence.
- **What is never in it:** wallet keys, session tokens, or your connected
  wallet. See [Security model](#security-model).

---

## User-facing behaviour

### The Share panel

Pressing **Share** opens a panel showing the exact link, a **Copy** button, the
optional ledger pin, and a plain statement of what the link contains.

The panel closes on **Escape** or on an outside click.

### Ledger pinning

A pinned link reproduces the view *as of a specific ledger*. Tick
**Pin to ledger N** and the link records the most recent ledger the dashboard
has observed.

Pinning is only offered where it can actually be honoured:

| Data source | Pin honoured | How |
| --- | --- | --- |
| Horizon paginated reads — transactions, operations, payments, offers, account, search, DEX, live activity, compare, claimable balances, anchors, real-time ledger | Yes | A `desc` Horizon paging cursor anchored at the sequence |
| Locally retained ledger history — network stats | Yes | The page is sliced at the sequence; no extra request |
| Soroban RPC — contracts, contract interaction, contract ABI, Soroban debug | **No** | The sequence is recorded for reference only |

The third row is the important one. Soroban RPC has no historical read, and
simulation always evaluates against the latest ledger, so a "pinned" contract
view would show live data under a frozen label. The Share panel disables the
checkbox and the banner says so, rather than implying the data is frozen.

If no ledger sequence has been observed yet, the checkbox is disabled too — the
dashboard will not invent a sequence to make the option look available.

### The recipient's view

Opening a shared link:

- applies the link's **tab, entity, filters, and ledger pin** to your dashboard;
- **leaves your network alone and shows a warning banner** when the link's
  network differs from yours. The banner names both networks, states that the
  data on screen is from *your* network, and offers a one-click
  **Switch to \<network\>**;
- shows the pinned ledger, or states plainly that this view cannot enforce it;
- offers **Exit shared view**, which removes the link parameters from the URL
  and leaves you on your own settings.

Your network is not switched for you. Silently flipping you onto the sender's
network would refetch everything under a network you never chose, and would
leave nothing for the banner to report. Switching is a deliberate action.

The tab *is* applied, including navigating the address bar to the link's route.
A link never leaves a view rendering behind a stale URL.

You are never signed out, and a link never changes which wallet is connected.

---

## URL format

Parameters are query parameters rather than a base64 hash: a shared link is
read by a human while debugging, and every field should be diffable in a bug
report.

| Param | Name | Example | Notes |
| --- | --- | --- | --- |
| `v` | schema version | `1` | Absent or unrecognised ⇒ parsed best-effort |
| `n` | network | `testnet` | One of `mainnet`, `testnet`, `futurenet`, `local`, `custom` |
| `t` | tab / route | `transactions` | Unknown route ⇒ falls back to `overview` |
| `e` | entity | `account:GAAZI4…`, `tx:9f2c…`, `contract:CA3D5…` | Validated per kind on encode **and** decode |
| `f` | filters | `{"f":{"status":"failed"},"x":[{"key":"tx.memo",…}]}` | Compact JSON; defaults omitted |
| `at` | ledger sequence | `58123412` | Integer, `1` … `MAX_SAFE_INTEGER` |

`f` holds two sub-objects: `f` for the simple transaction filters, `x` for
filter expressions. Both are validated on decode.

Unrelated query parameters (`?ref=incident-42`) are preserved when the link is
generated, and left alone when it is read.

---

## Security model

Shared links travel through chat, issue trackers and public bug reports, so the
pipeline is built to make leakage structurally impossible rather than merely
unlikely.

### 1. Allow-list extraction

`selectShareableState()` reads named fields off the store. It does not iterate
the store, so a secret added to the store later cannot leak into a link by
default. Adding a field to the allow-list is a deliberate, reviewable edit.

### 2. Allow-list serialization

`buildShareUrl()` emits only the parameters in `SHARE_PARAMS`. Anything else in
a snapshot is dropped.

### 3. Deny-list scrubbing

`SECRET_KEY_PATTERN` rejects any key that even *looks* credential-bearing
(`secret`, `mnemonic`, `seed`, `private`, `password`, `passphrase`, `token`,
`api_key`, `authorization`, `bearer`, `credential`, `wallet`, `session`,
`cookie`, `signature`, `signer`, `header`, `auth`).

`looksLikeSecretValue()` independently rejects values shaped like a Stellar
secret seed, a raw 32-byte ed25519 private key, a PEM private-key block, a
JWT, or a bearer token — regardless of the key they hang off.

This is defence in depth behind (1) and (2), and it is what keeps the guarantee
true if someone widens the allow-list carelessly later.

### 4. Length caps

Entity ids (128 chars), filter values (120 chars) and filter expressions (20)
are truncated or dropped, and raw filter payloads above 4 KB are rejected before
parsing. A link cannot be used to smuggle arbitrary payload into a teammate's
address bar.

### Which entities can be restored

`e=` accepts `tx`, `op`, `account`, `contract`, and `balance`, and all five are
validated on decode — a hand-edited or future link naming one of them is not
rejected.

Only the kinds the store can represent are actually re-applied: `account` (the
account being viewed) and `contract`. For `tx`, `op`, and `balance` the store
has no selected-record field, so the link opens with an
`entity-not-applied:<kind>` warning rather than dropping the entity silently and
letting you believe you are looking at the right record.

### Never shared

These store fields are structurally excluded:

- `walletConnected`, `walletType`, `walletPublicKey`, `walletSessionRevokedReason`
- `sessionRecordingActive`, `sessionRecordingId`
- `multiSigMode`
- `customTheme`, `themeBuilderDraft`
- custom-network `headers`, and any credential

`connectedAddress` **is** shared. It is the account being *viewed*, which is
public ledger data and is essential to reproducing the view. It is carried as a
validated `e=account:…` entity, never as raw store state, and it is never
confused with `walletPublicKey`.

### Link integrity

`buildShareUrl()` refuses a `javascript:`, `data:`, `vbscript:`, `blob:` or
`file:` base, so a copied link cannot become a script-execution vector.

### Test coverage

`src/lib/__tests__/shareLinks.test.ts` and
`src/components/share/__tests__/shareView.test.tsx` assert that a store
populated with every sensitive field the app tracks still yields a link with no
credential-shaped content (`findSecretLikeContent(url)` is `[]`), and that the
connected wallet key is never substituted for the viewed account.

---

## Compatibility

**Older recipients.** A link with an unrecognised or absent `v` is parsed
best-effort: known fields are honoured, fields a newer build added are ignored
rather than half-applied. A link carries no `v` at all still opens. Warnings
are surfaced rather than swallowed.

**Older senders.** A future schema version is *not* refused. `v=99` opens and
applies the fields this build understands, with a `future-schema-version`
warning.

**Unknown routes.** A `t=` value this build does not recognise falls back to
`overview` with an `unknown-tab` warning, rather than routing somewhere
unexpected.

**Corrupt links.** Every decode problem is non-fatal and reported as a
warning; the affected field is dropped and the rest of the view still opens.
`parseShareUrl()` never throws — it runs on every page load against
attacker-controllable input.

### Compatibility with the collaboration session hash

Shared links use **query parameters**; the existing collaboration feature uses
a **hash fragment** (`#<base64>`, see `src/utils/stateSync.ts`). The two do not
collide, and both may be present in the same URL. The hash remains the
collaboration channel; the query string is the shareable-view channel.

---

## Migration notes

**For users:** no action. The **Share** button appears in the dashboard toolbar.

**For developers:**

- New store state is **not** shared by default. If a new field is needed in a
  link, add it to `ShareableViewState` and `selectShareableState()` in
  `src/lib/shareLinks.ts`, then to the encoder and the decoder. Anything not in
  that path cannot reach a URL.
- `ledgerPin` was added to the store and is deliberately **not** in
  `PERSIST_KEYS`. A pin belongs to a shared link and the current session, not to
  a durable preference; persisting it would leave a stale pin silently applied
  to later unrelated work in the same browser. The URL is the source of truth
  and `useSharedView` re-applies it on load.
- To add a route that can honour a ledger pin, add it to `TAB_PIN_STRATEGY` in
  `src/lib/ledgerPin.ts` and record how the pin is applied. Leaving a route out
  means the UI reports that the pin is not enforced, which is the safe default.
- A shared link **never** writes the recipient's wallet or session state, and
  never clears their `connectedAddress`. Keep it that way: it is what makes a
  link safe to paste anywhere.

### Code map

| Concern | File |
| --- | --- |
| Link format, security model | `src/lib/shareLinks.ts` |
| Ledger pin semantics and support matrix | `src/lib/ledgerPin.ts` |
| URL ⇄ store bridge | `src/hooks/useSharedView.ts` |
| Share action UI | `src/components/share/ShareViewButton.tsx` |
| Mismatch banner | `src/components/share/SharedViewBanner.tsx` |
| Route registry the `t=` param is validated against | `TABS` in `src/routes/DashboardLayout.tsx` |
