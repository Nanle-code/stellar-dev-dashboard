// src/lib/phishingDetector.js
import weights from './model_weights.json';

const SUSPICIOUS_MEMOS = [
  /verify.*account/i,
  /claim.*reward/i,
  /urgent.*action/i,
  /suspended.*account/i,
  /security.*alert/i,
  /confirm.*identity/i,
  /wallet.*upgrade/i,
  /airdrop/i,
  /free.*tokens/i
];

const SUSPICIOUS_DOMAINS = [
  /stellàr\.org/i,
  /stellar-reward\.org/i,
  /coinbase-verify\.com/i,
  /stellar-airdrop\.com/i,
  /stelllar\.org/i,
  /stella-upgrade\.org/i
];

// Helper to check if a memo contains phishing patterns
export function memoHasPhishingPattern(memoText) {
  if (!memoText) return 0;
  return SUSPICIOUS_MEMOS.some(regex => regex.test(memoText)) ? 1 : 0;
}

// Helper to check for asset impersonation
export function detectAssetImpersonation(assetCode, assetIssuer, isNative) {
  if (isNative) return 0;
  if (!assetCode) return 0;
  
  // Custom lookalikes / scam names
  const SCAM_LOOKALIKES = ['XXLM', 'USDCC', 'USDTD', 'USDT-FREE', 'XLM-REWARD'];
  if (SCAM_LOOKALIKES.includes(assetCode.toUpperCase())) {
    return 1;
  }
  
  // Official USDC issuer on Stellar
  const OFFICIAL_USDC_ISSUER = 'GA5Z35H7TY653EX2COMSO63HJ4QB6E6CHZB4ST356UDH77HD6DJ7AD6S';
  if (assetCode.toUpperCase() === 'USDC' && assetIssuer !== OFFICIAL_USDC_ISSUER) {
    return 1;
  }
  
  return 0;
}

// Helper to check for domain impersonation (homoglyphs and typosquatting)
export function detectDomainImpersonation(domain) {
  if (!domain) return 0;
  
  // Check for homoglyphs (non-ASCII characters in domain name)
  const hasHomoglyphs = /[^\u0000-\u007F]/.test(domain);
  if (hasHomoglyphs) return 1;
  
  // Check typosquatting regex patterns
  return SUSPICIOUS_DOMAINS.some(regex => regex.test(domain)) ? 1 : 0;
}

// Mathematical helpers for the forward pass
function relu(x) {
  return Math.max(0, x);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Predict phishing probability using the lightweight forward pass
 * @param {Array<number>} features - Array of 6 normalized features
 * @returns {number} Probability between 0 and 1
 */
export function predictPhishingProbability(features) {
  if (!features || features.length !== 6) {
    throw new Error('Features must be an array of length 6');
  }

  // Layer 1: Dense (6 -> 16)
  const h1 = [];
  for (let j = 0; j < 16; j++) {
    let sum = weights.b1[j];
    for (let i = 0; i < 6; i++) {
      sum += features[i] * weights.w1[i][j];
    }
    h1.push(relu(sum));
  }

  // Layer 2: Dense (16 -> 8)
  const h2 = [];
  for (let j = 0; j < 8; j++) {
    let sum = weights.b2[j];
    for (let i = 0; i < 16; i++) {
      sum += h1[i] * weights.w2[i][j];
    }
    h2.push(relu(sum));
  }

  // Layer 3: Dense (8 -> 1)
  let sum = weights.b3[0];
  for (let i = 0; i < 8; i++) {
    sum += h2[i] * weights.w3[i][0];
  }
  
  return sigmoid(sum);
}

/**
 * Analyze a Stellar operation and predict phishing risk
 * @param {object} op - Parsed Stellar operation
 * @param {string} memo - Transaction memo text
 * @param {number} reputationScore - Reputation score of the recipient from 0.0 to 1.0
 * @param {boolean} recipientIsNew - Whether the recipient is a new/unestablished account
 * @returns {object} Phishing prediction result
 */
export function analyzePhishing(op, memo, reputationScore, recipientIsNew) {
  let amount = 0;
  let assetCode = 'XLM';
  let assetIssuer = '';
  let isNative = true;
  
  if (op.type === 'payment') {
    amount = parseFloat(op.amount || 0);
    if (op.asset) {
      isNative = op.asset.isNative();
      if (!isNative) {
        assetCode = op.asset.code;
        assetIssuer = op.asset.issuer;
      }
    }
  } else if (op.type === 'createAccount') {
    amount = parseFloat(op.startingBalance || 0);
  }
  
  // Extract features
  const amountLog = Math.log1p(amount) / 10;
  const isNewVal = recipientIsNew ? 1 : 0;
  const memoVal = memoHasPhishingPattern(memo);
  const assetVal = detectAssetImpersonation(assetCode, assetIssuer, isNative);
  
  // Check if domain is impersonated (by checking memo text or known domains)
  let domainVal = 0;
  if (memo) {
    // Extract domain-like patterns from memo
    const domainMatch = memo.match(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/i);
    if (domainMatch) {
      domainVal = detectDomainImpersonation(domainMatch[0]);
    }
  }
  
  const features = [
    amountLog,
    isNewVal,
    memoVal,
    assetVal,
    domainVal,
    reputationScore
  ];
  
  const probability = predictPhishingProbability(features);
  
  return {
    probability,
    isPhishing: probability > 0.5,
    features
  };
}
