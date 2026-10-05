/**
 * Draft Transaction Vault - Encrypted Local Storage
 * 
 * Persists unfinished transaction drafts with AES-256-GCM encryption at rest.
 * Uses browser IndexedDB for storage and Web Crypto API for encryption.
 * 
 * #855 - Persist draft transactions with encrypted local vault
 */

import { encrypt, decrypt, generateKey, encryptWithKey, decryptWithKey } from './encryption';
import { v4 as uuidv4 } from 'uuid';

const DRAFT_VAULT_DB_NAME = 'stellar-dev-dashboard-draft-vault';
const DRAFT_VAULT_DB_VERSION = 1;

export interface DraftTransaction {
  id: string;
  name: string;
  description?: string;
  sourceAccount: string;
  network: string;
  operations: Array<{
    type: string;
    params: Record<string, any>;
  }>;
  memo?: string;
  memoType?: string;
  baseFee?: number;
  timeout?: number;
  timeBounds?: {
    minTime?: number;
    maxTime?: number;
  };
  preconditions?: {
    ledgerBounds?: {
      minLedger?: number;
      maxLedger?: number;
    };
    minSequence?: number;
    minSequenceAge?: number;
    minSequenceLedgerGap?: number;
    extraSigners?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedDraft {
  id: string;
  ciphertext: string;
  iv: string;
  salt?: string;
  createdAt: string;
  updatedAt: string;
}

class DraftTransactionVault {
  private db: IDBDatabase | null = null;
  private encryptionKey: string | null = null;
  private usePassphrase: boolean = false;

  /**
   * Initialize the vault with either a generated key or user passphrase
   */
  async initialize(options?: {
    passphrase?: string;
    existingKey?: string;
  }): Promise<void> {
    if (!this.isBrowserSupported()) {
      throw new Error('Draft vault requires IndexedDB and Web Crypto API support');
    }

    await this.initializeDatabase();

    if (options?.passphrase) {
      this.usePassphrase = true;
    } else if (options?.existingKey) {
      this.encryptionKey = options.existingKey;
      this.usePassphrase = false;
    } else {
      // Generate a new key if none provided
      this.encryptionKey = await generateKey();
      this.usePassphrase = false;
    }
  }

  /**
   * Check if browser supports required APIs
   */
  private isBrowserSupported(): boolean {
    return typeof indexedDB !== 'undefined' && 
           typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined';
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DRAFT_VAULT_DB_NAME, DRAFT_VAULT_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('drafts')) {
          const store = db.createObjectStore('drafts', { keyPath: 'id' });
          store.createIndex('sourceAccount', 'sourceAccount', { unique: false });
          store.createIndex('network', 'network', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Get the current encryption key (for backup/restore)
   */
  async getEncryptionKey(): Promise<string | null> {
    return this.encryptionKey;
  }

  /**
   * Save a draft transaction with encryption
   */
  async saveDraft(
    draft: Omit<DraftTransaction, 'id' | 'createdAt' | 'updatedAt'>,
    passphrase?: string
  ): Promise<string> {
    if (!this.db) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const fullDraft: DraftTransaction = {
      ...draft,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const plaintext = JSON.stringify(fullDraft);
    let encrypted: EncryptedDraft;

    if (passphrase || this.usePassphrase) {
      const keyToUse = passphrase || this.encryptionKey;
      if (!keyToUse) {
        throw new Error('Passphrase required for passphrase-based encryption');
      }
      const result = await encrypt(plaintext, keyToUse);
      encrypted = {
        id,
        ciphertext: result.ciphertext,
        iv: result.iv,
        salt: result.salt,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      if (!this.encryptionKey) {
        throw new Error('Encryption key not available');
      }
      const result = await encryptWithKey(plaintext, this.encryptionKey);
      encrypted = {
        id,
        ciphertext: result.ciphertext,
        iv: result.iv,
        createdAt: now,
        updatedAt: now,
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['drafts'], 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.put(encrypted);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing draft
   */
  async updateDraft(
    id: string,
    updates: Partial<DraftTransaction>,
    passphrase?: string
  ): Promise<void> {
    const existing = await this.loadDraft(id, passphrase);
    if (!existing) {
      throw new Error('Draft not found');
    }

    const updated: DraftTransaction = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    await this.deleteDraft(id);
    await this.saveDraft(updated, passphrase);
  }

  /**
   * Load a draft transaction by ID
   */
  async loadDraft(id: string, passphrase?: string): Promise<DraftTransaction | null> {
    if (!this.db) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    const encrypted = await this.getEncryptedDraft(id);
    if (!encrypted) {
      return null;
    }

    try {
      let plaintext: string;

      if (encrypted.salt || this.usePassphrase) {
        const keyToUse = passphrase || this.encryptionKey;
        if (!keyToUse) {
          throw new Error('Passphrase required to decrypt this draft');
        }
        plaintext = await decrypt(encrypted.ciphertext, keyToUse, encrypted.iv, encrypted.salt!);
      } else {
        if (!this.encryptionKey) {
          throw new Error('Encryption key not available');
        }
        plaintext = await decryptWithKey(encrypted.ciphertext, this.encryptionKey, encrypted.iv);
      }

      return JSON.parse(plaintext) as DraftTransaction;
    } catch (error) {
      throw new Error(`Failed to decrypt draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get encrypted draft without decrypting (for listing)
   */
  private async getEncryptedDraft(id: string): Promise<EncryptedDraft | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['drafts'], 'readonly');
      const store = transaction.objectStore('drafts');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List all draft metadata (without decrypting)
   */
  async listDrafts(): Promise<Array<{ id: string; createdAt: string; updatedAt: string }>> {
    if (!this.db) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['drafts'], 'readonly');
      const store = transaction.objectStore('drafts');
      const request = store.getAll();

      request.onsuccess = () => {
        const drafts = request.result.map((d: EncryptedDraft) => ({
          id: d.id,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
        resolve(drafts);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a draft
   */
  async deleteDraft(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['drafts'], 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all drafts
   */
  async clearAllDrafts(): Promise<void> {
    if (!this.db) {
      throw new Error('Vault not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['drafts'], 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export all drafts (decrypted) for backup
   */
  async exportDrafts(passphrase?: string): Promise<DraftTransaction[]> {
    const metadata = await this.listDrafts();
    const drafts: DraftTransaction[] = [];

    for (const meta of metadata) {
      const draft = await this.loadDraft(meta.id, passphrase);
      if (draft) {
        drafts.push(draft);
      }
    }

    return drafts;
  }

  /**
   * Import drafts from backup
   */
  async importDrafts(drafts: DraftTransaction[], passphrase?: string): Promise<void> {
    for (const draft of drafts) {
      const { id, createdAt, updatedAt, ...draftData } = draft;
      await this.saveDraft(draftData, passphrase);
    }
  }
}

export const draftTransactionVault = new DraftTransactionVault();
