/**
 * Tax Reporting System for Asset Management
 * Implements cost basis tracking, tax report generation, and tax loss harvesting
 */

export interface TaxTransaction {
  id: string;
  assetCode: string;
  assetIssuer?: string;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'staking_reward' | 'airdrop';
  amount: number;
  priceUsd: number;
  totalUsd: number;
  timestamp: number;
  feeUsd?: number;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
}

export interface CostBasis {
  assetCode: string;
  assetIssuer?: string;
  totalAmount: number;
  totalCost: number;
  averageCost: number;
  lots: Array<{
    amount: number;
    cost: number;
    purchaseDate: number;
    txId: string;
  }>;
}

export interface TaxLot {
  id: string;
  assetCode: string;
  amount: number;
  costBasis: number;
  purchaseDate: number;
  purchasePrice: number;
  isClosed: boolean;
  closeDate?: number;
  closePrice?: number;
  realizedGain?: number;
  realizedLoss?: number;
}

export interface TaxReport {
  year: number;
  generatedAt: number;
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalNetGain: number;
  transactions: TaxTransaction[];
  costBasis: CostBasis[];
  closedLots: TaxLot[];
  openLots: TaxLot[];
}

export class TaxReportingManager {
  private transactions: TaxTransaction[] = [];
  private costBasis: Map<string, CostBasis> = new Map();
  private taxLots: Map<string, TaxLot> = new Map();

  constructor() {
    this.loadTransactions();
    this.loadCostBasis();
    this.loadTaxLots();
  }

  /**
   * Record a transaction
   */
  recordTransaction(transaction: Omit<TaxTransaction, 'id'>): TaxTransaction {
    const tx: TaxTransaction = {
      ...transaction,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.transactions.push(tx);
    this.updateCostBasis(tx);
    this.saveTransactions();
    return tx;
  }

  /**
   * Update cost basis after a transaction
   */
  private updateCostBasis(transaction: TaxTransaction): void {
    const key = this.getAssetKey(transaction.assetCode, transaction.assetIssuer);
    let basis = this.costBasis.get(key);

    if (!basis) {
      basis = {
        assetCode: transaction.assetCode,
        assetIssuer: transaction.assetIssuer,
        totalAmount: 0,
        totalCost: 0,
        averageCost: 0,
        lots: []
      };
      this.costBasis.set(key, basis);
    }

    switch (transaction.type) {
      case 'buy':
      case 'transfer_in':
      case 'staking_reward':
      case 'airdrop':
        // Add to cost basis
        basis.totalAmount += transaction.amount;
        basis.totalCost += transaction.totalUsd;
        basis.averageCost = basis.totalCost / basis.totalAmount;
        
        // Create new tax lot
        const lot: TaxLot = {
          id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          assetCode: transaction.assetCode,
          amount: transaction.amount,
          costBasis: transaction.totalUsd,
          purchaseDate: transaction.timestamp,
          purchasePrice: transaction.priceUsd,
          isClosed: false
        };
        this.taxLots.set(lot.id, lot);
        basis.lots.push({
          amount: transaction.amount,
          cost: transaction.totalUsd,
          purchaseDate: transaction.timestamp,
          txId: transaction.id
        });
        break;

      case 'sell':
      case 'transfer_out':
        // Remove from cost basis using FIFO
        this.removeFromCostBasis(basis, transaction.amount, transaction.priceUsd, transaction.timestamp);
        break;
    }

    this.saveCostBasis();
    this.saveTaxLots();
  }

  /**
   * Remove from cost basis using FIFO method
   */
  private removeFromCostBasis(
    basis: CostBasis,
    amount: number,
    sellPrice: number,
    sellDate: number
  ): void {
    let remaining = amount;

    // Close lots in FIFO order
    for (const lot of basis.lots) {
      if (remaining <= 0) break;

      const lotAmount = lot.amount;
      const lotCost = lot.cost;
      const lotPurchaseDate = lot.purchaseDate;

      if (lotAmount <= remaining) {
        // Close entire lot
        const realizedGain = (sellPrice * lotAmount) - lotCost;
        const isLongTerm = (sellDate - lotPurchaseDate) >= 365 * 24 * 60 * 60 * 1000;

        // Update tax lot
        const taxLot = this.taxLots.get(lot.txId);
        if (taxLot) {
          taxLot.isClosed = true;
          taxLot.closeDate = sellDate;
          taxLot.closePrice = sellPrice;
          taxLot.realizedGain = realizedGain > 0 ? realizedGain : undefined;
          taxLot.realizedLoss = realizedGain < 0 ? Math.abs(realizedGain) : undefined;
        }

        basis.totalAmount -= lotAmount;
        basis.totalCost -= lotCost;
        remaining -= lotAmount;
      } else {
        // Close partial lot
        const partialAmount = remaining;
        const partialCost = (lotCost / lotAmount) * partialAmount;
        const realizedGain = (sellPrice * partialAmount) - partialCost;

        // Update original lot
        lot.amount -= partialAmount;
        lot.cost -= partialCost;

        // Create new closed lot for the partial
        const newLotId = `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.taxLots.set(newLotId, {
          id: newLotId,
          assetCode: basis.assetCode,
          amount: partialAmount,
          costBasis: partialCost,
          purchaseDate: lotPurchaseDate,
          purchasePrice: lotCost / lotAmount,
          isClosed: true,
          closeDate: sellDate,
          closePrice: sellPrice,
          realizedGain: realizedGain > 0 ? realizedGain : undefined,
          realizedLoss: realizedGain < 0 ? Math.abs(realizedGain) : undefined
        });

        basis.totalAmount -= partialAmount;
        basis.totalCost -= partialCost;
        remaining = 0;
      }
    }

    if (basis.totalAmount > 0) {
      basis.averageCost = basis.totalCost / basis.totalAmount;
    } else {
      basis.averageCost = 0;
    }

    // Remove empty lots
    basis.lots = basis.lots.filter(lot => lot.amount > 0);
  }

  /**
   * Generate tax report for a specific year
   */
  generateTaxReport(year: number): TaxReport {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();

    const yearTransactions = this.transactions.filter(
      tx => tx.timestamp >= yearStart && tx.timestamp < yearEnd
    );

    const closedLots = Array.from(this.taxLots.values())
      .filter(lot => lot.isClosed && lot.closeDate && lot.closeDate >= yearStart && lot.closeDate < yearEnd);

    const openLots = Array.from(this.taxLots.values()).filter(lot => !lot.isClosed);

    let shortTermGains = 0;
    let longTermGains = 0;
    let shortTermLosses = 0;
    let longTermLosses = 0;

    closedLots.forEach(lot => {
      if (!lot.closeDate || !lot.purchaseDate) return;

      const holdingPeriod = lot.closeDate - lot.purchaseDate;
      const isLongTerm = holdingPeriod >= 365 * 24 * 60 * 60 * 1000;

      if (lot.realizedGain) {
        if (isLongTerm) {
          longTermGains += lot.realizedGain;
        } else {
          shortTermGains += lot.realizedGain;
        }
      }

      if (lot.realizedLoss) {
        if (isLongTerm) {
          longTermLosses += lot.realizedLoss;
        } else {
          shortTermLosses += lot.realizedLoss;
        }
      }
    });

    const netShortTerm = shortTermGains - shortTermLosses;
    const netLongTerm = longTermGains - longTermLosses;
    const totalNetGain = netShortTerm + netLongTerm;

    return {
      year,
      generatedAt: Date.now(),
      shortTermGains,
      longTermGains,
      shortTermLosses,
      longTermLosses,
      netShortTerm,
      netLongTerm,
      totalNetGain,
      transactions: yearTransactions,
      costBasis: Array.from(this.costBasis.values()),
      closedLots,
      openLots
    };
  }

  /**
   * Identify tax loss harvesting opportunities
   */
  identifyTaxLossHarvestingOpportunities(threshold: number = 100): Array<{
    assetCode: string;
    unrealizedLoss: number;
    currentAmount: number;
    averageCost: number;
    currentPrice: number;
    potentialTaxSavings: number;
  }> {
    const opportunities: Array<{
      assetCode: string;
      unrealizedLoss: number;
      currentAmount: number;
      averageCost: number;
      currentPrice: number;
      potentialTaxSavings: number;
    }> = [];

    for (const [key, basis] of this.costBasis.entries()) {
      if (basis.totalAmount === 0) continue;

      // Get current price (this would come from a price feed in a real implementation)
      const currentPrice = this.getCurrentPrice(basis.assetCode);
      if (!currentPrice) continue;

      const currentValue = currentPrice * basis.totalAmount;
      const unrealizedLoss = basis.totalCost - currentValue;

      if (unrealizedLoss > threshold) {
        // Assume 22% tax rate for long-term capital gains
        const potentialTaxSavings = unrealizedLoss * 0.22;

        opportunities.push({
          assetCode: basis.assetCode,
          unrealizedLoss,
          currentAmount: basis.totalAmount,
          averageCost: basis.averageCost,
          currentPrice,
          potentialTaxSavings
        });
      }
    }

    return opportunities.sort((a, b) => b.potentialTaxSavings - a.potentialTaxSavings);
  }

  /**
   * Get current price for an asset (placeholder)
   */
  private getCurrentPrice(assetCode: string): number | null {
    // In a real implementation, this would fetch from a price feed
    // For now, return null to indicate price is not available
    return null;
  }

  /**
   * Get cost basis for an asset
   */
  getCostBasis(assetCode: string, assetIssuer?: string): CostBasis | null {
    const key = this.getAssetKey(assetCode, assetIssuer);
    return this.costBasis.get(key) || null;
  }

  /**
   * Get all cost basis
   */
  getAllCostBasis(): CostBasis[] {
    return Array.from(this.costBasis.values());
  }

  /**
   * Get all transactions
   */
  getTransactions(assetCode?: string): TaxTransaction[] {
    if (assetCode) {
      return this.transactions.filter(tx => tx.assetCode === assetCode);
    }
    return [...this.transactions];
  }

  /**
   * Get tax lots
   */
  getTaxLots(assetCode?: string, includeClosed = true): TaxLot[] {
    let lots = Array.from(this.taxLots.values());

    if (!includeClosed) {
      lots = lots.filter(lot => !lot.isClosed);
    }

    if (assetCode) {
      lots = lots.filter(lot => lot.assetCode === assetCode);
    }

    return lots;
  }

  /**
   * Export tax report as CSV
   */
  exportTaxReportCSV(report: TaxReport): string {
    const headers = [
      'Date',
      'Type',
      'Asset',
      'Amount',
      'Price USD',
      'Total USD',
      'Fee USD',
      'Transaction Hash'
    ];

    const rows = report.transactions.map(tx => [
      new Date(tx.timestamp).toISOString(),
      tx.type,
      tx.assetCode,
      tx.amount.toString(),
      tx.priceUsd.toString(),
      tx.totalUsd.toString(),
      (tx.feeUsd || 0).toString(),
      tx.txHash || ''
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csv;
  }

  /**
   * Helper to get asset key
   */
  private getAssetKey(assetCode: string, assetIssuer?: string): string {
    return assetIssuer ? `${assetCode}:${assetIssuer}` : assetCode;
  }

  /**
   * Save transactions to localStorage
   */
  private saveTransactions(): void {
    try {
      localStorage.setItem('tax-transactions', JSON.stringify(this.transactions));
    } catch (error) {
      console.error('Failed to save transactions:', error);
    }
  }

  /**
   * Load transactions from localStorage
   */
  private loadTransactions(): void {
    try {
      const stored = localStorage.getItem('tax-transactions');
      if (stored) {
        this.transactions = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }

  /**
   * Save cost basis to localStorage
   */
  private saveCostBasis(): void {
    try {
      const data = Array.from(this.costBasis.entries());
      localStorage.setItem('tax-cost-basis', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save cost basis:', error);
    }
  }

  /**
   * Load cost basis from localStorage
   */
  private loadCostBasis(): void {
    try {
      const stored = localStorage.getItem('tax-cost-basis');
      if (stored) {
        const data = JSON.parse(stored) as Array<[string, CostBasis]>;
        this.costBasis = new Map(data);
      }
    } catch (error) {
      console.error('Failed to load cost basis:', error);
    }
  }

  /**
   * Save tax lots to localStorage
   */
  private saveTaxLots(): void {
    try {
      const data = Array.from(this.taxLots.entries());
      localStorage.setItem('tax-lots', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save tax lots:', error);
    }
  }

  /**
   * Load tax lots from localStorage
   */
  private loadTaxLots(): void {
    try {
      const stored = localStorage.getItem('tax-lots');
      if (stored) {
        const data = JSON.parse(stored) as Array<[string, TaxLot]>;
        this.taxLots = new Map(data);
      }
    } catch (error) {
      console.error('Failed to load tax lots:', error);
    }
  }

  /**
   * Clear all data
   */
  clearData(): void {
    this.transactions = [];
    this.costBasis.clear();
    this.taxLots.clear();
    localStorage.removeItem('tax-transactions');
    localStorage.removeItem('tax-cost-basis');
    localStorage.removeItem('tax-lots');
  }
}

export function createTaxReportingManager(): TaxReportingManager {
  return new TaxReportingManager();
}
