// src/lib/alertsService.ts
// Service to dispatch alerts via configured channels.
import { NOTIFICATION_CHANNEL, sendEmail, sendWebhook, sendSMS } from "./notificationChannels";

export interface AlertPayload {
  id: string;
  severity: string;
  title: string;
  description: string;
  channel: keyof typeof NOTIFICATION_CHANNEL;
  // Additional optional fields per channel
  email?: { to: string; subject: string; body: string };
  webhook?: { url: string; data: any };
  sms?: { to: string; message: string };
}

/**
 * Dispatch a single alert using the appropriate provider.
 * Returns true if the notification was sent successfully.
 */
export async function dispatchAlert(alert: AlertPayload): Promise<boolean> {
  switch (alert.channel) {
    case NOTIFICATION_CHANNEL.EMAIL:
      if (alert.email) {
        return await sendEmail(alert.email);
      }
      break;
    case NOTIFICATION_CHANNEL.WEBHOOK:
      if (alert.webhook) {
        return await sendWebhook(alert.webhook);
      }
      break;
    case NOTIFICATION_CHANNEL.SMS:
      if (alert.sms) {
        return await sendSMS(alert.sms);
      }
      break;
    default:
      console.warn("Unsupported notification channel", alert.channel);
  }
  return false;
}

/**
 * Dispatch multiple alerts in parallel, returning an array of results.
 */
export async function dispatchAlerts(alerts: AlertPayload[]): Promise<boolean[]> {
  return Promise.all(alerts.map(dispatchAlert));
}
