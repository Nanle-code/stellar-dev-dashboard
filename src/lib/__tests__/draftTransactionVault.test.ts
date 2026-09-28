/**
 * Tests for Draft Transaction Vault
 * #855 - Persist draft transactions with encrypted local vault
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { draftTransactionVault, DraftTransaction } from '../draftTransactionVault';

declare global {
  var indexedDB: IDBFactory | undefined;
  var crypto: Crypto | undefined;
}

describe('DraftTransactionVault', () => {
  beforeEach(async () => {
    // Clear any existing database
    try {
      await draftTransactionVault.clearAllDrafts();
    } catch (e) {
      // Ignore if not initialized
    }
  });

  afterEach(async () => {
    try {
      await draftTransactionVault.clearAllDrafts();
    } catch (e) {
      // Ignore
    }
  });

  describe('Initialization', () => {
    it('should initialize with generated key', async () => {
      await draftTransactionVault.initialize();
      const key = await draftTransactionVault.getEncryptionKey();
      expect(key).toBeTruthy();
      expect(key?.length).toBeGreaterThan(0);
    });

    it('should initialize with existing key', async () => {
      const existingKey = await draftTransactionVault.initialize();
      const key = await draftTransactionVault.getEncryptionKey();
      
      await draftTransactionVault.clearAllDrafts();
      await draftTransactionVault.initialize({ existingKey: key! });
      
      const newKey = await draftTransactionVault.getEncryptionKey();
      expect(newKey).toBe(key);
    });

    it('should initialize with passphrase', async () => {
      await draftTransactionVault.initialize({ passphrase: 'test-passphrase' });
      expect(await draftTransactionVault.getEncryptionKey()).toBeNull();
    });

    it('should throw error in unsupported environment', async () => {
      // Mock unsupported environment
      const originalIndexedDB = (globalThis as any).indexedDB;
      const originalCrypto = (globalThis as any).crypto;
      
      // @ts-ignore
      delete (globalThis as any).indexedDB;
      
      await expect(draftTransactionVault.initialize()).rejects.toThrow(
        'Draft vault requires IndexedDB and Web Crypto API support'
      );
      
      (globalThis as any).indexedDB = originalIndexedDB;
      (globalThis as any).crypto = originalCrypto;
    });
  });

  describe('Save and Load Drafts', () => {
    beforeEach(async () => {
      await draftTransactionVault.initialize();
    });

    it('should save and load a draft with key-based encryption', async () => {
      const draft = {
        name: 'Test Payment',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [
          {
            type: 'payment',
            params: {
              destination: 'GD7Y6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
              assetType: 'native',
              amount: '100',
            },
          },
        ],
      };

      const id = await draftTransactionVault.saveDraft(draft);
      expect(id).toBeTruthy();

      const loaded = await draftTransactionVault.loadDraft(id);
      expect(loaded).toBeTruthy();
      expect(loaded?.name).toBe('Test Payment');
      expect(loaded?.operations).toHaveLength(1);
      expect(loaded?.operations[0].type).toBe('payment');
    });

    it('should save and load a draft with passphrase encryption', async () => {
      await draftTransactionVault.clearAllDrafts();
      await draftTransactionVault.initialize({ passphrase: 'secure-passphrase' });

      const draft = {
        name: 'Secure Draft',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [
          {
            type: 'createAccount',
            params: {
              destination: 'GD7Y6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
              startingBalance: '2',
            },
          },
        ],
      };

      const id = await draftTransactionVault.saveDraft(draft, 'secure-passphrase');
      const loaded = await draftTransactionVault.loadDraft(id, 'secure-passphrase');

      expect(loaded?.name).toBe('Secure Draft');
      expect(loaded?.operations[0].type).toBe('createAccount');
    });

    it('should fail to decrypt with wrong passphrase', async () => {
      await draftTransactionVault.clearAllDrafts();
      await draftTransactionVault.initialize({ passphrase: 'correct-pass' });

      const draft = {
        name: 'Secret Draft',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      const id = await draftTransactionVault.saveDraft(draft, 'correct-pass');

      await expect(
        draftTransactionVault.loadDraft(id, 'wrong-pass')
      ).rejects.toThrow('Failed to decrypt draft');
    });

    it('should handle complex transaction with preconditions', async () => {
      const draft = {
        name: 'Complex Transaction',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [
          {
            type: 'payment',
            params: {
              destination: 'GD7Y6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
              assetType: 'native',
              amount: '50',
            },
          },
          {
            type: 'changeTrust',
            params: {
              assetCode: 'USDC',
              assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
              limit: '1000',
            },
          },
        ],
        memo: 'Test memo',
        memoType: 'text',
        baseFee: 100,
        timeout: 180,
        preconditions: {
          ledgerBounds: {
            minLedger: 100,
            maxLedger: 200,
          },
          minSequence: 12345,
          extraSigners: ['GD8Y6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K'],
        },
      };

      const id = await draftTransactionVault.saveDraft(draft);
      const loaded = await draftTransactionVault.loadDraft(id);

      expect(loaded?.preconditions?.ledgerBounds?.minLedger).toBe(100);
      expect(loaded?.preconditions?.extraSigners).toHaveLength(1);
      expect(loaded?.memo).toBe('Test memo');
    });
  });

  describe('Update Drafts', () => {
    beforeEach(async () => {
      await draftTransactionVault.initialize();
    });

    it('should update an existing draft', async () => {
      const draft = {
        name: 'Original Name',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      const id = await draftTransactionVault.saveDraft(draft);

      await draftTransactionVault.updateDraft(id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      const loaded = await draftTransactionVault.loadDraft(id);
      expect(loaded?.name).toBe('Updated Name');
      expect(loaded?.description).toBe('Updated description');
    });

    it('should throw error when updating non-existent draft', async () => {
      await expect(
        draftTransactionVault.updateDraft('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('Draft not found');
    });
  });

  describe('List Drafts', () => {
    beforeEach(async () => {
      await draftTransactionVault.initialize();
    });

    it('should list all draft metadata', async () => {
      const draft1 = {
        name: 'Draft 1',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      const draft2 = {
        name: 'Draft 2',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      await draftTransactionVault.saveDraft(draft1);
      await draftTransactionVault.saveDraft(draft2);

      const drafts = await draftTransactionVault.listDrafts();
      expect(drafts).toHaveLength(2);
      expect(drafts[0].id).toBeTruthy();
      expect(drafts[0].createdAt).toBeTruthy();
    });

    it('should return empty list when no drafts', async () => {
      const drafts = await draftTransactionVault.listDrafts();
      expect(drafts).toHaveLength(0);
    });
  });

  describe('Delete Drafts', () => {
    beforeEach(async () => {
      await draftTransactionVault.initialize();
    });

    it('should delete a draft', async () => {
      const draft = {
        name: 'To Delete',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      const id = await draftTransactionVault.saveDraft(draft);
      await draftTransactionVault.deleteDraft(id);

      const loaded = await draftTransactionVault.loadDraft(id);
      expect(loaded).toBeNull();
    });

    it('should clear all drafts', async () => {
      const draft = {
        name: 'Draft',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      await draftTransactionVault.saveDraft(draft);
      await draftTransactionVault.clearAllDrafts();

      const drafts = await draftTransactionVault.listDrafts();
      expect(drafts).toHaveLength(0);
    });
  });

  describe('Export and Import', () => {
    beforeEach(async () => {
      await draftTransactionVault.initialize();
    });

    it('should export all drafts', async () => {
      const draft = {
        name: 'Export Test',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [
          {
            type: 'payment',
            params: {
              destination: 'GD7Y6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
              assetType: 'native',
              amount: '10',
            },
          },
        ],
      };

      await draftTransactionVault.saveDraft(draft);
      const exported = await draftTransactionVault.exportDrafts();

      expect(exported).toHaveLength(1);
      expect(exported[0].name).toBe('Export Test');
      expect(exported[0].operations).toHaveLength(1);
    });

    it('should import drafts', async () => {
      const draftsToImport: DraftTransaction[] = [
        {
          id: 'imported-1',
          name: 'Imported Draft',
          sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
          network: 'testnet',
          operations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await draftTransactionVault.importDrafts(draftsToImport);
      const drafts = await draftTransactionVault.listDrafts();

      expect(drafts).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(draftTransactionVault.saveDraft({
        name: 'Test',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      })).rejects.toThrow('Vault not initialized');
    });

    it('should throw error when passphrase required but not provided', async () => {
      await draftTransactionVault.initialize({ passphrase: 'test' });
      await draftTransactionVault.clearAllDrafts();
      
      // Reinitialize without passphrase
      await draftTransactionVault.initialize();
      
      const draft = {
        name: 'Test',
        sourceAccount: 'GD5J6JFZ3Q6J5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K',
        network: 'testnet',
        operations: [],
      };

      await expect(
        draftTransactionVault.saveDraft(draft)
      ).rejects.toThrow('Passphrase required');
    });
  });
});
