import * as StellarSdk from "@stellar/stellar-sdk";
import { getServer, NETWORKS, isValidPublicKey } from "./stellar";
import { measureAsync, recordCustomMetric } from "./performanceMonitoring";

export const OPERATION_TYPES = [
  { value: "payment", label: "Payment" },
  { value: "createAccount", label: "Create Account" },
  { value: "changeTrust", label: "Change Trust" },
  { value: "manageSellOffer", label: "Manage Sell Offer" },
  { value: "manageBuyOffer", label: "Manage Buy Offer" },
  { value: "setOptions", label: "Set Options" },
  { value: "accountMerge", label: "Account Merge" },
  { value: "manageData", label: "Manage Data" },
  // Extended operation types (#111)
  { value: "pathPaymentStrictSend", label: "Path Payment (Strict Send)" },
  { value: "pathPaymentStrictReceive", label: "Path Payment (Strict Receive)" },
  { value: "claimClaimableBalance", label: "Claim Claimable Balance" },
  { value: "createClaimableBalance", label: "Create Claimable Balance" },
  { value: "bumpSequence", label: "Bump Sequence" },
  { value: "revokeSponsorship", label: "Revoke Sponsorship" },
  { value: "beginSponsoringFutureReserves", label: "Begin Sponsoring Future Reserves" },
  { value: "endSponsoringFutureReserves", label: "End Sponsoring Future Reserves" },
  // Fee-bump, sponsorship, and clawback operations (#196)
  { value: "feeBump", label: "Fee-Bump Transaction" },
  { value: "clawback", label: "Clawback" },
];

export function createOperation(type, params) {
  switch (type) {
    case "payment":
      return StellarSdk.Operation.payment({
        destination: params.destination,
        asset:
          params.assetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(params.assetCode, params.assetIssuer),
        amount: params.amount,
      });

    case "createAccount":
      return StellarSdk.Operation.createAccount({
        destination: params.destination,
        startingBalance: params.startingBalance,
      });

    case "changeTrust":
      return StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset(params.assetCode, params.assetIssuer),
        limit: params.limit || undefined,
      });

    case "manageSellOffer":
      return StellarSdk.Operation.manageSellOffer({
        selling:
          params.sellingAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(
                params.sellingAssetCode,
                params.sellingAssetIssuer,
              ),
        buying:
          params.buyingAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(
                params.buyingAssetCode,
                params.buyingAssetIssuer,
              ),
        amount: params.amount,
        price: params.price,
      });

    case "manageBuyOffer":
      return StellarSdk.Operation.manageBuyOffer({
        selling:
          params.sellingAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(
                params.sellingAssetCode,
                params.sellingAssetIssuer,
              ),
        buying:
          params.buyingAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(
                params.buyingAssetCode,
                params.buyingAssetIssuer,
              ),
        buyAmount: params.buyAmount,
        price: params.price,
      });

    case "setOptions":
      const options = {};
      if (params.homeDomain) options.homeDomain = params.homeDomain;
      if (params.setFlags) options.setFlags = parseInt(params.setFlags);
      if (params.clearFlags) options.clearFlags = parseInt(params.clearFlags);
      return StellarSdk.Operation.setOptions(options);

    case "accountMerge":
      return StellarSdk.Operation.accountMerge({
        destination: params.destination,
      });

    case "manageData":
      return StellarSdk.Operation.manageData({
        name: params.name,
        value: params.value || null,
      });

    // ── Extended operations (#111) ──────────────────────────────────────────

    case "pathPaymentStrictSend":
      return StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset:
          params.sendAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(params.sendAssetCode, params.sendAssetIssuer),
        sendAmount: params.sendAmount,
        destination: params.destination,
        destAsset:
          params.destAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(params.destAssetCode, params.destAssetIssuer),
        destMin: params.destMin,
        path: (params.path || []).map(
          (a) => new StellarSdk.Asset(a.assetCode, a.assetIssuer),
        ),
      });

    case "pathPaymentStrictReceive":
      return StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset:
          params.sendAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(params.sendAssetCode, params.sendAssetIssuer),
        sendMax: params.sendMax,
        destination: params.destination,
        destAsset:
          params.destAssetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(params.destAssetCode, params.destAssetIssuer),
        destAmount: params.destAmount,
        path: (params.path || []).map(
          (a) => new StellarSdk.Asset(a.assetCode, a.assetIssuer),
        ),
      });

    case "claimClaimableBalance":
      return StellarSdk.Operation.claimClaimableBalance({
        balanceId: params.balanceId,
      });

    case "createClaimableBalance": {
      const claimants = (params.claimants || []).map(
        (c) => new StellarSdk.Claimant(c.destination, c.predicate),
      );
      return StellarSdk.Operation.createClaimableBalance({
        asset:
          params.assetType === "native"
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(params.assetCode, params.assetIssuer),
        amount: params.amount,
        claimants,
      });
    }

    case "bumpSequence":
      return StellarSdk.Operation.bumpSequence({
        bumpTo: params.bumpTo,
      });

    case "revokeSponsorship":
      return StellarSdk.Operation.revokeAccountSponsorship({
        account: params.account,
      });

    case "beginSponsoringFutureReserves":
      return StellarSdk.Operation.beginSponsoringFutureReserves({
        sponsoredId: params.sponsoredId,
      });

    case "endSponsoringFutureReserves":
      return StellarSdk.Operation.endSponsoringFutureReserves({});

    case "clawback":
      return StellarSdk.Operation.clawback({
        asset: new StellarSdk.Asset(params.assetCode, params.assetIssuer),
        from: params.from,
        amount: params.amount,
      });

    default:
      throw new Error(`Unsupported operation type: ${type}`);
  }
}

export async function buildTransaction({
  sourceAccount,
  operations,
  memo,
  memoType = "text",
  baseFee = 100,
  timeout = 180,
  network = "testnet",
}) {
  if (!isValidPublicKey(sourceAccount)) {
    throw new Error("Invalid source account");
  }

  if (!operations || operations.length === 0) {
    throw new Error("At least one operation is required");
  }

  const server = getServer(network);
  const account = await server.loadAccount(sourceAccount);

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: baseFee.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  }).setTimeout(timeout);

  // Add operations
  operations.forEach((op) => {
    const operation = createOperation(op.type, op.params);
    txBuilder.addOperation(operation);
  });

  // Add memo
  if (memo) {
    switch (memoType) {
      case "text":
        txBuilder.addMemo(StellarSdk.Memo.text(memo));
        break;
      case "id":
        txBuilder.addMemo(StellarSdk.Memo.id(memo));
        break;
      case "hash":
        txBuilder.addMemo(StellarSdk.Memo.hash(memo));
        break;
      case "return":
        txBuilder.addMemo(StellarSdk.Memo.return(memo));
        break;
    }
  }

  return txBuilder.build();
}

export async function simulateTransaction(params) {
  try {
    const transaction = await buildTransaction(params);

    // Validate operations
    const errors = [];
    params.operations.forEach((op, index) => {
      if (op.type === "payment") {
        if (!isValidPublicKey(op.params.destination)) {
          errors.push(`Operation ${index + 1}: Invalid destination`);
        }
        if (!op.params.amount || parseFloat(op.params.amount) <= 0) {
          errors.push(`Operation ${index + 1}: Invalid amount`);
        }
      } else if (op.type === "createAccount") {
        if (!isValidPublicKey(op.params.destination)) {
          errors.push(`Operation ${index + 1}: Invalid destination`);
        }
        if (
          !op.params.startingBalance ||
          parseFloat(op.params.startingBalance) < 1
        ) {
          errors.push(
            `Operation ${index + 1}: Starting balance must be at least 1 XLM`,
          );
        }
      }
    });

    const estimatedFee = params.baseFee * params.operations.length;

    return {
      success: errors.length === 0,
      errors,
      fee: estimatedFee,
      operationCount: transaction.operations.length,
      xdr: transaction.toXDR(),
      hash: transaction.hash().toString("hex"),
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message],
      fee: 0,
      operationCount: params.operations.length,
    };
  }
}

/**
 * Build a fee-bump transaction wrapping a signed inner transaction.
 *
 * @param {string} feeSource - The account paying the fee-bump fee (must be a valid public key)
 * @param {string} baseFee - The fee per operation in stroops (must be positive)
 * @param {string} innerTransaction - The signed inner transaction as XDR envelope string
 * @param {string} network - The network name (testnet, mainnet, futurenet, local)
 * @returns {FeeBumpTransaction} The fee-bump transaction envelope
 * @throws {Error} If feeSource is invalid, baseFee is not positive, or innerTransaction XDR is invalid
 */
export function feeBump({
  feeSource,
  baseFee,
  innerTransaction,
  network = "testnet",
}) {
  if (!isValidPublicKey(feeSource)) {
    throw new Error("Invalid fee source account (must be a valid public key)");
  }

  const fee = parseInt(baseFee, 10);
  if (!Number.isFinite(fee) || fee <= 0) {
    throw new Error("Base fee must be a positive integer");
  }

  if (!innerTransaction || typeof innerTransaction !== "string" || innerTransaction.trim() === "") {
    throw new Error("Inner transaction XDR is required and must be a non-empty string");
  }

  try {
    const wrappedTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      feeSource,
      fee.toString(),
      innerTransaction,
      NETWORKS[network].passphrase,
    );
    return wrappedTx;
  } catch (error) {
    throw new Error(`Failed to build fee-bump transaction: ${error.message}`);
  }
}

export async function signAndSubmitTransaction(
  transaction,
  secretKey,
  network = "testnet",
) {
  if (!StellarSdk.StrKey.isValidEd25519SecretSeed(secretKey)) {
    throw new Error("Invalid secret key");
  }

  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const signingStart = performance.now();
  transaction.sign(keypair);
  recordCustomMetric("TRANSACTION_SIGNING_DURATION", performance.now() - signingStart, {
    network,
    operationCount: transaction.operations?.length || 0,
    signer: "local-keypair",
  });

  const server = getServer(network);
  const response = await measureAsync(
    "TRANSACTION_SUBMIT_DURATION",
    () => server.submitTransaction(transaction),
    { network, operationCount: transaction.operations?.length || 0 },
  );

  return {
    hash: response.hash,
    ledger: response.ledger,
    successful: response.successful,
  };
}
