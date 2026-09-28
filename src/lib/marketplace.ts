/**
 * marketplace.ts — Theme Marketplace data layer
 *
 * Currently uses local mock data. Designed so the fetch/install functions
 * can be swapped to real API calls without changing consumer code.
 */
import type { ThemeColors, ThemeTypography, ThemeSpacing } from '../styles/themeTypes'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketplaceTheme {
  id: string
  name: string
  author: string
  description: string
  colors: ThemeColors
  typography: ThemeTypography
  spacing: ThemeSpacing
  downloads: number
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_THEMES: MarketplaceTheme[] = [
  {
    id: 'ocean',
    name: 'Ocean Depths',
    author: 'Stellar Team',
    description: 'Deep blue tones inspired by the ocean',
    colors: {
      background: '#0a1628',
      surface: '#0f1f3d',
      primary: '#38bdf8',
      secondary: '#818cf8',
      text: '#e0f2fe',
    },
    typography: { fontFamily: "'Syne', sans-serif", fontScale: 1.0 },
    spacing: { baseUnit: 8 },
    downloads: 1240,
  },
  {
    id: 'forest',
    name: 'Forest Canopy',
    author: 'Community',
    description: 'Earthy greens for a natural feel',
    colors: {
      background: '#0a1a0f',
      surface: '#0f2418',
      primary: '#4ade80',
      secondary: '#fbbf24',
      text: '#dcfce7',
    },
    typography: { fontFamily: "'Syne', sans-serif", fontScale: 1.0 },
    spacing: { baseUnit: 8 },
    downloads: 890,
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    author: 'Design Lab',
    description: 'Warm sunset-inspired palette',
    colors: {
      background: '#1a0a0a',
      surface: '#2a1212',
      primary: '#fb923c',
      secondary: '#e879f9',
      text: '#ffedd5',
    },
    typography: { fontFamily: "'Syne', sans-serif", fontScale: 1.05 },
    spacing: { baseUnit: 10 },
    downloads: 2100,
  },
  {
    id: 'mono',
    name: 'Monochrome',
    author: 'Minimalist',
    description: 'Clean grayscale with a single accent',
    colors: {
      background: '#0a0a0a',
      surface: '#141414',
      primary: '#a3a3a3',
      secondary: '#525252',
      text: '#f5f5f5',
    },
    typography: { fontFamily: "'Space Mono', monospace", fontScale: 1.0 },
    spacing: { baseUnit: 6 },
    downloads: 560,
  },
  {
    id: 'aurora',
    name: 'Northern Aurora',
    author: 'Stellar Team',
    description: 'Purple and green aurora borealis theme',
    colors: {
      background: '#0a0a1a',
      surface: '#14142a',
      primary: '#a78bfa',
      secondary: '#34d399',
      text: '#ede9fe',
    },
    typography: { fontFamily: "'Syne', sans-serif", fontScale: 1.0 },
    spacing: { baseUnit: 8 },
    downloads: 340,
  },
  {
    id: 'retro',
    name: 'Retro Terminal',
    author: 'Community',
    description: 'CRT monitor inspired amber-on-black',
    colors: {
      background: '#0c0c00',
      surface: '#1a1a00',
      primary: '#ffb300',
      secondary: '#ff8f00',
      text: '#ffecb3',
    },
    typography: { fontFamily: "'Space Mono', monospace", fontScale: 1.0 },
    spacing: { baseUnit: 8 },
    downloads: 780,
  },
]

// ─── Public API (async — swap to real HTTP calls in the future) ───────────────

/**
 * Fetch all available marketplace themes.
 * Replace the implementation with a fetch() call when a real API exists.
 */
export async function fetchMarketplaceThemes(): Promise<MarketplaceTheme[]> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 300))
  return MOCK_THEMES
}

/**
 * Install (download) a single marketplace theme by id.
 * Returns null when the theme is not found.
 */
export async function installMarketplaceTheme(
  id: string
): Promise<MarketplaceTheme | null> {
  await new Promise((r) => setTimeout(r, 100))
  return MOCK_THEMES.find((t) => t.id === id) ?? null
}
