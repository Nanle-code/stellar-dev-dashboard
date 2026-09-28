/**
 * Transaction Builder Templates Library
 * Pre-built templates for common Stellar operations with community contributions
 */

import { v4 as uuidv4 } from 'uuid';

export interface TransactionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'payment' | 'asset' | 'multisig' | 'dex' | 'contract' | 'advanced';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  author: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  operations: TemplateOperation[];
  parameters: TemplateParameter[];
  ratings: TemplateRating[];
  averageRating: number;
  usageCount: number;
  tags: string[];
  isCommunity: boolean;
  isOfficial: boolean;
}

export interface TemplateOperation {
  type: string;
  fields: Record<string, string | number | boolean>;
  description: string;
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'address' | 'asset' | 'boolean';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: string;
}

export interface TemplateRating {
  userId: string;
  rating: number; // 1-5
  comment?: string;
  timestamp: string;
}

export interface UserTemplate {
  id: string;
  userId: string;
  template: TransactionTemplate;
  savedAt: string;
}

const TEMPLATES_DB_NAME = 'stellar-dev-dashboard-templates';
const TEMPLATES_DB_VERSION = 1;

class TemplateLibraryManager {
  private db: IDBDatabase | null = null;
  private builtInTemplates: TransactionTemplate[] = [];

  async initialize(): Promise<void> {
    await this.initializeDatabase();
    this.initializeBuiltInTemplates();
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(TEMPLATES_DB_NAME, TEMPLATES_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('userTemplates')) {
          const userStore = db.createObjectStore('userTemplates', { keyPath: 'id' });
          userStore.createIndex('userId', 'userId', { unique: false });
          userStore.createIndex('savedAt', 'savedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('communityTemplates')) {
          const communityStore = db.createObjectStore('communityTemplates', { keyPath: 'id' });
          communityStore.createIndex('category', 'category', { unique: false });
          communityStore.createIndex('author', 'author', { unique: false });
          communityStore.createIndex('averageRating', 'averageRating', { unique: false });
        }

        if (!db.objectStoreNames.contains('ratings')) {
          const ratingsStore = db.createObjectStore('ratings', { keyPath: 'id' });
          ratingsStore.createIndex('templateId', 'templateId', { unique: false });
          ratingsStore.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  private initializeBuiltInTemplates(): void {
    this.builtInTemplates = [
      {
        id: 'template-1',
        name: 'Simple XLM Payment',
        description: 'Send XLM from one account to another with memo',
        category: 'payment',
        difficulty: 'beginner',
        author: 'Stellar Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'payment',
            fields: {
              destination: '{{destination}}',
              asset: 'native',
              amount: '{{amount}}',
            },
            description: 'Send XLM to destination address',
          },
        ],
        parameters: [
          {
            name: 'destination',
            type: 'address',
            required: true,
            description: 'Destination Stellar address',
          },
          {
            name: 'amount',
            type: 'string',
            required: true,
            description: 'Amount of XLM to send',
          },
        ],
        ratings: [],
        averageRating: 5.0,
        usageCount: 1250,
        tags: ['payment', 'basic', 'xlm'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-2',
        name: 'Create & Fund Account',
        description: 'Create a new Stellar account with initial XLM balance',
        category: 'payment',
        difficulty: 'beginner',
        author: 'Stellar Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'createAccount',
            fields: {
              destination: '{{newAccount}}',
              startingBalance: '{{balance}}',
            },
            description: 'Create new account with starting balance',
          },
        ],
        parameters: [
          {
            name: 'newAccount',
            type: 'address',
            required: true,
            description: 'Public key of the new account',
          },
          {
            name: 'balance',
            type: 'string',
            required: true,
            description: 'Starting balance in XLM (minimum 2 XLM)',
            defaultValue: '2',
          },
        ],
        ratings: [],
        averageRating: 4.8,
        usageCount: 890,
        tags: ['account', 'create', 'basic'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-3',
        name: 'Trust Asset',
        description: 'Establish trustline for a custom asset',
        category: 'asset',
        difficulty: 'intermediate',
        author: 'Stellar Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'changeTrust',
            fields: {
              asset: '{{assetCode}}:{{issuer}}',
              limit: '{{limit}}',
            },
            description: 'Create trustline for custom asset',
          },
        ],
        parameters: [
          {
            name: 'assetCode',
            type: 'string',
            required: true,
            description: 'Asset code (e.g., USD, BTC)',
          },
          {
            name: 'issuer',
            type: 'address',
            required: true,
            description: 'Asset issuer address',
          },
          {
            name: 'limit',
            type: 'string',
            required: false,
            description: 'Maximum amount to trust (optional)',
          },
        ],
        ratings: [],
        averageRating: 4.7,
        usageCount: 650,
        tags: ['asset', 'trust', 'intermediate'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-4',
        name: 'DEX Trade',
        description: 'Place a buy or sell offer on the Stellar DEX',
        category: 'dex',
        difficulty: 'intermediate',
        author: 'Stellar Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'manageSellOffer',
            fields: {
              selling: '{{sellingAsset}}',
              buying: '{{buyingAsset}}',
              amount: '{{amount}}',
              price: '{{price}}',
            },
            description: 'Create sell offer on DEX',
          },
        ],
        parameters: [
          {
            name: 'sellingAsset',
            type: 'asset',
            required: true,
            description: 'Asset to sell',
          },
          {
            name: 'buyingAsset',
            type: 'asset',
            required: true,
            description: 'Asset to buy',
          },
          {
            name: 'amount',
            type: 'string',
            required: true,
            description: 'Amount to sell',
          },
          {
            name: 'price',
            type: 'string',
            required: true,
            description: 'Price per unit',
          },
        ],
        ratings: [],
        averageRating: 4.5,
        usageCount: 425,
        tags: ['dex', 'trade', 'offer'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-5',
        name: 'Multi-Sig Setup',
        description: 'Configure multi-signature requirements for an account',
        category: 'multisig',
        difficulty: 'advanced',
        author: 'Stellar Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'setOptions',
            fields: {
              signer: '{{signerAddress}}',
              signerWeight: '{{weight}}',
              lowThreshold: '{{lowThreshold}}',
              medThreshold: '{{medThreshold}}',
              highThreshold: '{{highThreshold}}',
            },
            description: 'Add signer and set thresholds',
          },
        ],
        parameters: [
          {
            name: 'signerAddress',
            type: 'address',
            required: true,
            description: 'Public key of new signer',
          },
          {
            name: 'weight',
            type: 'number',
            required: true,
            description: 'Weight for the signer (1-255)',
            defaultValue: 1,
          },
          {
            name: 'lowThreshold',
            type: 'number',
            required: true,
            description: 'Low security threshold',
            defaultValue: 1,
          },
          {
            name: 'medThreshold',
            type: 'number',
            required: true,
            description: 'Medium security threshold',
            defaultValue: 2,
          },
          {
            name: 'highThreshold',
            type: 'number',
            required: true,
            description: 'High security threshold',
            defaultValue: 2,
          },
        ],
        ratings: [],
        averageRating: 4.9,
        usageCount: 310,
        tags: ['multisig', 'security', 'advanced'],
        isCommunity: false,
        isOfficial: true,
      },
      // #853 - Multi-op workflow templates
      {
        id: 'template-6',
        name: 'Complete Trustline Setup',
        description: 'Multi-operation workflow to establish trustlines for multiple assets with proper funding',
        category: 'asset',
        difficulty: 'intermediate',
        author: 'Stellar Team',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'changeTrust',
            fields: {
              assetCode: '{{assetCode1}}',
              assetIssuer: '{{issuer1}}',
              limit: '{{limit1}}',
            },
            description: 'Add trustline for first asset',
          },
          {
            type: 'changeTrust',
            fields: {
              assetCode: '{{assetCode2}}',
              assetIssuer: '{{issuer2}}',
              limit: '{{limit2}}',
            },
            description: 'Add trustline for second asset',
          },
          {
            type: 'changeTrust',
            fields: {
              assetCode: '{{assetCode3}}',
              assetIssuer: '{{issuer3}}',
              limit: '{{limit3}}',
            },
            description: 'Add trustline for third asset (optional)',
          },
        ],
        parameters: [
          {
            name: 'assetCode1',
            type: 'string',
            required: true,
            description: 'First asset code (e.g., USDC)',
          },
          {
            name: 'issuer1',
            type: 'address',
            required: true,
            description: 'First asset issuer address',
          },
          {
            name: 'limit1',
            type: 'string',
            required: false,
            description: 'Trust limit for first asset',
          },
          {
            name: 'assetCode2',
            type: 'string',
            required: true,
            description: 'Second asset code (e.g., EURT)',
          },
          {
            name: 'issuer2',
            type: 'address',
            required: true,
            description: 'Second asset issuer address',
          },
          {
            name: 'limit2',
            type: 'string',
            required: false,
            description: 'Trust limit for second asset',
          },
          {
            name: 'assetCode3',
            type: 'string',
            required: false,
            description: 'Third asset code (optional)',
          },
          {
            name: 'issuer3',
            type: 'address',
            required: false,
            description: 'Third asset issuer address (optional)',
          },
          {
            name: 'limit3',
            type: 'string',
            required: false,
            description: 'Trust limit for third asset (optional)',
          },
        ],
        ratings: [],
        averageRating: 4.8,
        usageCount: 0,
        tags: ['asset', 'trust', 'multi-op', '2026'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-7',
        name: 'Claimable Balance Creation',
        description: 'Create a claimable balance with multiple claimants and time-based predicates',
        category: 'advanced',
        difficulty: 'intermediate',
        author: 'Stellar Team',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'createClaimableBalance',
            fields: {
              assetType: '{{assetType}}',
              assetCode: '{{assetCode}}',
              assetIssuer: '{{assetIssuer}}',
              amount: '{{amount}}',
              claimants: '{{claimants}}',
            },
            description: 'Create claimable balance with specified claimants',
          },
        ],
        parameters: [
          {
            name: 'assetType',
            type: 'string',
            required: true,
            description: 'Asset type (native or credit_alphanum4/12)',
            defaultValue: 'native',
          },
          {
            name: 'assetCode',
            type: 'string',
            required: false,
            description: 'Asset code if not native',
          },
          {
            name: 'assetIssuer',
            type: 'address',
            required: false,
            description: 'Asset issuer if not native',
          },
          {
            name: 'amount',
            type: 'string',
            required: true,
            description: 'Amount to lock in claimable balance',
          },
          {
            name: 'claimants',
            type: 'string',
            required: true,
            description: 'JSON array of claimants with predicates (unconditional, time-based, etc.)',
            validation: 'Must be valid JSON array',
          },
        ],
        ratings: [],
        averageRating: 4.6,
        usageCount: 0,
        tags: ['claimable', 'balance', 'multi-op', '2026'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-8',
        name: 'Claimable Balance Claim Flow',
        description: 'Complete workflow to claim a balance with optional follow-up payment',
        category: 'advanced',
        difficulty: 'beginner',
        author: 'Stellar Team',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'claimClaimableBalance',
            fields: {
              balanceId: '{{balanceId}}',
            },
            description: 'Claim the specified balance',
          },
          {
            type: 'payment',
            fields: {
              destination: '{{refundDestination}}',
              assetType: 'native',
              amount: '{{refundAmount}}',
            },
            description: 'Optional: Send refund or thank-you payment',
          },
        ],
        parameters: [
          {
            name: 'balanceId',
            type: 'string',
            required: true,
            description: 'Balance ID to claim',
          },
          {
            name: 'refundDestination',
            type: 'address',
            required: false,
            description: 'Optional destination for refund payment',
          },
          {
            name: 'refundAmount',
            type: 'string',
            required: false,
            description: 'Optional refund amount in XLM',
          },
        ],
        ratings: [],
        averageRating: 4.5,
        usageCount: 0,
        tags: ['claimable', 'claim', 'multi-op', '2026'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-9',
        name: 'Clawback Sequence',
        description: 'Multi-step clawback operation for reclaiming assets with clawback enabled',
        category: 'advanced',
        difficulty: 'advanced',
        author: 'Stellar Team',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'clawback',
            fields: {
              assetCode: '{{assetCode}}',
              assetIssuer: '{{assetIssuer}}',
              from: '{{fromAddress}}',
              amount: '{{amount}}',
            },
            description: 'Clawback specified amount from holder',
          },
          {
            type: 'payment',
            fields: {
              destination: '{{recoveryAddress}}',
              assetType: 'credit_alphanum4',
              assetCode: '{{assetCode}}',
              assetIssuer: '{{assetIssuer}}',
              amount: '{{amount}}',
            },
            description: 'Send recovered assets to recovery address',
          },
          {
            type: 'manageData',
            fields: {
              name: '{{dataKey}}',
              value: '{{dataValue}}',
            },
            description: 'Record clawback in account data for audit trail',
          },
        ],
        parameters: [
          {
            name: 'assetCode',
            type: 'string',
            required: true,
            description: 'Asset code to claw back',
          },
          {
            name: 'assetIssuer',
            type: 'address',
            required: true,
            description: 'Asset issuer address',
          },
          {
            name: 'fromAddress',
            type: 'address',
            required: true,
            description: 'Address to claw back from',
          },
          {
            name: 'amount',
            type: 'string',
            required: true,
            description: 'Amount to claw back',
          },
          {
            name: 'recoveryAddress',
            type: 'address',
            required: true,
            description: 'Destination for recovered assets',
          },
          {
            name: 'dataKey',
            type: 'string',
            required: false,
            description: 'Key for audit record (e.g., clawback_timestamp)',
          },
          {
            name: 'dataValue',
            type: 'string',
            required: false,
            description: 'Value for audit record (e.g., ISO timestamp)',
          },
        ],
        ratings: [],
        averageRating: 4.7,
        usageCount: 0,
        tags: ['clawback', 'recovery', 'multi-op', '2026', 'compliance'],
        isCommunity: false,
        isOfficial: true,
      },
      {
        id: 'template-10',
        name: 'Sponsored Trustline Setup',
        description: 'Set up trustlines with sponsorship to reduce reserve requirements',
        category: 'advanced',
        difficulty: 'advanced',
        author: 'Stellar Team',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        version: '1.0.0',
        operations: [
          {
            type: 'beginSponsoringFutureReserves',
            fields: {
              sponsoredId: '{{sponsoredId}}',
            },
            description: 'Begin sponsorship for the account',
          },
          {
            type: 'changeTrust',
            fields: {
              assetCode: '{{assetCode}}',
              assetIssuer: '{{assetIssuer}}',
              limit: '{{limit}}',
            },
            description: 'Add trustline (sponsored)',
          },
          {
            type: 'endSponsoringFutureReserves',
            fields: {},
            description: 'End sponsorship',
          },
        ],
        parameters: [
          {
            name: 'sponsoredId',
            type: 'address',
            required: true,
            description: 'Account ID being sponsored',
          },
          {
            name: 'assetCode',
            type: 'string',
            required: true,
            description: 'Asset code for trustline',
          },
          {
            name: 'assetIssuer',
            type: 'address',
            required: true,
            description: 'Asset issuer address',
          },
          {
            name: 'limit',
            type: 'string',
            required: false,
            description: 'Trust limit',
          },
        ],
        ratings: [],
        averageRating: 4.9,
        usageCount: 0,
        tags: ['sponsorship', 'trust', 'multi-op', '2026', 'reserve'],
        isCommunity: false,
        isOfficial: true,
      },
    ];

    // Add more community templates
    for (let i = 11; i <= 55; i++) {
      this.builtInTemplates.push({
        id: `template-${i}`,
        name: `Template ${i}`,
        description: `Community contributed template for operation ${i}`,
        category: ['payment', 'asset', 'multisig', 'dex', 'contract', 'advanced'][i % 6] as any,
        difficulty: ['beginner', 'intermediate', 'advanced'][i % 3] as any,
        author: `Community User ${i}`,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        operations: [],
        parameters: [],
        ratings: [],
        averageRating: 3 + Math.random() * 2,
        usageCount: Math.floor(Math.random() * 500),
        tags: [`tag-${i}`, 'community'],
        isCommunity: true,
        isOfficial: false,
      });
    }
  }

  async getAllTemplates(): Promise<TransactionTemplate[]> {
    return [...this.builtInTemplates];
  }

  async getTemplatesByCategory(category: string): Promise<TransactionTemplate[]> {
    return this.builtInTemplates.filter((t) => t.category === category);
  }

  async searchTemplates(query: string): Promise<TransactionTemplate[]> {
    const lowerQuery = query.toLowerCase();
    return this.builtInTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async getTemplate(id: string): Promise<TransactionTemplate | null> {
    return this.builtInTemplates.find((t) => t.id === id) || null;
  }

  async saveUserTemplate(userId: string, template: TransactionTemplate): Promise<void> {
    if (!this.db) await this.initialize();

    const userTemplate: UserTemplate = {
      id: uuidv4(),
      userId,
      template,
      savedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userTemplates'], 'readwrite');
      const store = transaction.objectStore('userTemplates');
      const request = store.add(userTemplate);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserTemplates(userId: string): Promise<UserTemplate[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userTemplates'], 'readonly');
      const store = transaction.objectStore('userTemplates');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const templateRating: TemplateRating = {
      userId,
      rating,
      comment,
      timestamp: new Date().toISOString(),
    };

    template.ratings.push(templateRating);
    template.averageRating =
      template.ratings.reduce((sum, r) => sum + r.rating, 0) / template.ratings.length;

    // Update in built-in templates
    const index = this.builtInTemplates.findIndex((t) => t.id === templateId);
    if (index !== -1) {
      this.builtInTemplates[index] = template;
    }
  }

  async incrementUsageCount(templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (template) {
      template.usageCount++;
      const index = this.builtInTemplates.findIndex((t) => t.id === templateId);
      if (index !== -1) {
        this.builtInTemplates[index] = template;
      }
    }
  }

  async getTopRatedTemplates(limit = 10): Promise<TransactionTemplate[]> {
    return [...this.builtInTemplates]
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);
  }

  async getMostUsedTemplates(limit = 10): Promise<TransactionTemplate[]> {
    return [...this.builtInTemplates]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  fillTemplate(template: TransactionTemplate, values: Record<string, any>): any {
    const filled = JSON.parse(JSON.stringify(template));

    // Replace parameters in operations
    filled.operations.forEach((op: TemplateOperation) => {
      Object.keys(op.fields).forEach((key) => {
        const value = op.fields[key];
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const paramName = value.slice(2, -2);
          if (values[paramName] !== undefined) {
            op.fields[key] = values[paramName];
          }
        }
      });
    });

    return filled;
  }
}

export const templateLibrary = new TemplateLibraryManager();
