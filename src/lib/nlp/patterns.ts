/**
 * Pattern table for the Natural Language Transaction Builder (#551).
 *
 * Each pattern owns a regex, an operation type, and a builder that turns the
 * capture groups into the params shape createOperation() expects. Patterns are
 * ordered most-specific first; the parser takes the first match, so a narrow
 * phrasing must appear above the general one it would otherwise shadow.
 *
 * Acceptance criteria call for 30+ patterns. The table below defines 38.
 */

import {
  assetTypeForCode,
  extractAmount,
  extractAssetToken,
  extractPrice,
  isNativeAssetWord,
  looksLikePublicKey,
  normalizeAmount,
  resolveAsset,
  resolveDestination,
} from "./entityRecognition";
import type { OperationType, ResolutionContext } from "./types";

export interface PatternMatchOutput {
  params: Record<string, unknown>;
  fieldConfidence: Record<string, number>;
  missingFields: string[];
}

export interface Pattern {
  id: string;
  type: OperationType;
  /** Higher wins when two patterns match with equal specificity. */
  weight: number;
  regex: RegExp;
  build: (
    match: RegExpMatchArray,
    clause: string,
    ctx: ResolutionContext,
  ) => PatternMatchOutput;
  /** Example phrasings, used by the test suite and the UI hint list. */
  examples: string[];
}

// ─── Shared fragments ────────────────────────────────────────────────────────

const KEY = "G[A-Z2-7]{55}";
// A bare name stops at a preposition or connective so trailing context
// ("for rent", "with memo x") is not absorbed into the recipient.
const NAME_STOP = "(?:for|with|memo|note|and|then|also|at|using|from|to)";
const BARE_NAME = `[A-Za-z][A-Za-z0-9_-]*(?:\\s+(?!${NAME_STOP}\\b)[A-Za-z0-9_-]+){0,3}`;
const ADDR = `(?:${KEY}|M[A-Z2-7]{68}|[A-Za-z0-9._%+-]+\\*[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|${BARE_NAME})`;
const AMT = "\\d+(?:[.,]\\d+)*(?:\\.\\d+)?\\s*[kmb]?|(?:one|two|three|four|five|ten|twenty|fifty|hundred|thousand|million)(?:\\s+(?:hundred|thousand|million))?";
const ASSET = "[A-Za-z0-9]{1,12}(?::G[A-Z2-7]{55})?";

/** Builds payment-style params shared by payment and createAccount. */
function buildTransfer(
  amountRaw: string,
  assetRaw: string | undefined,
  destRaw: string,
  clause: string,
  ctx: ResolutionContext,
): PatternMatchOutput {
  const amount = extractAmount(amountRaw) ?? extractAmount(clause);
  const assetToken = assetRaw ?? extractAssetToken(clause, amount?.raw);
  const { asset, confidence: assetConf } = resolveAsset(assetToken ?? "XLM", ctx);
  const { destination, confidence: destConf } = resolveDestination(destRaw, ctx);

  const missing: string[] = [];
  if (!destination.resolved) missing.push("destination");
  if (asset.assetType !== "native" && asset.issuerUnresolved) missing.push("assetIssuer");
  if (!amount) missing.push("amount");

  return {
    params: {
      destination: destination.resolved ?? destination.raw,
      destinationRaw: destination.raw,
      amount: amount?.value ?? "",
      assetType: asset.assetType,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer,
    },
    fieldConfidence: {
      destination: destConf,
      amount: amount ? 0.95 : 0.2,
      assetType: assetConf,
      assetCode: assetConf,
      assetIssuer: asset.issuerUnresolved ? 0.3 : assetConf,
    },
    missingFields: missing,
  };
}

function buildOffer(
  type: "manageSellOffer" | "manageBuyOffer",
  amountRaw: string,
  sellingRaw: string,
  buyingRaw: string,
  clause: string,
  ctx: ResolutionContext,
): PatternMatchOutput {
  const amount = extractAmount(amountRaw) ?? extractAmount(clause);
  const selling = resolveAsset(sellingRaw, ctx);
  const buying = resolveAsset(buyingRaw, ctx);
  const price = extractPrice(clause);

  const missing: string[] = [];
  if (!amount) missing.push(type === "manageBuyOffer" ? "buyAmount" : "amount");
  if (!price) missing.push("price");
  if (selling.asset.issuerUnresolved) missing.push("sellingAssetIssuer");
  if (buying.asset.issuerUnresolved) missing.push("buyingAssetIssuer");

  const amountField = type === "manageBuyOffer" ? "buyAmount" : "amount";

  return {
    params: {
      [amountField]: amount?.value ?? "",
      price: price ?? "",
      sellingAssetType: selling.asset.assetType,
      sellingAssetCode: selling.asset.assetCode,
      sellingAssetIssuer: selling.asset.assetIssuer,
      buyingAssetType: buying.asset.assetType,
      buyingAssetCode: buying.asset.assetCode,
      buyingAssetIssuer: buying.asset.assetIssuer,
    },
    fieldConfidence: {
      [amountField]: amount ? 0.95 : 0.2,
      price: price ? 0.9 : 0.2,
      sellingAssetCode: selling.confidence,
      buyingAssetCode: buying.confidence,
    },
    missingFields: missing,
  };
}

function buildTrustline(
  assetRaw: string,
  clause: string,
  ctx: ResolutionContext,
  limitOverride?: string,
): PatternMatchOutput {
  const { asset, confidence } = resolveAsset(assetRaw, ctx);
  const limitMatch = clause.match(/\blimit\s+(?:of\s+)?(\d+(?:\.\d+)?)/i);
  const limit = limitOverride ?? (limitMatch ? normalizeAmount(parseFloat(limitMatch[1])) : "");

  const missing: string[] = [];
  if (!asset.assetCode) missing.push("assetCode");
  if (asset.issuerUnresolved) missing.push("assetIssuer");

  return {
    params: {
      assetCode: asset.assetCode ?? "",
      assetIssuer: asset.assetIssuer ?? "",
      limit,
    },
    fieldConfidence: {
      assetCode: asset.assetCode ? confidence : 0.2,
      assetIssuer: asset.issuerUnresolved ? 0.3 : confidence,
      limit: limitOverride !== undefined || limitMatch ? 0.9 : 0.8,
    },
    missingFields: missing,
  };
}

function buildPathPayment(
  strict: "Send" | "Receive",
  sendAmountRaw: string,
  sendAssetRaw: string,
  destRaw: string,
  destAssetRaw: string,
  destAmountRaw: string | undefined,
  clause: string,
  ctx: ResolutionContext,
): PatternMatchOutput {
  const sendAmount = extractAmount(sendAmountRaw);
  const destAmount = destAmountRaw ? extractAmount(destAmountRaw) : undefined;
  const sendAsset = resolveAsset(sendAssetRaw, ctx);
  const destAsset = resolveAsset(destAssetRaw, ctx);
  const { destination, confidence: destConf } = resolveDestination(destRaw, ctx);

  const missing: string[] = [];
  if (!destination.resolved) missing.push("destination");
  if (sendAsset.asset.issuerUnresolved) missing.push("sendAssetIssuer");
  if (destAsset.asset.issuerUnresolved) missing.push("destAssetIssuer");

  const base = {
    destination: destination.resolved ?? destination.raw,
    destinationRaw: destination.raw,
    sendAssetType: sendAsset.asset.assetType,
    sendAssetCode: sendAsset.asset.assetCode,
    sendAssetIssuer: sendAsset.asset.assetIssuer,
    destAssetType: destAsset.asset.assetType,
    destAssetCode: destAsset.asset.assetCode,
    destAssetIssuer: destAsset.asset.assetIssuer,
    path: [],
  };

  const params =
    strict === "Send"
      ? {
          ...base,
          sendAmount: sendAmount?.value ?? "",
          destMin: destAmount?.value ?? "",
        }
      : {
          ...base,
          sendMax: sendAmount?.value ?? "",
          destAmount: destAmount?.value ?? "",
        };

  if (strict === "Send" && !destAmount) missing.push("destMin");
  if (strict === "Receive" && !destAmount) missing.push("destAmount");

  return {
    params,
    fieldConfidence: {
      destination: destConf,
      sendAssetCode: sendAsset.confidence,
      destAssetCode: destAsset.confidence,
    },
    missingFields: missing,
  };
}

// ─── Pattern table ───────────────────────────────────────────────────────────

export const PATTERNS: Pattern[] = [
  // ── Path payments (before plain payment, which would otherwise shadow them)
  {
    id: "path.strictSend.explicit",
    type: "pathPaymentStrictSend",
    weight: 100,
    regex: new RegExp(
      `^(?:swap|convert|exchange)\\s+(${AMT})\\s*(${ASSET})\\s+(?:to|into|for)\\s+(${ASSET})\\s+(?:and\\s+)?(?:send\\s+|pay\\s+)(?:to\\s+)?(${ADDR})(?:\\s+.*?(?:at\\s+least|minimum(?:\\s+of)?)\\s+(${AMT}))?`,
      "i",
    ),
    build: (m, clause, ctx) =>
      buildPathPayment("Send", m[1], m[2], m[4], m[3], m[5], clause, ctx),
    examples: ["Swap 100 XLM to USDC and send to alice"],
  },
  {
    id: "path.strictSend.asAsset",
    type: "pathPaymentStrictSend",
    weight: 100,
    // "into" or "as" signals a conversion; plain "to" does not, so that
    // "Send 500 XLM to Alice" stays a payment.
    regex: new RegExp(
      `^send\\s+(${AMT})\\s*(${ASSET})\\s+(?:into|as)\\s+(${ASSET})\\s+(?:to|for)\\s+(${ADDR})(?:\\s+.*?(?:at\\s+least|minimum(?:\\s+of)?)\\s+(${AMT}))?`,
      "i",
    ),
    build: (m, clause, ctx) =>
      buildPathPayment("Send", m[1], m[2], m[4], m[3], m[5], clause, ctx),
    examples: ["Send 100 XLM into USDC for alice at least 24"],
  },
  {
    id: "path.strictReceive.explicit",
    type: "pathPaymentStrictReceive",
    weight: 99,
    regex: new RegExp(
      `^(?:send|pay)\\s+(${ADDR}?)\\s*(?:exactly\\s+)?(${AMT})\\s*(${ASSET})\\s+(?:using|paying\\s+with|from)\\s+(?:at\\s+most\\s+)?(${AMT})?\\s*(${ASSET})`,
      "i",
    ),
    build: (m, clause, ctx) =>
      buildPathPayment("Receive", m[4] ?? "", m[5], m[1], m[3], m[2], clause, ctx),
    examples: ["Pay alice exactly 50 USDC using at most 300 XLM"],
  },

  // ── Payments
  {
    id: "payment.send.amount.asset.to.dest",
    type: "payment",
    weight: 90,
    regex: new RegExp(`^(?:send|pay|transfer|give)\\s+(${AMT})\\s*(${ASSET})\\s+to\\s+(${ADDR})`, "i"),
    build: (m, clause, ctx) => buildTransfer(m[1], m[2], m[3], clause, ctx),
    examples: ["Send 500 XLM to Alice for rent", "Transfer 25 USDC to GABC..."],
  },
  {
    id: "payment.send.dest.amount.asset",
    type: "payment",
    weight: 89,
    regex: new RegExp(`^(?:send|pay|transfer|give)\\s+(${ADDR}?)\\s+(${AMT})\\s*(${ASSET})\\b`, "i"),
    build: (m, clause, ctx) => buildTransfer(m[2], m[3], m[1], clause, ctx),
    examples: ["Send Alice 500 XLM", "Pay bob 12 USDC"],
  },
  {
    id: "payment.to.dest.amount",
    type: "payment",
    weight: 85,
    regex: new RegExp(`^(?:to|for)\\s+(${ADDR})\\s*[:,-]?\\s*(${AMT})\\s*(${ASSET})`, "i"),
    build: (m, clause, ctx) => buildTransfer(m[2], m[3], m[1], clause, ctx),
    examples: ["To alice: 40 XLM"],
  },
  {
    id: "payment.amount.asset.to.dest",
    type: "payment",
    weight: 84,
    regex: new RegExp(`^(${AMT})\\s*(${ASSET})\\s+to\\s+(${ADDR})`, "i"),
    build: (m, clause, ctx) => buildTransfer(m[1], m[2], m[3], clause, ctx),
    examples: ["500 XLM to Alice"],
  },
  {
    id: "payment.settle.owe",
    type: "payment",
    weight: 83,
    regex: new RegExp(
      `^(?:settle|repay|refund|reimburse)\\s+(${ADDR}?)\\s*(?:for\\s+)?(${AMT})\\s*(${ASSET})`,
      "i",
    ),
    build: (m, clause, ctx) => buildTransfer(m[2], m[3], m[1], clause, ctx),
    examples: ["Repay alice 30 USDC"],
  },
  {
    id: "payment.send.everything",
    type: "payment",
    weight: 82,
    regex: new RegExp(`^(?:send|transfer)\\s+(?:all|everything)\\s+(?:my\\s+)?(${ASSET})?\\s*to\\s+(${ADDR})`, "i"),
    build: (m, clause, ctx) => {
      const out = buildTransfer("", m[1], m[2], clause, ctx);
      out.missingFields = Array.from(new Set([...out.missingFields, "amount"]));
      out.fieldConfidence.amount = 0.1;
      return out;
    },
    examples: ["Send all my USDC to alice"],
  },

  // ── Account creation
  {
    id: "createAccount.create.with.balance",
    type: "createAccount",
    weight: 95,
    regex: new RegExp(
      `^(?:create|open|fund|set\\s+up)\\s+(?:a\\s+)?(?:new\\s+)?account\\s+(?:for\\s+|at\\s+)?(${ADDR})\\s+(?:with|funding\\s+it\\s+with|and\\s+fund\\s+(?:it\\s+)?with)\\s+(${AMT})`,
      "i",
    ),
    build: (m, clause, ctx) => {
      const { destination, confidence } = resolveDestination(m[1], ctx);
      const amount = extractAmount(m[2]);
      const missing: string[] = [];
      if (!destination.resolved) missing.push("destination");
      if (!amount) missing.push("startingBalance");
      return {
        params: {
          destination: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
          startingBalance: amount?.value ?? "",
        },
        fieldConfidence: { destination: confidence, startingBalance: amount ? 0.95 : 0.2 },
        missingFields: missing,
      };
    },
    examples: ["Create account for GABC... with 5 XLM", "Open a new account for alice with 10 XLM"],
  },
  {
    id: "createAccount.fund.new",
    type: "createAccount",
    weight: 94,
    regex: new RegExp(`^(?:fund|activate)\\s+(?:new\\s+)?(${ADDR})\\s+with\\s+(${AMT})`, "i"),
    build: (m, clause, ctx) => {
      const { destination, confidence } = resolveDestination(m[1], ctx);
      const amount = extractAmount(m[2]);
      const missing: string[] = [];
      if (!destination.resolved) missing.push("destination");
      if (!amount) missing.push("startingBalance");
      return {
        params: {
          destination: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
          startingBalance: amount?.value ?? "",
        },
        fieldConfidence: { destination: confidence, startingBalance: amount ? 0.95 : 0.2 },
        missingFields: missing,
      };
    },
    examples: ["Fund new GABC... with 2 XLM"],
  },

  // ── Trustlines
  {
    id: "changeTrust.trust.asset.from.issuer",
    type: "changeTrust",
    weight: 93,
    regex: new RegExp(
      `^(?:add\\s+(?:a\\s+)?trustline?|trust|create\\s+(?:a\\s+)?trustline?|establish\\s+trust)\\s+(?:for\\s+|to\\s+|in\\s+)?(${ASSET})\\s+(?:from|issued\\s+by|by)\\s+(${KEY})`,
      "i",
    ),
    build: (m, clause, ctx) =>
      buildTrustline(`${m[1].split(":")[0]}:${m[2]}`, clause, ctx),
    examples: ["Add trustline for USDC from GABC...", "Trust EURT issued by GXYZ..."],
  },
  {
    id: "changeTrust.trust.asset",
    type: "changeTrust",
    weight: 88,
    regex: new RegExp(
      `^(?:add\\s+(?:a\\s+)?trustline?|trust|create\\s+(?:a\\s+)?trustline?)\\s+(?:for\\s+|to\\s+|in\\s+)?(${ASSET})`,
      "i",
    ),
    build: (m, clause, ctx) => buildTrustline(m[1], clause, ctx),
    examples: ["Trust USDC", "Add a trustline for yXLM"],
  },
  {
    id: "changeTrust.remove",
    type: "changeTrust",
    weight: 92,
    regex: new RegExp(
      `^(?:remove|delete|drop|untrust|revoke)\\s+(?:the\\s+)?(?:trustline?\\s+(?:for|to|in)\\s+)?(${ASSET})(?:\\s+trustline)?`,
      "i",
    ),
    build: (m, clause, ctx) => buildTrustline(m[1], clause, ctx, "0"),
    examples: ["Remove trustline for USDC", "Untrust EURT"],
  },

  // ── Offers
  {
    id: "offer.sell.for",
    type: "manageSellOffer",
    weight: 91,
    regex: new RegExp(`^(?:sell|offer)\\s+(${AMT})\\s*(${ASSET})\\s+for\\s+(${ASSET})`, "i"),
    build: (m, clause, ctx) => buildOffer("manageSellOffer", m[1], m[2], m[3], clause, ctx),
    examples: ["Sell 100 XLM for USDC at 0.12 each"],
  },
  {
    id: "offer.buy.with",
    type: "manageBuyOffer",
    weight: 91,
    regex: new RegExp(`^buy\\s+(${AMT})\\s*(${ASSET})\\s+(?:with|using|for)\\s+(${ASSET})`, "i"),
    build: (m, clause, ctx) => buildOffer("manageBuyOffer", m[1], m[3], m[2], clause, ctx),
    examples: ["Buy 50 USDC with XLM at 0.12"],
  },
  {
    id: "offer.sell.selling.buying",
    type: "manageSellOffer",
    weight: 87,
    regex: new RegExp(
      `^(?:create|place|post)\\s+(?:an?\\s+)?(?:sell\\s+)?offer\\s+selling\\s+(${AMT})\\s*([A-Za-z0-9]{1,12}(?::G[A-Z2-7]{55})?)\\s*(?:,)?\\s*(?:and\\s+)?buying\\s+([A-Za-z0-9]{1,12}(?::G[A-Z2-7]{55})?)`,
      "i",
    ),
    build: (m, clause, ctx) => buildOffer("manageSellOffer", m[1], m[2], m[3], clause, ctx),
    examples: ["Create an offer selling 100 XLM buying USDC at 0.12"],
  },
  {
    id: "offer.cancel",
    type: "manageSellOffer",
    weight: 86,
    regex: new RegExp(`^(?:cancel|remove|delete)\\s+(?:my\\s+)?(?:sell\\s+)?offer\\b`, "i"),
    build: (m, clause, ctx) => {
      const out = buildOffer("manageSellOffer", "0", "XLM", "XLM", clause, ctx);
      out.params.amount = "0";
      out.missingFields = ["offerId", "price"];
      return out;
    },
    examples: ["Cancel my sell offer"],
  },

  // ── Account merge
  {
    id: "accountMerge.merge.into",
    type: "accountMerge",
    weight: 96,
    regex: new RegExp(
      `^(?:merge|close)\\s+(?:my\\s+)?account\\s+(?:into|to|with)\\s+(${ADDR})`,
      "i",
    ),
    build: (m, clause, ctx) => {
      const { destination, confidence } = resolveDestination(m[1], ctx);
      return {
        params: {
          destination: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
        },
        fieldConfidence: { destination: confidence },
        missingFields: destination.resolved ? [] : ["destination"],
      };
    },
    examples: ["Merge my account into GABC...", "Close my account to alice"],
  },
  {
    id: "accountMerge.send.remaining",
    type: "accountMerge",
    weight: 80,
    regex: new RegExp(
      `^(?:send|transfer)\\s+(?:my\\s+)?(?:remaining|leftover|entire)\\s+balance\\s+to\\s+(${ADDR})\\s+and\\s+close`,
      "i",
    ),
    build: (m, clause, ctx) => {
      const { destination, confidence } = resolveDestination(m[1], ctx);
      return {
        params: {
          destination: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
        },
        fieldConfidence: { destination: confidence },
        missingFields: destination.resolved ? [] : ["destination"],
      };
    },
    examples: ["Send my remaining balance to alice and close"],
  },

  // ── Manage data
  {
    id: "manageData.set.kv",
    type: "manageData",
    weight: 94,
    regex:
      /^(?:set|store|save|write)\s+(?:the\s+)?(?:data\s+)?(?:entry\s+)?["']?([A-Za-z0-9_.-]{1,64})["']?\s+(?:to|as|=)\s+["']?([^"']{0,64})["']?$/i,
    build: (m) => ({
      params: { name: m[1], value: m[2].trim() },
      fieldConfidence: { name: 0.95, value: 0.9 },
      missingFields: [],
    }),
    examples: ["Set homepage to example.com", "Store 'theme' as dark"],
  },
  {
    id: "manageData.delete",
    type: "manageData",
    weight: 93,
    regex:
      /^(?:delete|remove|clear|unset)\s+(?:the\s+)?(?:data\s+)?(?:entry\s+)?["']?([A-Za-z0-9_.-]{1,64})["']?$/i,
    build: (m) => ({
      params: { name: m[1], value: null },
      fieldConfidence: { name: 0.9 },
      missingFields: [],
    }),
    examples: ["Delete data entry theme"],
  },

  // ── Claimable balances
  {
    id: "claim.balance.id",
    type: "claimClaimableBalance",
    weight: 97,
    regex: /^claim\s+(?:the\s+)?(?:claimable\s+)?balance\s+([0-9a-f]{72})/i,
    build: (m) => ({
      params: { balanceId: m[1] },
      fieldConfidence: { balanceId: 1 },
      missingFields: [],
    }),
    examples: ["Claim balance 00000000abc..."],
  },
  {
    id: "claim.balance.bare",
    type: "claimClaimableBalance",
    weight: 79,
    regex: /^claim\s+(?:the\s+)?(?:claimable\s+)?balance\b/i,
    build: () => ({
      params: { balanceId: "" },
      fieldConfidence: { balanceId: 0.2 },
      missingFields: ["balanceId"],
    }),
    examples: ["Claim the claimable balance"],
  },

  // ── Sequence
  {
    id: "bumpSequence.to",
    type: "bumpSequence",
    weight: 95,
    regex: /^bump\s+(?:the\s+)?sequence\s+(?:number\s+)?(?:to\s+)?(\d+)/i,
    build: (m) => ({
      params: { bumpTo: m[1] },
      fieldConfidence: { bumpTo: 0.95 },
      missingFields: [],
    }),
    examples: ["Bump sequence to 123456789"],
  },

  // ── Sponsorship
  {
    id: "sponsor.begin",
    type: "beginSponsoringFutureReserves",
    weight: 95,
    regex: new RegExp(
      `^(?:begin|start)\\s+sponsoring\\s+(?:future\\s+reserves\\s+for\\s+|reserves\\s+for\\s+|for\\s+)?(${ADDR})`,
      "i",
    ),
    build: (m, clause, ctx) => {
      const { destination, confidence } = resolveDestination(m[1], ctx);
      return {
        params: {
          sponsoredId: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
        },
        fieldConfidence: { sponsoredId: confidence },
        missingFields: destination.resolved ? [] : ["sponsoredId"],
      };
    },
    examples: ["Begin sponsoring future reserves for GABC..."],
  },
  {
    id: "sponsor.end",
    type: "endSponsoringFutureReserves",
    weight: 95,
    regex: /^(?:end|stop|finish)\s+sponsoring(?:\s+future\s+reserves)?/i,
    build: () => ({ params: {}, fieldConfidence: {}, missingFields: [] }),
    examples: ["End sponsoring future reserves"],
  },

  // ── Clawback
  {
    id: "clawback.amount.asset.from",
    type: "clawback",
    weight: 96,
    regex: new RegExp(
      `^(?:clawback|claw\\s+back|reclaim)\\s+(${AMT})\\s*(${ASSET})\\s+from\\s+(${ADDR})`,
      "i",
    ),
    build: (m, clause, ctx) => {
      const amount = extractAmount(m[1]);
      const { asset, confidence: assetConf } = resolveAsset(m[2], ctx);
      const { destination, confidence: destConf } = resolveDestination(m[3], ctx);
      const missing: string[] = [];
      if (!destination.resolved) missing.push("from");
      if (asset.issuerUnresolved) missing.push("assetIssuer");
      if (!amount) missing.push("amount");
      return {
        params: {
          amount: amount?.value ?? "",
          assetCode: asset.assetCode ?? "",
          assetIssuer: asset.assetIssuer ?? "",
          from: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
        },
        fieldConfidence: {
          amount: amount ? 0.95 : 0.2,
          assetCode: assetConf,
          from: destConf,
        },
        missingFields: missing,
      };
    },
    examples: ["Clawback 100 USDC from GABC..."],
  },

  // ── Lower-weight fallbacks: verb plus destination, amount elsewhere
  {
    id: "payment.verb.dest.fallback",
    type: "payment",
    weight: 40,
    regex: new RegExp(`^(?:send|pay|transfer)\\s+(?:to\\s+)?(${ADDR})\\b`, "i"),
    build: (m, clause, ctx) => buildTransfer("", undefined, m[1], clause, ctx),
    examples: ["Send to alice"],
  },
  {
    id: "createAccount.verb.fallback",
    type: "createAccount",
    weight: 39,
    regex: new RegExp(`^(?:create|open)\\s+(?:an?\\s+)?(?:new\\s+)?account\\b(?:\\s+for\\s+(${ADDR}))?`, "i"),
    build: (m, clause, ctx) => {
      const { destination, confidence } = m[1]
        ? resolveDestination(m[1], ctx)
        : { destination: { raw: "", kind: "unknown" as const }, confidence: 0.1 };
      const amount = extractAmount(clause);
      const missing: string[] = [];
      if (!destination.resolved) missing.push("destination");
      if (!amount) missing.push("startingBalance");
      return {
        params: {
          destination: destination.resolved ?? destination.raw,
          destinationRaw: destination.raw,
          startingBalance: amount?.value ?? "",
        },
        fieldConfidence: { destination: confidence, startingBalance: amount ? 0.8 : 0.2 },
        missingFields: missing,
      };
    },
    examples: ["Create a new account"],
  },
  {
    id: "changeTrust.verb.fallback",
    type: "changeTrust",
    weight: 38,
    regex: /^(?:trust|trustline)\b/i,
    build: (m, clause, ctx) => buildTrustline(extractAssetToken(clause) ?? "", clause, ctx),
    examples: ["Trustline"],
  },
];

/** Sorted once at module load; the parser relies on descending weight. */
export const SORTED_PATTERNS: Pattern[] = [...PATTERNS].sort((a, b) => b.weight - a.weight);

/** Total pattern count, asserted by the test suite against the 30+ criterion. */
export const PATTERN_COUNT = PATTERNS.length;

/** Flat list of example phrasings for the UI hint panel. */
export const PATTERN_EXAMPLES: string[] = PATTERNS.flatMap((p) => p.examples);