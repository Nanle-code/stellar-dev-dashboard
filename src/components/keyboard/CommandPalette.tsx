/**
 * Command Palette Component - D-023
 * Fuzzy search command palette with keyboard navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { keyboardManager, Shortcut } from '../../lib/keyboard/shortcuts';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  action: () => void;
  icon?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commands, setCommands] = useState<Command[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
      loadCommands();
    }
  }, [isOpen]);

  const loadCommands = useCallback(() => {
    const shortcuts = keyboardManager.getAllShortcuts();
    const commandList: Command[] = shortcuts.map(shortcut => ({
      id: shortcut.id,
      label: shortcut.description,
      description: shortcut.keys.join(', '),
      category: shortcut.category,
      action: shortcut.action,
    }));

    // Add additional commands
    commandList.push(
      {
        id: 'nav.settings',
        label: 'Open Settings',
        category: 'Navigation',
        action: () => window.dispatchEvent(new CustomEvent('keyboard-navigate', { detail: { path: '/settings' } })),
      },
      {
        id: 'view.help',
        label: 'Show Help',
        category: 'View',
        action: () => window.dispatchEvent(new CustomEvent('keyboard-action', { detail: { action: 'show-help' } })),
      }
    );

    setCommands(commandList);
  }, []);

  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;

    const queryLower = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(queryLower) ||
      cmd.category.toLowerCase().includes(queryLower) ||
      cmd.id.toLowerCase().includes(queryLower)
    );
  }, [commands, query]);

  const groupedCommands = React.useMemo(() => {
    const groups = new Map<string, Command[]>();
    filteredCommands.forEach(cmd => {
      if (!groups.has(cmd.category)) {
        groups.set(cmd.category, []);
      }
      groups.get(cmd.category)!.push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const flatCommands = React.useMemo(() => {
    const flat: Command[] = [];
    groupedCommands.forEach((cmds) => flat.push(...cmds));
    return flat;
  }, [groupedCommands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % flatCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flatCommands.length) % flatCommands.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatCommands, selectedIndex, onClose]);

  const executeCommand = useCallback((cmd: Command) => {
    cmd.action();
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center pt-[20vh] z-50 p-4">
      <div className="bg-[#0d1318] border border-[#1e2d3d] rounded-lg w-full max-w-2xl shadow-2xl">
        {/* Input */}
        <div className="flex items-center border-b border-[#1e2d3d]">
          <div className="pl-4 text-[#7a9bb0]">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent px-4 py-4 text-[#e8f4f8] outline-none placeholder-[#7a9bb0]"
          />
          <div className="pr-4 text-[#7a9bb0] text-sm">
            <kbd className="bg-[#1a2530] px-2 py-1 rounded">ESC</kbd>
          </div>
        </div>

        {/* Commands List */}
        <div className="max-h-[400px] overflow-auto py-2">
          {flatCommands.length === 0 ? (
            <div className="text-center text-[#7a9bb0] py-8">No commands found</div>
          ) : (
            Array.from(groupedCommands.entries()).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-2 text-[#7a9bb0] text-xs font-semibold uppercase tracking-wider">
                  {category}
                </div>
                {cmds.map((cmd, idx) => {
                  const globalIndex = flatCommands.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left transition ${
                        isSelected ? 'bg-[#1a2530] text-[#00e5ff]' : 'text-[#e8f4f8] hover:bg-[#0f1820]'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-sm text-[#7a9bb0]">{cmd.description}</div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="text-[#7a9bb0] text-sm">
                          <kbd className="bg-[#1a2530] px-2 py-1 rounded">↵</kbd>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1e2d3d] px-4 py-2 flex items-center justify-between text-xs text-[#7a9bb0]">
          <div className="flex gap-4">
            <span><kbd className="bg-[#1a2530] px-1 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="bg-[#1a2530] px-1 rounded">↵</kbd> Select</span>
            <span><kbd className="bg-[#1a2530] px-1 rounded">ESC</kbd> Close</span>
          </div>
          <div>
            <kbd className="bg-[#1a2530] px-1 rounded">Ctrl+K</kbd> to open
          </div>
        </div>
      </div>
    </div>
  );
}
