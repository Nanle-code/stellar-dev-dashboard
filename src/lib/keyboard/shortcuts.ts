/**
 * Advanced Keyboard Shortcuts System - D-023
 * Command palette, fuzzy search, and keyboard navigation
 */

export interface Shortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action: () => void;
  context?: string[];
  enabled?: boolean;
}

export interface ShortcutPreset {
  name: string;
  shortcuts: Record<string, string[]>;
}

class KeyboardShortcutManager {
  private shortcuts = new Map<string, Shortcut>();
  private pressedKeys = new Set<string>();
  private listeners = new Set<(shortcut: Shortcut) => void>();
  private commandPaletteOpen = false;
  private currentContext: string[] = [];

  constructor() {
    this.bindGlobalListeners();
    this.registerDefaultShortcuts();
  }

  private bindGlobalListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Don't trigger shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable) {
      return;
    }

    const key = this.normalizeKey(e);
    this.pressedKeys.add(key);

    // Command palette: Cmd/Ctrl+K
    if ((e.metaKey || e.ctrlKey) && key === 'k') {
      e.preventDefault();
      this.toggleCommandPalette();
      return;
    }

    // Check for matching shortcuts
    const matchingShortcut = this.findMatchingShortcut();
    if (matchingShortcut) {
      e.preventDefault();
      if (this.isShortcutEnabled(matchingShortcut)) {
        matchingShortcut.action();
        this.notifyListeners(matchingShortcut);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const key = this.normalizeKey(e);
    this.pressedKeys.delete(key);
  }

  private normalizeKey(e: KeyboardEvent): string {
    const key = e.key.toLowerCase();
    const modifiers: string[] = [];
    
    if (e.metaKey) modifiers.push('cmd');
    if (e.ctrlKey) modifiers.push('ctrl');
    if (e.altKey) modifiers.push('alt');
    if (e.shiftKey) modifiers.push('shift');

    if (modifiers.length > 0) {
      return `${modifiers.join('+')}+${key}`;
    }
    return key;
  }

  private findMatchingShortcut(): Shortcut | null {
    for (const shortcut of this.shortcuts.values()) {
      if (this.matchesShortcut(shortcut)) {
        return shortcut;
      }
    }
    return null;
  }

  private matchesShortcut(shortcut: Shortcut): boolean {
    if (!this.isShortcutEnabled(shortcut)) return false;

    // Check if any key combination matches
    return shortcut.keys.some(keyCombo => {
      const requiredKeys = keyCombo.toLowerCase().split('+');
      return requiredKeys.every(key => this.pressedKeys.has(key)) &&
             this.pressedKeys.size === requiredKeys.length;
    });
  }

  private isShortcutEnabled(shortcut: Shortcut): boolean {
    if (shortcut.enabled === false) return false;
    
    // Check context
    if (shortcut.context && shortcut.context.length > 0) {
      return shortcut.context.some(ctx => this.currentContext.includes(ctx));
    }
    
    return true;
  }

  register(shortcut: Shortcut) {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  unregister(id: string) {
    this.shortcuts.delete(id);
  }

  setContext(context: string[]) {
    this.currentContext = context;
  }

  addContext(context: string) {
    if (!this.currentContext.includes(context)) {
      this.currentContext.push(context);
    }
  }

  removeContext(context: string) {
    this.currentContext = this.currentContext.filter(c => c !== context);
  }

  subscribe(callback: (shortcut: Shortcut) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(shortcut: Shortcut) {
    this.listeners.forEach(cb => cb(shortcut));
  }

  toggleCommandPalette() {
    this.commandPaletteOpen = !this.commandPaletteOpen;
    const event = new CustomEvent('command-palette-toggle', { 
      detail: { open: this.commandPaletteOpen } 
    });
    window.dispatchEvent(event);
  }

  isCommandPaletteOpen(): boolean {
    return this.commandPaletteOpen;
  }

  closeCommandPalette() {
    if (this.commandPaletteOpen) {
      this.commandPaletteOpen = false;
      const event = new CustomEvent('command-palette-toggle', { 
        detail: { open: false } 
      });
      window.dispatchEvent(event);
    }
  }

  getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsByCategory(category: string): Shortcut[] {
    return this.getAllShortcuts().filter(s => s.category === category);
  }

  detectConflicts(): Array<{ shortcut: Shortcut; conflicts: string[] }> {
    const conflicts: Array<{ shortcut: Shortcut; conflicts: string[] }> = [];
    const keyMap = new Map<string, string[]>();

    this.shortcuts.forEach((shortcut, id) => {
      shortcut.keys.forEach(keyCombo => {
        if (!keyMap.has(keyCombo)) {
          keyMap.set(keyCombo, []);
        }
        keyMap.get(keyCombo)!.push(id);
      });
    });

    keyMap.forEach((ids, keyCombo) => {
      if (ids.length > 1) {
        ids.forEach(id => {
          const shortcut = this.shortcuts.get(id);
          if (shortcut) {
            const existing = conflicts.find(c => c.shortcut.id === id);
            if (existing) {
              existing.conflicts.push(keyCombo);
            } else {
              conflicts.push({
                shortcut,
                conflicts: [keyCombo],
              });
            }
          }
        });
      }
    });

    return conflicts;
  }

  detectBrowserConflicts(): string[] {
    const reservedKeys = [
      'ctrl+t', 'ctrl+w', 'ctrl+n', 'ctrl+shift+n',
      'ctrl+l', 'ctrl+d', 'ctrl+j', 'ctrl+shift+j',
      'f12', 'ctrl+shift+i', 'ctrl+shift+c',
      'ctrl+r', 'ctrl+shift+r', 'f5',
      'ctrl+f', 'ctrl+g', 'ctrl+shift+g',
      'ctrl+p', 'ctrl+s', 'ctrl+o',
    ];

    const conflicts: string[] = [];
    this.shortcuts.forEach(shortcut => {
      shortcut.keys.forEach(keyCombo => {
        if (reservedKeys.includes(keyCombo.toLowerCase())) {
          conflicts.push(`${shortcut.id}: ${keyCombo}`);
        }
      });
    });

    return conflicts;
  }

  exportShortcuts(): Record<string, string[]> {
    const exported: Record<string, string[]> = {};
    this.shortcuts.forEach((shortcut, id) => {
      exported[id] = shortcut.keys;
    });
    return exported;
  }

  importShortcuts(shortcuts: Record<string, string[]>) {
    Object.entries(shortcuts).forEach(([id, keys]) => {
      const shortcut = this.shortcuts.get(id);
      if (shortcut) {
        shortcut.keys = keys;
      }
    });
  }

  applyPreset(preset: ShortcutPreset) {
    Object.entries(preset.shortcuts).forEach(([id, keys]) => {
      const shortcut = this.shortcuts.get(id);
      if (shortcut) {
        shortcut.keys = keys;
      }
    });
  }

  private registerDefaultShortcuts() {
    // Navigation shortcuts
    this.register({
      id: 'nav.overview',
      keys: ['g', 'o'],
      description: 'Go to Overview',
      category: 'Navigation',
      action: () => this.navigate('/overview'),
    });

    this.register({
      id: 'nav.account',
      keys: ['g', 'a'],
      description: 'Go to Account',
      category: 'Navigation',
      action: () => this.navigate('/account'),
    });

    this.register({
      id: 'nav.transactions',
      keys: ['g', 't'],
      description: 'Go to Transactions',
      category: 'Navigation',
      action: () => this.navigate('/transactions'),
    });

    this.register({
      id: 'nav.contracts',
      keys: ['g', 'c'],
      description: 'Go to Contracts',
      category: 'Navigation',
      action: () => this.navigate('/contracts'),
    });

    this.register({
      id: 'nav.network',
      keys: ['g', 'n'],
      description: 'Go to Network Stats',
      category: 'Navigation',
      action: () => this.navigate('/network'),
    });

    // Action shortcuts
    this.register({
      id: 'action.connect',
      keys: ['c'],
      description: 'Connect Account',
      category: 'Actions',
      action: () => this.triggerAction('connect'),
    });

    this.register({
      id: 'action.disconnect',
      keys: ['d'],
      description: 'Disconnect',
      category: 'Actions',
      action: () => this.triggerAction('disconnect'),
    });

    this.register({
      id: 'action.refresh',
      keys: ['r'],
      description: 'Refresh Data',
      category: 'Actions',
      action: () => this.triggerAction('refresh'),
    });

    this.register({
      id: 'action.search',
      keys: ['/'],
      description: 'Search',
      category: 'Actions',
      action: () => this.triggerAction('search'),
    });

    // View shortcuts
    this.register({
      id: 'view.theme',
      keys: ['t'],
      description: 'Toggle Theme',
      category: 'View',
      action: () => this.triggerAction('toggle-theme'),
    });

    this.register({
      id: 'view.sidebar',
      keys: ['s'],
      description: 'Toggle Sidebar',
      category: 'View',
      action: () => this.triggerAction('toggle-sidebar'),
    });

    this.register({
      id: 'view.logs',
      keys: ['l'],
      description: 'Toggle Log Monitor',
      category: 'View',
      action: () => this.triggerAction('toggle-logs'),
    });

    // Utility shortcuts
    this.register({
      id: 'util.copy',
      keys: ['ctrl+c'],
      description: 'Copy',
      category: 'Utility',
      action: () => this.triggerAction('copy'),
    });

    this.register({
      id: 'util.help',
      keys: ['?'],
      description: 'Show Keyboard Shortcuts',
      category: 'Utility',
      action: () => this.triggerAction('show-shortcuts'),
    });

    this.register({
      id: 'util.escape',
      keys: ['escape'],
      description: 'Close/Escape',
      category: 'Utility',
      action: () => this.triggerAction('escape'),
    });
  }

  private navigate(path: string) {
    window.dispatchEvent(new CustomEvent('keyboard-navigate', { detail: { path } }));
  }

  private triggerAction(action: string) {
    window.dispatchEvent(new CustomEvent('keyboard-action', { detail: { action } }));
  }
}

export const keyboardManager = new KeyboardShortcutManager();
