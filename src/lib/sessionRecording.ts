/**
 * Session Recording (#410)
 *
 * Captures user interactions (clicks, navigation, form inputs) for
 * compliance audit and replay. Stores to IndexedDB. No secrets captured.
 */

import { getStoredValue, setStoredValue } from './storage.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionEventType =
  | 'click' | 'navigation' | 'input' | 'scroll' | 'error'
  | 'network' | 'state_change' | 'session_start' | 'session_end';

export interface SessionEvent {
  type: SessionEventType;
  timestamp: string;
  target?: string;
  value?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRecording {
  id: string;
  userId: string | null;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  events: SessionEvent[];
  url: string;
  userAgent: string;
  tags: string[];
}

export interface SessionSearchOptions {
  userId?: string;
  since?: string;
  until?: string;
  tag?: string;
  search?: string;
  limit?: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'session-recordings';
const MAX_SESSIONS = 50;
const MAX_EVENTS_PER_SESSION = 500;

let _sessions: SessionRecording[] = [];
let _hydrated = false;

async function hydrate() {
  if (_hydrated || typeof window === 'undefined') return;
  _hydrated = true;
  try {
    const stored = await getStoredValue(STORAGE_KEY);
    if (Array.isArray(stored)) _sessions = stored.slice(-MAX_SESSIONS);
  } catch { /* operate in-memory */ }
}

async function persist() {
  if (typeof window === 'undefined') return;
  try {
    await setStoredValue(STORAGE_KEY, _sessions.slice(-MAX_SESSIONS));
  } catch { /* best-effort */ }
}

hydrate();

// ─── Active recording ─────────────────────────────────────────────────────────

let _active: SessionRecording | null = null;
const _subscribers = new Set<(s: SessionRecording) => void>();

function notifySubscribers() {
  if (!_active) return;
  for (const fn of _subscribers) {
    try { fn(_active); } catch { /* swallow */ }
  }
}

// ─── Redaction ────────────────────────────────────────────────────────────────

const REDACT_ATTRS = new Set(['password', 'type-password', 'credit-card', 'ssn', 'token']);

function redactTarget(el: HTMLElement | null): string {
  if (!el) return '';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? `.${el.className.trim().split(/\s+/).join('.')}`
    : '';
  return `${tag}${id}${cls}`;
}

function redactInputValue(el: HTMLInputElement): string {
  const t = (el.type || '').toLowerCase();
  if (REDACT_ATTRS.has(t) || el.name?.toLowerCase().includes('password')) return '[REDACTED]';
  return ''; // only record that an input changed, not the value
}

// ─── DOM listeners ────────────────────────────────────────────────────────────

function onClickCapture(e: MouseEvent) {
  if (!_active) return;
  appendEvent({
    type: 'click',
    target: redactTarget(e.target as HTMLElement),
  });
}

function onNavigate() {
  if (!_active) return;
  appendEvent({ type: 'navigation', url: window.location.href });
}

function onInputChange(e: Event) {
  if (!_active) return;
  const el = e.target as HTMLInputElement;
  appendEvent({
    type: 'input',
    target: redactTarget(el),
    value: redactInputValue(el),
  });
}

function onUnhandledError(e: ErrorEvent) {
  if (!_active) return;
  appendEvent({
    type: 'error',
    metadata: { message: e.message, filename: e.filename, lineno: e.lineno },
  });
}

// ─── Core API ────────────────────────────────────────────────────────────────

function appendEvent(partial: Omit<SessionEvent, 'timestamp'>) {
  if (!_active) return;
  if (_active.events.length >= MAX_EVENTS_PER_SESSION) return;
  _active.events.push({ ...partial, timestamp: new Date().toISOString() });
  notifySubscribers();
}

export async function startRecording(userId: string | null = null, tags: string[] = []) {
  await hydrate();
  if (_active) stopRecording();

  _active = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    duration: null,
    events: [],
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    tags,
  };

  appendEvent({ type: 'session_start', url: _active.url });

  if (typeof window !== 'undefined') {
    window.addEventListener('click', onClickCapture, true);
    window.addEventListener('change', onInputChange, true);
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('error', onUnhandledError);
  }

  return _active.id;
}

export async function stopRecording(): Promise<SessionRecording | null> {
  if (!_active) return null;

  if (typeof window !== 'undefined') {
    window.removeEventListener('click', onClickCapture, true);
    window.removeEventListener('change', onInputChange, true);
    window.removeEventListener('popstate', onNavigate);
    window.removeEventListener('error', onUnhandledError);
  }

  const endedAt = new Date().toISOString();
  _active.endedAt = endedAt;
  _active.duration = new Date(endedAt).getTime() - new Date(_active.startedAt).getTime();
  appendEvent({ type: 'session_end' });

  const finished = { ..._active };
  _sessions.push(finished);
  if (_sessions.length > MAX_SESSIONS) _sessions.shift();
  _active = null;

  await persist();
  return finished;
}

export function isRecording(): boolean {
  return _active !== null;
}

export function getActiveRecording(): SessionRecording | null {
  return _active ? { ..._active } : null;
}

/** Append a custom state-change event from application code. */
export function recordStateChange(action: string, metadata?: Record<string, unknown>) {
  appendEvent({ type: 'state_change', target: action, metadata });
}

/** Append a custom network event from application code. */
export function recordNetworkEvent(url: string, status: number) {
  appendEvent({ type: 'network', url, metadata: { status } });
}

export function subscribeRecording(fn: (s: SessionRecording) => void): () => void {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

// ─── Search & retrieval ───────────────────────────────────────────────────────

export async function getRecordings(opts: SessionSearchOptions = {}): Promise<SessionRecording[]> {
  await hydrate();
  let results = _sessions.slice();

  if (opts.userId) results = results.filter((s) => s.userId === opts.userId);
  if (opts.tag) results = results.filter((s) => s.tags.includes(opts.tag!));
  if (opts.since) {
    const t = new Date(opts.since).getTime();
    results = results.filter((s) => new Date(s.startedAt).getTime() >= t);
  }
  if (opts.until) {
    const t = new Date(opts.until).getTime();
    results = results.filter((s) => new Date(s.startedAt).getTime() <= t);
  }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((s) =>
      s.userId?.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  results = results.reverse().slice(0, opts.limit ?? 100);
  return results;
}

export async function getRecording(id: string): Promise<SessionRecording | null> {
  await hydrate();
  return _sessions.find((s) => s.id === id) ?? null;
}

export async function deleteRecording(id: string): Promise<boolean> {
  await hydrate();
  const before = _sessions.length;
  _sessions = _sessions.filter((s) => s.id !== id);
  if (_sessions.length < before) { await persist(); return true; }
  return false;
}

export async function clearRecordings(): Promise<void> {
  _sessions = [];
  await persist();
}

// ─── Replay helpers ───────────────────────────────────────────────────────────

export interface ReplayState {
  session: SessionRecording;
  cursor: number;
  currentEvent: SessionEvent | null;
  progress: number;
}

/** Returns a simple replay iterator — call next() to advance. */
export function createReplay(session: SessionRecording) {
  let cursor = 0;

  return {
    get cursor() { return cursor; },
    get progress() { return session.events.length ? cursor / session.events.length : 0; },
    get currentEvent() { return session.events[cursor - 1] ?? null; },
    get done() { return cursor >= session.events.length; },
    next() {
      if (cursor < session.events.length) cursor++;
      return session.events[cursor - 1] ?? null;
    },
    seek(index: number) {
      cursor = Math.max(0, Math.min(index, session.events.length));
    },
    reset() { cursor = 0; },
  };
}
