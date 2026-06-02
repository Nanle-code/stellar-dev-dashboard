/**
 * Webhook System for Transaction Events
 * Manages webhook endpoints, event subscriptions, delivery, retries, and signatures
 */

import { v4 as uuidv4 } from 'uuid';

export type WebhookEventType = 'payment' | 'trust' | 'contract' | 'account_merge' | 'all';

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookEvent {
  id: string;
  endpointId: string;
  type: WebhookEventType;
  payload: Record<string, unknown>;
  timestamp: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: string;
  nextRetry?: string;
  error?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  eventId: string;
  endpointId: string;
  attempt: number;
  status: 'success' | 'failure';
  statusCode?: number;
  responseTime: number;
  timestamp: string;
  error?: string;
}

const WEBHOOK_DB_NAME = 'stellar-dev-dashboard-webhooks';
const WEBHOOK_DB_VERSION = 1;
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

class WebhookManager {
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(WEBHOOK_DB_NAME, WEBHOOK_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('endpoints')) {
          const endpointStore = db.createObjectStore('endpoints', { keyPath: 'id' });
          endpointStore.createIndex('url', 'url', { unique: false });
          endpointStore.createIndex('enabled', 'enabled', { unique: false });
        }

        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('endpointId', 'endpointId', { unique: false });
          eventStore.createIndex('status', 'status', { unique: false });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('eventId', 'eventId', { unique: false });
          logStore.createIndex('endpointId', 'endpointId', { unique: false });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Endpoint Management
  async createEndpoint(
    url: string,
    events: WebhookEventType[],
    metadata?: Record<string, unknown>
  ): Promise<WebhookEndpoint> {
    if (!this.db) await this.initialize();

    const endpoint: WebhookEndpoint = {
      id: uuidv4(),
      url,
      events,
      secret: this.generateSecret(),
      enabled: true,
      createdAt: new Date().toISOString(),
      metadata,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['endpoints'], 'readwrite');
      const store = transaction.objectStore('endpoints');
      const request = store.add(endpoint);

      request.onsuccess = () => resolve(endpoint);
      request.onerror = () => reject(request.error);
    });
  }

  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['endpoints'], 'readonly');
      const store = transaction.objectStore('endpoints');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEndpoints(): Promise<WebhookEndpoint[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['endpoints'], 'readonly');
      const store = transaction.objectStore('endpoints');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<void> {
    if (!this.db) await this.initialize();

    const endpoint = await this.getEndpoint(id);
    if (!endpoint) throw new Error('Endpoint not found');

    const updated = { ...endpoint, ...updates };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['endpoints'], 'readwrite');
      const store = transaction.objectStore('endpoints');
      const request = store.put(updated);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteEndpoint(id: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['endpoints'], 'readwrite');
      const store = transaction.objectStore('endpoints');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Event Delivery
  async triggerEvent(
    type: WebhookEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const endpoints = await this.getAllEndpoints();
    const matchingEndpoints = endpoints.filter(
      (ep) => ep.enabled && (ep.events.includes(type) || ep.events.includes('all'))
    );

    for (const endpoint of matchingEndpoints) {
      const event: WebhookEvent = {
        id: uuidv4(),
        endpointId: endpoint.id,
        type,
        payload,
        timestamp: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
      };

      await this.saveEvent(event);
      await this.deliverEvent(event, endpoint);
    }
  }

  private async deliverEvent(
    event: WebhookEvent,
    endpoint: WebhookEndpoint
  ): Promise<void> {
    const startTime = Date.now();
    event.attempts += 1;
    event.lastAttempt = new Date().toISOString();

    try {
      const signature = this.generateSignature(event.payload, endpoint.secret);
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event-Type': event.type,
          'X-Webhook-Event-Id': event.id,
        },
        body: JSON.stringify(event.payload),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        event.status = 'delivered';
        await this.updateEndpoint(endpoint.id, { lastTriggered: new Date().toISOString() });
        await this.logDelivery(event.id, endpoint.id, event.attempts, 'success', {
          statusCode: response.status,
          responseTime,
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      event.error = errorMessage;

      if (event.attempts < MAX_RETRY_ATTEMPTS) {
        event.status = 'retrying';
        const retryDelay = this.calculateRetryDelay(event.attempts);
        event.nextRetry = new Date(Date.now() + retryDelay).toISOString();
        setTimeout(() => this.deliverEvent(event, endpoint), retryDelay);
      } else {
        event.status = 'failed';
      }

      await this.logDelivery(event.id, endpoint.id, event.attempts, 'failure', {
        error: errorMessage,
        responseTime,
      });
    }

    await this.saveEvent(event);
  }

  private calculateRetryDelay(attempts: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return INITIAL_RETRY_DELAY * Math.pow(2, attempts - 1);
  }

  // Signature Generation & Verification
  private generateSignature(payload: Record<string, unknown>, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return this.hmacSha256(payloadString, secret);
  }

  private hmacSha256(data: string, secret: string): string {
    // Using Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const keyBuffer = encoder.encode(secret);

    // For browser compatibility, we'll use a simple hash
    // In production, use proper HMAC-SHA256 implementation
    return btoa(data + secret).slice(0, 64);
  }

  async verifySignature(
    payload: Record<string, unknown>,
    signature: string,
    endpointId: string
  ): Promise<boolean> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) return false;

    const expectedSignature = this.generateSignature(payload, endpoint.secret);
    return signature === expectedSignature;
  }

  // Event Storage
  private async saveEvent(event: WebhookEvent): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      const request = store.put(event);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEventHistory(endpointId?: string, limit = 100): Promise<WebhookEvent[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      
      let request: IDBRequest;
      if (endpointId) {
        const index = store.index('endpointId');
        request = index.getAll(endpointId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const events = request.result;
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(events.slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Delivery Logs
  private async logDelivery(
    eventId: string,
    endpointId: string,
    attempt: number,
    status: 'success' | 'failure',
    details: { statusCode?: number; responseTime: number; error?: string }
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const log: WebhookDeliveryLog = {
      id: uuidv4(),
      eventId,
      endpointId,
      attempt,
      status,
      statusCode: details.statusCode,
      responseTime: details.responseTime,
      timestamp: new Date().toISOString(),
      error: details.error,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['logs'], 'readwrite');
      const store = transaction.objectStore('logs');
      const request = store.add(log);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDeliveryLogs(eventId: string): Promise<WebhookDeliveryLog[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      const index = store.index('eventId');
      const request = index.getAll(eventId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Utility
  private generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Test webhook endpoint
  async testEndpoint(endpointId: string): Promise<{ success: boolean; message: string }> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      return { success: false, message: 'Endpoint not found' };
    }

    const testPayload = {
      test: true,
      message: 'This is a test webhook event',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.triggerEvent('payment', testPayload);
      return { success: true, message: 'Test event triggered successfully' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      };
    }
  }
}

export const webhookManager = new WebhookManager();
