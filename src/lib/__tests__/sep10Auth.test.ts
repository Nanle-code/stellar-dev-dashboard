import { describe, it, expect } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  createSep10Challenge,
  validateSep10Challenge,
  signSep10Challenge,
  verifyChallengeAndIssueToken,
  generateChallengeNonce,
  Sep10ValidationError,
} from '../sep10Auth';

describe('SEP-0010 Web Authentication Helper', () => {
  const serverKp = StellarSdk.Keypair.random();
  const clientKp = StellarSdk.Keypair.random();
  const homeDomain = 'stellar-dashboard.test';
  const networkPassphrase = StellarSdk.Networks.TESTNET;

  describe('generateChallengeNonce', () => {
    it('generates random hex/base64 nonce of expected length', () => {
      const nonce = generateChallengeNonce(48);
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBe(64); // 48 bytes in base64 = 64 chars (within Stellar 64-byte limit)
    });
  });

  describe('createSep10Challenge & validateSep10Challenge (Primary Flow)', () => {
    it('successfully generates and validates a SEP-0010 challenge', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
        timeoutSeconds: 300,
        networkPassphrase,
      });

      expect(challenge.transactionXDR).toBeDefined();
      expect(challenge.serverPublicKey).toBe(serverKp.publicKey());
      expect(challenge.clientAccountId).toBe(clientKp.publicKey());
      expect(challenge.homeDomain).toBe(homeDomain);
      expect(challenge.maxTime - challenge.minTime).toBe(300);

      // Validate the created challenge
      const parsed = validateSep10Challenge(
        challenge.transactionXDR,
        serverKp.publicKey(),
        homeDomain,
        networkPassphrase
      );

      expect(parsed.serverPublicKey).toBe(serverKp.publicKey());
      expect(parsed.clientAccountId).toBe(clientKp.publicKey());
      expect(parsed.homeDomain).toBe(homeDomain);
      expect(parsed.hasServerSignature).toBe(true);
      expect(parsed.hasClientSignature).toBe(false);
      expect(parsed.isExpired).toBe(false);
    });

    it('supports client signing and subsequent token verification', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
        networkPassphrase,
      });

      // Client signs challenge
      const signedXDR = signSep10Challenge(
        challenge.transactionXDR,
        clientKp,
        networkPassphrase
      );

      // Verify and issue token
      const tokenPayload = verifyChallengeAndIssueToken(
        signedXDR,
        serverKp.publicKey(),
        homeDomain,
        networkPassphrase
      );

      expect(tokenPayload.token).toBeDefined();
      expect(tokenPayload.sub).toBe(clientKp.publicKey());
      expect(tokenPayload.iss).toBe(`https://${homeDomain}/auth`);
      expect(tokenPayload.exp).toBeGreaterThan(tokenPayload.iat);
    });
  });

  describe('Boundary Cases', () => {
    it('supports maximum allowed timeout (86400 seconds)', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
        timeoutSeconds: 86400,
      });

      expect(challenge.maxTime - challenge.minTime).toBe(86400);
    });

    it('supports optional webAuthDomain parameter', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
        webAuthDomain: 'auth.stellar-dashboard.test',
      });

      const parsed = validateSep10Challenge(
        challenge.transactionXDR,
        serverKp.publicKey(),
        homeDomain
      );
      expect(parsed.hasServerSignature).toBe(true);
    });
  });

  describe('Failure & Error Handling Paths', () => {
    it('rejects invalid client account ID', () => {
      expect(() =>
        createSep10Challenge({
          serverKeypair: serverKp,
          clientAccountId: 'invalid-address',
          homeDomain,
        })
      ).toThrow(Sep10ValidationError);
    });

    it('rejects invalid home domain', () => {
      expect(() =>
        createSep10Challenge({
          serverKeypair: serverKp,
          clientAccountId: clientKp.publicKey(),
          homeDomain: '',
        })
      ).toThrow(/homeDomain is required/);
    });

    it('rejects invalid timeout values', () => {
      expect(() =>
        createSep10Challenge({
          serverKeypair: serverKp,
          clientAccountId: clientKp.publicKey(),
          homeDomain,
          timeoutSeconds: 0,
        })
      ).toThrow(/Timeout must be between 1 and 86400/);

      expect(() =>
        createSep10Challenge({
          serverKeypair: serverKp,
          clientAccountId: clientKp.publicKey(),
          homeDomain,
          timeoutSeconds: 90000,
        })
      ).toThrow(/Timeout must be between 1 and 86400/);
    });

    it('detects and rejects expired challenges', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
        timeoutSeconds: 10,
      });

      // Simulate validation at time in future
      const futureEpoch = challenge.maxTime + 100;
      expect(() =>
        validateSep10Challenge(
          challenge.transactionXDR,
          serverKp.publicKey(),
          homeDomain,
          networkPassphrase,
          futureEpoch
        )
      ).toThrow(/Challenge has expired/);
    });

    it('rejects challenge if expected server public key does not match', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
      });

      const otherKp = StellarSdk.Keypair.random();
      expect(() =>
        validateSep10Challenge(
          challenge.transactionXDR,
          otherKp.publicKey(),
          homeDomain
        )
      ).toThrow(/does not match server public key/);
    });

    it('fails token issuance if client has not signed the challenge', () => {
      const challenge = createSep10Challenge({
        serverKeypair: serverKp,
        clientAccountId: clientKp.publicKey(),
        homeDomain,
      });

      expect(() =>
        verifyChallengeAndIssueToken(
          challenge.transactionXDR,
          serverKp.publicKey(),
          homeDomain
        )
      ).toThrow(/missing a valid signature from client account/);
    });

    it('rejects malformed XDR string', () => {
      expect(() =>
        validateSep10Challenge(
          'not-a-valid-xdr-string',
          serverKp.publicKey(),
          homeDomain
        )
      ).toThrow(/Failed to deserialize challenge transaction/);
    });
  });
});
