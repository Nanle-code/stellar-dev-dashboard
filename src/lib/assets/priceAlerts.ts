/**
 * Price Alerts System for Asset Management
 * Implements alert conditions, multiple channels, and alert history
 */

export interface AlertCondition {
  id: string;
  assetCode: string;
  assetIssuer?: string;
  type: 'above' | 'below' | 'percent_change' | 'volume_spike';
  threshold: number;
  timeWindow?: number; // for percent_change and volume_spike
  enabled: boolean;
}

export interface AlertChannel {
  type: 'in_app' | 'email' | 'push' | 'webhook';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PriceAlert {
  id: string;
  condition: AlertCondition;
  triggeredAt: number;
  price: number;
  previousPrice?: number;
  channels: AlertChannel[];
  acknowledged: boolean;
  metadata: Record<string, unknown>;
}

export class PriceAlertManager {
  private alerts: Map<string, AlertCondition> = new Map();
  private alertHistory: PriceAlert[] = [];
  private currentPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, Array<{ timestamp: number; price: number }>> = new Map();
  private alertCallbacks: Set<(alert: PriceAlert) => void> = new Set();

  constructor() {
    this.loadAlerts();
    this.loadPriceHistory();
  }

  /**
   * Create a new alert condition
   */
  createAlert(condition: Omit<AlertCondition, 'id'>): AlertCondition {
    const alert: AlertCondition = {
      ...condition,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.alerts.set(alert.id, alert);
    this.saveAlerts();
    return alert;
  }

  /**
   * Update an existing alert
   */
  updateAlert(alertId: string, updates: Partial<AlertCondition>): AlertCondition | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    const updated = { ...alert, ...updates };
    this.alerts.set(alertId, updated);
    this.saveAlerts();
    return updated;
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    const deleted = this.alerts.delete(alertId);
    if (deleted) {
      this.saveAlerts();
    }
    return deleted;
  }

  /**
   * Enable/disable an alert
   */
  toggleAlert(alertId: string, enabled: boolean): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.enabled = enabled;
    this.saveAlerts();
    return true;
  }

  /**
   * Update current price for an asset
   */
  updatePrice(assetCode: string, price: number): void {
    const previousPrice = this.currentPrices.get(assetCode);
    this.currentPrices.set(assetCode, price);

    // Record price history
    const history = this.priceHistory.get(assetCode) || [];
    history.push({ timestamp: Date.now(), price });
    
    // Keep only last 1000 data points
    if (history.length > 1000) {
      history.shift();
    }
    this.priceHistory.set(assetCode, history);

    // Check alerts
    this.checkAlerts(assetCode, price, previousPrice);
  }

  /**
   * Check if any alerts should be triggered
   */
  private checkAlerts(assetCode: string, currentPrice: number, previousPrice?: number): void {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled || alert.assetCode !== assetCode) continue;

      let triggered = false;
      let metadata: Record<string, unknown> = {};

      switch (alert.type) {
        case 'above':
          triggered = currentPrice >= alert.threshold;
          metadata = { threshold: alert.threshold, currentPrice };
          break;

        case 'below':
          triggered = currentPrice <= alert.threshold;
          metadata = { threshold: alert.threshold, currentPrice };
          break;

        case 'percent_change':
          if (previousPrice && alert.timeWindow) {
            const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;
            triggered = Math.abs(percentChange) >= alert.threshold;
            metadata = { percentChange, threshold: alert.threshold, previousPrice, currentPrice };
          }
          break;

        case 'volume_spike':
          // Volume spike detection would require volume data
          // This is a placeholder for the implementation
          break;
      }

      if (triggered) {
        this.triggerAlert(alert, currentPrice, previousPrice, metadata);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(
    condition: AlertCondition,
    price: number,
    previousPrice?: number,
    metadata: Record<string, unknown> = {}
  ): void {
    const alert: PriceAlert = {
      id: `triggered-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      condition,
      triggeredAt: Date.now(),
      price,
      previousPrice,
      channels: [
        { type: 'in_app', enabled: true, config: {} }
      ],
      acknowledged: false,
      metadata
    };

    this.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    this.saveAlertHistory();

    // Notify callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: PriceAlert) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }

  /**
   * Get all alerts
   */
  getAlerts(): AlertCondition[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alerts for a specific asset
   */
  getAlertsForAsset(assetCode: string): AlertCondition[] {
    return this.getAlerts().filter(alert => alert.assetCode === assetCode);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): PriceAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveAlertHistory();
      return true;
    }
    return false;
  }

  /**
   * Get current price for an asset
   */
  getCurrentPrice(assetCode: string): number | undefined {
    return this.currentPrices.get(assetCode);
  }

  /**
   * Get price history for an asset
   */
  getPriceHistory(assetCode: string, limit: number = 100): Array<{ timestamp: number; price: number }> {
    const history = this.priceHistory.get(assetCode) || [];
    return history.slice(-limit);
  }

  /**
   * Get price change over time window
   */
  getPriceChange(assetCode: string, timeWindowMs: number): {
    change: number;
    percentChange: number;
    startPrice: number;
    endPrice: number;
  } | null {
    const history = this.priceHistory.get(assetCode);
    if (!history || history.length < 2) return null;

    const now = Date.now();
    const cutoff = now - timeWindowMs;

    const recent = history.filter(h => h.timestamp >= cutoff);
    if (recent.length < 2) return null;

    const startPrice = recent[0].price;
    const endPrice = recent[recent.length - 1].price;
    const change = endPrice - startPrice;
    const percentChange = (change / startPrice) * 100;

    return { change, percentChange, startPrice, endPrice };
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalAlerts: number;
    activeAlerts: number;
    triggeredCount: number;
    acknowledgedCount: number;
    byAsset: Record<string, number>;
    byType: Record<string, number>;
  } {
    const alerts = this.getAlerts();
    const activeAlerts = alerts.filter(a => a.enabled).length;

    const byAsset: Record<string, number> = {};
    const byType: Record<string, number> = {};

    alerts.forEach(alert => {
      byAsset[alert.assetCode] = (byAsset[alert.assetCode] || 0) + 1;
      byType[alert.type] = (byType[alert.type] || 0) + 1;
    });

    const triggeredCount = this.alertHistory.length;
    const acknowledgedCount = this.alertHistory.filter(a => a.acknowledged).length;

    return {
      totalAlerts: alerts.length,
      activeAlerts,
      triggeredCount,
      acknowledgedCount,
      byAsset,
      byType
    };
  }

  /**
   * Save alerts to localStorage
   */
  private saveAlerts(): void {
    try {
      const alerts = Array.from(this.alerts.values());
      localStorage.setItem('price-alerts', JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }

  /**
   * Load alerts from localStorage
   */
  private loadAlerts(): void {
    try {
      const stored = localStorage.getItem('price-alerts');
      if (stored) {
        const alerts = JSON.parse(stored) as AlertCondition[];
        alerts.forEach(alert => this.alerts.set(alert.id, alert));
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }

  /**
   * Save alert history to localStorage
   */
  private saveAlertHistory(): void {
    try {
      localStorage.setItem('price-alert-history', JSON.stringify(this.alertHistory));
    } catch (error) {
      console.error('Failed to save alert history:', error);
    }
  }

  /**
   * Load price history from localStorage
   */
  private loadPriceHistory(): void {
    try {
      const stored = localStorage.getItem('price-history');
      if (stored) {
        const data = JSON.parse(stored) as Record<string, Array<{ timestamp: number; price: number }>>;
        for (const [assetCode, history] of Object.entries(data)) {
          this.priceHistory.set(assetCode, history);
          if (history.length > 0) {
            this.currentPrices.set(assetCode, history[history.length - 1].price);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load price history:', error);
    }
  }

  /**
   * Clear old data
   */
  cleanup(): void {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days

    // Clean up price history
    for (const [assetCode, history] of this.priceHistory.entries()) {
      const filtered = history.filter(h => h.timestamp >= cutoff);
      this.priceHistory.set(assetCode, filtered);
    }

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(a => a.triggeredAt >= cutoff);
  }
}

export function createPriceAlertManager(): PriceAlertManager {
  return new PriceAlertManager();
}
