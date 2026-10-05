import { stellarCache } from './networks.js';
import {
  formatXLM as coreFormatXLM,
  shortAddress as coreShortAddress,
  formatStroops as coreFormatStroops,
  formatInstructions as coreFormatInstructions,
  formatBytes as coreFormatBytes,
} from '@stellar-dev-dashboard/core';

export function formatXLM(amount: string | number): string {
  return coreFormatXLM(amount);
}

export function shortAddress(addr: string | null | undefined, chars = 6): string {
  return coreShortAddress(addr, chars);
}

export function clearCache(pattern: string | null = null) {
  if (pattern) {
    stellarCache.invalidatePrefix(pattern);
  } else {
    stellarCache.clear();
  }
}

export function getCacheStats() {
  return stellarCache.getStats();
}

export function formatInstructions(instructions: number): string {
  return coreFormatInstructions(instructions);
}

export function formatBytes(bytes: number): string {
  return coreFormatBytes(bytes);
}

export function formatStroops(stroops: unknown): string {
  return coreFormatStroops(stroops);
}