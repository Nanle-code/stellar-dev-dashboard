import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useStore } from '../../lib/store';

export default function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useStore();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
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
