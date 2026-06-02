import { Transaction, Networks } from '@stellar/stellar-sdk';
import { encryptWithKey, decryptWithKey, generateKey } from './encryption.js';
import auditTrail from './auditTrail.js';

/**
 * Stellar Anchor Integration System
 * Integrates with major Stellar anchors for deposit/withdrawal operations
 */

class AnchorService {
  constructor() {
    this.anchors = new Map();
    this.authSessionKey = null;
    this.authSessionStorePrefix = 'sep10-anchor-session:';
    this.supportedAnchors = [
      {
        id: 'coinbase',
        name: 'Coinbase',
        icon: '🪙',
        website: 'https://coinbase.com',
        homeDomain: 'coinbase.com',
        authEndpoint: 'https://coinbase.com/auth',
        supportedAssets: ['XLM', 'USDC', 'BTC', 'ETH', 'USDT'],
        depositMethods: ['bank_transfer', 'card', 'crypto'],
        withdrawalMethods: ['bank_transfer', 'crypto'],
        fees: { deposit: '1.49%', withdrawal: '1.49%', minimum: '$0.99' },
        processingTime: { deposit: '1-3 business days', withdrawal: '1-3 business days' },
        status: 'active'
      },
      {
        id: 'kraken',
        name: 'Kraken',
        icon: '🐙',
        website: 'https://kraken.com',
        homeDomain: 'kraken.com',
        authEndpoint: 'https://kraken.com/auth',
        supportedAssets: ['XLM', 'USDC', 'BTC', 'ETH', 'USDT', 'EUR', 'USD'],
        depositMethods: ['bank_transfer', 'wire', 'crypto'],
        withdrawalMethods: ['bank_transfer', 'wire', 'crypto'],
        fees: { deposit: 'Free', withdrawal: '0.0005 BTC', minimum: '$1' },
        processingTime: { deposit: '1-5 business days', withdrawal: '1-5 business days' },
        status: 'active'
      },
      {
        id: 'binance',
        name: 'Binance',
        icon: '🔶',
        website: 'https://binance.com',
        homeDomain: 'binance.com',
        authEndpoint: 'https://binance.com/auth',
        supportedAssets: ['XLM', 'USDC', 'BTC', 'ETH', 'USDT', 'BUSD'],
        depositMethods: ['crypto', 'card', 'p2p'],
        withdrawalMethods: ['crypto', 'p2p'],
        fees: { deposit: 'Free', withdrawal: '0.0005 XLM', minimum: '$1' },
        processingTime: { deposit: 'Instant', withdrawal: 'Instant' },
        status: 'active'
      },
      {
        id: 'bitstamp',
        name: 'Bitstamp',
        icon: '📊',
        website: 'https://bitstamp.net',
        homeDomain: 'bitstamp.net',
        authEndpoint: 'https://bitstamp.net/auth',
        supportedAssets: ['XLM', 'USDC', 'BTC', 'ETH', 'EUR', 'USD'],
        depositMethods: ['bank_transfer', 'wire', 'crypto', 'card'],
        withdrawalMethods: ['bank_transfer', 'wire', 'crypto'],
        fees: { deposit: 'Free', withdrawal: '0.5%', minimum: '$10' },
        processingTime: { deposit: '1-4 business days', withdrawal: '1-4 business days' },
        status: 'active'
      },
      {
        id: 'gatehub',
        name: 'GateHub',
        icon: '🚪',
        website: 'https://gatehub.net',
        homeDomain: 'gatehub.net',
        authEndpoint: 'https://gatehub.net/auth',
        supportedAssets: ['XLM', 'USDC', 'BTC', 'ETH', 'EUR', 'USD'],
        depositMethods: ['bank_transfer', 'wire', 'crypto'],
        withdrawalMethods: ['bank_transfer', 'wire', 'crypto'],
        fees: { deposit: '1%', withdrawal: '1%', minimum: '$2.5' },
        processingTime: { deposit: '1-3 business days', withdrawal: '1-3 business days' },
        status: 'active'
      }
    ];
    
    this.initializeAnchors();
  }

  initializeAnchors() {
    this.supportedAnchors.forEach(anchor => {
      this.anchors.set(anchor.id, anchor);
    });
  }

  /**
   * Get all available anchors
   * @param {object} filters - Optional filters (asset, method, status)
   * @returns {array} Filtered list of anchors
   */
  getAvailableAnchors(filters = {}) {
    let anchors = Array.from(this.anchors.values());

    if (filters.asset) {
      anchors = anchors.filter(anchor => 
        anchor.supportedAssets.includes(filters.asset)
      );
    }

    if (filters.depositMethod) {
      anchors = anchors.filter(anchor => 
        anchor.depositMethods.includes(filters.depositMethod)
      );
    }

    if (filters.withdrawalMethod) {
      anchors = anchors.filter(anchor => 
        anchor.withdrawalMethods.includes(filters.withdrawalMethod)
      );
    }

    if (filters.status) {
      anchors = anchors.filter(anchor => 
        anchor.status === filters.status
      );
    }

    return anchors.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get anchor by ID
   * @param {string} anchorId - Anchor identifier
   * @returns {object} Anchor details
   */
  getAnchor(anchorId) {
    return this.anchors.get(anchorId);
  }

  /**
   * Get supported assets across all anchors
   * @returns {array} List of supported assets
   */
  getSupportedAssets() {
    const assetSet = new Set();
    
    this.anchors.forEach(anchor => {
      anchor.supportedAssets.forEach(asset => {
        assetSet.add(asset);
      });
    });

    return Array.from(assetSet).sort();
  }

  /**
   * Calculate fees for a transaction
   * @param {string} anchorId - Anchor identifier
   * @param {string} type - 'deposit' or 'withdrawal'
   * @param {number} amount - Amount in USD
   * @returns {object} Fee calculation
   */
  calculateFees(anchorId, type, amount) {
    const anchor = this.getAnchor(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    const feeStructure = anchor.fees[type];
    let fee = 0;

    if (feeStructure.includes('%')) {
      const percentage = parseFloat(feeStructure) / 100;
      fee = amount * percentage;
    } else if (feeStructure === 'Free') {
      fee = 0;
    } else {
      // Fixed fee (e.g., '0.0005 BTC')
      fee = parseFloat(feeStructure);
    }

    // Apply minimum fee
    const minFee = parseFloat(anchor.fees.minimum.replace(/[^0-9.]/g, ''));
    fee = Math.max(fee, minFee);

    return {
      anchorId,
      type,
      amount,
      fee,
      feePercentage: feeStructure,
      minFee: anchor.fees.minimum,
      totalAmount: type === 'deposit' ? amount + fee : amount - fee,
      effectiveRate: (fee / amount) * 100
    };
  }

  /**
   * Get best rates for a specific asset and amount
   * @param {string} asset - Asset code
   * @param {number} amount - Amount in USD
   * @param {string} type - 'deposit' or 'withdrawal'
   * @returns {array} Sorted list of best rates
   */
  getBestRates(asset, amount, type) {
    const anchors = this.getAvailableAnchors({ asset, status: 'active' });
    const rates = [];

    anchors.forEach(anchor => {
      try {
        const feeCalculation = this.calculateFees(anchor.id, type, amount);
        rates.push({
          ...anchor,
          feeCalculation,
          score: this.calculateAnchorScore(anchor, feeCalculation)
        });
      } catch {
        // Skip anchors that can't process this request
      }
    });

    return rates.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate anchor score for ranking
   * @param {object} anchor - Anchor object
   * @param {object} feeCalculation - Fee calculation result
   * @returns {number} Anchor score
   */
  calculateAnchorScore(anchor, feeCalculation) {
    let score = 100;

    // Lower fees get higher scores
    score -= feeCalculation.effectiveRate * 10;

    // Popular anchors get bonus
    const popularityBonus = {
      'coinbase': 20,
      'kraken': 15,
      'binance': 18,
      'bitstamp': 12,
      'gatehub': 10
    };
    score += popularityBonus[anchor.id] || 0;

    // More deposit/withdrawal methods get bonus
    score += (anchor.depositMethods.length + anchor.withdrawalMethods.length) * 2;

    // Faster processing gets bonus
    if (anchor.processingTime.deposit.includes('Instant')) score += 10;
    if (anchor.processingTime.withdrawal.includes('Instant')) score += 10;

    return Math.max(0, score);
  }

  /**
   * Generate deposit instructions
   * @param {string} anchorId - Anchor identifier
   * @param {string} asset - Asset to deposit
   * @param {number} amount - Amount to deposit
   * @param {string} method - Deposit method
   * @returns {object} Deposit instructions
   */
  generateDepositInstructions(anchorId, asset, amount, method) {
    const anchor = this.getAnchor(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    if (!anchor.supportedAssets.includes(asset)) {
      throw new Error(`Anchor ${anchorId} does not support ${asset}`);
    }

    if (!anchor.depositMethods.includes(method)) {
      throw new Error(`Anchor ${anchorId} does not support ${method} deposits`);
    }

    const feeCalculation = this.calculateFees(anchorId, 'deposit', amount);

    return {
      anchorId: anchor.id,
      anchorName: anchor.name,
      asset,
      amount,
      method,
      fees: feeCalculation,
      instructions: this.generateMethodSpecificInstructions(anchor, 'deposit', asset, method),
      processingTime: anchor.processingTime.deposit,
      supportUrl: anchor.website,
      warnings: this.generateWarnings(anchor, 'deposit', method)
    };
  }

  /**
   * Generate withdrawal instructions
   * @param {string} anchorId - Anchor identifier
   * @param {string} asset - Asset to withdraw
   * @param {number} amount - Amount to withdraw
   * @param {string} method - Withdrawal method
   * @returns {object} Withdrawal instructions
   */
  generateWithdrawalInstructions(anchorId, asset, amount, method) {
    const anchor = this.getAnchor(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    if (!anchor.supportedAssets.includes(asset)) {
      throw new Error(`Anchor ${anchorId} does not support ${asset}`);
    }

    if (!anchor.withdrawalMethods.includes(method)) {
      throw new Error(`Anchor ${anchorId} does not support ${method} withdrawals`);
    }

    const feeCalculation = this.calculateFees(anchorId, 'withdrawal', amount);

    return {
      anchorId: anchor.id,
      anchorName: anchor.name,
      asset,
      amount,
      method,
      fees: feeCalculation,
      instructions: this.generateMethodSpecificInstructions(anchor, 'withdrawal', asset, method),
      processingTime: anchor.processingTime.withdrawal,
      supportUrl: anchor.website,
      warnings: this.generateWarnings(anchor, 'withdrawal', method)
    };
  }

  /**
   * Generate method-specific instructions
   * @param {object} anchor - Anchor object
   * @param {string} type - 'deposit' or 'withdrawal'
   * @param {string} asset - Asset code
   * @param {string} method - Payment method
   * @returns {array} Instructions array
   */
  generateMethodSpecificInstructions(anchor, type, asset, method) {
    const baseInstructions = {
      bank_transfer: [
        `Log in to your ${anchor.name} account`,
        `Navigate to the ${type} section`,
        `Select ${asset} as the asset`,
        `Choose bank transfer as the method`,
        `Follow the on-screen instructions to complete the ${type}`
      ],
      wire: [
        `Contact ${anchor.name} support for wire transfer details`,
        `Provide your bank's wire transfer information`,
        `Include reference code: ${this.generateReferenceCode()}`,
        `Wait for processing confirmation`
      ],
      crypto: [
        `Go to ${asset} ${type} page on ${anchor.name}`,
        `Copy the provided wallet address`,
        `Send ${asset} to the address`,
        `Wait for network confirmation`
      ],
      card: [
        `Navigate to ${type} section on ${anchor.name}`,
        `Select ${asset}`,
        `Choose card payment`,
        `Enter card details and confirm`
      ],
      p2p: [
        `Access P2P marketplace on ${anchor.name}`,
        `Find ${asset} ${type} offers`,
        `Choose a reputable trader`,
        `Follow the escrow process`
      ]
    };

    return baseInstructions[method] || baseInstructions.crypto;
  }

  /**
   * Generate warnings for transactions
   * @param {object} anchor - Anchor object
   * @param {string} type - 'deposit' or 'withdrawal'
   * @param {string} method - Payment method
   * @returns {array} Warnings array
   */
  generateWarnings(anchor, type, method) {
    const warnings = [];

    if (method === 'bank_transfer' || method === 'wire') {
      warnings.push('Bank transfers may take 1-5 business days to process');
      warnings.push('Your bank may charge additional fees');
    }

    if (method === 'crypto') {
      warnings.push('Network fees apply in addition to anchor fees');
      warnings.push('Blockchain confirmation times vary by network congestion');
    }

    if (method === 'card') {
      warnings.push('Card payments may have higher fees');
      warnings.push('Daily limits may apply');
    }

    if (type === 'withdrawal') {
      warnings.push('Always verify withdrawal addresses before confirming');
      warnings.push('Some withdrawals require additional verification');
    }

    warnings.push(`Review ${anchor.name}'s terms of service before proceeding`);
    warnings.push('Rates and fees are subject to change');

    return warnings;
  }

  /**
   * Generate reference code for transactions
   * @returns {string} Reference code
   */
  generateReferenceCode() {
    return `STELLAR-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }

  /**
   * Parse a minimal subset of stellar.toml to extract values used for SEP-10.
   * @param {string} tomlText
   * @returns {object}
   */
  parseToml(tomlText) {
    const result = {};
    tomlText.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*['"](.+?)['"]$/);
      if (match) {
        result[match[1]] = match[2];
      }
    });
    return result;
  }

  async fetchStellarToml(homeDomain) {
    if (!homeDomain) {
      throw new Error('Home domain is required to resolve stellar.toml');
    }

    const url = `https://${homeDomain}/.well-known/stellar.toml`;
    const start = performance.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' }
    });
    const duration = Math.round(performance.now() - start);

    auditTrail.logAPICall(url, 'GET', {}, { status: response.status, responseTime: duration });

    if (!response.ok) {
      throw new Error(`Unable to fetch stellar.toml for ${homeDomain}`);
    }

    const text = await response.text();
    return this.parseToml(text);
  }

  async getWebAuthEndpoint(anchor) {
    if (!anchor) {
      throw new Error('Anchor not found');
    }

    if (anchor.authEndpoint) {
      return anchor.authEndpoint;
    }

    if (anchor.homeDomain) {
      const toml = await this.fetchStellarToml(anchor.homeDomain);
      if (!toml.WEB_AUTH_ENDPOINT) {
        throw new Error(`WEB_AUTH_ENDPOINT not defined in stellar.toml for ${anchor.homeDomain}`);
      }
      return toml.WEB_AUTH_ENDPOINT;
    }

    throw new Error(`Anchor ${anchor.id} does not support SEP-10 authentication`);
  }

  hasWebAuth(anchorId) {
    const anchor = this.getAnchor(anchorId);
    return Boolean(anchor && (anchor.authEndpoint || anchor.homeDomain));
  }

  async requestChallengeTransaction(anchorId, accountPublicKey, network = 'TESTNET') {
    const anchor = this.getAnchor(anchorId);
    const endpoint = await this.getWebAuthEndpoint(anchor);
    const networkPassphrase = network === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET;

    const url = new URL(endpoint);
    url.searchParams.set('account', accountPublicKey);
    url.searchParams.set('network_passphrase', networkPassphrase);

    const start = performance.now();
    const response = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
    const duration = Math.round(performance.now() - start);

    const responseData = await response.clone().json().catch(() => ({}));
    auditTrail.logAPICall(url.toString(), 'GET', { account: accountPublicKey }, { status: response.status, responseTime: duration, responseData });

    if (!response.ok) {
      throw new Error(`Failed to request SEP-10 challenge: ${response.status}`);
    }

    const data = await response.json();
    if (!data.transaction) {
      throw new Error('Invalid SEP-10 challenge response from anchor');
    }

    try {
      new Transaction(data.transaction, networkPassphrase);
    } catch (error) {
      throw new Error(`Invalid SEP-10 challenge transaction: ${error.message}`);
    }

    return data;
  }

  async submitChallengeTransaction(anchorId, signedTransactionXdr) {
    const anchor = this.getAnchor(anchorId);
    const endpoint = await this.getWebAuthEndpoint(anchor);
    const start = performance.now();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: signedTransactionXdr })
    });

    const duration = Math.round(performance.now() - start);
    const responseBody = await response.clone().json().catch(() => ({}));

    auditTrail.logAPICall(endpoint, 'POST', { transaction: '[REDACTED]' }, { status: response.status, responseTime: duration, response: responseBody });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SEP-10 authentication failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.token) {
      throw new Error('Anchor auth response did not include a JWT token');
    }

    return data.token;
  }

  async getOrCreateSessionKey() {
    if (this.authSessionKey) {
      return this.authSessionKey;
    }

    this.authSessionKey = await generateKey();
    return this.authSessionKey;
  }

  async saveAnchorAuthSession(anchorId, token, accountPublicKey, network, homeDomain) {
    try {
      const rawKey = await this.getOrCreateSessionKey();
      const encrypted = await encryptWithKey(token, rawKey);
      const sessionPayload = {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        accountPublicKey,
        network,
        homeDomain,
        createdAt: new Date().toISOString()
      };
      sessionStorage.setItem(this.authSessionStorePrefix + anchorId, JSON.stringify(sessionPayload));
      auditTrail.logSecurityEvent('Stored SEP-10 auth session', { anchorId, homeDomain });
      return true;
    } catch (error) {
      auditTrail.logError(error, { operation: 'saveAnchorAuthSession', anchorId });
      throw error;
    }
  }

  async getAnchorAuthSession(anchorId) {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    const sessionString = sessionStorage.getItem(this.authSessionStorePrefix + anchorId);
    if (!sessionString) {
      return null;
    }

    try {
      const sessionPayload = JSON.parse(sessionString);
      const rawKey = await this.getOrCreateSessionKey();
      const token = await decryptWithKey(sessionPayload.ciphertext, rawKey, sessionPayload.iv);
      return {
        token,
        accountPublicKey: sessionPayload.accountPublicKey,
        network: sessionPayload.network,
        homeDomain: sessionPayload.homeDomain,
        createdAt: sessionPayload.createdAt
      };
    } catch (error) {
      sessionStorage.removeItem(this.authSessionStorePrefix + anchorId);
      auditTrail.logSecurityEvent('Failed to decrypt SEP-10 auth session', { anchorId, error: error.message });
      return null;
    }
  }

  async clearAnchorAuthSession(anchorId) {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }

    sessionStorage.removeItem(this.authSessionStorePrefix + anchorId);
    auditTrail.logUserAction('Cleared SEP-10 auth session', { anchorId });
    return true;
  }

  parseJwt(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch (error) {
      auditTrail.logError(error, { operation: 'parseJwt' });
      return null;
    }
  }

  /**
   * Get real-time rates (mock implementation)
   * @param {string} anchorId - Anchor identifier
   * @returns {object} Real-time rates
   */
  async getRealTimeRates(anchorId) {
    // In a real implementation, this would call the anchor's API
    const anchor = this.getAnchor(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    // Mock real-time rates with small variations
    const mockRates = {};
    anchor.supportedAssets.forEach(asset => {
      const baseRate = asset === 'XLM' ? 0.12 : asset === 'USDC' ? 1 : 
                     asset === 'BTC' ? 43000 : asset === 'ETH' ? 2200 : 1;
      const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
      mockRates[asset] = baseRate * (1 + variation);
    });

    return {
      anchorId,
      anchorName: anchor.name,
      timestamp: new Date().toISOString(),
      rates: mockRates,
      status: 'active'
    };
  }

  /**
   * Get anchor status and health
   * @param {string} anchorId - Anchor identifier
   * @returns {object} Anchor status
   */
  async getAnchorStatus(anchorId) {
    const anchor = this.getAnchor(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    // Mock status check - in reality this would ping the anchor's API
    const isHealthy = Math.random() > 0.05; // 95% uptime simulation

    return {
      anchorId,
      anchorName: anchor.name,
      status: isHealthy ? 'active' : 'maintenance',
      lastChecked: new Date().toISOString(),
      responseTime: Math.floor(Math.random() * 500) + 100, // 100-600ms
      uptime: isHealthy ? '99.9%' : 'Under maintenance',
      issues: isHealthy ? [] : ['Scheduled maintenance in progress']
    };
  }

  /**
   * Compare multiple anchors for a specific transaction
   * @param {string} asset - Asset code
   * @param {number} amount - Amount in USD
   * @param {string} type - 'deposit' or 'withdrawal'
   * @returns {object} Comparison results
   */
  compareAnchors(asset, amount, type) {
    const rates = this.getBestRates(asset, amount, type);
    
    if (rates.length === 0) {
      throw new Error(`No anchors available for ${asset} ${type}`);
    }

    const best = rates[0];
    const worst = rates[rates.length - 1];
    const savings = worst.feeCalculation.fee - best.feeCalculation.fee;

    return {
      asset,
      amount,
      type,
      totalAnchors: rates.length,
      best: {
        anchor: best.name,
        fee: best.feeCalculation.fee,
        totalCost: best.feeCalculation.totalAmount,
        effectiveRate: best.feeCalculation.effectiveRate
      },
      worst: {
        anchor: worst.name,
        fee: worst.feeCalculation.fee,
        totalCost: worst.feeCalculation.totalAmount,
        effectiveRate: worst.feeCalculation.effectiveRate
      },
      savings: {
        amount: savings,
        percentage: (savings / worst.feeCalculation.fee) * 100
      },
      allOptions: rates.map(r => ({
        name: r.name,
        fee: r.feeCalculation.fee,
        totalCost: r.feeCalculation.totalAmount,
        effectiveRate: r.feeCalculation.effectiveRate,
        processingTime: r.processingTime[type],
        score: r.score
      })).sort((a, b) => a.fee - b.fee)
    };
  }
}

// Create singleton instance
const anchorService = new AnchorService();

export default anchorService;
export { AnchorService };
