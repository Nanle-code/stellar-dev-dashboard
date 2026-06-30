/**
 * Error Grouping and Deduplication System
 * Groups similar errors together to reduce noise and improve analysis
 */

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  errorName: string;
  errorMessage: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  affectedUsers: Set<string>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'resolved' | 'ignored';
  sampleError: Record<string, unknown>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SimilarityConfig {
  messageSimilarityThreshold: number;
  stackSimilarityThreshold: number;
  groupingWindowMs: number;
}

export class ErrorGroupingManager {
  private groups: Map<string, ErrorGroup> = new Map();
  private config: SimilarityConfig;
  private occurrenceHistory: Map<string, number[]> = new Map();

  constructor(config: Partial<SimilarityConfig> = {}) {
    this.config = {
      messageSimilarityThreshold: 0.85,
      stackSimilarityThreshold: 0.7,
      groupingWindowMs: 3600000, // 1 hour
      ...config
    };
  }

  /**
   * Generate a fingerprint for an error
   */
  generateFingerprint(error: Record<string, unknown>): string {
    const name = String(error.name || 'Unknown');
    const message = String(error.message || 'Unknown');
    const stack = this.normalizeStackTrace(error.stack as string);
    
    // Create a hash of the error signature
    const signature = `${name}:${message}:${stack.substring(0, 100)}`;
    return this.hashString(signature);
  }

  /**
   * Normalize stack trace for comparison
   */
  private normalizeStackTrace(stack?: string): string {
    if (!stack) return '';
    
    return stack
      .split('\n')
      .map(line => {
        // Remove line numbers and file paths, keep function names
        return line
          .replace(/\d+:\d+/g, '')
          .replace(/\/[\w\/.-]+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(line => line.length > 0)
      .join('|');
  }

  /**
   * Calculate similarity between two strings using Jaccard similarity
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(' '));
    const set2 = new Set(str2.toLowerCase().split(' '));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Find or create an error group
   */
  groupError(error: Record<string, unknown>, userId?: string): ErrorGroup {
    const fingerprint = this.generateFingerprint(error);
    
    // Try to find existing group
    let group = this.findMatchingGroup(error, fingerprint);
    
    if (group) {
      // Update existing group
      group.occurrences++;
      group.lastSeen = Date.now();
      if (userId) {
        group.affectedUsers.add(userId);
      }
      group.trend = this.calculateTrend(group.id);
    } else {
      // Create new group
      group = {
        id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fingerprint,
        errorName: String(error.name || 'Unknown'),
        errorMessage: String(error.message || 'Unknown'),
        occurrences: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        affectedUsers: userId ? new Set([userId]) : new Set(),
        severity: this.determineSeverity(error),
        status: 'active',
        sampleError: error,
        trend: 'stable'
      };
      
      this.groups.set(group.id, group);
      this.occurrenceHistory.set(group.id, [Date.now()]);
    }
    
    // Track occurrence for trend analysis
    const history = this.occurrenceHistory.get(group.id) || [];
    history.push(Date.now());
    // Keep only last 100 occurrences
    if (history.length > 100) {
      history.shift();
    }
    this.occurrenceHistory.set(group.id, history);
    
    return group;
  }

  /**
   * Find matching group based on similarity
   */
  private findMatchingGroup(error: Record<string, unknown>, fingerprint: string): ErrorGroup | null {
    const errorMessage = String(error.message || '');
    const errorStack = this.normalizeStackTrace(error.stack as string);
    
    // First try exact fingerprint match
    for (const group of this.groups.values()) {
      if (group.fingerprint === fingerprint && group.status === 'active') {
        return group;
      }
    }
    
    // Then try similarity-based matching
    for (const group of this.groups.values()) {
      if (group.status !== 'active') continue;
      
      const messageSimilarity = this.calculateSimilarity(errorMessage, group.errorMessage);
      const stackSimilarity = this.calculateSimilarity(errorStack, this.normalizeStackTrace(group.sampleError.stack as string));
      
      if (messageSimilarity >= this.config.messageSimilarityThreshold ||
          stackSimilarity >= this.config.stackSimilarityThreshold) {
        return group;
      }
    }
    
    return null;
  }

  /**
   * Calculate trend based on occurrence history
   */
  private calculateTrend(groupId: string): 'increasing' | 'decreasing' | 'stable' {
    const history = this.occurrenceHistory.get(groupId);
    if (!history || history.length < 10) return 'stable';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    const recentAvg = this.calculateAverageInterval(recent);
    const olderAvg = this.calculateAverageInterval(older);
    
    if (recentAvg < olderAvg * 0.7) return 'increasing';
    if (recentAvg > olderAvg * 1.3) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate average interval between occurrences
   */
  private calculateAverageInterval(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;
    
    let total = 0;
    for (let i = 1; i < timestamps.length; i++) {
      total += timestamps[i] - timestamps[i - 1];
    }
    
    return total / (timestamps.length - 1);
  }

  /**
   * Determine error severity based on error properties
   */
  private determineSeverity(error: Record<string, unknown>): 'critical' | 'high' | 'medium' | 'low' {
    const message = String(error.message || '').toLowerCase();
    
    // Critical indicators
    if (message.includes('critical') || 
        message.includes('fatal') || 
        message.includes('security') ||
        message.includes('authentication failed')) {
      return 'critical';
    }
    
    // High indicators
    if (message.includes('error') || 
        message.includes('failed') || 
        message.includes('timeout')) {
      return 'high';
    }
    
    // Medium indicators
    if (message.includes('warning') || 
        message.includes('deprecated')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Get all active error groups
   */
  getActiveGroups(): ErrorGroup[] {
    return Array.from(this.groups.values())
      .filter(group => group.status === 'active')
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Get groups by severity
   */
  getGroupsBySeverity(severity: 'critical' | 'high' | 'medium' | 'low'): ErrorGroup[] {
    return this.getActiveGroups()
      .filter(group => group.severity === severity);
  }

  /**
   * Resolve an error group
   */
  resolveGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.status = 'resolved';
    }
  }

  /**
   * Ignore an error group
   */
  ignoreGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.status = 'ignored';
    }
  }

  /**
   * Get grouping statistics
   */
  getStats(): {
    totalGroups: number;
    activeGroups: number;
    totalOccurrences: number;
    bySeverity: Record<string, number>;
    byTrend: Record<string, number>;
  } {
    const groups = Array.from(this.groups.values());
    const activeGroups = groups.filter(g => g.status === 'active');
    
    const bySeverity: Record<string, number> = {};
    const byTrend: Record<string, number> = {};
    let totalOccurrences = 0;
    
    groups.forEach(group => {
      totalOccurrences += group.occurrences;
      bySeverity[group.severity] = (bySeverity[group.severity] || 0) + 1;
      byTrend[group.trend] = (byTrend[group.trend] || 0) + 1;
    });
    
    return {
      totalGroups: groups.length,
      activeGroups: activeGroups.length,
      totalOccurrences,
      bySeverity,
      byTrend
    };
  }

  /**
   * Simple hash function for fingerprinting
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clear old groups (older than 30 days)
   */
  cleanup(): void {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    for (const [id, group] of this.groups.entries()) {
      if (group.lastSeen < cutoff && group.status === 'resolved') {
        this.groups.delete(id);
        this.occurrenceHistory.delete(id);
      }
    }
  }
}

export function createErrorGroupingManager(config?: Partial<SimilarityConfig>): ErrorGroupingManager {
  return new ErrorGroupingManager(config);
}
