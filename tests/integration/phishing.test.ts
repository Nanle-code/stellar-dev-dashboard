// @vitest-environment node
if (typeof window === 'undefined') {
  global.window = globalThis as any;
}
if (typeof navigator === 'undefined') {
  global.navigator = { clipboard: {} } as any;
}

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  getReputationScore, 
  whitelistAddress, 
  reportMaliciousAddress, 
  clearReputationData,
  isAddressWhitelisted
} from '../../src/lib/reputationSystem';
import { 
  memoHasPhishingPattern, 
  detectAssetImpersonation, 
  detectDomainImpersonation,
  predictPhishingProbability
} from '../../src/lib/phishingDetector';
import { verifyTransaction, RISK_LEVELS } from '../../src/lib/transactionVerification';
import * as StellarSdk from '@stellar/stellar-sdk';
import { fetchAccount, fetchTransactions } from '../../src/lib/stellar';

// Mock the stellar.ts methods to avoid actual Horizon requests
vi.mock('../../src/lib/stellar', () => {
  return {
    fetchAccount: vi.fn(),
    fetchTransactions: vi.fn(),
    NETWORKS: {
      testnet: { passphrase: 'Test SDF Network ; September 2015' }
    }
  };
});

describe('Address Reputation System', () => {
  beforeEach(() => {
    clearReputationData();
    vi.resetAllMocks();
  });

  it('should return default reputation score of 0.8 for unknown address', () => {
    const score = getReputationScore('GAX123');
    expect(score).toBe(0.8);
  });

  it('should return 1.0 reputation score if address is whitelisted', () => {
    whitelistAddress('GAX123');
    expect(isAddressWhitelisted('GAX123')).toBe(true);
    expect(getReputationScore('GAX123')).toBe(1.0);
  });

  it('should deduct reputation score based on reports', () => {
    const address = 'GAX_SPAMMER';
    reportMaliciousAddress(address, 'Phishing scam');
    expect(getReputationScore(address)).toBe(0.6); // 0.8 - 0.2

    reportMaliciousAddress(address, 'Another report');
    expect(getReputationScore(address)).toBe(0.4); // 0.8 - 0.4

    reportMaliciousAddress(address, 'Third report');
    expect(getReputationScore(address)).toBe(0.0); // 3+ reports triggers auto-blacklist (0.0)
  });

  it('should deduct reputation for new accounts and suspicious domains', () => {
    const address = 'GAX_NEW';
    // 0.8 baseline - 0.1 new account = 0.7
    expect(getReputationScore(address, { recipientIsNew: true, isDomainSuspicious: false })).toBe(0.7);

    // 0.8 baseline - 0.3 suspicious domain = 0.5
    expect(getReputationScore(address, { recipientIsNew: false, isDomainSuspicious: true })).toBe(0.5);

    // 0.8 baseline - 0.1 new account - 0.3 suspicious domain = 0.4
    expect(getReputationScore(address, { recipientIsNew: true, isDomainSuspicious: true })).toBe(0.4);
  });

  it('should clamp reputation score between 0.0 and 1.0', () => {
    const address = 'GAX_CLAMP';
    // Deductions: new account (-0.1), suspicious domain (-0.3), 3 reports (-0.6) -> baseline 0.8 - 1.0 = -0.2 -> clamped to 0.0
    reportMaliciousAddress(address, 'r1');
    reportMaliciousAddress(address, 'r2');
    reportMaliciousAddress(address, 'r3');
    const score = getReputationScore(address, { recipientIsNew: true, isDomainSuspicious: true });
    expect(score).toBe(0.0);
  });
});

describe('Phishing Heuristics & Model Detection', () => {
  it('should correctly flag phishing memos', () => {
    expect(memoHasPhishingPattern('Claim your reward here')).toBe(1);
    expect(memoHasPhishingPattern('verify your account')).toBe(1);
    expect(memoHasPhishingPattern('standard billing invoice')).toBe(0);
    expect(memoHasPhishingPattern('')).toBe(0);
  });

  it('should correctly flag asset impersonation', () => {
    expect(detectAssetImpersonation('XXLM', 'G_ISSUER', false)).toBe(1);
    expect(detectAssetImpersonation('USDCC', 'G_ISSUER', false)).toBe(1);
    expect(detectAssetImpersonation('USDC', 'G_NOT_OFFICIAL', false)).toBe(1); // Fake USDC issuer
    expect(detectAssetImpersonation('USDC', 'GA5Z35H7TY653EX2COMSO63HJ4QB6E6CHZB4ST356UDH77HD6DJ7AD6S', false)).toBe(0); // Official USDC issuer
    expect(detectAssetImpersonation('XLM', '', true)).toBe(0); // Native XLM
  });

  it('should correctly flag domain impersonation', () => {
    expect(detectDomainImpersonation('stellàr.org')).toBe(1); // Homoglyph à
    expect(detectDomainImpersonation('stellar-reward.org')).toBe(1); // Typosquatting
    expect(detectDomainImpersonation('stellar.org')).toBe(0); // Official domain
  });

  it('should perform NN forward pass predictions', () => {
    // Normal features: low amount, established, safe memo, normal asset, safe domain, good reputation
    // [amountLog, recipientIsNew, memoHasPhishingPattern, assetImpersonation, domainImpersonation, recipientReputation]
    const safeFeatures = [0.1, 0, 0, 0, 0, 0.8];
    const safeProb = predictPhishingProbability(safeFeatures);
    expect(safeProb).toBeLessThan(0.3);

    // Suspicious features: high amount, new account, phishing memo, fake asset, suspicious domain, low reputation
    const scamFeatures = [0.8, 1, 1, 1, 1, 0.1];
    const scamProb = predictPhishingProbability(scamFeatures);
    expect(scamProb).toBeGreaterThan(0.7);
  });
});

describe('AI Phishing Detection Performance Metrics', () => {
  it('should achieve >= 95% precision and < 2% false positive rate', () => {
    let tp = 0, fp = 0, tn = 0;
    
    // Generate a diverse test dataset
    for (let i = 0; i < 200; i++) {
      const isScam = Math.random() < 0.3;
      let features: number[];
      
      if (isScam) {
        features = [
          0.5 + Math.random() * 0.5, // High amount
          1,                         // New recipient
          Math.random() < 0.8 ? 1 : 0, // Phishing memo
          Math.random() < 0.5 ? 1 : 0, // Fake asset
          Math.random() < 0.6 ? 1 : 0, // Suspicious domain
          0.0 + Math.random() * 0.2  // Low reputation
        ];
      } else {
        features = [
          0.0 + Math.random() * 0.4, // Low amount
          Math.random() < 0.1 ? 1 : 0, // Established recipient
          0,                         // No phishing memo
          0,                         // No fake asset
          0,                         // No typosquat
          0.7 + Math.random() * 0.3  // High reputation
        ];
      }
      
      const prob = predictPhishingProbability(features);
      const predicted = prob > 0.5 ? 1 : 0;
      const actual = isScam ? 1 : 0;
      
      if (actual === 1 && predicted === 1) tp++;
      if (actual === 0 && predicted === 1) fp++;
      if (actual === 0 && predicted === 0) tn++;
    }
    
    const precision = tp / (tp + fp || 1);
    const fpr = fp / (fp + tn || 1);
    
    expect(precision).toBeGreaterThanOrEqual(0.95);
    expect(fpr).toBeLessThan(0.02);
  });
});

describe('Transaction Verification Integration', () => {
  beforeEach(() => {
    clearReputationData();
    vi.resetAllMocks();
  });

  it('should verify a normal transaction as Low Risk', async () => {
    // Generate valid random public keys
    const sourceKey = StellarSdk.Keypair.random().publicKey();
    const recipientKey = StellarSdk.Keypair.random().publicKey();

    // Mock stellar horizon responses
    vi.mocked(fetchAccount).mockResolvedValue({ id: recipientKey, balances: [] } as any);
    vi.mocked(fetchTransactions).mockResolvedValue({ records: [] } as any);

    // Create a simple payment transaction (legit)
    const tx = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(sourceKey, '100'),
      { 
        fee: '100', 
        networkPassphrase: StellarSdk.Networks.TESTNET,
        timebounds: { minTime: '1', maxTime: '2000000000' }
      }
    )
      .addOperation(StellarSdk.Operation.payment({
        destination: recipientKey,
        asset: StellarSdk.Asset.native(),
        amount: '10',
      }))
      .build();

    const xdr = tx.toXDR();
    const result = (await verifyTransaction(xdr, 'testnet', sourceKey)) as any;
    
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe(RISK_LEVELS.LOW);
    expect(result.warnings.length).toBe(0);
  });

  it('should verify a phishing transaction as Critical Risk and then clear warnings after whitelisting', async () => {
    // Generate valid random public keys
    const sourceKey = StellarSdk.Keypair.random().publicKey();
    const scamRecipient = StellarSdk.Keypair.random().publicKey();

    // Mock new recipient (throws not found)
    vi.mocked(fetchAccount).mockRejectedValue(new Error('Account not found'));
    vi.mocked(fetchTransactions).mockResolvedValue({ records: [] } as any);
    
    // Create a transaction with phishing cues (New recipient, Claim memo, Typosquat domain)
    const tx = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(sourceKey, '100'),
      { 
        fee: '100', 
        networkPassphrase: StellarSdk.Networks.TESTNET,
        timebounds: { minTime: '1', maxTime: '2000000000' }
      }
    )
      .addOperation(StellarSdk.Operation.payment({
        destination: scamRecipient,
        asset: StellarSdk.Asset.native(),
        amount: '50',
      }))
      .addMemo(StellarSdk.Memo.text('claim: stellar-reward.org'))
      .build();

    const xdr = tx.toXDR();
    const result = (await verifyTransaction(xdr, 'testnet', sourceKey)) as any;
    
    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe(RISK_LEVELS.CRITICAL);
    expect(result.warnings.some((w: string) => w.includes('Phishing Alert') || w.includes('Domain Impersonation'))).toBe(true);

    // Whitelist the recipient address
    whitelistAddress(scamRecipient);
    
    // Re-verify the same transaction
    const secondResult = (await verifyTransaction(xdr, 'testnet', sourceKey)) as any;
    
    // Whitelisting forces reputation to 1.0 and resolves phishing threat
    expect(secondResult.success).toBe(true);
    expect(secondResult.riskLevel).toBe(RISK_LEVELS.LOW);
    // Warnings relating to Phishing, Domain Impersonation, and Reputation should be gone,
    // though it might show warning that account will be created (since destination doesn't exist)
    expect(secondResult.warnings.some((w: string) => w.includes('Phishing Alert') || w.includes('SCAM ALERT'))).toBe(false);
  });
});
