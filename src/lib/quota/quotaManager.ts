/**
 * Comprehensive Quota Management System
 * Implements tiered access, quota tracking, alerts, and analytics
 */

export interface QuotaConfig {
  tiers: {
    free: TierConfig;
    pro: TierConfig;
    enterprise: TierConfig;
  };
  defaultTier: 'free' | 'pro' | 'enterprise';
  alertThreshold: number; // percentage
  resetInterval: number; // milliseconds
}

export interface TierConfig {
  name: string;
  requestsPerDay: number;
  requestsPerHour: number;
  requestsPerMinute: number;
  burstAllowance: number;
  features: string[];
  priority: number;
}

export interface UserQuota {
  userId: string;
  tier: 'free' | 'pro' | 'enterprise';
  dailyQuota: number;
  dailyUsed: number;
  hourlyQuota: number;
  hourlyUsed: number;
  minuteQuota: number;
  minuteUsed: number;
  burstQuota: number;
  burstUsed: number;
  resetTime: number;
  alertsSent: number;
  lastAlertTime: number;
}

export interface QuotaUsage {
  userId: string;
  timestamp: number;
  endpoint: string;
  method: string;
  success: boolean;
  responseTime: number;
}

export class QuotaManager {
  private config: QuotaConfig;
  private userQuotas: Map<string, UserQuota> = new Map();
  private usageHistory: QuotaUsage[] = [];
  private alertCallbacks: Set<(userId: string, usage: number, quota: number) => void> = new Set();

  constructor(config: QuotaConfig) {
    this.config = config;
  }

  /**
   * Get or create user quota
   */
  private getUserQuota(userId: string, tier?: 'free' | 'pro' | 'enterprise'): UserQuota {
    let quota = this.userQuotas.get(userId);
    
    if (!quota) {
      const tierConfig = this.config.tiers[tier || this.config.defaultTier];
      quota = {
        userId,
        tier: tier || this.config.defaultTier,
        dailyQuota: tierConfig.requestsPerDay,
        dailyUsed: 0,
        hourlyQuota: tierConfig.requestsPerHour,
        hourlyUsed: 0,
        minuteQuota: tierConfig.requestsPerMinute,
        minuteUsed: 0,
        burstQuota: tierConfig.burstAllowance,
        burstUsed: 0,
        resetTime: this.calculateNextReset(),
        alertsSent: 0,
        lastAlertTime: 0
      };
      this.userQuotas.set(userId, quota);
    }

    // Check if quota needs reset
    this.checkAndResetQuota(quota);

    return quota;
  }

  /**
   * Check if request is allowed
   */
  checkRequest(
    userId: string,
    endpoint: string,
    tier?: 'free' | 'pro' | 'enterprise'
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
    reason?: string;
  } {
    const quota = this.getUserQuota(userId, tier);
    const tierConfig = this.config.tiers[quota.tier];

    // Check minute limit
    if (quota.minuteUsed >= quota.minuteQuota) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: quota.resetTime,
        retryAfter: 60,
        reason: 'Minute limit exceeded'
      };
    }

    // Check hour limit
    if (quota.hourlyUsed >= quota.hourlyQuota) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: quota.resetTime,
        retryAfter: 3600,
        reason: 'Hourly limit exceeded'
      };
    }

    // Check daily limit
    if (quota.dailyUsed >= quota.dailyQuota) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: quota.resetTime,
        retryAfter: 86400,
        reason: 'Daily limit exceeded'
      };
    }

    // Check burst allowance
    if (quota.burstUsed >= quota.burstQuota) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: quota.resetTime,
        retryAfter: 60,
        reason: 'Burst allowance exceeded'
      };
    }

    return {
      allowed: true,
      remaining: quota.dailyQuota - quota.dailyUsed,
      resetTime: quota.resetTime
    };
  }

  /**
   * Record a request usage
   */
  recordRequest(
    userId: string,
    endpoint: string,
    method: string,
    success: boolean,
    responseTime: number,
    tier?: 'free' | 'pro' | 'enterprise'
  ): void {
    const quota = this.getUserQuota(userId, tier);

    if (success) {
      quota.dailyUsed++;
      quota.hourlyUsed++;
      quota.minuteUsed++;
      quota.burstUsed++;
    }

    // Record usage history
    this.usageHistory.push({
      userId,
      timestamp: Date.now(),
      endpoint,
      method,
      success,
      responseTime
    });

    // Keep only last 10000 records
    if (this.usageHistory.length > 10000) {
      this.usageHistory.shift();
    }

    // Check for quota alerts
    this.checkQuotaAlerts(quota);
  }

  /**
   * Check and reset quota if needed
   */
  private checkAndResetQuota(quota: UserQuota): void {
    const now = Date.now();
    
    if (now >= quota.resetTime) {
      const tierConfig = this.config.tiers[quota.tier];
      
      quota.dailyQuota = tierConfig.requestsPerDay;
      quota.dailyUsed = 0;
      quota.hourlyQuota = tierConfig.requestsPerHour;
      quota.hourlyUsed = 0;
      quota.minuteQuota = tierConfig.requestsPerMinute;
      quota.minuteUsed = 0;
      quota.burstQuota = tierConfig.burstAllowance;
      quota.burstUsed = 0;
      quota.resetTime = this.calculateNextReset();
      quota.alertsSent = 0;
    }
  }

  /**
   * Calculate next reset time (midnight)
   */
  private calculateNextReset(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Check if quota alert should be sent
   */
  private checkQuotaAlerts(quota: UserQuota): void {
    const usagePercentage = (quota.dailyUsed / quota.dailyQuota) * 100;
    const alertThreshold = this.config.alertThreshold;
    const now = Date.now();

    // Only alert if threshold exceeded and not recently alerted
    if (usagePercentage >= alertThreshold && 
        (now - quota.lastAlertTime > 3600000) && // 1 hour cooldown
        quota.alertsSent < 3) { // Max 3 alerts per day
      
      quota.alertsSent++;
      quota.lastAlertTime = now;

      this.alertCallbacks.forEach(callback => {
        try {
          callback(quota.userId, usagePercentage, quota.dailyQuota);
        } catch (error) {
          console.error('Error in quota alert callback:', error);
        }
      });
    }
  }

  /**
   * Register alert callback
   */
  onQuotaAlert(callback: (userId: string, usage: number, quota: number) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }

  /**
   * Get user quota status
   */
  getUserQuotaStatus(userId: string): UserQuota | null {
    const quota = this.userQuotas.get(userId);
    if (quota) {
      this.checkAndResetQuota(quota);
    }
    return quota || null;
  }

  /**
   * Update user tier
   */
  updateUserTier(userId: string, newTier: 'free' | 'pro' | 'enterprise'): void {
    const quota = this.userQuotas.get(userId);
    if (quota) {
      const tierConfig = this.config.tiers[newTier];
      quota.tier = newTier;
      quota.dailyQuota = tierConfig.requestsPerDay;
      quota.hourlyQuota = tierConfig.requestsPerHour;
      quota.minuteQuota = tierConfig.requestsPerMinute;
      quota.burstQuota = tierConfig.burstAllowance;
    }
  }

  /**
   * Get usage analytics
   */
  getUsageAnalytics(timeRange: number = 86400000): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    byEndpoint: Record<string, number>;
    byMethod: Record<string, number>;
    byTier: Record<string, number>;
    topUsers: Array<{ userId: string; requests: number }>;
  } {
    const cutoff = Date.now() - timeRange;
    const recentUsage = this.usageHistory.filter(u => u.timestamp >= cutoff);

    const totalRequests = recentUsage.length;
    const successfulRequests = recentUsage.filter(u => u.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = recentUsage.map(u => u.responseTime);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const byEndpoint: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    const userRequestCounts: Map<string, number> = new Map();

    recentUsage.forEach(usage => {
      byEndpoint[usage.endpoint] = (byEndpoint[usage.endpoint] || 0) + 1;
      byMethod[usage.method] = (byMethod[usage.method] || 0) + 1;
      
      const quota = this.userQuotas.get(usage.userId);
      if (quota) {
        byTier[quota.tier] = (byTier[quota.tier] || 0) + 1;
      }

      userRequestCounts.set(usage.userId, (userRequestCounts.get(usage.userId) || 0) + 1);
    });

    const topUsers = Array.from(userRequestCounts.entries())
      .map(([userId, requests]) => ({ userId, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      byEndpoint,
      byMethod,
      byTier,
      topUsers
    };
  }

  /**
   * Get quota utilization across all users
   */
  getQuotaUtilization(): {
    totalUsers: number;
    byTier: Record<string, { count: number; totalQuota: number; totalUsed: number; utilization: number }>;
    usersNearLimit: Array<{ userId: string; tier: string; utilization: number }>;
    usersExceeded: Array<{ userId: string; tier: string; utilization: number }>;
  } {
    const byTier: Record<string, { count: number; totalQuota: number; totalUsed: number; utilization: number }> = {};
    const usersNearLimit: Array<{ userId: string; tier: string; utilization: number }> = [];
    const usersExceeded: Array<{ userId: string; tier: string; utilization: number }> = [];

    for (const quota of this.userQuotas.values()) {
      this.checkAndResetQuota(quota);

      const utilization = (quota.dailyUsed / quota.dailyQuota) * 100;

      if (!byTier[quota.tier]) {
        byTier[quota.tier] = { count: 0, totalQuota: 0, totalUsed: 0, utilization: 0 };
      }

      byTier[quota.tier].count++;
      byTier[quota.tier].totalQuota += quota.dailyQuota;
      byTier[quota.tier].totalUsed += quota.dailyUsed;

      if (utilization >= 90) {
        usersNearLimit.push({ userId: quota.userId, tier: quota.tier, utilization });
      }

      if (utilization >= 100) {
        usersExceeded.push({ userId: quota.userId, tier: quota.tier, utilization });
      }
    }

    // Calculate tier utilization
    for (const tier in byTier) {
      const data = byTier[tier];
      data.utilization = data.totalQuota > 0 ? (data.totalUsed / data.totalQuota) * 100 : 0;
    }

    return {
      totalUsers: this.userQuotas.size,
      byTier,
      usersNearLimit: usersNearLimit.sort((a, b) => b.utilization - a.utilization),
      usersExceeded: usersExceeded.sort((a, b) => b.utilization - a.utilization)
    };
  }

  /**
   * Get rate limit headers for response
   */
  getRateLimitHeaders(userId: string): Record<string, string> {
    const quota = this.getUserQuota(userId);
    if (!quota) {
      return {};
    }

    const remaining = Math.max(0, quota.dailyQuota - quota.dailyUsed);
    const reset = Math.ceil(quota.resetTime / 1000);
    const limit = quota.dailyQuota;

    return {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
      'X-RateLimit-Used': quota.dailyUsed.toString(),
      'X-RateLimit-Tier': quota.tier
    };
  }

  /**
   * Clear old usage history
   */
  cleanup(): void {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    this.usageHistory = this.usageHistory.filter(u => u.timestamp >= cutoff);
    
    // Remove inactive users
    for (const [userId, quota] of this.userQuotas.entries()) {
      if (Date.now() - quota.resetTime > 30 * 24 * 60 * 60 * 1000) {
        this.userQuotas.delete(userId);
      }
    }
  }
}

export function createQuotaManager(config?: Partial<QuotaConfig>): QuotaManager {
  const defaultConfig: QuotaConfig = {
    tiers: {
      free: {
        name: 'Free',
        requestsPerDay: 1000,
        requestsPerHour: 100,
        requestsPerMinute: 10,
        burstAllowance: 20,
        features: ['basic-api', 'read-only'],
        priority: 1
      },
      pro: {
        name: 'Pro',
        requestsPerDay: 10000,
        requestsPerHour: 1000,
        requestsPerMinute: 100,
        burstAllowance: 200,
        features: ['basic-api', 'read-write', 'advanced-features'],
        priority: 2
      },
      enterprise: {
        name: 'Enterprise',
        requestsPerDay: 100000,
        requestsPerHour: 10000,
        requestsPerMinute: 1000,
        burstAllowance: 2000,
        features: ['basic-api', 'read-write', 'advanced-features', 'priority-support', 'custom-integrations'],
        priority: 3
      }
    },
    defaultTier: 'free',
    alertThreshold: 80,
    resetInterval: 86400000
  };

  return new QuotaManager({ ...defaultConfig, ...config });
}
