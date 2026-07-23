/**
 * dashboardLayouts.ts — Issue #341
 * Manages multiple dashboard layouts with save/load/switch/import/export functionality.
 */

import { getStoredValue, setStoredValue } from './storage'
import type { WidgetConfig, WidgetLayout } from '../components/dashboard/types'

export interface DashboardLayout {
  id: string
  name: string
  description?: string
  widgets: WidgetConfig[]
  createdAt: string
  updatedAt: string
  isPreset?: boolean
  isShared?: boolean
}

export interface LayoutPreset {
  id: string
  name: string
  description: string
  icon: string
  widgets: WidgetConfig[]
  category: 'productivity' | 'monitoring' | 'trading' | 'development' | 'minimal'
}

const LAYOUTS_KEY = 'dashboard-layouts-v1'
const ACTIVE_LAYOUT_KEY = 'active-dashboard-layout-v1'

/**
 * Generate a unique ID for layouts
 */
export function generateLayoutId(): string {
  return `layout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create a new empty layout
 */
export function createEmptyLayout(name: string): DashboardLayout {
  return {
    id: generateLayoutId(),
    name,
    widgets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Load all saved layouts
 */
export async function loadAllLayouts(): Promise<DashboardLayout[]> {
  try {
    const stored = await getStoredValue(LAYOUTS_KEY) as DashboardLayout[] | null
    return stored || []
  } catch {
    return []
  }
}

/**
 * Save a layout (create or update)
 */
export async function saveLayout(layout: DashboardLayout): Promise<DashboardLayout> {
  const layouts = await loadAllLayouts()
  const existingIndex = layouts.findIndex(l => l.id === layout.id)
  
  const updatedLayout = {
    ...layout,
    updatedAt: new Date().toISOString(),
  }
  
  if (existingIndex >= 0) {
    layouts[existingIndex] = updatedLayout
  } else {
    layouts.push(updatedLayout)
  }
  
  await setStoredValue(LAYOUTS_KEY, layouts)
  return updatedLayout
}

/**
 * Delete a layout by ID
 */
export async function deleteLayout(layoutId: string): Promise<void> {
  const layouts = await loadAllLayouts()
  const filtered = layouts.filter(l => l.id !== layoutId)
  await setStoredValue(LAYOUTS_KEY, filtered)
  
  // If deleted layout was active, clear active layout
  const activeId = await getActiveLayoutId()
  if (activeId === layoutId) {
    await setActiveLayout(null)
  }
}

/**
 * Get the active layout ID
 */
export async function getActiveLayoutId(): Promise<string | null> {
  try {
    const stored = await getStoredValue(ACTIVE_LAYOUT_KEY) as string | null
    return stored
  } catch {
    return null
  }
}

/**
 * Set the active layout by ID
 */
export async function setActiveLayout(layoutId: string | null): Promise<void> {
  if (layoutId) {
    await setStoredValue(ACTIVE_LAYOUT_KEY, layoutId)
  } else {
    await setStoredValue(ACTIVE_LAYOUT_KEY, null)
  }
}

/**
 * Get the active layout with its widgets
 */
export async function getActiveLayout(): Promise<DashboardLayout | null> {
  const activeId = await getActiveLayoutId()
  if (!activeId) return null
  
  const layouts = await loadAllLayouts()
  return layouts.find(l => l.id === activeId) || null
}

/**
 * Duplicate an existing layout
 */
export async function duplicateLayout(layoutId: string, newName?: string): Promise<DashboardLayout> {
  const layouts = await loadAllLayouts()
  const original = layouts.find(l => l.id === layoutId)
  
  if (!original) {
    throw new Error('Layout not found')
  }
  
  const duplicated: DashboardLayout = {
    ...original,
    id: generateLayoutId(),
    name: newName || `${original.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPreset: false,
    isShared: false,
  }
  
  await saveLayout(duplicated)
  return duplicated
}

/**
 * Export a layout to JSON string
 */
export function exportLayout(layout: DashboardLayout): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    layout,
  }, null, 2)
}

/**
 * Import a layout from JSON string
 */
export function importLayout(jsonString: string): DashboardLayout {
  try {
    const parsed = JSON.parse(jsonString)
    
    if (!parsed.layout || !parsed.layout.id || !parsed.layout.name) {
      throw new Error('Invalid layout format')
    }
    
    // Generate new ID to avoid conflicts
    const imported: DashboardLayout = {
      ...parsed.layout,
      id: generateLayoutId(),
      name: `${parsed.layout.name} (Imported)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPreset: false,
      isShared: false,
    }
    
    return imported
  } catch (error) {
    throw new Error(`Failed to import layout: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Preset layouts library
 */
export const PRESET_LAYOUTS: LayoutPreset[] = [
  {
    id: 'preset-default',
    name: 'Default',
    description: 'Balanced overview with essential widgets',
    icon: '📊',
    category: 'productivity',
    widgets: [
      { id: 'balance-preset', type: 'balance', height: 260, span: 1 },
      { id: 'assets-preset', type: 'assets', height: 320, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
      { id: 'networkStats-preset', type: 'networkStats', height: 300, span: 1 },
    ],
  },
  {
    id: 'preset-trading',
    name: 'Trading Focus',
    description: 'Market data and portfolio analytics',
    icon: '📈',
    category: 'trading',
    widgets: [
      { id: 'priceTicker-preset', type: 'priceTicker', height: 250, span: 1 },
      { id: 'portfolio-preset', type: 'portfolio', height: 400, span: 2 },
      { id: 'assets-preset', type: 'assets', height: 320, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
    ],
  },
  {
    id: 'preset-monitoring',
    name: 'Network Monitor',
    description: 'Network stats and ledger information',
    icon: '🌐',
    category: 'monitoring',
    widgets: [
      { id: 'networkStats-preset', type: 'networkStats', height: 300, span: 2 },
      { id: 'ledgerStats-preset', type: 'ledgerStats', height: 320, span: 2 },
      { id: 'accountStats-preset', type: 'accountStats', height: 400, span: 1 },
    ],
  },
  {
    id: 'preset-minimal',
    name: 'Minimal',
    description: 'Clean layout with just essentials',
    icon: '✨',
    category: 'minimal',
    widgets: [
      { id: 'balance-minimal', type: 'balance', height: 260, span: 1 },
      { id: 'transactions-minimal', type: 'transactions', height: 360, span: 1 },
    ],
  },
  {
    id: 'preset-developer',
    name: 'Developer',
    description: 'Technical details and account info',
    icon: '⚙️',
    category: 'development',
    widgets: [
      { id: 'accountStats-preset', type: 'accountStats', height: 400, span: 1 },
      { id: 'networkStats-preset', type: 'networkStats', height: 300, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
      { id: 'ledgerStats-preset', type: 'ledgerStats', height: 320, span: 1 },
    ],
  },
  {
    id: 'preset-productivity',
    name: 'Productivity',
    description: 'Quick actions and recent activity',
    icon: '🚀',
    category: 'productivity',
    widgets: [
      { id: 'quickActions-preset', type: 'quickActions', height: 280, span: 1 },
      { id: 'balance-preset', type: 'balance', height: 260, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
      { id: 'assets-preset', type: 'assets', height: 320, span: 1 },
    ],
  },
]

/**
 * Convert WidgetConfig to WidgetLayout for storage
 */
export function configToLayout(config: WidgetConfig): WidgetLayout {
  return {
    id: config.id,
    type: config.type,
    height: config.height,
    span: config.span,
    order: 0,
  }
}

/**
 * Convert WidgetLayout to WidgetConfig
 */
export function layoutToConfig(layout: WidgetLayout): WidgetConfig {
  return {
    id: layout.id,
    type: layout.type,
    height: layout.height,
    span: layout.span,
  }
}

/**
 * Convert array of WidgetConfig to WidgetLayout array
 */
export function configsToLayouts(configs: WidgetConfig[]): WidgetLayout[] {
  return configs.map((config, index) => ({
    id: config.id,
    type: config.type,
    height: config.height,
    span: config.span,
    order: index,
  }))
}

/**
 * Convert array of WidgetLayout to WidgetConfig array
 */
export function layoutsToConfigs(layouts: WidgetLayout[]): WidgetConfig[] {
  return layouts.map(layout => layoutToConfig(layout))
}