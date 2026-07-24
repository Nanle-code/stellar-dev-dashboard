---
id: developer-toolkit
title: Developer Toolkit
sidebar_label: Developer Toolkit
---

# Developer Toolkit

The Stellar Dev Dashboard includes an integrated developer toolkit that brings the most important Stellar workflows into a single interface.

This guide explains the toolkit in five structured steps:

- API Explorer
- Transaction Builder
- XDR Tools
- Inspector
- Console

## Overview

The toolkit is designed for developers who want to build, test, and debug Stellar applications without switching between multiple external tools.

It combines:

- interactive Horizon and Soroban API testing
- visual transaction creation and fee guidance
- raw XDR encoding, decoding, and validation
- rich ledger and contract inspection
- a developer console for REPL-style execution and debugging

## Implementation Details

The dashboard uses a modular, browser-native implementation:

- `docs/api/openapi.yaml` powers the interactive API Explorer and ensures the API surface matches live Stellar endpoints.
- Transaction building is backed by reusable Stellar SDK helpers, with visual operation forms and XDR export.
- XDR tools are implemented using Stellar XDR parsing utilities, plus extra validation and signature helpers.
- Ledger and contract inspectors query Horizon and Soroban endpoints to surface account state, contract ABIs, and storage details.
- The console exposes a developer REPL for executing small snippets, inspecting objects, and debugging workflows.

### How it fits together

1. The API Explorer is the first stop for exploring raw network endpoints and experimenting with request / response payloads.
2. The Transaction Builder takes those request ideas and turns them into real Stellar transactions, with a live preview and fee estimate.
3. XDR Tools let developers inspect the binary transaction payload, verify signatures, and validate transaction structure.
4. The Inspector surfaces ledger state, account metadata, contract interfaces, and deployed storage so developers can confirm expected on-chain state.
5. The Console helps with immediate troubleshooting by allowing code execution and debugging in the same environment.

## Step 1: API explorer

The API Explorer is the integrated starting point for interactive Stellar API testing.

### Interactive API testing

- Execute Horizon REST calls directly from the browser.
- Run Soroban RPC requests against testnet or mainnet.
- Inspect request and response bodies without leaving the dashboard.

### Request builder

- Build requests with live request field helpers.
- Choose endpoints and payload formats.
- Copy request examples for use in Postman, curl, or other tooling.

### Response viewer

- View raw JSON responses from Horizon and Soroban.
- Inspect response metadata, result codes, and error details.
- Use the viewer to confirm network behavior before building transactions.

## Step 2: Transaction builder

The Transaction Builder is a visual workflow for constructing Stellar transactions.

### Visual operation builder

- Add one or more operations using guided forms.
- Configure operation parameters for payments, trustlines, offers, contract invocations, and more.
- Reorder, edit, or remove operations without manual XDR editing.

### XDR preview

- Preview the transaction XDR before signing.
- Export raw transaction envelopes to paste into other tools or share with collaborators.
- Confirm the exact transaction payload that will be submitted.

### Fee estimation

- See recommended base fee values for your transaction.
- Estimate total transaction fees before submission.
- Use fee bump and sponsorship options when needed.

## Step 3: XDR tools

XDR Tools help developers inspect, verify, and validate transaction payloads.

### XDR encoder/decoder

- Encode transaction objects into base64 XDR.
- Decode raw XDR strings into readable transaction structure.
- Inspect operations, memos, time bounds, and other transaction details.

### Signature verification

- Verify that signatures are valid for the supplied XDR.
- Identify which signers have already signed a transaction.
- Validate multi-signature sessions and partial signing flows.

### XDR validation

- Confirm XDR format validity before sending it to the network.
- Detect malformed envelopes and invalid base64 payloads.
- Use validation feedback to fix transaction issues early.

## Step 4: Inspector

The Inspector surfaces on-chain state and contract metadata for faster debugging.

### Ledger data explorer

- Explore ledgers, transactions, and operations directly from the dashboard.
- Search by account, ledger sequence, or transaction hash.
- Inspect the current state of on-chain resources.

### Contract ABI inspector

- Browse deployed Soroban contract ABIs.
- View available functions, argument types, and return types.
- Use the ABI inspector to build safe contract calls.

### Account inspector

- View account balances, signers, thresholds, and trustlines.
- Inspect account activity and sequence values.
- Confirm account state before submitting transactions.

## Step 5: Console

The Console provides an interactive developer environment inside the dashboard.

### Developer REPL

- Execute JavaScript expressions and inspect results.
- Work with Stellar SDK objects in a live session.
- Rapidly test small snippets without leaving the browser.

### Code execution

- Run code that interacts with Horizon, Soroban, and dashboard helpers.
- Evaluate transaction building, signing, and submission logic.
- Iterate faster with immediate feedback.

### Debugging

- Inspect runtime errors and response details.
- Use console output to validate assumptions and trace issues.
- Debug transaction workflows, contract calls, and API integrations in one place.
