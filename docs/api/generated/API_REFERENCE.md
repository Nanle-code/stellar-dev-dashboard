# API Reference

This API reference is auto-generated from the `src/lib` source files and JSDoc-style comments.

Generated on: 2026-06-02T11:17:56.346Z

---

## src/lib/accountWatchSystem.ts

### `export function normalizeBalances(`

Convert a Horizon balances array into our normalized shape.

---

### `export function aggregateBalances(snapshots: AccountSnapshot[]): AggregatedInsights`

Roll balances up across every (successful) snapshot.

---

### `export function evaluateWatchRules(`

Evaluate every enabled rule against the current snapshots.

---

### `export function detectAnomalies(`

Detect anomalous balance swings between the previous and current snapshots.

---

### `export interface AccountWatchUpdate`

Run async `worker` over `items` with at most `limit` running at once.

---

### `export interface AccountWatchOptions`

Run async `worker` over `items` with at most `limit` running at once.

---

### `export class AccountWatchSystem`

Run async `worker` over `items` with at most `limit` running at once.

---

### `export const accountWatchSystem = new AccountWatchSystem()`

Shared singleton used by the React hook.

---

## src/lib/alertNotifications.ts

### `export async function requestBrowserNotificationPermission(): Promise<boolean>`

Request browser notification permission from the user

---

### `export function areBrowserNotificationsAvailable(): boolean`

Check if browser notifications are available and permitted

---

### `export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported'`

Get current browser notification permission status

---

### `export async function deliverNotification(`

Deliver a notification through the specified channels

---

### `export function createAlertNotification(`

Create an alert notification object

---

## src/lib/alertRuleEngine.ts

### `export function startRuleEngine(`

Start the rule evaluation engine

---

### `export function stopRuleEngine(): void`

Stop the rule evaluation engine

---

### `export function isEngineRunning(): boolean`

Check if the engine is currently running

---

## src/lib/alertRulesDb.js

### `export async function saveAlertRule(rule)`

Saves an alert rule to IndexedDB.

**Parameters**

| Name | Description |
| --- | --- |
| `{AlertRule}` | rule - The alert rule object to save. |

**Returns**: {Promise<string>} The ID of the saved rule.

---

### `export async function getAlertRules()`

Reads all alert rules from IndexedDB.

**Returns**: {Promise<AlertRule[]>} An array of alert rule objects.

---

### `export async function deleteAlertRule(ruleId)`

Deletes an alert rule from IndexedDB by its ID.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | ruleId - The ID of the rule to delete. |

**Returns**: {Promise<void>}

---

## src/lib/alertRulesDb.ts

### `export async function saveRule(rule: AlertRule): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function deleteRule(ruleId: string): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function getRules(userId: string): Promise<AlertRule[]>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function getEnabledRules(userId: string): Promise<AlertRule[]>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function updateRuleEvaluationTime(`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function saveNotification(notification: AlertNotification): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function getNotifications(`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function markNotificationRead(notificationId: string): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function markAllNotificationsRead(userId: string): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function deleteNotification(notificationId: string): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

### `export async function clearOldNotifications(userId: string, olderThanMs: number): Promise<void>`

IndexedDB persistence layer for Alert Rules and Notifications
Extends the existing storage pattern from src/lib/storage.js

---

## src/lib/alerts.js

### `export function evaluateAlertRules(snapshot, score)`

_No description available._

---

### `export function evaluateEventRules(incomingEvent, activeRules, watchedAccount)`

Evaluates an incoming streaming event against a collection of user-defined alert rules.

**Parameters**

| Name | Description |
| --- | --- |
| `{AccountStreamEvent}` | incomingEvent - The event received from the account stream. |
| `{AlertRule[]}` | activeRules - An array of active alert rules. |
| `{string}` | watchedAccount - The account ID being watched. |

**Returns**: {Array<object>} An array of alert payloads for violated rules.

---

### `export class AlertCenter`

Evaluates an incoming streaming event against a collection of user-defined alert rules.

**Parameters**

| Name | Description |
| --- | --- |
| `{AccountStreamEvent}` | incomingEvent - The event received from the account stream. |
| `{AlertRule[]}` | activeRules - An array of active alert rules. |
| `{string}` | watchedAccount - The account ID being watched. |

**Returns**: {Array<object>} An array of alert payloads for violated rules.

---

### `export const alertCenter = new AlertCenter()`

Evaluates an incoming streaming event against a collection of user-defined alert rules.

**Parameters**

| Name | Description |
| --- | --- |
| `{AccountStreamEvent}` | incomingEvent - The event received from the account stream. |
| `{AlertRule[]}` | activeRules - An array of active alert rules. |
| `{string}` | watchedAccount - The account ID being watched. |

**Returns**: {Array<object>} An array of alert payloads for violated rules.

---

## src/lib/alertsService.ts

### `export interface AlertPayload`

_No description available._

---

### `export async function dispatchAlert(alert: AlertPayload): Promise<boolean>`

Dispatch a single alert using the appropriate provider.
Returns true if the notification was sent successfully.

---

### `export async function dispatchAlerts(alerts: AlertPayload[]): Promise<boolean[]>`

Dispatch multiple alerts in parallel, returning an array of results.

---

## src/lib/analytics.js

### `export function summarizeBalances(accountData)`

_No description available._

---

### `export function summarizeTransactions(transactions = [], operations = [])`

_No description available._

---

### `export function buildActivityTimeseries(transactions = [], days = 14)`

_No description available._

---

### `export function summarizeNetwork(networkStats, recentLedgers = [])`

_No description available._

---

### `export function computeAverageCloseTime(ledgers = [])`

_No description available._

---

### `export function calculateRiskSignals(accountData, transactions = [])`

_No description available._

---

### `export function buildAnalyticsSnapshot(`

_No description available._

---

## src/lib/biometricAuth.ts

### `export interface BiometricOptions`

_No description available._

---

### `export async function registerBiometric(options: BiometricOptions)`

_No description available._

---

### `export async function loginBiometric()`

_No description available._

---

### `export function isBiometricSupported(): boolean`

_No description available._

---

## src/lib/cache.js

### `export const TTL =`

Intelligent Caching System

Layers:
  L1 — in-memory LRU with TTL (fast, volatile)
  L2 — IndexedDB via storage.js (persistent, survives reload)

Features:
  - Stale-while-revalidate: serve stale data immediately, refresh in background
  - Tag-based invalidation: invalidate groups of keys by tag
  - Per-key TTL overrides
  - Offline detection: skip network when offline, extend stale window
  - Cache statistics per namespace
  - Subscriber notifications on key updates

---

### `export class Cache`

Intelligent Caching System

Layers:
  L1 — in-memory LRU with TTL (fast, volatile)
  L2 — IndexedDB via storage.js (persistent, survives reload)

Features:
  - Stale-while-revalidate: serve stale data immediately, refresh in background
  - Tag-based invalidation: invalidate groups of keys by tag
  - Per-key TTL overrides
  - Offline detection: skip network when offline, extend stale window
  - Cache statistics per namespace
  - Subscriber notifications on key updates

---

### `export function isOffline()`

Subscribe to updates for a key.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | key |
| `{Function}` | cb (value) => void |

**Returns**: {Function} unsubscribe

---

### `export const persistentCache = new Cache(`

Persistent cache for account data — survives page reload

---

### `export const realtimeCache = new Cache(`

Short-lived cache for real-time data (prices, ledger)

---

## src/lib/cacheManager.ts

### `export type CacheNamespace = 'default' | 'stellar' | 'realtime' | 'soroban' | 'price'`

CacheManager — typed, two-layer cache facade.

  L1: in-memory LRU (cache.js)        — fast, volatile
  L2: IndexedDB API cache (storage.js) — persistent, survives reload

Wraps the existing JS cache primitives in a strict TypeScript surface and
routes reads through L1 → L2, with stale-while-revalidate, tag-based
invalidation, and offline awareness.

---

### `export interface CacheManagerOptions`

CacheManager — typed, two-layer cache facade.

  L1: in-memory LRU (cache.js)        — fast, volatile
  L2: IndexedDB API cache (storage.js) — persistent, survives reload

Wraps the existing JS cache primitives in a strict TypeScript surface and
routes reads through L1 → L2, with stale-while-revalidate, tag-based
invalidation, and offline awareness.

---

### `export interface CacheStatsSnapshot`

When true, every set() also writes through to IndexedDB.

---

### `export interface CacheGetResult<T>`

When true, every set() also writes through to IndexedDB.

---

### `export interface SwrOptions`

When true, every set() also writes through to IndexedDB.

---

### `export type CacheUnsubscribe = ()`

When true, force a network refresh and bypass any cached value.

---

### `export class CacheManager`

When true, force a network refresh and bypass any cached value.

---

### `export const stellarCacheManager = new CacheManager(`

Global manager used by stellar.ts and friends. Persistent so users see their
last-known account state instantly on reload, even without network.

---

### `export const realtimeCacheManager = new CacheManager(`

Short-lived prices, ledger snapshots — no persistence.

---

### `export const priceCacheManager = new CacheManager(`

Asset price cache — persistent 5-minute TTL with stale-while-revalidate.

---

### `export const sorobanCacheManager = new CacheManager(`

Soroban contract metadata — persistent because it rarely changes.

---

### `export async function getCombinedCacheStats(): Promise<`

Soroban contract metadata — persistent because it rarely changes.

---

### `export async function pruneCaches(): Promise<void>`

Run on app startup to drop expired API cache rows from IDB.

---

## src/lib/chartUtils.js

### `export const TIMEFRAME_OPTIONS = [`

Chart utility functions and formatters for Recharts components.

---

### `export function formatCompactNumber(value)`

Format a number with compact notation (e.g. 1.2K, 3.4M).

---

### `export function formatTimeAxis(timestamp)`

Format a timestamp for chart axes (HH:MM).

---

### `export function formatDateAxis(timestamp)`

Format a date for chart axes (MMM D).

---

### `export function formatXLMValue(value, decimals = 2)`

Format a number as XLM with the given decimal places.

---

### `export const CHART_COLORS =`

Shared chart theme colors that match the CSS variables.

---

### `export const TOOLTIP_STYLE =`

Shared Recharts tooltip style.

---

### `export const AXIS_TICK_STYLE =`

Shared Recharts axis tick style.

---

### `export function filterSeriesByTimeframe(data, timeframe = '30d', key = 'timestamp')`

Keep only data points that match a selected timeframe.

---

### `export function calculateSMA(data, period = 14, valueKey = 'value', outKey = 'sma')`

Calculate a simple moving average.

---

### `export function calculateEMA(data, period = 14, valueKey = 'value', outKey = 'ema')`

Calculate an exponential moving average.

---

### `export function calculateRSI(data, period = 14, valueKey = 'value', outKey = 'rsi')`

Calculate relative strength index (RSI).

---

### `export function normalizeSeriesForComparison(series = [])`

Convert multiple series into a normalized performance index (starts at 100).

---

### `export function buildCsv(rows = [])`

Convert rows into CSV.

---

### `export function exportChartDataAsCsv(rows, filename = 'chart-export.csv')`

Trigger client-side CSV download.

---

### `export function generatePlaceholderData(count, minValue = 100, maxValue = 1000)`

Generate mock data points for chart demonstrations when real data is unavailable.

---

## src/lib/config.js

### `export const DEFAULT_CONFIG =`

_No description available._

---

### `export function getEnvironmentConfig()`

_No description available._

---

### `export function loadConfigProfiles()`

_No description available._

---

### `export function saveConfigProfiles(profiles)`

_No description available._

---

### `export function getActiveProfileName()`

_No description available._

---

### `export function setActiveProfileName(name)`

_No description available._

---

### `export function upsertProfile(name, config)`

_No description available._

---

### `export function removeProfile(name)`

_No description available._

---

## src/lib/contractDevelopment.js

### `export function getContractTemplates()`

_No description available._

---

### `export function getContractTemplateById(templateId)`

_No description available._

---

### `export function buildContractWorkspace(templateId, options =`

_No description available._

---

### `export function simulateSorobanTests(sourceCode, testCode, settings =`

_No description available._

---

### `export function generateDeploymentPlan(config =`

_No description available._

---

### `export function generateWasmHash(templateId)`

Generate a deterministic WASM hash placeholder for local dev.
Real builds produce actual hashes; this stub allows UI testing.

---

### `export function exportContractSpec(templateId)`

Export a starter contract specification (JSON) for a given template.
Includes ABI-like method signatures and constructor args.

---

### `export function generateContractReadme(templateId)`

Build a downloadable README scaffold for a contract template.

---

### `export function downloadScaffold(templateId)`

Download a starter scaffold bundle (spec JSON + README + source) for a template.
Triggers a browser download of a zip-like JSON bundle.

---

## src/lib/contractInvoker.js

### `export async function parseContractWasm(contractId, network = "testnet")`

_No description available._

---

### `export async function invokeContractFunction(`

_No description available._

---

### `export function normalizeContractValue(value)`

_No description available._

---

## src/lib/deployment/ContractDeployer.ts

### `export interface DeploymentCost`

_No description available._

---

### `export interface DeploymentResult`

_No description available._

---

### `export class ContractDeployer`

_No description available._

---

## src/lib/deployment/CostEstimator.ts

### `export interface CostEstimate`

_No description available._

---

### `export class CostEstimator`

_No description available._

---

## src/lib/deployment/WASMProcessor.ts

### `export interface ScValType`

_No description available._

---

### `export class WASMProcessor`

_No description available._

---

## src/lib/dex.js

### `export async function fetchOrderBook(sellingAsset, buyingAsset, network = "testnet", limit = 20)`

_No description available._

---

### `export async function fetchTrades(baseAsset, counterAsset, network = "testnet", limit = 50)`

_No description available._

---

### `export async function fetchAllAssets(network = "testnet", limit = 200)`

_No description available._

---

### `export async function fetchLiquidityPools(network = "testnet", limit = 50, assetFilter = null)`

Fetch all AMM liquidity pools, optionally filtered by asset.

---

### `export async function fetchLiquidityPoolsByAssetPair(assetA, assetB, network = "testnet", limit = 50)`

Fetch all AMM liquidity pools, optionally filtered by asset.

---

### `export async function fetchPoolById(poolId, network = "testnet")`

Fetch a single pool by ID with full detail.

---

### `export async function fetchPoolTrades(poolId, network = "testnet", limit = 50)`

Fetch trades for a specific liquidity pool.

---

### `export async function fetchPoolOperations(poolId, network = "testnet", limit = 50)`

Fetch operations (deposits/withdrawals) for a pool.

---

### `export async function fetchAccountLiquidityPoolPositions(publicKey, network = "testnet")`

Fetch operations (deposits/withdrawals) for a pool.

---

### `export async function fetchAccountLiquidityPoolHistory(publicKey, network = "testnet", limit = 50, poolId = null)`

Fetch operations (deposits/withdrawals) for a pool.

---

### `export function enrichPool(pool)`

Add computed fields to a raw Horizon pool record.

---

### `export function estimatePoolApr(pool, volume24hUsd = 0)`

Estimate annualised fee APR from 24h trade volume.
APR = (24h_fees / TVL) * 365

Since Horizon doesn't expose 24h volume directly, we estimate from
recent trades fetched separately.

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | pool - enriched pool record |
| `{number}` | volume24hUsd - estimated 24h volume in USD (or XLM units) |

**Returns**: {{ feeApr: number, dailyFees: number }}

---

### `export function estimateImpermanentLoss(priceRatio)`

Estimate impermanent loss for a given price change ratio.

**Parameters**

| Name | Description |
| --- | --- |
| `{number}` | priceRatio - new_price / initial_price |

**Returns**: {number} IL as a percentage (negative = loss)

---

### `export function buildILCurve(steps = 20)`

Build a series of IL data points across a range of price ratios.

---

### `export function buildPoolHistorySeries(operations = [])`

Build synthetic historical TVL/volume series from pool operations.
Groups operations by day and accumulates reserve changes.

---

### `export function formatAsset(asset)`

Build synthetic historical TVL/volume series from pool operations.
Groups operations by day and accumulates reserve changes.

---

### `export function parseAssetString(assetStr)`

Build synthetic historical TVL/volume series from pool operations.
Groups operations by day and accumulates reserve changes.

---

### `export function calculateSpread(bids, asks)`

Build synthetic historical TVL/volume series from pool operations.
Groups operations by day and accumulates reserve changes.

---

### `export function aggregateOrderBookDepth(orders, levels = 10)`

Build synthetic historical TVL/volume series from pool operations.
Groups operations by day and accumulates reserve changes.

---

## src/lib/encryption.js

### `export async function encrypt(plaintext, passphrase)`

Encrypt a plaintext string with a passphrase.
Generates a fresh random IV and salt for every call.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | plaintext |
| `{string}` | passphrase |

**Returns**: {Promise<{ ciphertext: string, iv: string, salt: string }>}

---

### `export async function decrypt(ciphertext, passphrase, iv, salt)`

Decrypt data produced by `encrypt()`.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | ciphertext base64 ciphertext |
| `{string}` | passphrase |
| `{string}` | iv base64 IV |
| `{string}` | salt base64 salt |

**Returns**: {Promise<string>}

---

### `export async function generateKey()`

Generate a random 256-bit key as a base64 string.
Useful for app-level encryption that doesn't require a user passphrase.

**Returns**: {Promise<string>} base64-encoded key

---

### `export async function encryptWithKey(plaintext, rawKeyBase64)`

Encrypt using a raw base64 key (from generateKey) instead of a passphrase.
Faster — no PBKDF2 derivation.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | plaintext |
| `{string}` | rawKeyBase64 |

**Returns**: {Promise<{ ciphertext: string, iv: string }>}

---

### `export async function decryptWithKey(ciphertext, rawKeyBase64, iv)`

Decrypt using a raw base64 key (from generateKey).

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | ciphertext base64 |
| `{string}` | rawKeyBase64 |
| `{string}` | iv base64 |

**Returns**: {Promise<string>}

---

## src/lib/errorHandling.ts

### `export enum ErrorCategory`

Centralized error types and handlers for production debugging

---

### `export interface ErrorContext`

Centralized error types and handlers for production debugging

---

### `export class AppError extends Error`

Centralized error types and handlers for production debugging

---

### `export function classifyError(error: unknown): ErrorContext`

Centralized error types and handlers for production debugging

---

### `export function handleHttpError(status: number, data?: any): ErrorContext`

Centralized error types and handlers for production debugging

---

### `export async function retryWithBackoff(`

Centralized error types and handlers for production debugging

---

### `export async function safeExecute(`

Centralized error types and handlers for production debugging

---

## src/lib/errorHandling/CircuitBreaker.ts

### `export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'`

CircuitBreaker.ts — Issue #144
Circuit breaker pattern to prevent cascading failures on API calls.

States:
  CLOSED   — normal operation, requests pass through
  OPEN     — too many failures, requests are rejected immediately
  HALF_OPEN — testing if the service has recovered

---

### `export interface CircuitBreakerOptions`

CircuitBreaker.ts — Issue #144
Circuit breaker pattern to prevent cascading failures on API calls.

States:
  CLOSED   — normal operation, requests pass through
  OPEN     — too many failures, requests are rejected immediately
  HALF_OPEN — testing if the service has recovered

---

### `export class CircuitBreaker`

CircuitBreaker.ts — Issue #144
Circuit breaker pattern to prevent cascading failures on API calls.

States:
  CLOSED   — normal operation, requests pass through
  OPEN     — too many failures, requests are rejected immediately
  HALF_OPEN — testing if the service has recovered

---

### `export function getCircuitBreaker(service: string, options?: CircuitBreakerOptions): CircuitBreaker`

CircuitBreaker.ts — Issue #144
Circuit breaker pattern to prevent cascading failures on API calls.

States:
  CLOSED   — normal operation, requests pass through
  OPEN     — too many failures, requests are rejected immediately
  HALF_OPEN — testing if the service has recovered

---

## src/lib/errorHandling/ErrorHandler.ts

### `export interface ErrorHandlerOptions`

ErrorHandler.ts — Issue #144
Central error handler that integrates RetryManager, CircuitBreaker, and ErrorMessages.

---

### `export interface HandledError`

ErrorHandler.ts — Issue #144
Central error handler that integrates RetryManager, CircuitBreaker, and ErrorMessages.

---

### `export class ErrorHandler`

ErrorHandler.ts — Issue #144
Central error handler that integrates RetryManager, CircuitBreaker, and ErrorMessages.

---

### `export const errorHandler = new ErrorHandler()`

Classify and enrich an error with user-friendly details.

---

## src/lib/errorHandling/ErrorMessages.ts

### `export const ERROR_MESSAGES: Record<string,`

ErrorMessages.ts — Issue #144
User-friendly error messages keyed by category and context.

---

### `export function getErrorMessage(category: string)`

ErrorMessages.ts — Issue #144
User-friendly error messages keyed by category and context.

---

### `export const STELLAR_ERROR_CODES: Record<string, string> =`

ErrorMessages.ts — Issue #144
User-friendly error messages keyed by category and context.

---

### `export function getStellarErrorMessage(resultCode: string): string`

ErrorMessages.ts — Issue #144
User-friendly error messages keyed by category and context.

---

## src/lib/errorHandling/RetryManager.ts

### `export interface RetryOptions`

RetryManager.ts — Issue #144
Exponential backoff retry logic for API calls.

---

### `export class RetryManager`

RetryManager.ts — Issue #144
Exponential backoff retry logic for API calls.

---

### `export const retryManager = new RetryManager()`

Execute an operation with exponential backoff retry.

---

### `export interface OfflineQueueEntry`

OfflineQueue — typed wrapper around src/utils/offline.js for Horizon writes.

Usage:
  offlineQueue.enqueue('simulate:abc', () => simulateTx(xdr), 'Simulate TX')

When the network comes back the queue is flushed automatically (via the
'online' event in offline.js). Callers can also call flush() manually.

---

### `export class OfflineQueue`

OfflineQueue — typed wrapper around src/utils/offline.js for Horizon writes.

Usage:
  offlineQueue.enqueue('simulate:abc', () => simulateTx(xdr), 'Simulate TX')

When the network comes back the queue is flushed automatically (via the
'online' event in offline.js). Callers can also call flush() manually.

---

### `export const offlineQueue = new OfflineQueue()`

Singleton — import this wherever you need to queue Horizon writes.

---

## src/lib/errorReporting.ts

### `export interface ErrorReportingConfig`

_No description available._

---

### `export interface ErrorReport`

_No description available._

---

### `export interface Breadcrumb`

_No description available._

---

### `export const reportError = (error: unknown, errorInfo: Record<string, unknown> | null = null): void`

_No description available._

---

### `export const addBreadcrumb = (message: string, category = 'info', data: Record<string, unknown> =`

_No description available._

---

### `export const reportWarning = (message: string, data: Record<string, unknown> | null = null, category = 'warning'): void`

_No description available._

---

### `export const reportPerformance = (metric: string, value: number, context: Record<string, unknown> =`

_No description available._

---

### `export const initializeErrorReporting = (config: Partial<ErrorReportingConfig> =`

_No description available._

---

### `export const getErrorStats = ()`

_No description available._

---

### `export const clearErrorData = (): void`

_No description available._

---

## src/lib/externalExplorers.js

### `export const EXPLORERS =`

_No description available._

---

### `export function getAccountUrl(explorer, network, publicKey)`

_No description available._

---

### `export function getTransactionUrl(explorer, network, txHash)`

_No description available._

---

### `export function getContractUrl(explorer, network, contractId)`

_No description available._

---

### `export function getAssetUrl(explorer, network, assetCode, assetIssuer)`

_No description available._

---

### `export function getLedgerUrl(explorer, network, ledgerSeq)`

_No description available._

---

### `export function getOperationUrl(explorer, network, operationId)`

_No description available._

---

## src/lib/filters.js

### `export function applyTransactionFilters(transactions = [], filters =`

_No description available._

---

### `export function applyOperationFilters(operations = [], filters =`

_No description available._

---

### `export function applyAssetFilters(assets = [], filters =`

_No description available._

---

## src/lib/highRiskLogger.js

### `export function getHighRiskLogs()`

Retrieve the current log array from localStorage.

**Returns**: {Array<Object>} Array of log objects.

---

### `export function logApprovedHighRiskTransaction(entry)`

Append a new log entry for an approved high‑risk transaction.

**Parameters**

| Name | Description |
| --- | --- |
| `{Object}` | entry - Information about the transaction. Expected fields: { transactionId, riskLevel, riskScore, timestamp, details } |

---

### `export function clearHighRiskLogs()`

Clear all high‑risk logs (e.g., for debugging or user reset).

---

## src/lib/import.js

### `export function parseBackup(jsonString)`

Parse and validate a backup JSON string.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | jsonString - Raw file contents |

**Returns**: {{ ok: true, data: Object } | { ok: false, error: string }}

---

### `export function readFileAsText(file)`

Read a File object and return its text content as a promise.

**Parameters**

| Name | Description |
| --- | --- |
| `{File}` | file |

**Returns**: {Promise<string>}

---

### `export function validateBackupPayload(data)`

Validate that a backup payload has all required top-level keys.

**Parameters**

| Name | Description |
| --- | --- |
| `{Object}` | data - Parsed backup object |

**Returns**: {string[]}  - Array of validation error messages (empty = valid)

---

### `export function applyBackupToStore(data, store)`

Merge imported backup data into the given Zustand store.
Only whitelisted keys are applied to prevent prototype pollution.

**Parameters**

| Name | Description |
| --- | --- |
| `{Object}` | data - Validated backup payload |
| `{Object}` | store - Zustand store with setter actions |

---

## src/lib/learningHub.ts

### `export interface Tutorial`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export interface CodeExample`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export interface Quiz`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export interface QuizQuestion`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export interface QuizResult`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export interface Certificate`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export interface UserProgress`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

### `export const learningHub = new LearningHubManager()`

Learning Hub System
Manages tutorials, quizzes, certifications, and progress tracking

---

## src/lib/multisig.js

### `export const MULTISIG_STORAGE_KEY = 'stellar-multisig-sessions'`

Multi-Signature Account Management Library
Handles co-signer coordination, threshold management, and signature collection

---

### `export const SIGNER_WEIGHT =`

Multi-Signature Account Management Library
Handles co-signer coordination, threshold management, and signature collection

---

### `export const THRESHOLD_TYPE =`

Multi-Signature Account Management Library
Handles co-signer coordination, threshold management, and signature collection

---

### `export const SESSION_STATUS =`

Multi-Signature Account Management Library
Handles co-signer coordination, threshold management, and signature collection

---

### `export function isValidPublicKey(key)`

Multi-Signature Account Management Library
Handles co-signer coordination, threshold management, and signature collection

---

### `export function validateThresholds(thresholds, signers)`

Validate threshold configuration

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | thresholds - { low, medium, high } |
| `{Array}` | signers - [{ key, weight }] |

**Returns**: {{ valid: boolean, errors: string[] }}

---

### `export function parseAccountSigners(accountData)`

Parse signers and thresholds from a Horizon account response

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | accountData - Horizon AccountResponse |

**Returns**: {{ signers: Array, thresholds: object, masterWeight: number }}

---

### `export function checkThresholdMet(collectedSigners, allSigners, threshold)`

Calculate whether a set of signatures meets a threshold

**Parameters**

| Name | Description |
| --- | --- |
| `{Array}` | collectedSigners - public keys that have signed |
| `{Array}` | allSigners - [{ key, weight }] |
| `{number}` | threshold |

**Returns**: {{ met: boolean, currentWeight: number, needed: number }}

---

### `export function buildSetSignersTransaction(sourceAccount, config, network = 'testnet')`

Build a SetOptions transaction to configure multisig on an account

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | sourceAccount - Horizon AccountResponse |
| `{object}` | config - { signers: [{key, weight}], thresholds: {low, medium, high}, masterWeight } |
| `{string}` | network |

**Returns**: {StellarSdk.Transaction}

---

### `export function addSignatureToXdr(txXdr, signerSecret, network = 'testnet')`

Add a signature (decorated) to a transaction XDR

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | txXdr - base64 XDR of the transaction |
| `{string}` | signerSecret - secret key of the signer |
| `{string}` | network |

**Returns**: {string} new XDR with signature appended

---

### `export function addRawSignatureToXdr(txXdr, publicKey, signatureHex, network = 'testnet')`

Add a raw signature (sig + hint) to a transaction XDR without needing the secret key
Used when a co-signer provides their signature externally

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | txXdr |
| `{string}` | publicKey |
| `{string}` | signatureHex - hex-encoded signature bytes |
| `{string}` | network |

**Returns**: {string} new XDR

---

### `export function getSignersFromXdr(txXdr, network = 'testnet')`

Get the list of public keys that have already signed a transaction XDR

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | txXdr |
| `{string}` | network |

**Returns**: {string[]} public keys

---

### `export async function submitMultisigTransaction(txXdr, network = 'testnet')`

Submit a fully-signed transaction to the network

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | txXdr |
| `{string}` | network |

**Returns**: {Promise<object>} Horizon submit result

---

### `export function loadSessions()`

Load all multisig sessions from localStorage

**Returns**: {object[]}

---

### `export function saveSessions(sessions)`

Save sessions to localStorage

**Parameters**

| Name | Description |
| --- | --- |
| `{object[]}` | sessions |

---

### `export function createSession(`

Create a new signature collection session

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | params |

**Returns**: {object} session

---

### `export function updateSession(id, updates)`

Update a session by id

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | id |
| `{object}` | updates |

**Returns**: {object|null} updated session

---

### `export function deleteSession(id)`

Delete a session by id

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | id |

---

### `export function addSignatureToSession(sessionId, signerKey, signedXdr)`

Add a collected signature to a session

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | sessionId |
| `{string}` | signerKey - public key |
| `{string}` | signedXdr - XDR with this signer's signature added |

**Returns**: {object|null} updated session

---

## src/lib/multisig/MultiSigTransaction.ts

### `export class MultiSigTransaction`

_No description available._

---

## src/lib/multisig/SigningCoordinator.ts

### `export class SigningCoordinator`

_No description available._

---

## src/lib/multisig/ThresholdCalculator.ts

### `export class ThresholdCalculator`

_No description available._

---

## src/lib/networkMonitoring.js

### `export const PRIMARY_VALIDATORS = [`

Telemetry and network monitoring service for Stellar.
Processes Horizon network state, fee distributions, and ledger closed-intervals
to compute advanced diagnostics, congestion load, fee predictions, and validator performance.

---

### `export const LEDGER_OPERATION_LIMIT = 1000`

Telemetry and network monitoring service for Stellar.
Processes Horizon network state, fee distributions, and ledger closed-intervals
to compute advanced diagnostics, congestion load, fee predictions, and validator performance.

---

### `export const LEDGER_BASE_RESERVE_STROOPS = 5000000`

Telemetry and network monitoring service for Stellar.
Processes Horizon network state, fee distributions, and ledger closed-intervals
to compute advanced diagnostics, congestion load, fee predictions, and validator performance.

---

### `export function calculateCongestion(latestLedger)`

Calculates network congestion metrics from the latest ledger information

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | latestLedger - Horizon ledger record |

**Returns**: {object} Congestion index details

---

### `export function getLiveValidatorStatus()`

Generates interactive live validator statuses with simulated real-time jitter/pings

**Returns**: {Array} Validator status array

---

### `export function predictFees(feeStats, congestionRatio = 0.1)`

Computes fee predictions for varying urgency levels based on Horizon feeStats and congestion

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | feeStats - Horizon feeStats response |
| `{number}` | congestionRatio - Calculated congestion occupancy ratio |

**Returns**: {object} Recommended priority fees

---

### `export function calculatePerformanceMetrics(ledger, closeTime = 5.0)`

Calculates current network-wide TPS and OPS averages

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | ledger - Current Horizon ledger |
| `{number}` | closeTime - Time took to close this ledger in seconds |

**Returns**: {object} Computed metrics

---

## src/lib/notificationChannels.js

### `export const NOTIFICATION_CHANNEL =`

_No description available._

---

### `export async function sendEmail(payload)`

Send an email notification.

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | payload - { to, subject, body } |

---

### `export async function sendWebhook(payload)`

Send a webhook POST request.

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | payload - { url, data } |

---

### `export async function sendSMS(payload)`

Send an SMS notification.

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | payload - { to, message } |

---

## src/lib/notifications.js

### `export const NOTIFICATION_TYPES =`

_No description available._

---

### `export const NOTIFICATION_DEFAULT_TIMEOUT = 5000`

_No description available._

---

### `export const generateId = ()`

_No description available._

---

### `export const playSound = (type)`

_No description available._

---

## src/lib/performance.ts

### `export function initPerformanceMonitoring(userConfig: PerfConfig =`

_No description available._

---

## src/lib/performanceMonitoring.js

### `export const PERFORMANCE_BUDGETS =`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function initPerformanceMonitoring()`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function recordCustomMetric(name, value, metadata =`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function recordUserInteraction(action, metadata =`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function measurePerformance(name, fn, metadata =`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export async function measureAsync(name, asyncFn, metadata =`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function mark(name)`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function measure(name, startMark, endMark)`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function getAllMetrics()`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function getMetricsSummary()`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function clearMetrics()`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function getPerformanceScore()`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function usePerformanceMonitor(componentName)`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function getBundleAnalysis()`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function formatBytes(bytes)`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

### `export function formatMs(ms)`

Privacy-preserving performance monitoring.
Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
and optional production delivery to a configured monitoring endpoint.

---

## src/lib/portfolioAnalytics.js

### `export function calculateAssetAllocation(portfolioItems)`

Calculate asset allocation percentages

**Parameters**

| Name | Description |
| --- | --- |
| `{Array}` | portfolioItems - Array of { code, valueUsd, amount } |

**Returns**: {Array} Items with allocation percentage

---

### `export function calculateDiversificationScore(portfolioItems)`

Calculate diversification score (0-100)
Higher score = more diversified
Uses Herfindahl-Hirschman Index (HHI)

---

### `export function identifyConcentrationRisks(portfolioItems)`

Identify concentration risk (assets > 25% allocation)

---

### `export function calculatePerformanceMetrics(currentValue, previousValue)`

Calculate portfolio performance metrics

**Parameters**

| Name | Description |
| --- | --- |
| `{number}` | currentValue - Current portfolio value |
| `{number}` | previousValue - Previous portfolio value (24h ago) |

**Returns**: {Object} Performance metrics

---

### `export function calculate24hPortfolioChange(portfolioItems)`

Calculate 24h portfolio change based on individual asset changes

---

### `export async function fetchHistoricalPerformance(server, accountId, currentBalances, days = 30)`

Reconstructs historical running balances by parsing account effects backwards.
Handles sequential page token parsing and network history truncation rules.

**Parameters**

| Name | Description |
| --- | --- |
| `{Object}` | server - Horizon server instance |
| `{string}` | accountId - Stellar account ID |
| `{Object}` | currentBalances - Current balances { assetCode: amount } |
| `{number}` | days - Timeline window (e.g. 30, 90) |

**Returns**: {Array} Snapshot series

---

### `export function calculateVolatility(historicalData)`

Calculate portfolio volatility (standard deviation of returns)

**Parameters**

| Name | Description |
| --- | --- |
| `{Array}` | historicalData - Array of { value, timestamp } |

**Returns**: {number} Volatility percentage

---

### `export function calculateSharpeRatio(portfolioReturn, volatility, riskFreeRate = 4)`

Calculate Sharpe Ratio (risk-adjusted return)

**Parameters**

| Name | Description |
| --- | --- |
| `{number}` | portfolioReturn - Portfolio return percentage |
| `{number}` | volatility - Portfolio volatility |
| `{number}` | riskFreeRate - Risk-free rate (default 4% annual) |

**Returns**: {number} Sharpe ratio

---

### `export function assessPortfolioRisk(metrics)`

Assess overall portfolio risk level

**Parameters**

| Name | Description |
| --- | --- |
| `{Object}` | metrics - { volatility, diversificationScore, concentrationRisks } |

**Returns**: {Object} { level: 'low'|'medium'|'high', score: 0-100, factors: [] }

---

### `export function calculateAssetPnL(portfolioItems, costBasis =`

Calculate profit/loss for individual assets

**Parameters**

| Name | Description |
| --- | --- |
| `{Array}` | portfolioItems - Current portfolio items |
| `{Object}` | costBasis - Map of { assetCode: averageCost } |

**Returns**: {Array} Items with P&L data

---

### `export function calculateTotalPnL(portfolioItemsWithPnL)`

Calculate total portfolio P&L

---

### `export function calculateCorrelation(asset1Data, asset2Data)`

Calculate correlation between two assets

**Parameters**

| Name | Description |
| --- | --- |
| `{Array}` | asset1Data - Historical prices for asset 1 |
| `{Array}` | asset2Data - Historical prices for asset 2 |

**Returns**: {number} Correlation coefficient (-1 to 1)

---

### `export function calculateRebalancingActions(currentAllocation, targetAllocation, totalValue)`

Calculate rebalancing recommendations

**Parameters**

| Name | Description |
| --- | --- |
| `{Array}` | currentAllocation - Current portfolio allocation |
| `{Object}` | targetAllocation - Target allocation percentages { assetCode: percentage } |
| `{number}` | totalValue - Total portfolio value |

**Returns**: {Array} Rebalancing actions

---

### `export function generatePortfolioSummary(portfolioItems, historicalData = [])`

Generate comprehensive portfolio summary

---

## src/lib/priceFeed.js

### `export async function fetchPrices(assetCodes = ['XLM'], options =`

Fetch current prices for a list of asset codes.
Returns an object keyed by asset code with { usd, usd_24h_change } values.

---

### `export async function fetchXLMPrice(options =`

Fetch the XLM price only (most common use case).

---

### `export function calculatePortfolioValue(balances, prices)`

Calculate portfolio value in USD from account balances and prices.

---

### `export async function refreshPrices(assetCodes = ['XLM'], currency = 'usd')`

Calculate portfolio value in USD from account balances and prices.

---

### `export async function clearPriceCache()`

Calculate portfolio value in USD from account balances and prices.

---

## src/lib/region.ts

### `export type Region = 'global' | 'europe' | 'north_america' | 'asia' | 'custom'`

_No description available._

---

### `export const REGION_NETWORK_MAP: Record<Region,`

_No description available._

---

### `export function resolveRegionNetwork(region: Region): string`

Resolve the Stellar network configuration for a given region.
Returns a NetworkName that can be used with the existing getServer / getSorobanServer functions.

---

### `export async function fetchLocalFiatRates(`

Fetch local fiat exchange rates for XLM using CoinGecko.
Supports multiple fiat currencies (e.g. USD, EUR, JPY).
Returns a map of fiat -> rate.

---

## src/lib/riskWhitelist.js

### `export const whitelist = loadWhitelist()`

_No description available._

---

### `export function isWhitelistedAddress(address)`

Returns true if the address is in the whitelist.

---

### `export function addWhitelistedAddress(address)`

Adds an address to the whitelist and persists it.

---

### `export function removeWhitelistedAddress(address)`

Removes an address from the whitelist.

---

## src/lib/searchEngine.ts

### `export class SearchEngine`

_No description available._

---

## src/lib/securityEvents.js

### `export const SecurityEventType = Object.freeze(`

Security Event Tracking (#118)

High-level helpers that record security-significant events into the
audit trail and run lightweight anomaly detection (failed-auth bursts,
rate-limit exhaustion, unusual transaction values).

---

### `export function subscribeSecurityAlerts(handler)`

Security Event Tracking (#118)

High-level helpers that record security-significant events into the
audit trail and run lightweight anomaly detection (failed-auth bursts,
rate-limit exhaustion, unusual transaction values).

---

### `export function trackSecurityEvent(eventType, opts =`

Record a security-significant event.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | eventType one of SecurityEventType |
| `{{` | actor?: string, target?: string, outcome?: 'success'|'failure'|'denied', metadata?: Record<string, unknown>, severityOverride?: string, }} [opts] |

**Returns**: {Promise<object>}

---

### `export function installSecurityEventListeners()`

Record a security-significant event.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | eventType one of SecurityEventType |
| `{{` | actor?: string, target?: string, outcome?: 'success'|'failure'|'denied', metadata?: Record<string, unknown>, severityOverride?: string, }} [opts] |

**Returns**: {Promise<object>}

---

## src/lib/stellar.ts

### `export function getSimulationFeeOptions(`

_No description available._

---

### `export type NetworkName = 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom'`

_No description available._

---

### `export interface NetworkConfig`

_No description available._

---

### `export const NETWORKS: Record<NetworkName, NetworkConfig> =`

_No description available._

---

### `export function getCustomNetworkAuthHeaders(): Record<string, string>`

_No description available._

---

### `export function getNetworkDetails(network: NetworkName): NetworkConfig`

_No description available._

---

### `export function updateCustomNetworkConfig(config: Partial<NetworkConfig>)`

_No description available._

---

### `export async function switchToCustomProfile(profileId: string): Promise<void>`

Switch to a custom network profile (Issue #188).
Updates NETWORKS.custom with profile data and creates new clients.

---

### `export async function loadCustomNetworkProfiles()`

Load profiles from storage and return them (Issue #188).

---

### `export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server`

Load profiles from storage and return them (Issue #188).

---

### `export const ee = getServer`

Load profiles from storage and return them (Issue #188).

---

### `export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.SorobanRpc.Server`

Load profiles from storage and return them (Issue #188).

---

### `export type ProbeStatus = 'up' | 'degraded' | 'down'`

Load profiles from storage and return them (Issue #188).

---

### `export interface ServiceProbeResult`

Load profiles from storage and return them (Issue #188).

---

### `export interface NetworkProbeResult`

Load profiles from storage and return them (Issue #188).

---

### `export async function probeAllNetworks(): Promise<NetworkProbeResult[]>`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchAccount(`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchTransactions(`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchOperations(`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchAccountOffers(`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchTransactionDetails(`

Load profiles from storage and return them (Issue #188).

---

### `export const OPERATION_LABELS: Record<string, string> =`

Load profiles from storage and return them (Issue #188).

---

### `export function getOperationLabel(type: string): string`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchAccountCreationDate(`

Load profiles from storage and return them (Issue #188).

---

### `export function streamLedgers(`

Load profiles from storage and return them (Issue #188).

---

### `export interface NetworkStats`

Load profiles from storage and return them (Issue #188).

---

### `export interface AccountReserves`

Load profiles from storage and return them (Issue #188).

---

### `export async function fetchNetworkStats(network: NetworkName = 'testnet'): Promise<NetworkStats>`

Load profiles from storage and return them (Issue #188).

---

### `export function calculateAccountReserves(`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface XLMPrice`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface AssetPriceEstimate`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface AssetBalanceLike`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export async function fetchXLMPrice(): Promise<XLMPrice>`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export async function fetchAssetPrice(`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export async function fundTestnetAccount(publicKey: string): Promise<unknown>`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export async function fetchContractInfo(`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface ContractInvocationArg`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface SerializedLedgerKey`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface SerializedContractEvent`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface ContractSimulationResult`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export interface ContractSubmitResult`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export async function simulateContractCall(`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export async function invokeContract(params: InvokeContractParams): Promise<ContractSubmitResult>`

Calculate account reserves based on Stellar network base reserve

**Parameters**

| Name | Description |
| --- | --- |
| `accountData` | - Account response from Horizon |
| `networkStats` | - Network stats containing ledger with base_reserve |
| `offerCount` | - Number of open offers (optional, defaults to 0) |

**Returns**: AccountReserves object with breakdown of all reserves

---

### `export function isValidEd25519PublicKey(key: string): boolean`

Check if address is a valid Ed25519 public key (G...)

---

### `export function isValidMuxedAccount(key: string): boolean`

Check if address is a valid muxed account (M...)

---

### `export function isFederatedAddress(input: string): boolean`

Check if address is a federated address (name*domain or name

---

### `export function parseMuxedAccount(`

Extract master account and muxed ID from a muxed address

---

### `export async function resolveFederatedAddress(`

Resolve a federated address to a Stellar account via Horizon federation endpoint

---

### `export interface ResolvedAddress`

Comprehensive address resolver
Accepts: G... (Ed25519), M... (muxed), or name*domain (federated)
Returns: master account ID, muxed ID (if applicable), and original input info

---

### `export async function resolveAddress(`

Comprehensive address resolver
Accepts: G... (Ed25519), M... (muxed), or name*domain (federated)
Returns: master account ID, muxed ID (if applicable), and original input info

---

### `export function isValidPublicKey(key: string): boolean`

Validate any supported address format (legacy function name for backward compatibility)

---

### `export function isValidContractId(id: string): boolean`

Validate any supported address format (legacy function name for backward compatibility)

---

### `export interface ClaimableBalanceRecord`

Validate any supported address format (legacy function name for backward compatibility)

---

### `export function formatClaimPredicate(predicate: Record<string, unknown>): string`

Human-readable summary of a claimant predicate.

---

### `export async function fetchClaimableBalances(`

Human-readable summary of a claimant predicate.

---

### `export function formatXLM(amount: string | number): string`

Human-readable summary of a claimant predicate.

---

### `export function shortAddress(addr: string | null | undefined, chars = 6): string`

Human-readable summary of a claimant predicate.

---

### `export type OperationType = 'payment' | 'createAccount'`

Human-readable summary of a claimant predicate.

---

### `export interface PaymentOperation`

Human-readable summary of a claimant predicate.

---

### `export interface CreateAccountOperation`

Human-readable summary of a claimant predicate.

---

### `export interface InvokeHostFunctionOperation`

Human-readable summary of a claimant predicate.

---

### `export type BuilderOperation =`

Human-readable summary of a claimant predicate.

---

### `export interface TimeBounds`

Human-readable summary of a claimant predicate.

---

### `export interface BuildTransactionParams`

Human-readable summary of a claimant predicate.

---

### `export async function buildTransaction(`

Human-readable summary of a claimant predicate.

---

### `export interface SimulateResult`

Human-readable summary of a claimant predicate.

---

### `export async function simulateTransaction(params: BuildTransactionParams): Promise<SimulateResult>`

Human-readable summary of a claimant predicate.

---

### `export interface SimulationWhatIfScenario`

Human-readable summary of a claimant predicate.

---

### `export interface SimulationFeeOption`

Human-readable summary of a claimant predicate.

---

### `export interface ExecutionTraceStep`

Human-readable summary of a claimant predicate.

---

### `export interface AdvancedSimulationParams extends BuildTransactionParams`

Human-readable summary of a claimant predicate.

---

### `export interface AdvancedSimulationReport`

Human-readable summary of a claimant predicate.

---

### `export function optimizeTransactionFee(`

Human-readable summary of a claimant predicate.

---

### `export function scoreTransactionSuccess(`

Human-readable summary of a claimant predicate.

---

### `export function buildExecutionTrace(`

Human-readable summary of a claimant predicate.

---

### `export async function runAdvancedTransactionSimulation(`

Human-readable summary of a claimant predicate.

---

### `export async function exportTransactionXDR(params: BuildTransactionParams): Promise<string>`

Human-readable summary of a claimant predicate.

---

### `export type PathPaymentMode = 'strict-send' | 'strict-receive'`

Human-readable summary of a claimant predicate.

---

### `export interface PathAsset`

Human-readable summary of a claimant predicate.

---

### `export interface PaymentPathRecord`

Human-readable summary of a claimant predicate.

---

### `export interface FetchPaymentPathsParams`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface LiquidityPoolReserve`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface LiquidityPoolRecord`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface LiquidityPoolPosition`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export async function fetchLiquidityPools(`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export function fetchLiquidityPoolsByAssetPair(`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export function fetchLiquidityPoolById(`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export async function fetchLiquidityPoolOperations(`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export async function fetchAccountLiquidityPoolPositions(`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export async function fetchAccountLiquidityPoolHistory(`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface AssetInfo`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface AssetStats`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface AssetMarketData`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface TradingPair`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface IssuerInfo`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface AssetSearchFilters`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export interface TrustlineRecommendation`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export const POPULAR_ASSETS: AssetInfo[] = [`

Slippage % vs best path — annotated client-side, not from Horizon

---

### `export async function fetchAssets(`

Fetch all assets from Horizon

---

### `export async function fetchAssetStats(`

Fetch detailed asset statistics

---

### `export async function fetchIssuerInfo(`

Fetch issuer information from stellar.toml

---

### `export async function getTrustlineRecommendations(`

Get trustline recommendations for an account

---

### `export async function searchAssets(`

Search assets with advanced filtering

---

### `export async function fetchAssetMarketData(`

Get asset market data (mock implementation - would integrate with real price APIs)

---

### `export async function fetchPaymentPaths(`

Get asset market data (mock implementation - would integrate with real price APIs)

---

### `export function clearCache(pattern: string | null = null)`

Clear cache for specific pattern

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | pattern - Key pattern to clear |

---

### `export function getCacheStats()`

Get cache statistics

**Returns**: {object} Cache stats

---

## src/lib/storage.js

### `export async function getStoredValue(key)`

Persistent Storage Layer — IndexedDB with localStorage fallback

Provides:
  - getStoredValue / setStoredValue / removeStoredValue / clearStorage
  - getCachedApiResponse / setCachedApiResponse  (TTL-aware API cache in IDB)
  - getOfflineQueue / enqueueOfflineOp / dequeueOfflineOp  (offline write queue)
  - storageStats  (size estimates)

---

### `export async function setStoredValue(key, value)`

Persistent Storage Layer — IndexedDB with localStorage fallback

Provides:
  - getStoredValue / setStoredValue / removeStoredValue / clearStorage
  - getCachedApiResponse / setCachedApiResponse  (TTL-aware API cache in IDB)
  - getOfflineQueue / enqueueOfflineOp / dequeueOfflineOp  (offline write queue)
  - storageStats  (size estimates)

---

### `export async function removeStoredValue(key)`

Persistent Storage Layer — IndexedDB with localStorage fallback

Provides:
  - getStoredValue / setStoredValue / removeStoredValue / clearStorage
  - getCachedApiResponse / setCachedApiResponse  (TTL-aware API cache in IDB)
  - getOfflineQueue / enqueueOfflineOp / dequeueOfflineOp  (offline write queue)
  - storageStats  (size estimates)

---

### `export async function clearStorage()`

Persistent Storage Layer — IndexedDB with localStorage fallback

Provides:
  - getStoredValue / setStoredValue / removeStoredValue / clearStorage
  - getCachedApiResponse / setCachedApiResponse  (TTL-aware API cache in IDB)
  - getOfflineQueue / enqueueOfflineOp / dequeueOfflineOp  (offline write queue)
  - storageStats  (size estimates)

---

### `export async function getCachedApiResponse(key)`

Read a cached API response. Returns null if missing or expired.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | key |

**Returns**: {Promise<*|null>}

---

### `export async function setCachedApiResponse(key, value, ttl, tag = '')`

Write an API response to the persistent cache.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | key |
| `{*}` | value |
| `{number}` | ttl TTL in ms |
| `{string}` | [tag] Optional tag for group invalidation |

---

### `export async function deleteCachedApiResponse(key)`

Delete a single API cache entry.

---

### `export async function invalidateCacheByTag(tag)`

Invalidate all API cache entries with a given tag.

---

### `export async function pruneExpiredApiCache()`

Remove all expired API cache entries.

---

### `export async function enqueueOfflineOp(op)`

Add an operation to the offline queue (e.g. a transaction to submit later).

**Parameters**

| Name | Description |
| --- | --- |
| `{{` | type: string, payload: * }} op |

---

### `export async function getOfflineQueue()`

Read all queued offline operations.

**Returns**: {Promise<Array>}

---

### `export async function dequeueOfflineOp(id)`

Remove a processed operation from the queue by its auto-increment id.

**Parameters**

| Name | Description |
| --- | --- |
| `{number}` | id |

---

### `export async function clearOfflineQueue()`

Clear the entire offline queue.

---

### `export async function addContractInteraction(record)`

Clear the entire offline queue.

---

### `export async function getContractInteractions(filters =`

Clear the entire offline queue.

---

### `export async function clearContractInteractions()`

Clear the entire offline queue.

---

### `export async function storageStats()`

Estimate the number of entries in each store.

**Returns**: {Promise<{ appState: number, apiCache: number, offlineQueue: number }>}

---

### `export async function setEncryptedValue(key, plaintext, passphrase)`

Store a value encrypted with a passphrase.
The stored record contains { ciphertext, iv, salt } — no plaintext is persisted.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | key |
| `{string}` | plaintext String value to encrypt (JSON.stringify objects first) |
| `{string}` | passphrase User-provided passphrase |

---

### `export async function getEncryptedValue(key, passphrase)`

Retrieve and decrypt a value stored with setEncryptedValue.
Returns null if the key doesn't exist.
Throws if the passphrase is wrong or data is corrupted.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | key |
| `{string}` | passphrase |

**Returns**: {Promise<string|null>}

---

### `export async function removeEncryptedValue(key)`

Remove an encrypted value.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | key |

---

## src/lib/store.ts

### `export interface SearchFilters`

_No description available._

---

### `export interface ComparisonSlot`

_No description available._

---

### `export interface Notification`

_No description available._

---

### `export interface StreamLedger`

_No description available._

---

### `export const DEFAULT_SEARCH_FILTERS: SearchFilters =`

_No description available._

---

### `export interface StoreState`

_No description available._

---

### `export const useStore = create<StoreState>((set, get)`

_No description available._

---

### `export const useStore = create<StoreState>((set, get)`

_No description available._

---

## src/lib/streaming.js

### `export const ledgerStreamManager = new StreamManager()`

Shared stream manager instance.  Components attach/detach subscribers
without creating multiple HTTP connections.

---

### `export function connectLedgerStream(network, onLedger, onStatus)`

Connect the shared manager to `network`, register ledger and status
callbacks, and return a cleanup function that removes the callbacks and
disconnects the stream.

Designed to be called inside a React useEffect:

  useEffect(() => connectLedgerStream(network, onLedger, onStatus), [network])

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | network |
| `{(ledger:` | object) => void} onLedger |
| `{(status:` | string) => void} onStatus |

**Returns**: {() => void} cleanup

---

## src/lib/templateLibrary.ts

### `export interface TransactionTemplate`

Transaction Builder Templates Library
Pre-built templates for common Stellar operations with community contributions

---

### `export interface TemplateOperation`

Transaction Builder Templates Library
Pre-built templates for common Stellar operations with community contributions

---

### `export interface TemplateParameter`

Transaction Builder Templates Library
Pre-built templates for common Stellar operations with community contributions

---

### `export interface TemplateRating`

Transaction Builder Templates Library
Pre-built templates for common Stellar operations with community contributions

---

### `export interface UserTemplate`

Transaction Builder Templates Library
Pre-built templates for common Stellar operations with community contributions

---

### `export const templateLibrary = new TemplateLibraryManager()`

Transaction Builder Templates Library
Pre-built templates for common Stellar operations with community contributions

---

## src/lib/templateManager.ts

### `export interface TemplateConstructorParam`

templateManager.ts — Issue #148
Manages Soroban smart contract templates: listing, loading, deploying.

---

### `export interface ContractTemplate`

templateManager.ts — Issue #148
Manages Soroban smart contract templates: listing, loading, deploying.

---

### `export const CONTRACT_TEMPLATES: ContractTemplate[] = [`

Simulated WASM size in bytes

---

### `export function getTemplate(id: string): ContractTemplate | undefined`

Simulated WASM size in bytes

---

### `export function getTemplatesByCategory(category: ContractTemplate['category']): ContractTemplate[]`

Simulated WASM size in bytes

---

### `export function getAllTemplates(): ContractTemplate[]`

Simulated WASM size in bytes

---

### `export function buildTemplateSource(template: ContractTemplate): string`

Build a Rust-like source scaffold for a given template.
This is a human-readable preview — not compilable WASM.

---

### `export interface DeploymentConfig`

Generate a one-click deployment config for a template.

---

### `export function buildDeploymentConfig(`

Generate a one-click deployment config for a template.

---

## src/lib/thresholds.js

### `export const THRESHOLDS =`

_No description available._

---

## src/lib/transactionBuilder.js

### `export const OPERATION_TYPES = [`

_No description available._

---

### `export function createOperation(type, params)`

_No description available._

---

### `export async function buildTransaction(`

_No description available._

---

### `export async function simulateTransaction(params)`

_No description available._

---

### `export function feeBump(`

Build a fee-bump transaction wrapping a signed inner transaction.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | feeSource - The account paying the fee-bump fee (must be a valid public key) |
| `{string}` | baseFee - The fee per operation in stroops (must be positive) |
| `{string}` | innerTransaction - The signed inner transaction as XDR envelope string |
| `{string}` | network - The network name (testnet, mainnet, futurenet, local) |

**Returns**: {FeeBumpTransaction} The fee-bump transaction envelope

---

### `export async function signAndSubmitTransaction(`

Build a fee-bump transaction wrapping a signed inner transaction.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | feeSource - The account paying the fee-bump fee (must be a valid public key) |
| `{string}` | baseFee - The fee per operation in stroops (must be positive) |
| `{string}` | innerTransaction - The signed inner transaction as XDR envelope string |
| `{string}` | network - The network name (testnet, mainnet, futurenet, local) |

**Returns**: {FeeBumpTransaction} The fee-bump transaction envelope

---

## src/lib/transactionNotifications.ts

### `export interface TransactionNotification`

Transaction Real-Time Notification System (#295)

Integrates with Stellar's streaming API to provide real-time notifications
for incoming transactions on monitored accounts. Supports mainnet and testnet
with automatic network switching.

Features:
- Real-time updates via Stellar Horizon SSE API
- Toast notifications for new transactions
- Optional sound alerts
- Notification history panel (10+ notifications retained)
- Network-aware (mainnet/testnet)

---

### `export const transactionNotificationStore = new TransactionNotificationStore()`

Export notifications as CSV

---

## src/lib/transactionSigningAuditLog.ts

### `export interface SigningAuditEntry`

Transaction Signing Audit Log (#310)

Comprehensive audit log for all transaction signing operations.
Provides security/compliance tracking with timestamp, user tracking,
signing status, and export capabilities.

Features:
- Log all signing operations (approved/rejected)
- Timestamp and user tracking
- Tamper-proof implementation using hashing
- Export to JSON/CSV formats
- Query and filtering capabilities

---

### `export const transactionSigningAuditLog = new TransactionSigningAuditLog()`

Get entry count

---

## src/lib/transactionTemplateVault.ts

### `export interface TransactionTemplateOperation`

_No description available._

---

### `export interface TransactionTemplate`

_No description available._

---

### `export interface EncryptedTemplateExportFileV1`

_No description available._

---

### `export function getCachedUserTransactionTemplates(): TransactionTemplate[]`

_No description available._

---

### `export function clearCachedUserTransactionTemplates()`

_No description available._

---

### `export async function loadUserTransactionTemplates(passphrase: string): Promise<TransactionTemplate[]>`

_No description available._

---

### `export async function saveUserTransactionTemplates(`

_No description available._

---

### `export async function upsertUserTransactionTemplate(`

_No description available._

---

### `export async function deleteUserTransactionTemplate(passphrase: string, id: string): Promise<void>`

_No description available._

---

### `export async function exportUserTemplatesEncryptedFile(`

_No description available._

---

### `export async function importUserTemplatesEncryptedFile(`

_No description available._

---

## src/lib/transactionTemplates.js

### `export const TRANSACTION_TEMPLATES = [`

Pre-built transaction templates (#111).

Each template provides a human-readable description, a list of
default operation parameters, and field-level documentation so
the Builder UI can render the right form fields automatically.

---

### `export function getTemplate(id)`

Look up a template by id.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | id |

**Returns**: {Object|undefined}

---

### `export function cloneTemplate(id)`

Deep-clone a template so edits don't mutate the original.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | id |

**Returns**: {Object|null}

---

## src/lib/transactionVerification.js

### `export const RISK_LEVELS =`

Risk levels

---

### `export async function verifyTransaction(`

Verify transaction and calculate risk score

**Parameters**

| Name | Description |
| --- | --- |
| `{object}` | transaction - Transaction object or XDR |
| `{string}` | network - Network (mainnet/testnet) |
| `{string}` | sourceAccount - Source account public key |

**Returns**: {Promise<object>} Verification result

---

### `export function isKnownScamAddress(address)`

Quick scam check for address

---

### `export function reportScamAddress(address, reason = "")`

Add address to scam list (for user reporting)

---

### `export async function analyzeAccountActivity(publicKey, network = "testnet")`

Analyze account for suspicious activity

---

## src/lib/tutorialSystem.js

### `export const TOURS =`

Tutorial System — manages guided tours, step state, and contextual help

---

### `export const HELP_ENTRIES =`

Tutorial System — manages guided tours, step state, and contextual help

---

### `export const tutorialSystem =`

Tutorial System — manages guided tours, step state, and contextual help

---

## src/lib/userPreferences.ts

### `export interface AddressEntry`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export interface WidgetLayout`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export interface NetworkProfile`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export interface UserPreferences`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export const DEFAULT_PREFERENCES: UserPreferences =`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export async function loadPreferences(): Promise<UserPreferences>`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export async function savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences>`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export async function updatePreference<K extends keyof UserPreferences>(`

userPreferences.ts — Issue #142, #188, #198
User preferences schema, defaults, and persistence helpers.
Custom network profiles support for multiple Horizon/RPC presets.

---

### `export async function saveDashboardLayout(layout: WidgetLayout[]): Promise<UserPreferences>`

Persists the modified dashboard layout state array.

---

### `export async function getDashboardLayout(): Promise<WidgetLayout[]>`

Retrieves the current dashboard layout array.

---

### `export async function addSavedAddress(entry: Omit<AddressEntry, 'addedAt'>): Promise<UserPreferences>`

Retrieves the current dashboard layout array.

---

### `export async function removeSavedAddress(address: string): Promise<UserPreferences>`

Retrieves the current dashboard layout array.

---

### `export async function loadNetworkProfiles(): Promise<NetworkProfile[]>`

Load all custom network profiles.

---

### `export async function saveNetworkProfile(profile: Omit<NetworkProfile, 'createdAt' | 'updatedAt' | 'id'> &`

Save a new or updated network profile.

**Parameters**

| Name | Description |
| --- | --- |
| `profile` | Profile to save (if no id, one is generated) |

**Returns**: The saved profile with id and timestamps

---

### `export async function deleteNetworkProfile(profileId: string): Promise<void>`

Delete a network profile by ID.

---

### `export async function getNetworkProfile(profileId: string): Promise<NetworkProfile | null>`

Get a specific profile by ID.

---

### `export async function getActiveProfile(): Promise<NetworkProfile | null>`

Get the active profile.

---

### `export async function setActiveProfile(profileId: string): Promise<void>`

Set the active profile.

---

### `export async function resetPreferences(): Promise<UserPreferences>`

Set the active profile.

---

## src/lib/validation.ts

### `export interface ValidationResult`

Input validation schemas (#106)

Lightweight runtime validators for all user-supplied inputs.
No external schema library required — pure TypeScript functions.

---

### `export function validateStellarAddress(value: unknown): ValidationResult`

Validate a Stellar public key (G…), muxed account (M…), or federated address (name*domain).

---

### `export function validateAmount(`

Validate a payment amount string.

**Parameters**

| Name | Description |
| --- | --- |
| `min` | Minimum allowed value (default 0.0000001 — one stroop) |
| `max` | Maximum allowed value (default unlimited) |

---

### `export function validateMemo(value: unknown): ValidationResult`

Validate a transaction memo (text type, max 28 bytes UTF-8).

---

### `export function validateContractId(value: unknown): ValidationResult`

Validate a transaction memo (text type, max 28 bytes UTF-8).

---

### `export type NetworkName = (typeof VALID_NETWORKS)[number]`

Validate a transaction memo (text type, max 28 bytes UTF-8).

---

### `export function validateNetwork(value: unknown): ValidationResult`

Validate a transaction memo (text type, max 28 bytes UTF-8).

---

### `export function validateUrl(value: unknown, required = true): ValidationResult`

Validate a URL (HTTP/HTTPS only).

**Parameters**

| Name | Description |
| --- | --- |
| `value` | The URL to validate |
| `required` | Whether the URL is required (default true) |

---

### `export function validateHorizonUrl(value: unknown): ValidationResult`

Validate a Horizon API URL.

---

### `export function validateSorobanUrl(value: unknown, required = true): ValidationResult`

Validate a Soroban RPC URL.

---

### `export function validateNetworkPassphrase(value: unknown, required = true): ValidationResult`

Validate a network passphrase.

---

### `export function composeValidations(...results: ValidationResult[]): ValidationResult`

Run multiple validators and merge results.

---

## src/lib/wallet/devices.js

### `export const HARDWARE_WALLET_DEVICES = [`

_No description available._

---

### `export async function connectHardwareWallet(type, options =`

_No description available._

---

## src/lib/wallet/freighter.js

### `export async function isFreighterInstalled()`

Freighter wallet connector for Stellar.
Freighter is a browser extension wallet for the Stellar network.

---

### `export async function connectFreighter()`

Freighter wallet connector for Stellar.
Freighter is a browser extension wallet for the Stellar network.

---

### `export async function signTransactionWithFreighter(xdr, network = 'TESTNET')`

Freighter wallet connector for Stellar.
Freighter is a browser extension wallet for the Stellar network.

---

### `export async function getFreighterNetwork()`

Freighter wallet connector for Stellar.
Freighter is a browser extension wallet for the Stellar network.

---

## src/lib/wallet/hardwareWalletSecurity.ts

### `export interface HardwareDevice`

Hardware Wallet Security Enhancements
Enhanced security features for Ledger and other hardware wallets

---

### `export interface SecurityVulnerability`

Hardware Wallet Security Enhancements
Enhanced security features for Ledger and other hardware wallets

---

### `export interface SecurityCheckResult`

Hardware Wallet Security Enhancements
Enhanced security features for Ledger and other hardware wallets

---

### `export const hardwareWalletSecurity = new HardwareWalletSecurityManager()`

Hardware Wallet Security Enhancements
Enhanced security features for Ledger and other hardware wallets

---

## src/lib/wallet/ledger.js

### `export function getActiveLedgerSession()`

Ledger hardware wallet connector for Stellar.

Optional peer dependencies (not bundled):

---

### `export function clearLedgerSession()`

Ledger hardware wallet connector for Stellar.

Optional peer dependencies (not bundled):

---

### `export function getLedgerStatus()`

Ledger hardware wallet connector for Stellar.

Optional peer dependencies (not bundled):

---

### `export async function isLedgerSupported()`

Returns true when the browser exposes WebUSB or WebHID.
Firefox and Safari do not support either API.

---

### `export async function connectLedger()`

Open a Ledger transport (WebUSB preferred, WebHID fallback).

**Returns**: {{ transport, stellarApp, publicKey }}

---

### `export async function signTransactionWithLedger(transaction, stellarApp)`

Sign a raw Stellar Transaction object with the connected Ledger device.
Returns the raw signature bytes (Buffer / Uint8Array).

**Parameters**

| Name | Description |
| --- | --- |
| `{StellarSdk.Transaction}` | transaction |
| `{object}` | stellarApp – instance returned by connectLedger |

---

### `export async function signXdrWithLedger(xdr, networkPassphrase, stellarApp, publicKey)`

Full XDR signing flow:
  1. Parse the unsigned XDR envelope
  2. Prompt the Ledger device to sign
  3. Attach the signature to the transaction
  4. Return the signed XDR envelope string

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | xdr – Base64-encoded unsigned transaction XDR |
| `{string}` | networkPassphrase |
| `{object}` | stellarApp – instance returned by connectLedger |
| `{string}` | publicKey – Ledger public key (for attaching the signature) |

**Returns**: {Promise<string>}     – Signed XDR envelope (base64)

---

### `export function disconnectLedger(transport)`

Full XDR signing flow:
  1. Parse the unsigned XDR envelope
  2. Prompt the Ledger device to sign
  3. Attach the signature to the transaction
  4. Return the signed XDR envelope string

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | xdr – Base64-encoded unsigned transaction XDR |
| `{string}` | networkPassphrase |
| `{object}` | stellarApp – instance returned by connectLedger |
| `{string}` | publicKey – Ledger public key (for attaching the signature) |

**Returns**: {Promise<string>}     – Signed XDR envelope (base64)

---

## src/lib/wallet/security.js

### `export function detectPhishingRisk(input = '')`

_No description available._

---

### `export function buildTransactionConfirmationSummary(payload =`

_No description available._

---

### `export function appendSecurityAuditLog(entry)`

_No description available._

---

### `export function readSecurityAuditLog()`

_No description available._

---

### `export function getSessionSecurityPosture(`

_No description available._

---

## src/lib/webhooks.ts

### `export type WebhookEventType = 'payment' | 'trust' | 'contract' | 'account_merge' | 'all'`

Webhook System for Transaction Events
Manages webhook endpoints, event subscriptions, delivery, retries, and signatures

---

### `export interface WebhookEndpoint`

Webhook System for Transaction Events
Manages webhook endpoints, event subscriptions, delivery, retries, and signatures

---

### `export interface WebhookEvent`

Webhook System for Transaction Events
Manages webhook endpoints, event subscriptions, delivery, retries, and signatures

---

### `export interface WebhookDeliveryLog`

Webhook System for Transaction Events
Manages webhook endpoints, event subscriptions, delivery, retries, and signatures

---

### `export const webhookManager = new WebhookManager()`

Webhook System for Transaction Events
Manages webhook endpoints, event subscriptions, delivery, retries, and signatures

---

## src/lib/websocket.js

### `export class CollaborationSocket`

WebSocket client for real-time collaboration (#112).

Provides an auto-reconnecting WebSocket wrapper with:
 - Exponential back-off reconnect
 - Message type routing (subscribe/publish)
 - Ping/pong keepalive
 - Listener cleanup

---

### `export function getCollaborationSocket(url)`

Send a typed message to the server.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | type |
| `{Record<string,` | unknown>} payload |

---

### `export function destroyCollaborationSocket()`

Send a typed message to the server.

**Parameters**

| Name | Description |
| --- | --- |
| `{string}` | type |
| `{Record<string,` | unknown>} payload |

---

## src/lib/websocket/AccountStreamManager.ts

### `export class AccountStreamManager`

AccountStreamManager

Manages real-time, per-account streams against Horizon (SSE under the
hood). Multiple subscribers can attach to the same accountId/channel pair
without opening more than one network connection per (channel, account).

Channels:
  effects      — every effect on the account (balance changes, signers, …)
  payments     — incoming and outgoing payments
  operations   — every operation that involved the account
  transactions — every transaction the account participated in

Resilience:
  - Exponential backoff up to 30s on errors.
  - Caps at MAX_RECONNECT_ATTEMPTS, then sits in 'error' until manually retried.
  - Tracks lastMessageAt so the UI can surface "stale stream" warnings.

---

### `export const accountStreamManager = new AccountStreamManager()`

Shared singleton — components subscribe through this.

---

## src/lib/websocket/ContractStreamManager.ts

### `export class ContractStreamManager`

ContractStreamManager

Soroban does not expose a streaming endpoint, so this manager polls
`getEvents` on a configurable interval and emits new events to subscribers.
Multiple consumers of the same contractId share one polling timer.

---

### `export const contractStreamManager = new ContractStreamManager()`

ContractStreamManager

Soroban does not expose a streaming endpoint, so this manager polls
`getEvents` on a configurable interval and emits new events to subscribers.
Multiple consumers of the same contractId share one polling timer.

---

## src/lib/websocket/StreamTypes.ts

### `export type StreamStatus =`

Shared types for the real-time streaming layer.

Note: Stellar Horizon exposes account/transaction streams over Server-Sent
Events (SSE), not raw WebSockets — but the consumer-facing API in this
module follows the WebSocket-style "subscribe / unsubscribe / status"
model so it reads naturally from React components.

---

### `export interface StreamStatusChange`

Shared types for the real-time streaming layer.

Note: Stellar Horizon exposes account/transaction streams over Server-Sent
Events (SSE), not raw WebSockets — but the consumer-facing API in this
module follows the WebSocket-style "subscribe / unsubscribe / status"
model so it reads naturally from React components.

---

### `export type AccountStreamChannel =`

ms timestamp of the last successful message.

---

### `export type ContractStreamChannel = 'events' | 'state'`

ms timestamp of the last successful message.

---

### `export interface AccountStreamEvent<T = unknown>`

ms timestamp of the last successful message.

---

### `export type EffectRecord = Horizon.ServerApi.EffectRecord`

Raw record from Horizon (effect, payment, operation, transaction).

---

### `export type PaymentRecord = Horizon.ServerApi.PaymentOperationRecord`

Raw record from Horizon (effect, payment, operation, transaction).

---

### `export type OperationRecord = Horizon.ServerApi.OperationRecord`

Raw record from Horizon (effect, payment, operation, transaction).

---

### `export type TransactionRecord = Horizon.ServerApi.TransactionRecord`

Raw record from Horizon (effect, payment, operation, transaction).

---

### `export type AccountStreamPayload =`

Raw record from Horizon (effect, payment, operation, transaction).

---

### `export interface ContractStreamEvent`

Raw record from Horizon (effect, payment, operation, transaction).

---

### `export type StreamUnsubscribe = ()`

Raw event/state record from Soroban RPC.

---

### `export interface AccountSubscriptionOptions`

Raw event/state record from Soroban RPC.

---

### `export interface ContractSubscriptionOptions`

Optional callback for connection state changes scoped to this account.

---

### `export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'`

Topic filters passed straight through to Soroban getEvents.

---

### `export interface RealTimeNotification`

Topic filters passed straight through to Soroban getEvents.

---

## src/lib/websocket/notificationStore.ts

### `export const notificationStore = new NotificationStore()`

Lightweight, dependency-free pub/sub store for real-time notifications.

Components subscribe via the useRealTimeNotifications hook (or directly
via getSnapshot/subscribe). The store caps history at MAX_HISTORY entries
to keep memory bounded over long sessions.

---
