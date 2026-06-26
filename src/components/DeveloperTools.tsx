/**
 * Developer Tools Integration Component
 * Integrates keyboard shortcuts, logging, time travel debugging, and validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CommandPalette } from './keyboard/CommandPalette';
import { ShortcutCheatSheet } from './keyboard/ShortcutCheatSheet';
import { LogMonitor } from '../lib/logging/logMonitor';
import { TimeTravelDebugger } from './state/TimeTravelDebugger';
import { keyboardManager } from '../lib/keyboard/shortcuts';
import { logger } from '../lib/logging/logger';
import { useStore } from '../lib/store';

export function DeveloperTools() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false);
  const [logMonitorOpen, setLogMonitorOpen] = useState(false);
  const [timeTravelOpen, setTimeTravelOpen] = useState(false);
  const [currentState, setCurrentState] = useState<unknown>(null);

  const store = useStore();

  // Capture current state for time travel
  useEffect(() => {
    setCurrentState(store);
  }, [store]);

  // Listen for command palette toggle
  useEffect(() => {
    const handleCommandPaletteToggle = (e: CustomEvent) => {
      setCommandPaletteOpen(e.detail.open);
    };

    window.addEventListener('command-palette-toggle', handleCommandPaletteToggle as EventListener);
    return () => {
      window.removeEventListener('command-palette-toggle', handleCommandPaletteToggle as EventListener);
    };
  }, []);

  // Listen for keyboard actions
  useEffect(() => {
    const handleKeyboardAction = (e: CustomEvent) => {
      const { action } = e.detail;

      switch (action) {
        case 'show-shortcuts':
          setShortcutSheetOpen(true);
          break;
        case 'toggle-logs':
          setLogMonitorOpen(prev => !prev);
          break;
        case 'toggle-theme':
          // Toggle theme logic
          break;
        case 'escape':
          setCommandPaletteOpen(false);
          setShortcutSheetOpen(false);
          setLogMonitorOpen(false);
          setTimeTravelOpen(false);
          break;
      }
    };

    window.addEventListener('keyboard-action', handleKeyboardAction as EventListener);
    return () => {
      window.removeEventListener('keyboard-action', handleKeyboardAction as EventListener);
    };
  }, []);

  // Listen for keyboard navigation
  useEffect(() => {
    const handleKeyboardNavigate = (e: CustomEvent) => {
      const { path } = e.detail;
      // Navigation logic would go here
      logger.info('Keyboard navigation triggered', { path });
    };

    window.addEventListener('keyboard-navigate', handleKeyboardNavigate as EventListener);
    return () => {
      window.removeEventListener('keyboard-navigate', handleKeyboardNavigate as EventListener);
    };
  }, []);

  // Register custom keyboard shortcuts for developer tools
  useEffect(() => {
    keyboardManager.register({
      id: 'dev.logs',
      keys: ['ctrl+shift+l'],
      description: 'Toggle Log Monitor',
      category: 'Developer Tools',
      action: () => setLogMonitorOpen(prev => !prev),
    });

    keyboardManager.register({
      id: 'dev.timetravel',
      keys: ['ctrl+shift+t'],
      description: 'Toggle Time Travel Debugger',
      category: 'Developer Tools',
      action: () => setTimeTravelOpen(prev => !prev),
    });

    keyboardManager.register({
      id: 'dev.shortcuts',
      keys: ['ctrl+shift+/'],
      description: 'Show Keyboard Shortcuts',
      category: 'Developer Tools',
      action: () => setShortcutSheetOpen(true),
    });

    return () => {
      keyboardManager.unregister('dev.logs');
      keyboardManager.unregister('dev.timetravel');
      keyboardManager.unregister('dev.shortcuts');
    };
  }, []);

  const handleStateRestore = useCallback((state: unknown) => {
    // State restoration logic would go here
    logger.info('State restored from time travel', { state });
  }, []);

  return (
    <>
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
      
      <ShortcutCheatSheet 
        isOpen={shortcutSheetOpen} 
        onClose={() => setShortcutSheetOpen(false)} 
      />
      
      <LogMonitor 
        isOpen={logMonitorOpen} 
        onClose={() => setLogMonitorOpen(false)} 
      />
      
      <TimeTravelDebugger
        isOpen={timeTravelOpen}
        onClose={() => setTimeTravelOpen(false)}
        currentState={currentState}
        onStateRestore={handleStateRestore}
      />
    </>
  );
}
