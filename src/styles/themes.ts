export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const THEME_STORAGE_KEY = 'stellar-dashboard-theme';

/**
 * Returns the default system theme preference
 */
export const getSystemTheme = () => {
  if (typeof window === 'undefined') return THEMES.DARK;
  return window.matchMedia('(prefers-color-scheme: light)').matches 
    ? THEMES.LIGHT 
    : THEMES.DARK;
};
