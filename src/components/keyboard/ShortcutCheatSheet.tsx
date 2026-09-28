/**
 * Shortcut Cheat Sheet - D-023
 * Shows all available keyboard shortcuts organized by category
 */

import React, { useState, useEffect } from 'react';
import { keyboardManager, Shortcut } from '../../lib/keyboard/shortcuts';

interface ShortcutCheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutCheatSheet({ isOpen, onClose }: ShortcutCheatSheetProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShortcuts(keyboardManager.getAllShortcuts());
    }
  }, [isOpen]);

  const groupedShortcuts = React.useMemo(() => {
    const groups = new Map<string, Shortcut[]>();
    const query = searchQuery.toLowerCase();

    shortcuts.forEach(shortcut => {
      if (searchQuery && !shortcut.description.toLowerCase().includes(query) && 
          !shortcut.category.toLowerCase().includes(query)) {
        return;
      }

      if (!groups.has(shortcut.category)) {
        groups.set(shortcut.category, []);
      }
      groups.get(shortcut.category)!.push(shortcut);
    });

    return groups;
  }, [shortcuts, searchQuery]);

  const formatKey = (keyCombo: string): string => {
    return keyCombo
      .split('+')
      .map(key => {
        const keyMap: Record<string, string> = {
          'cmd': '⌘',
          'ctrl': 'Ctrl',
          'alt': 'Alt',
          'shift': '⇧',
          'escape': 'Esc',
        };
        return keyMap[key] || key.toUpperCase();
      })
      .join(' + ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1318] border border-[#1e2d3d] rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d3d]">
          <h2 className="text-xl font-bold text-[#e8f4f8]">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1a2530] text-[#e8f4f8] rounded hover:bg-[#2a3f55] transition"
          >
            Close
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#1e2d3d]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            className="w-full bg-[#1a2530] text-[#e8f4f8] px-4 py-2 rounded border border-[#1e2d3d] outline-none focus:border-[#00e5ff]"
          />
        </div>

        {/* Shortcuts */}
        <div className="flex-1 overflow-auto p-4">
          {Array.from(groupedShortcuts.entries()).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold text-[#00e5ff] mb-3">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {categoryShortcuts.map(shortcut => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between p-3 bg-[#0f1820] rounded border border-[#1e2d3d]"
                  >
                    <div className="flex-1">
                      <div className="text-[#e8f4f8]">{shortcut.description}</div>
                      {shortcut.context && shortcut.context.length > 0 && (
                        <div className="text-xs text-[#7a9bb0] mt-1">
                          Context: {shortcut.context.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4">
                      {shortcut.keys.map((keyCombo, i) => (
                        <kbd
                          key={i}
                          className="bg-[#1a2530] px-2 py-1 rounded text-sm text-[#00e5ff] font-mono"
                        >
                          {formatKey(keyCombo)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e2d3d] text-center text-[#7a9bb0] text-sm">
          Press <kbd className="bg-[#1a2530] px-2 py-1 rounded">?</kbd> to toggle this sheet
        </div>
      </div>
    </div>
  );
}
