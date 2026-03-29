import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useStore } from '../../lib/store';
import { THEMES } from '../../styles/themes';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useStore();

  const isLight = theme === THEMES.LIGHT;

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle p-2 rounded-md transition-colors ${
        isLight ? 'hover:bg-gray-200' : 'hover:bg-gray-800'
      }`}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
    >
      {isLight ? (
        <Moon className="w-5 h-5 text-gray-800" />
      ) : (
        <Sun className="w-5 h-5 text-gray-200" />
      )}
    </button>
  );
};

export default ThemeToggle;
