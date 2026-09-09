/**
 * Transaction Verification System
 * Provides risk scoring, scam detection, and unusual activity alerts
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { fetchAccount, fetchTransactions, NETWORKS } from "./stellar";
import { THRESHOLDS } from "./thresholds";
import { getReputationScore, reportMaliciousAddress, isAddressWhitelisted } from "./reputationSystem";
import { analyzePhishing, detectDomainImpersonation } from "./phishingDetector";

/**
 * Risk levels
 */
export const RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

/**
 * Known scam patterns and addresses
 */
const SCAM_PATTERNS = {
  // Common scam asset codes
  suspiciousAssetCodes: [
    /^X{2,}L{2,}M$/i,
    /^USDT?$/i, // Fake USDT/USDC on wrong issuer
    /^USDC?$/i,
    /^BTC$/i,
    /^ETH$/i,
    /AIRDROP/i,
    /FREE/i,
    /BONUS/i,
  ],

  // Suspicious memo patterns
  suspiciousMemos: [
    /verify.*account/i,
    /claim.*reward/i,
    /urgent.*action/i,
    /suspended.*account/i,
    /security.*alert/i,
    /confirm.*identity/i,
    /wallet.*upgrade/i,
  ],

  // Known scam addresses (example - should be maintained separately)
  knownScamAddresses: new Set([
    // Add known scam addresses here
  ]),
};

/**
 * Verify transaction and calculate risk score
 * @param {object|string} transaction - Transaction object or XDR
 * @param {string} network - Network (mainnet/testnet)
 * @param {string} sourceAccount - Source account public key
 * @returns {Promise<any>} Verification result
 */
export async function verifyTransaction(
  transaction,
  network = "testnet",
  sourceAccount = null,
) {
  const startTime = Date.now();
  const warnings = [];
  const errors = [];
  const info = [];
  let riskScore = 0;
  let riskLevel = RISK_LEVELS.LOW;

  try {
    // Parse transaction if XDR
    let tx = transaction;
    if (typeof transaction === "string") {
      tx = StellarSdk.TransactionBuilder.fromXDR(
        transaction,
        NETWORKS[network].passphrase,
      );
    }

    // Extract transaction details
    const operations = tx.operations || [];
    const memo = tx.memo;
    const source = sourceAccount || tx.source;

    // 1. Check transaction structure
    const structureCheck = checkTransactionStructure(tx);
    riskScore += structureCheck.riskScore;
    warnings.push(...structureCheck.warnings);
    info.push(...structureCheck.info);

    // 2. Check operations
    const memoText = memo && memo.value ? memo.value.toString() : "";
    for (const op of operations) {
      const opCheck = await checkOperation(op, network, source, memoText);
      riskScore += opCheck.riskScore;
      warnings.push(...opCheck.warnings);
      errors.push(...opCheck.errors);
      info.push(...opCheck.info);
    }

    // 3. Check memo
    if (memo && memo.value) {
      const memoCheck = checkMemo(memo);
      riskScore += memoCheck.riskScore;
      warnings.push(...memoCheck.warnings);
    }

    // 4. Check for unusual patterns
    const patternCheck = await checkUnusualPatterns(
      operations,
      source,
      network,
    );
    riskScore += patternCheck.riskScore;
    warnings.push(...patternCheck.warnings);
    info.push(...patternCheck.info);

    // 5. Calculate final risk level
    let allDestinationsWhitelisted = true;
    let destinationsCount = 0;
    for (const op of operations) {
      if ((op.type === "payment" || op.type === "createAccount") && op.destination) {
        destinationsCount++;
        if (!isAddressWhitelisted(op.destination)) {
          allDestinationsWhitelisted = false;
        }
      }
    }
    if (destinationsCount > 0 && allDestinationsWhitelisted) {
      const memoIndex = warnings.findIndex(w => w.includes("SUSPICIOUS: Memo"));
      if (memoIndex > -1) {
        warnings.splice(memoIndex, 1);
        riskScore -= 25;
      }
      riskLevel = calculateRiskLevel(riskScore);
    } else {
      riskLevel = calculateRiskLevel(riskScore);
    }

    // 6. Get recommendations
    const recommendations = generateRecommendations(
      riskLevel,
      warnings,
      errors,
    );

    return {
      success: true,
      riskScore,
      riskLevel,
      warnings,
      errors,
      info,
      recommendations,
      verificationTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      riskScore: 100,
      riskLevel: RISK_LEVELS.CRITICAL,
      warnings: ["Failed to verify transaction"],
      errors: [error.message],
      info: [],
      recommendations: ["Do not proceed with this transaction"],
      verificationTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check transaction structure
 */
function checkTransactionStructure(tx) {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  // Check fee
  const fee = parseInt(tx.fee);
  const baseFee = parseInt(StellarSdk.BASE_FEE);
  const operations = tx.operations?.length || 1;
  const expectedMinFee = baseFee * operations;

  if (fee > expectedMinFee * 100) {
    warnings.push(
      `Unusually high fee: ${fee} stroops (expected ~${expectedMinFee})`,
    );
    riskScore += 15;
  } else if (fee > expectedMinFee * 10) {
    warnings.push(`High fee: ${fee} stroops (expected ~${expectedMinFee})`);
    riskScore += 5;
  } else {
    info.push(
      `Fee: ${fee} stroops (${operations} operation${operations > 1 ? "s" : ""})`,
    );
  }

  // Check sequence number
  if (tx.sequence) {
    info.push(`Sequence: ${tx.sequence}`);
  }

  // Check time bounds
  if (!tx.timeBounds || (!tx.timeBounds.minTime && !tx.timeBounds.maxTime)) {
    warnings.push("No time bounds set - transaction valid indefinitely");
    riskScore += 10;
  } else {
    info.push("Time bounds set");
  }

  // Check number of operations
  if (operations > 100) {
    warnings.push(`Large number of operations: ${operations}`);
    riskScore += 10;
  }

  return { riskScore, warnings, info };
}

/**
 * Check individual operation
 */
async function checkOperation(operation, network, sourceAccount, memoText = "") {
  const warnings = [];
  const errors = [];
  const info = [];
  let riskScore = 0;

  const opType = operation.type;
  info.push(`Operation: ${opType}`);

  switch (opType) {
    case "payment":
      const paymentCheck = await checkPaymentOperation(
        operation,
        network,
        sourceAccount,
        memoText,
      );
      riskScore += paymentCheck.riskScore;
      warnings.push(...paymentCheck.warnings);
      info.push(...paymentCheck.info);
      break;

    case "createAccount":
      const createAccountCheck = await checkCreateAccountOperation(
        operation,
        network,
        sourceAccount,
        memoText,
      );
      riskScore += createAccountCheck.riskScore;
      warnings.push(...createAccountCheck.warnings);
      info.push(...createAccountCheck.info);
      break;

    case "changeTrust":
      const trustCheck = checkChangeTrustOperation(operation);
      riskScore += trustCheck.riskScore;
      warnings.push(...trustCheck.warnings);
      info.push(...trustCheck.info);
      break;

    case "accountMerge":
      warnings.push("Account merge operation - this will delete the account");
      riskScore += 30;
      break;

    case "allowTrust":
    case "setTrustLineFlags":
      warnings.push("Trust authorization operation - verify the asset issuer");
      riskScore += 10;
      break;

    case "setOptions":
      const optionsCheck = checkSetOptionsOperation(operation);
      riskScore += optionsCheck.riskScore;
      warnings.push(...optionsCheck.warnings);
      info.push(...optionsCheck.info);
      break;

    case "manageData":
      info.push(`Data operation: ${operation.name}`);
      break;

    case "createClaimableBalance":
    case "claimClaimableBalance":
      info.push("Claimable balance operation");
      break;

    case "invokeHostFunction":
      warnings.push(
        "Smart contract invocation - verify contract address and function",
      );
      riskScore += 15;
      break;

    default:
      info.push(`Operation type: ${opType}`);
  }

  return { riskScore, warnings, errors, info };
}

/**
 * Assess risk based on destination address, reputation, domain, and ML phishing model.
 */
async function assessAddressRisk({
  destination,
  amount,
  assetCode,
  assetIssuer,
  isNative,
  network,
  memoText
}) {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  // 1. Determine if recipient account is new
  let recipientIsNew = false;
  try {
    await fetchAccount(destination, network);
    info.push(`Destination account exists: ${destination.slice(0, 8)}...`);
  } catch (error) {
    recipientIsNew = true;
    warnings.push("Destination account does not exist - will be created");
    riskScore += 5;
  }

  // If whitelisted, skip all other suspicious/phishing checks
  if (isAddressWhitelisted(destination)) {
    info.push(`Recipient is whitelisted (reputation 1.0). Skipping security warnings.`);
    return { riskScore, warnings, info };
  }

  // 2. Determine if associated domain in memo is typosquatted / suspicious
  let isDomainSuspicious = false;
  if (memoText) {
    const domainMatch = memoText.match(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/i);
    if (domainMatch) {
      const isSuspicious = detectDomainImpersonation(domainMatch[0]);
      if (isSuspicious) {
        isDomainSuspicious = true;
        warnings.push(`⚠️ Domain Impersonation: Memo contains a suspicious domain: "${domainMatch[0]}"`);
        riskScore += 30;
      }
    }
  }

  // 3. Check address reputation
  const reputation = getReputationScore(destination, { recipientIsNew, isDomainSuspicious });
  info.push(`Recipient reputation score: ${reputation}`);
  
  if (reputation === 0.0) {
    warnings.push("⚠️ SCAM ALERT: Destination is a reported malicious address");
    riskScore += 50;
  } else if (reputation < 0.3) {
    warnings.push(`⚠️ Suspicious Address: Recipient has very low reputation (${reputation})`);
    riskScore += 30;
  } else if (reputation < 0.6) {
    warnings.push(`⚠️ Warning: Recipient has below average reputation (${reputation})`);
    riskScore += 15;
  }

  // 4. Run ML phishing model prediction
  const op = {
    type: 'payment',
    amount,
    asset: isNative ? null : { isNative: () => false, code: assetCode, issuer: assetIssuer }
  };
  const mlResult = analyzePhishing(op, memoText, reputation, recipientIsNew);
  
  if (mlResult.isPhishing) {
    const confidence = (mlResult.probability * 100).toFixed(0);
    warnings.push(`⚠️ Phishing Alert: Model predicts phishing attempt (${confidence}% confidence)`);
    riskScore += 40;
  }

  return { riskScore, warnings, info };
}

/**
 * Check payment operation
 */
async function checkPaymentOperation(operation, network, sourceAccount, memoText = "") {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  const { destination, amount, asset } = operation;
  const isNative = !asset || asset.isNative();
  const assetCode = isNative ? 'XLM' : asset.code;
  const assetIssuer = isNative ? '' : asset.issuer;

  // Run the common address risk assessment (checks new accounts, reputation, domain, and runs ML)
  const addressRisk = await assessAddressRisk({
    destination,
    amount,
    assetCode,
    assetIssuer,
    isNative,
    network,
    memoText
  });

  riskScore += addressRisk.riskScore;
  warnings.push(...addressRisk.warnings);
  info.push(...addressRisk.info);

  // Check amount bounds (existing verification code)
  const amountNum = parseFloat(amount);
  if (amountNum > 10000) {
    warnings.push(`Large payment amount: ${amount}`);
    riskScore += 10;
  }

  // Check asset-specific risk
  if (!isNative) {
    const assetCheck = checkAsset(asset);
    riskScore += assetCheck.riskScore;
    warnings.push(...assetCheck.warnings);
    info.push(...assetCheck.info);
  } else {
    info.push("Asset: XLM (native)");
  }

  return { riskScore, warnings, info };
}

/**
 * Check createAccount operation
 */
async function checkCreateAccountOperation(operation, network, sourceAccount, memoText = "") {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  const { destination, startingBalance } = operation;

  // Run the common address risk assessment
  const addressRisk = await assessAddressRisk({
    destination,
    amount: startingBalance,
    assetCode: 'XLM',
    assetIssuer: '',
    isNative: true,
    network,
    memoText
  });

  riskScore += addressRisk.riskScore;
  warnings.push(...addressRisk.warnings);
  info.push(...addressRisk.info);

  return { riskScore, warnings, info };
}

/**
 * Check change trust operation
 */
function checkChangeTrustOperation(operation) {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  const { asset, limit } = operation;

  if (asset && asset.code && asset.issuer) {
    const assetCheck = checkAsset(asset);
    riskScore += assetCheck.riskScore;
    warnings.push(...assetCheck.warnings);
    info.push(...assetCheck.info);

    // Check if removing trustline
    if (limit === "0") {
      info.push("Removing trustline");
    } else {
      info.push(`Setting trustline limit: ${limit || "unlimited"}`);
    }
  }

  return { riskScore, warnings, info };
}

/**
 * Check set options operation
 */
function checkSetOptionsOperation(operation) {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  // Check for dangerous operations
  if (operation.masterWeight !== undefined) {
    warnings.push(`Changing master key weight to ${operation.masterWeight}`);
    if (operation.masterWeight === 0) {
      warnings.push(
        "⚠️ WARNING: Setting master weight to 0 will lock the account",
      );
      riskScore += 40;
    } else {
      riskScore += 10;
    }
  }

  if (operation.signer) {
    warnings.push("Adding/modifying signer");
    riskScore += 15;
  }

  if (operation.homeDomain) {
    info.push(`Setting home domain: ${operation.homeDomain}`);
  }

  if (operation.setFlags || operation.clearFlags) {
    warnings.push("Modifying account flags");
    riskScore += 10;
  }

  return { riskScore, warnings, info };
}

/**
 * Check asset for scam patterns
 */
function checkAsset(asset) {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  const { code, issuer } = asset;

  // Check for suspicious asset codes
  for (const pattern of SCAM_PATTERNS.suspiciousAssetCodes) {
    if (pattern.test(code)) {
      warnings.push(`⚠️ SUSPICIOUS: Asset code "${code}" matches scam pattern`);
      riskScore += 30;
      break;
    }
  }

  // Check issuer
  if (SCAM_PATTERNS.knownScamAddresses.has(issuer)) {
    warnings.push("⚠️ SCAM ALERT: Asset issuer is a known scam address");
    riskScore += 50;
  }

  info.push(`Asset: ${code} (${issuer.slice(0, 8)}...)`);

  return { riskScore, warnings, info };
}

/**
 * Check memo for suspicious patterns
 */
function checkMemo(memo) {
  const warnings = [];
  let riskScore = 0;

  const memoValue = memo.value?.toString() || "";

  for (const pattern of SCAM_PATTERNS.suspiciousMemos) {
    if (pattern.test(memoValue)) {
      warnings.push(
        `⚠️ SUSPICIOUS: Memo contains suspicious text: "${memoValue}"`,
      );
      riskScore += 25;
      break;
    }
  }

  return { riskScore, warnings };
}

/**
 * Check for unusual patterns
 */
async function checkUnusualPatterns(operations, sourceAccount, network) {
  const warnings = [];
  const info = [];
  let riskScore = 0;

  if (!sourceAccount) {
    return { riskScore, warnings, info };
  }

  try {
    // Get recent transaction history
    const history = await fetchTransactions(sourceAccount, network, 10);
    const recentTxs = history.records || [];

    // Check transaction frequency
    if (recentTxs.length >= 10) {
      const oldestTx = new Date(recentTxs[recentTxs.length - 1].created_at);
      const newestTx = new Date(recentTxs[0].created_at);
      const timeDiff = newestTx - oldestTx;
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff < 5) {
        warnings.push("High transaction frequency detected in recent history");
        riskScore += 10;
      }
    }

    // Check for similar operations in history
    const paymentOps = operations.filter((op) => op.type === "payment");
    if (paymentOps.length > 0) {
      const destinations = new Set(paymentOps.map((op) => op.destination));
      if (destinations.size === 1 && paymentOps.length > 5) {
        warnings.push("Multiple payments to same destination");
        riskScore += 5;
      }
    }

    info.push(`Recent transactions: ${recentTxs.length}`);
  } catch (error) {
    // Ignore errors in pattern checking
  }

  return { riskScore, warnings, info };
}

/**
 * Calculate risk level from score
 */
function calculateRiskLevel(score) {
  if (score >= THRESHOLDS.CRITICAL) return RISK_LEVELS.CRITICAL;
  if (score >= THRESHOLDS.HIGH) return RISK_LEVELS.HIGH;
  if (score >= THRESHOLDS.MEDIUM) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

/**
 * Generate recommendations based on risk
 */
function generateRecommendations(riskLevel, warnings, errors) {
  const recommendations = [];

  if (errors.length > 0) {
    recommendations.push("❌ Do not proceed - transaction has errors");
    return recommendations;
  }

  switch (riskLevel) {
    case RISK_LEVELS.CRITICAL:
      recommendations.push("🛑 STOP - Do not sign this transaction");
      recommendations.push("This transaction shows critical risk indicators");
      recommendations.push(
        "Verify all details with the recipient through a trusted channel",
      );
      break;

    case RISK_LEVELS.HIGH:
      recommendations.push("⚠️ High risk - Exercise extreme caution");
      recommendations.push("Carefully review all warnings before proceeding");
      recommendations.push("Consider using a test transaction first");
      break;

    case RISK_LEVELS.MEDIUM:
      recommendations.push("⚡ Medium risk - Review carefully");
      recommendations.push("Verify destination addresses and amounts");
      recommendations.push("Ensure you trust the recipient");
      break;

    case RISK_LEVELS.LOW:
      recommendations.push("✓ Low risk - Transaction appears normal");
      recommendations.push("Always verify details before signing");
      break;
  }

  return recommendations;
}

/**
 * Quick scam check for address
 */
export function isKnownScamAddress(address) {
  return SCAM_PATTERNS.knownScamAddresses.has(address) || getReputationScore(address) === 0.0;
}

/**
 * Add address to scam list (for user reporting)
 */
export function reportScamAddress(address, reason = "") {
  SCAM_PATTERNS.knownScamAddresses.add(address);
  reportMaliciousAddress(address, reason);

  // In production, this should report to a backend service
  console.warn("Scam address reported:", address, reason);
}

/**
 * Analyze account for suspicious activity
 */
export async function analyzeAccountActivity(publicKey, network = "testnet") {
  const warnings = [];
  const info = [];
  let suspiciousScore = 0;

  try {
    const account = await fetchAccount(publicKey, network);
    const transactions = await fetchTransactions(publicKey, network, 50);

    // Check account age
    const createdAt =
      transactions.records[transactions.records.length - 1]?.created_at;
    if (createdAt) {
      const accountAge = Date.now() - new Date(createdAt).getTime();
      const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

      if (daysSinceCreation < 1) {
        warnings.push("Very new account (less than 1 day old)");
        suspiciousScore += 15;
      }

      info.push(`Account age: ${Math.floor(daysSinceCreation)} days`);
    }

    // Check transaction patterns
    const txCount = transactions.records.length;
    info.push(`Total transactions: ${txCount}`);

    if (txCount > 100) {
      info.push("High transaction volume");
    }

    // Check balances
    const balances = account.balances || [];
    const trustlines = balances.filter((b) => b.asset_type !== "native");

    if (trustlines.length > 50) {
      warnings.push("Large number of trustlines");
      suspiciousScore += 10;
    }

    info.push(`Trustlines: ${trustlines.length}`);

    return {
      success: true,
      suspiciousScore,
      warnings,
      info,
      riskLevel:
        suspiciousScore >= 30
          ? RISK_LEVELS.HIGH
          : suspiciousScore >= 15
            ? RISK_LEVELS.MEDIUM
            : RISK_LEVELS.LOW,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      warnings: ["Failed to analyze account"],
      info: [],
      suspiciousScore: 0,
      riskLevel: RISK_LEVELS.LOW,
    };
  }
}

export default {
  verifyTransaction,
  isKnownScamAddress,
  reportScamAddress,
  analyzeAccountActivity,
  RISK_LEVELS,
};
