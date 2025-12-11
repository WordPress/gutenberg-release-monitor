import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';

function getSystemPreference(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getStoredPreference(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return null;
}

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    return getStoredPreference() ?? 'system';
  });

  const isDark = theme === 'dark' || (theme === 'system' && getSystemPreference());

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', isDark);
  }, [isDark]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.classList.toggle('dark-mode', mediaQuery.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Persist preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      if (current === 'system') {
        // If system, switch to opposite of current system preference
        return getSystemPreference() ? 'light' : 'dark';
      }
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const setToSystem = useCallback(() => {
    setTheme('system');
  }, []);

  return { isDark, theme, toggle, setToSystem };
}
