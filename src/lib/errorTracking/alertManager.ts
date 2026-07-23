/**
 * Alert Manager for Error Tracking System
 * Integrates with Slack, Email, and PagerDuty for alerting
 */

export interface AlertConfig {
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    username: string;
    iconEmoji: string;
  };
  email?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  pagerDuty?: {
    enabled: boolean;
    integrationKey: string;
    routingKey: string;
    apiUrl: string;
  };
}

export interface Alert {
  id: string;
  type: 'slack' | 'email' | 'pagerduty';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed';
  errorData: Record<string, unknown>;
  retryCount: number;
}

export class AlertManager {
  private config: AlertConfig;
  private alertQueue: Alert[] = [];
  private alertHistory: Alert[] = [];
  private processing: boolean = false;

  constructor(config: AlertConfig) {
    this.config = config;
  }

  async sendAlert(
    severity: 'critical' | 'high' | 'medium' | 'low',
    title: string,
    message: string,
    errorData: Record<string, unknown>
  ): Promise<void> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'slack',
      severity,
      title,
      message,
      timestamp: Date.now(),
      status: 'pending',
      errorData,
      retryCount: 0
    };

    this.alertQueue.push(alert);
    this.alertHistory.push(alert);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.alertQueue.length === 0) return;

    this.processing = true;

    while (this.alertQueue.length > 0) {
      const alert = this.alertQueue.shift()!;
      
      try {
        await this.sendToAllChannels(alert);
        alert.status = 'sent';
      } catch (error) {
        alert.status = 'failed';
        alert.retryCount++;
        
        if (alert.retryCount < 3) {
          this.alertQueue.unshift(alert);
          await new Promise(resolve => setTimeout(resolve, 1000 * alert.retryCount));
        }
      }
    }

    this.processing = false;
  }

  private async sendToAllChannels(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.slack?.enabled) {
      promises.push(this.sendSlackAlert(alert));
    }

    if (this.config.email?.enabled && alert.severity === 'critical') {
      promises.push(this.sendEmailAlert(alert));
    }

    if (this.config.pagerDuty?.enabled && alert.severity === 'critical') {
      promises.push(this.sendPagerDutyAlert(alert));
    }

    await Promise.allSettled(promises);
  }

  private async sendSlackAlert(alert: Alert): Promise<void> {
    const { webhookUrl, channel, username, iconEmoji } = this.config.slack!;

    const color = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFCC00',
      low: '#00CC00'
    }[alert.severity];

    const payload = {
      channel,
      username,
      icon_emoji: iconEmoji,
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Timestamp',
              value: new Date(alert.timestamp).toISOString(),
              short: true
            },
            {
              title: 'Error ID',
              value: alert.id,
              short: true
            }
          ],
          footer: 'Stellar Dev Dashboard Error Tracking',
          ts: Math.floor(alert.timestamp / 1000)
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack alert failed: ${response.statusText}`);
    }
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    // Email sending would typically be done via a backend service
    // This is a placeholder for the implementation
    console.log('[Email Alert]', alert);
    
    // In a real implementation, you would:
    // 1. Call your backend API endpoint that handles email sending
    // 2. Or use a service like SendGrid, Mailgun, or AWS SES directly
    // 3. Include proper email templates with HTML formatting
    
    const emailPayload = {
      to: this.config.email!.recipients,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: this.generateEmailTemplate(alert),
      text: alert.message
    };

    // Placeholder for actual email sending
    // await fetch('/api/send-email', { method: 'POST', body: JSON.stringify(emailPayload) });
  }

  private generateEmailTemplate(alert: Alert): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .alert-box { border-left: 4px solid ${alert.severity === 'critical' ? '#FF0000' : '#FF6600'}; padding: 20px; background: #f9f9f9; }
            .severity { font-weight: bold; color: ${alert.severity === 'critical' ? '#FF0000' : '#FF6600'}; }
          </style>
        </head>
        <body>
          <div class="alert-box">
            <h2>${alert.title}</h2>
            <p><span class="severity">Severity:</span> ${alert.severity.toUpperCase()}</p>
            <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
            <p><strong>Error ID:</strong> ${alert.id}</p>
            <hr>
            <p>${alert.message}</p>
            <pre style="background: #f0f0f0; padding: 10px; overflow-x: auto;">${JSON.stringify(alert.errorData, null, 2)}</pre>
          </div>
        </body>
      </html>
    `;
  }

  private async sendPagerDutyAlert(alert: Alert): Promise<void> {
    const { integrationKey, routingKey, apiUrl } = this.config.pagerDuty!;

    const payload = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        severity: alert.severity === 'critical' ? 'critical' : 'error',
        source: 'stellar-dev-dashboard',
        timestamp: new Date(alert.timestamp).toISOString(),
        custom_details: alert.errorData
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`PagerDuty alert failed: ${response.statusText}`);
    }
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  getAlertStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    successRate: number;
  } {
    const total = this.alertHistory.length;
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const successful = this.alertHistory.filter(a => a.status === 'sent').length;

    this.alertHistory.forEach(alert => {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byType[alert.type] = (byType[alert.type] || 0) + 1;
    });

    return {
      total,
      bySeverity,
      byType,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  }

  clearHistory(): void {
    this.alertHistory = [];
  }
}

export function createAlertManager(config: AlertConfig): AlertManager {
  return new AlertManager(config);
}
