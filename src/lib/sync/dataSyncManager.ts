/**
 * Advanced Data Synchronization Manager
 * Implements real-time sync across devices with conflict resolution, queue management, and encryption
 * 
 * Features:
 * - WebSocket-based real-time synchronization
 * - Multiple conflict resolution strategies (last-write-wins, merge, user choice)
 * - Priority-based sync queue with retry logic
 * - Comprehensive sync status tracking
 * - End-to-end encryption for sync data
 * - Secure key management
 */

import { CollaborationSocket } from '../websocket.js';

// ── Type Definitions ─────────────────────────────────────────────────────────────

export interface SyncData {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  deviceId: string;
  version: number;
  encrypted?: boolean;
}

export interface SyncConflict {
  localData: SyncData;
  remoteData: SyncData;
  conflictType: 'version' | 'timestamp' | 'content';
  resolution?: 'local' | 'remote' | 'merge' | 'pending';
}

export interface SyncQueueItem {
  id: string;
  data: SyncData;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface SyncStatus {
  connected: boolean;
  syncing: boolean;
  lastSyncTime: number | null;
  pendingItems: number;
  failedItems: number;
  conflicts: number;
  progress: number;
  error: string | null;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyDerivationIterations: number;
}

export interface SyncConfig {
  websocketUrl: string;
  encryption: EncryptionConfig;
  conflictResolution: 'last-write-wins' | 'merge' | 'user-choice';
  retryDelay: number;
  maxRetries: number;
  syncInterval: number;
}

// ── Encryption Manager ─────────────────────────────────────────────────────────

class EncryptionManager {
  private config: EncryptionConfig;
  private key: CryptoKey | null = null;

  constructor(config: EncryptionConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    // Generate or retrieve encryption key
    const storedKey = localStorage.getItem('sync-encryption-key');
    
    if (storedKey) {
      this.key = await this.importKey(storedKey);
    } else {
      this.key = await this.generateKey();
      const exportedKey = await this.exportKey(this.key);
      localStorage.setItem('sync-encryption-key', exportedKey);
    }
  }

  private async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async importKey(keyData: string): Promise<CryptoKey> {
    const keyBuffer = this.base64ToArrayBuffer(keyData);
    return await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async exportKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return this.arrayBufferToBase64(exported);
  }

  async encrypt(data: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.config.enabled || !this.key) {
      return { encrypted: data, iv: '' };
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.key,
      encodedData
    );

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  async decrypt(encrypted: string, iv: string): Promise<string> {
    if (!this.config.enabled || !this.key) {
      return encrypted;
    }

    const encryptedBuffer = this.base64ToArrayBuffer(encrypted);
    const ivBuffer = this.base64ToArrayBuffer(iv);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer)
      },
      this.key,
      encryptedBuffer
    );

    return new TextDecoder().decode(decrypted);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async clearKey(): Promise<void> {
    this.key = null;
    localStorage.removeItem('sync-encryption-key');
  }
}

// ── Conflict Resolution Manager ─────────────────────────────────────────────────

class ConflictResolutionManager {
  public strategy: 'last-write-wins' | 'merge' | 'user-choice';
  private pendingConflicts: Map<string, SyncConflict> = new Map();

  constructor(strategy: 'last-write-wins' | 'merge' | 'user-choice') {
    this.strategy = strategy;
  }

  resolveConflict(conflict: SyncConflict): SyncData {
    switch (this.strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(conflict);
      case 'merge':
        return this.mergeData(conflict);
      case 'user-choice':
        this.pendingConflicts.set(conflict.localData.id, conflict);
        return conflict.localData; // Default to local until user decides
      default:
        return this.lastWriteWins(conflict);
    }
  }

  private lastWriteWins(conflict: SyncConflict): SyncData {
    return conflict.localData.timestamp > conflict.remoteData.timestamp
      ? conflict.localData
      : conflict.remoteData;
  }

  private mergeData(conflict: SyncConflict): SyncData {
    const merged = {
      ...conflict.localData,
      data: {
        ...conflict.remoteData.data,
        ...conflict.localData.data
      },
      version: Math.max(conflict.localData.version, conflict.remoteData.version) + 1,
      timestamp: Date.now()
    };
    return merged;
  }

  getUserChoice(conflictId: string, choice: 'local' | 'remote' | 'merge'): SyncData | null {
    const conflict = this.pendingConflicts.get(conflictId);
    if (!conflict) return null;

    this.pendingConflicts.delete(conflictId);

    switch (choice) {
      case 'local':
        return conflict.localData;
      case 'remote':
        return conflict.remoteData;
      case 'merge':
        return this.mergeData(conflict);
      default:
        return null;
    }
  }

  getPendingConflicts(): SyncConflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  clearPendingConflicts(): void {
    this.pendingConflicts.clear();
  }
}

// ── Sync Queue Manager ───────────────────────────────────────────────────────────

class SyncQueueManager {
  private queue: SyncQueueItem[] = [];
  private processing: Set<string> = new Set();

  enqueue(data: SyncData, priority: 'high' | 'medium' | 'low' = 'medium', maxRetries = 3): string {
    const item: SyncQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
      priority,
      retryCount: 0,
      maxRetries,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.queue.push(item);
    this.sortQueue();
    return item.id;
  }

  private sortQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.queue.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp - b.timestamp;
    });
  }

  dequeue(): SyncQueueItem | null {
    const item = this.queue.find(i => i.status === 'pending' && !this.processing.has(i.id));
    if (item) {
      item.status = 'processing';
      this.processing.add(item.id);
      return item;
    }
    return null;
  }

  markComplete(itemId: string, success: boolean): void {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return;

    this.processing.delete(itemId);

    if (success) {
      item.status = 'completed';
      this.queue = this.queue.filter(i => i.id !== itemId);
    } else {
      item.retryCount++;
      if (item.retryCount >= item.maxRetries) {
        item.status = 'failed';
      } else {
        item.status = 'pending';
        item.timestamp = Date.now();
      }
    }
  }

  getQueue(): SyncQueueItem[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.queue.filter(i => i.status === 'pending').length;
  }

  getFailedCount(): number {
    return this.queue.filter(i => i.status === 'failed').length;
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
  }

  retryFailed(): void {
    this.queue
      .filter(i => i.status === 'failed')
      .forEach(i => {
        i.status = 'pending';
        i.retryCount = 0;
        i.timestamp = Date.now();
      });
  }
}

// ── Main Data Sync Manager ───────────────────────────────────────────────────────

export class DataSyncManager {
  private config: SyncConfig;
  private deviceId: string;
  private socket: CollaborationSocket | null = null;
  private encryptionManager: EncryptionManager;
  private conflictManager: ConflictResolutionManager;
  private queueManager: SyncQueueManager;
  private status: SyncStatus;
  private localData: Map<string, SyncData> = new Map();
  private syncInterval: number | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(config: SyncConfig) {
    this.config = config;
    this.deviceId = this.generateDeviceId();
    this.encryptionManager = new EncryptionManager(config.encryption);
    this.conflictManager = new ConflictResolutionManager(config.conflictResolution);
    this.queueManager = new SyncQueueManager();
    this.status = {
      connected: false,
      syncing: false,
      lastSyncTime: null,
      pendingItems: 0,
      failedItems: 0,
      conflicts: 0,
      progress: 0,
      error: null
    };
  }

  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('sync-device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('sync-device-id', deviceId);
    }
    return deviceId;
  }

  async initialize(): Promise<void> {
    await this.encryptionManager.initialize();
    this.connectWebSocket();
    this.startSyncInterval();
    this.loadLocalData();
  }

  private connectWebSocket(): void {
    this.socket = new CollaborationSocket(this.config.websocketUrl);
    this.socket.connect();

    this.socket.on('connected', () => {
      this.status.connected = true;
      this.status.error = null;
      this.emit('statusChange', this.status);
      this.syncAll();
    });

    this.socket.on('disconnected', () => {
      this.status.connected = false;
      this.status.syncing = false;
      this.emit('statusChange', this.status);
    });

    this.socket.on('error', (data) => {
      this.status.error = data.error?.message || 'Connection error';
      this.emit('statusChange', this.status);
    });

    this.socket.on('sync-data', async (data) => {
      await this.handleIncomingSync(data);
    });

    this.socket.on('sync-request', async (data) => {
      await this.handleSyncRequest(data);
    });
  }

  private startSyncInterval(): void {
    this.syncInterval = window.setInterval(() => {
      if (this.status.connected && !this.status.syncing) {
        this.syncAll();
      }
    }, this.config.syncInterval);
  }

  async syncData(type: string, data: Record<string, unknown>, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const syncData: SyncData = {
      id: `${type}-${Date.now()}`,
      type,
      data,
      timestamp: Date.now(),
      deviceId: this.deviceId,
      version: 1
    };

    // Encrypt if enabled
    if (this.config.encryption.enabled) {
      const { encrypted, iv } = await this.encryptionManager.encrypt(JSON.stringify(data));
      syncData.data = { encrypted, iv };
      syncData.encrypted = true;
    }

    // Store locally
    this.localData.set(syncData.id, syncData);
    this.saveLocalData();

    // Queue for sync
    this.queueManager.enqueue(syncData, priority, this.config.maxRetries);
    this.updateStatus();

    // Try to send immediately if connected
    if (this.status.connected) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.status.syncing) return;

    this.status.syncing = true;
    this.emit('statusChange', this.status);

    let item = this.queueManager.dequeue();
    while (item) {
      try {
        await this.sendSyncData(item.data);
        this.queueManager.markComplete(item.id, true);
      } catch (error) {
        this.queueManager.markComplete(item.id, false);
        console.error('Sync failed for item:', item.id, error);
      }

      this.updateStatus();
      item = this.queueManager.dequeue();
    }

    this.status.syncing = false;
    this.status.lastSyncTime = Date.now();
    this.emit('statusChange', this.status);
  }

  private async sendSyncData(data: SyncData): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected');
    }

    this.socket.send('sync-data', {
      data,
      deviceId: this.deviceId
    });
  }

  private async handleIncomingSync(message: { payload: { data: SyncData; deviceId: string } }): Promise<void> {
    const { data, deviceId } = message.payload;

    // Ignore own messages
    if (deviceId === this.deviceId) return;

    // Decrypt if needed
    if (data.encrypted && this.config.encryption.enabled) {
      const { encrypted, iv } = data.data as { encrypted: string; iv: string };
      const decrypted = await this.encryptionManager.decrypt(encrypted, iv);
      data.data = JSON.parse(decrypted);
      data.encrypted = false;
    }

    // Check for conflicts
    const existing = this.localData.get(data.id);
    if (existing) {
      const conflict: SyncConflict = {
        localData: existing,
        remoteData: data,
        conflictType: this.detectConflictType(existing, data)
      };

      const resolved = this.conflictManager.resolveConflict(conflict);
      this.localData.set(resolved.id, resolved);
      
      if (this.conflictManager.strategy === 'user-choice') {
        this.status.conflicts++;
        this.emit('conflict', conflict);
      }
    } else {
      this.localData.set(data.id, data);
    }

    this.saveLocalData();
    this.emit('dataReceived', data);
    this.updateStatus();
  }

  private detectConflictType(local: SyncData, remote: SyncData): 'version' | 'timestamp' | 'content' {
    if (local.version !== remote.version) return 'version';
    if (local.timestamp !== remote.timestamp) return 'timestamp';
    return 'content';
  }

  private async handleSyncRequest(message: { payload: { deviceId: string; types?: string[] } }): Promise<void> {
    const { deviceId, types } = message.payload;

    const dataToSend = Array.from(this.localData.values()).filter(item => {
      if (types && !types.includes(item.type)) return false;
      return true;
    });

    for (const data of dataToSend) {
      this.socket?.send('sync-data', {
        data,
        deviceId: this.deviceId
      });
    }
  }

  private async syncAll(): Promise<void> {
    this.socket?.send('sync-request', {
      deviceId: this.deviceId
    });
    await this.processQueue();
  }

  private updateStatus(): void {
    this.status.pendingItems = this.queueManager.getPendingCount();
    this.status.failedItems = this.queueManager.getFailedCount();
    this.status.conflicts = this.conflictManager.getPendingConflicts().length;
    
    const total = this.queueManager.getQueue().length;
    const completed = this.queueManager.getQueue().filter(i => i.status === 'completed').length;
    this.status.progress = total > 0 ? (completed / total) * 100 : 100;

    this.emit('statusChange', this.status);
  }

  private loadLocalData(): void {
    try {
      const stored = localStorage.getItem('sync-local-data');
      if (stored) {
        const data = JSON.parse(stored) as SyncData[];
        data.forEach(item => this.localData.set(item.id, item));
      }
    } catch (error) {
      console.error('Failed to load local data:', error);
    }
  }

  private saveLocalData(): void {
    try {
      const data = Array.from(this.localData.values());
      localStorage.setItem('sync-local-data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save local data:', error);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  getLocalData(type?: string): SyncData[] {
    const all = Array.from(this.localData.values());
    return type ? all.filter(item => item.type === type) : all;
  }

  getConflicts(): SyncConflict[] {
    return this.conflictManager.getPendingConflicts();
  }

  resolveConflict(conflictId: string, choice: 'local' | 'remote' | 'merge'): void {
    const resolved = this.conflictManager.getUserChoice(conflictId, choice);
    if (resolved) {
      this.localData.set(resolved.id, resolved);
      this.saveLocalData();
      this.updateStatus();
    }
  }

  retryFailedSyncs(): void {
    this.queueManager.retryFailed();
    this.processQueue();
  }

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    return () => this.off(event, handler);
  }

  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }

  disconnect(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.socket?.disconnect();
    this.socket = null;
    this.queueManager.clear();
    this.conflictManager.clearPendingConflicts();
  }

  async clearData(): Promise<void> {
    this.localData.clear();
    localStorage.removeItem('sync-local-data');
    await this.encryptionManager.clearKey();
  }
}

// ── Factory Function ─────────────────────────────────────────────────────────────

export function createDataSyncManager(config: Partial<SyncConfig> = {}): DataSyncManager {
  const defaultConfig: SyncConfig = {
    websocketUrl: 'wss://api.stellar-dashboard.dev/sync',
    encryption: {
      enabled: true,
      algorithm: 'AES-GCM',
      keyDerivationIterations: 100000
    },
    conflictResolution: 'last-write-wins',
    retryDelay: 1000,
    maxRetries: 3,
    syncInterval: 30000
  };

  return new DataSyncManager({ ...defaultConfig, ...config });
}
