import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useStore } from '../../lib/store';

export default function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useStore();
  const isDark = theme === 'dark';
  // Keyboard-only focus ring: shown for tab navigation, not mouse clicks.
  const [keyboardFocused, setKeyboardFocused] = useState(false);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onFocus={(e) => {
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) {
          setKeyboardFocused(true);
        }
      }}
      onBlur={() => setKeyboardFocused(false)}
      style={{
        width: '36px',
        height: '36px',
        background: 'var(--bg-elevated, #1a1a1a)',
        border: '1px solid var(--border, #333)',
        borderRadius: 'var(--radius-md, 6px)',
        color: 'var(--text-primary, #fff)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background var(--transition), border-color var(--transition), color var(--transition)',
        outline: keyboardFocused ? '2px solid var(--cyan, #00e5ff)' : 'none',
        outlineOffset: keyboardFocused ? '2px' : undefined,
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleTheme();
        }
      }}
    >
      {isDark ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  );
}
