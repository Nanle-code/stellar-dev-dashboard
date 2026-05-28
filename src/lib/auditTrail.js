/**
 * Comprehensive Audit Trail System
 * Logs all user actions, API calls, and data changes with security monitoring
 */

class AuditTrail {
  constructor() {
    this.events = [];
    this.maxEvents = 10000; // Maximum events to keep in memory
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.securityThresholds = {
      failedLogins: 5,
      apiCallsPerMinute: 100,
      suspiciousOperations: 10
    };
    this.counters = {
      failedLogins: 0,
      apiCalls: 0,
      suspiciousOperations: 0,
      lastApiCallReset: Date.now()
    };
    this.subscribers = [];
    this.initStorage();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initStorage() {
    // Load existing events from localStorage if available
    try {
      const stored = localStorage.getItem('stellar_audit_trail');
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];
        this.userId = data.userId || null;
      }
    } catch (error) {
      console.warn('Failed to load audit trail from storage:', error);
    }
  }

  setUserId(userId) {
    this.userId = userId;
    this.logEvent('USER_IDENTIFIED', 'User session identified', { userId });
  }

  logEvent(type, message, metadata = {}, severity = 'info') {
    const event = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      type,
      message,
      metadata,
      severity,
      userAgent: navigator.userAgent,
      ip: this.getClientIP(),
      location: window.location.href
    };

    this.events.unshift(event);
    
    // Trim events if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Update counters
    this.updateCounters(type);

    // Check for security issues
    this.checkSecurityThresholds(event);

    // Notify subscribers
    this.notifySubscribers(event);

    // Persist to storage
    this.persistToStorage();

    return event.id;
  }

  generateEventId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientIP() {
    // In a real implementation, this would come from server headers
    return 'client_ip_unknown';
  }

  updateCounters(type) {
    const now = Date.now();
    
    // Reset API counter every minute
    if (now - this.counters.lastApiCallReset > 60000) {
      this.counters.apiCalls = 0;
      this.counters.lastApiCallReset = now;
    }

    switch (type) {
      case 'LOGIN_FAILED':
        this.counters.failedLogins++;
        break;
      case 'API_CALL':
        this.counters.apiCalls++;
        break;
      case 'SUSPICIOUS_OPERATION':
        this.counters.suspiciousOperations++;
        break;
    }
  }

  checkSecurityThresholds(event) {
    const alerts = [];

    if (this.counters.failedLogins >= this.securityThresholds.failedLogins) {
      alerts.push({
        type: 'SECURITY_ALERT',
        message: 'Multiple failed login attempts detected',
        severity: 'high',
        count: this.counters.failedLogins
      });
    }

    if (this.counters.apiCalls >= this.securityThresholds.apiCallsPerMinute) {
      alerts.push({
        type: 'SECURITY_ALERT',
        message: 'High API call rate detected',
        severity: 'medium',
        count: this.counters.apiCalls
      });
    }

    if (this.counters.suspiciousOperations >= this.securityThresholds.suspiciousOperations) {
      alerts.push({
        type: 'SECURITY_ALERT',
        message: 'Multiple suspicious operations detected',
        severity: 'high',
        count: this.counters.suspiciousOperations
      });
    }

    alerts.forEach(alert => {
      this.logEvent(alert.type, alert.message, alert, alert.severity);
    });
  }

  // Specific logging methods for different types of actions
  logUserAction(action, details = {}) {
    this.logEvent('USER_ACTION', `User performed: ${action}`, details);
  }

  logAPICall(endpoint, method, params = {}, response = {}) {
    const metadata = {
      endpoint,
      method,
      params: this.sanitizeParams(params),
      responseStatus: response.status,
      responseTime: response.responseTime
    };
    
    this.logEvent('API_CALL', `${method} ${endpoint}`, metadata);
  }

  logDataChange(entity, action, before, after) {
    const metadata = {
      entity,
      action,
      before: this.sanitizeData(before),
      after: this.sanitizeData(after)
    };
    
    this.logEvent('DATA_CHANGE', `${entity} ${action}`, metadata);
  }

  logSecurityEvent(event, details = {}) {
    this.logEvent('SECURITY_EVENT', event, details, 'warning');
  }

  logError(error, context = {}) {
    const metadata = {
      error: error.message,
      stack: error.stack,
      context
    };
    
    this.logEvent('ERROR', error.message, metadata, 'error');
  }

  sanitizeParams(params) {
    // Remove sensitive data like private keys, passwords, API keys, etc.
    const sanitized = { ...params };
    const sensitiveKeys = ['secret', 'privateKey', 'password', 'token'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    // Redact sensitive HTTP headers (Authorization, x-api-key, etc.)
    if (sanitized.headers && typeof sanitized.headers === 'object') {
      const redactedHeaders = { ...sanitized.headers };
      Object.keys(redactedHeaders).forEach(h => {
        if (/^(authorization|x-api-key|api-key)$/i.test(h)) {
          redactedHeaders[h] = '[REDACTED]';
        }
      });
      sanitized.headers = redactedHeaders;
    }
    
    return sanitized;
  }

  sanitizeData(data) {
    if (!data) return data;
    
    // Create a deep copy and redact sensitive fields
    const sanitized = JSON.parse(JSON.stringify(data));
    const sensitivePaths = [
      'secretKey', 'privateKey', 'seed', 'password', 'token',
      'signerKey', 'signingKey'
    ];
    
    const redactSensitive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const key in obj) {
        if (sensitivePaths.some(path => key.toLowerCase().includes(path.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          redactSensitive(obj[key]);
        }
      }
      return obj;
    };
    
    return redactSensitive(sanitized);
  }

  // Query methods
  getEvents(options = {}) {
    let filtered = [...this.events];
    
    if (options.type) {
      filtered = filtered.filter(event => event.type === options.type);
    }
    
    if (options.severity) {
      filtered = filtered.filter(event => event.severity === options.severity);
    }
    
    if (options.userId) {
      filtered = filtered.filter(event => event.userId === options.userId);
    }
    
    if (options.startDate) {
      const start = new Date(options.startDate);
      filtered = filtered.filter(event => new Date(event.timestamp) >= start);
    }
    
    if (options.endDate) {
      const end = new Date(options.endDate);
      filtered = filtered.filter(event => new Date(event.timestamp) <= end);
    }
    
    if (options.search) {
      const search = options.search.toLowerCase();
      filtered = filtered.filter(event => 
        event.message.toLowerCase().includes(search) ||
        JSON.stringify(event.metadata).toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }

  getSecurityAlerts() {
    return this.getEvents({ type: 'SECURITY_ALERT' });
  }

  getErrors() {
    return this.getEvents({ type: 'ERROR' });
  }

  getAPIActivity() {
    return this.getEvents({ type: 'API_CALL' });
  }

  // Export functionality
  exportEvents(format = 'json', options = {}) {
    const events = this.getEvents(options);
    
    switch (format) {
      case 'json':
        return this.exportAsJSON(events);
      case 'csv':
        return this.exportAsCSV(events);
      case 'txt':
        return this.exportAsText(events);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  exportAsJSON(events) {
    const data = {
      exportDate: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      totalEvents: events.length,
      events
    };
    
    return JSON.stringify(data, null, 2);
  }

  exportAsCSV(events) {
    const headers = ['ID', 'Timestamp', 'User ID', 'Type', 'Message', 'Severity', 'Metadata'];
    const rows = events.map(event => [
      event.id,
      event.timestamp,
      event.userId || '',
      event.type,
      event.message,
      event.severity,
      JSON.stringify(event.metadata)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  exportAsText(events) {
    return events.map(event => {
      return `[${event.timestamp}] ${event.severity.toUpperCase()} ${event.type}: ${event.message}
Metadata: ${JSON.stringify(event.metadata, null, 2)}
---`;
    }).join('\n');
  }

  // Subscription system
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  notifySubscribers(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Audit trail subscriber error:', error);
      }
    });
  }

  // Storage persistence
  persistToStorage() {
    try {
      const data = {
        events: this.events.slice(0, 1000), // Only store last 1000 events in localStorage
        userId: this.userId,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('stellar_audit_trail', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist audit trail to storage:', error);
    }
  }

  // Cleanup and maintenance
  clearEvents() {
    this.events = [];
    this.persistToStorage();
    this.logEvent('SYSTEM', 'Audit trail cleared', {}, 'info');
  }

  clearOldEvents(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    this.events = this.events.filter(event => 
      new Date(event.timestamp) >= cutoffDate
    );
    
    this.persistToStorage();
    this.logEvent('SYSTEM', `Old audit events cleared (kept ${daysToKeep} days)`, { 
      remainingEvents: this.events.length 
    }, 'info');
  }

  // Statistics
  getStatistics() {
    const now = Date.now();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const recentEvents = this.events.filter(event => 
      new Date(event.timestamp) >= last24h
    );
    
    const weeklyEvents = this.events.filter(event => 
      new Date(event.timestamp) >= last7d
    );

    return {
      totalEvents: this.events.length,
      last24hEvents: recentEvents.length,
      last7dEvents: weeklyEvents.length,
      securityAlerts: this.getSecurityAlerts().length,
      errors: this.getErrors().length,
      apiCalls: this.getAPIActivity().length,
      sessionId: this.sessionId,
      userId: this.userId,
      counters: { ...this.counters }
    };
  }
}

// Create singleton instance
const auditTrail = new AuditTrail();

export default auditTrail;
export { AuditTrail };
