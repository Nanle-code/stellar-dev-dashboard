import { stellarCache } from './networks.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatXLM(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

export function shortAddress(addr: string | null | undefined, chars = 6): string {
  if (!addr) return '';
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}



/**
 * Clear cache for specific pattern
 * @param {string} pattern - Key pattern to clear
 */
export function clearCache(pattern: string | null = null) {
  if (pattern) {
    stellarCache.invalidatePrefix(pattern);
  } else {
    stellarCache.clear();
  }
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
  return stellarCache.getStats();
}



export function formatInstructions(instructions: number): string {
  if (instructions < 1000) return `${instructions}`;
  if (instructions < 1000000) return `${(instructions / 1000).toFixed(2)}K`;
  return `${(instructions / 1000000).toFixed(2)}M`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatStroops(stroops: unknown): string {
  const num = typeof stroops === 'number' ? stroops : parseInt(String(stroops), 10);
  if (isNaN(num)) return '—';
  const xlm = (num / 10000000).toFixed(7);
  return `${xlm} XLM (${num.toLocaleString('en-US')} stroops)`;
}
