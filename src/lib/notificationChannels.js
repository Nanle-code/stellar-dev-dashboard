// src/lib/notificationChannels.js
// Simple notification channel adapters (email, webhook, SMS).
// In a real implementation these would integrate with external services.
// Here we provide lightweight stubs that can be extended later.

export const NOTIFICATION_CHANNEL = {
  EMAIL: "email",
  WEBHOOK: "webhook",
  SMS: "sms",
};

/**
 * Send an email notification.
 * @param {object} payload - { to, subject, body }
 */
export async function sendEmail(payload) {
  // Placeholder: In production replace with proper email service (SendGrid, SES, etc.)
  console.log("[Email]", payload);
  return true;
}

/**
 * Send a webhook POST request.
 * @param {object} payload - { url, data }
 */
export async function sendWebhook(payload) {
  try {
    const response = await fetch(payload.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.data),
    });
    console.log("[Webhook] status", response.status);
    return response.ok;
  } catch (e) {
    console.error("Webhook error", e);
    return false;
  }
}

/**
 * Send an SMS notification.
 * @param {object} payload - { to, message }
 */
export async function sendSMS(payload) {
  // Placeholder: integrate with Twilio or similar.
  console.log("[SMS]", payload);
  return true;
}
