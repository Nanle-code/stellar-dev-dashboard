// src/lib/notificationChannels.ts
// Simple notification channel adapters (email, webhook, SMS).
// In a real implementation these would integrate with external services.
// Here we provide lightweight stubs that can be extended later.

import { logger } from './logging/logger';

export const NOTIFICATION_CHANNEL = {
  EMAIL: "email",
  WEBHOOK: "webhook",
  SMS: "sms",
};

/**
 * Send an email notification.
 * @param {object} payload - { to, subject, body }
 */
export async function sendEmail(payload: { to: string; subject: string; body: string }) {
  // Placeholder: In production replace with proper email service (SendGrid, SES, etc.)
  logger.info("[Email]", { payload });
  return true;
}

/**
 * Send a webhook POST request.
 * @param {object} payload - { url, data }
 */
export async function sendWebhook(payload: { url: string; data: unknown }) {
  try {
    const response = await fetch(payload.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.data),
    });
    logger.info("[Webhook] status", { status: response.status });
    return response.ok;
  } catch (e) {
    logger.error("Webhook error", undefined, undefined, e instanceof Error ? e : new Error(String(e)));
    return false;
  }
}

/**
 * Send an SMS notification.
 * @param {object} payload - { to, message }
 */
export async function sendSMS(payload: { to: string; message: string }) {
  // Placeholder: integrate with Twilio or similar.
  logger.info("[SMS]", { payload });
  return true;
}
