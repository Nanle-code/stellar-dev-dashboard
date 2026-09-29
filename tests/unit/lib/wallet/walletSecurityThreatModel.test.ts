/**
 * Unit & Threat Model tests for Freighter and Ledger wallet flows (#841)
 * Covers:
 * - Wallet spoofing detection (invalid/counterfeit public keys, derivation path hijacking)
 * - Phishing mitigation (malicious memos, suspicious destinations, typosquatted origins)
 * - Malicious dApp scenarios (cross-network replay, empty/tampered XDR payloads)
 * - Unsupported environments & failure paths (WebUSB/WebHID absence, locked state)
 */

import { describe, it, expect } from 'vitest';
import {
  validateWalletPublicKey,
  validateDerivationPath,
  evaluateWalletThreatModel,
} from '../../../../src/lib/wallet/security';

const VALID_KEY = 'GBTRHGO73LJZ6BST3MIFJNKZZVVNCNYCM4U5N4M47OOJYEG3QEOY4NS3';

describe('Wallet Threat Model & Security Validations', () => {
  describe('validateWalletPublicKey', () => {
    it('primary flow: validates genuine Stellar Ed25519 public key', () => {
      const result = validateWalletPublicKey(VALID_KEY);
      expect(result.valid).toBe(true);
    });

    it('boundary case: accepts legacy test mock key prefix', () => {
      const result = validateWalletPublicKey('GA1234567890MOCKWALLETPUBLICKEY1234567890');
      expect(result.valid).toBe(true);
    });

    it('threat model failure: rejects spoofed or corrupted public keys', () => {
      expect(validateWalletPublicKey('MALICIOUS_PUBLIC_KEY').valid).toBe(false);
      expect(validateWalletPublicKey('<script>alert("xss")</script>').valid).toBe(false);
      // Corrupted checksum
      expect(
        validateWalletPublicKey('GBTRHGO73LJZ6BST3MIFJNKZZVVNCNYCM4U5N4M47OOJYEG3QEOY4NS0').valid
      ).toBe(false);
    });

    it('failure case: handles null, non-string or whitespace-only keys', () => {
      expect(validateWalletPublicKey(null).valid).toBe(false);
      expect(validateWalletPublicKey(undefined).valid).toBe(false);
      expect(validateWalletPublicKey('').valid).toBe(false);
      expect(validateWalletPublicKey('   ').valid).toBe(false);
      expect(validateWalletPublicKey(12345).valid).toBe(false);
    });
  });

  describe('validateDerivationPath', () => {
    it('primary flow: accepts standard BIP-44 Stellar primary account path', () => {
      expect(validateDerivationPath("44'/148'/0'").valid).toBe(true);
    });

    it('boundary case: accepts alternate BIP-44 account and change indices', () => {
      expect(validateDerivationPath("44'/148'/1'").valid).toBe(true);
      expect(validateDerivationPath("44'/148'/255'").valid).toBe(true);
      expect(validateDerivationPath("44'/148'/0'/0'").valid).toBe(true);
    });

    it('threat model failure: rejects derivation path manipulation outside Stellar coin type', () => {
      // Ethereum path
      const ethResult = validateDerivationPath("44'/60'/0'");
      expect(ethResult.valid).toBe(false);
      expect(ethResult.reason).toMatch(/BIP-44 Stellar/i);

      // Bitcoin path
      const btcResult = validateDerivationPath("44'/0'/0'");
      expect(btcResult.valid).toBe(false);
      expect(btcResult.reason).toMatch(/BIP-44 Stellar/i);
    });

    it('failure case: rejects empty, non-string, or injection strings', () => {
      expect(validateDerivationPath('').valid).toBe(false);
      expect(validateDerivationPath(null).valid).toBe(false);
      expect(validateDerivationPath("44'/148'/; DROP TABLE").valid).toBe(false);
    });
  });

  describe('evaluateWalletThreatModel', () => {
    it('primary flow: evaluates clean session as safe', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'freighter',
        publicKey: VALID_KEY,
        network: 'testnet',
        expectedNetwork: 'testnet',
        xdr: 'AAAA_VALID_BASE64_XDR',
      });

      expect(evaluation.safe).toBe(true);
      expect(evaluation.riskLevel).toBe('low');
      expect(evaluation.threatsDetected).toHaveLength(0);
    });

    it('threat model: flags public key spoofing with critical risk', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'freighter',
        publicKey: 'INVALID_SPOOFED_KEY',
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.riskLevel).toBe('critical');
      expect(evaluation.threatsDetected).toContain('wallet_spoofing_public_key');
    });

    it('threat model: flags derivation path hijacking on Ledger with critical risk', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'ledger',
        publicKey: VALID_KEY,
        derivationPath: "44'/60'/0'/0/0",
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.riskLevel).toBe('critical');
      expect(evaluation.threatsDetected).toContain('derivation_path_manipulation');
    });

    it('threat model: flags phishing destination and memo patterns', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'freighter',
        publicKey: VALID_KEY,
        destination: 'stellarr-scam-reward.com',
        memo: 'claim: freighter-wallet.org',
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.riskLevel).toBe('critical');
      expect(evaluation.threatsDetected).toContain('phishing_destination');
      expect(evaluation.threatsDetected).toContain('phishing_memo');
    });

    it('threat model: flags typosquatted or deceptive dApp origin', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'freighter',
        publicKey: VALID_KEY,
        origin: 'https://stellar-dev-dashb0ard.com',
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.riskLevel).toBe('critical');
      expect(evaluation.threatsDetected).toContain('phishing_origin_spoofing');
    });

    it('threat model: flags cross-network replay risk on network mismatch', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'freighter',
        publicKey: VALID_KEY,
        network: 'public',
        expectedNetwork: 'testnet',
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.threatsDetected).toContain('cross_network_replay_risk');
      expect(evaluation.remediation[0]).toMatch(/Cross-network mismatch/i);
    });

    it('failure case: flags unsupported browser environment for Ledger', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'ledger',
        isSupported: false,
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.riskLevel).toBe('critical');
      expect(evaluation.threatsDetected).toContain('unsupported_environment');
      expect(evaluation.remediation[0]).toMatch(/WebUSB\/WebHID/i);
    });

    it('failure case: flags locked wallet state', () => {
      const evaluation = evaluateWalletThreatModel({
        walletType: 'freighter',
        publicKey: VALID_KEY,
        isLocked: true,
      });

      expect(evaluation.safe).toBe(false);
      expect(evaluation.riskLevel).toBe('high');
      expect(evaluation.threatsDetected).toContain('wallet_locked');
    });
  });
});
