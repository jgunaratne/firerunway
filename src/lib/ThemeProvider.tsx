'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  mounted: false,
  setTheme: () => { },
  toggleTheme: () => { },
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with 'dark' to match server render and avoid hydration mismatch
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('firerunway-theme', t);
    } catch { /* SSR guard */ }
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // On mount: read stored/system preference and apply
  useEffect(() => {
    let initial: Theme = 'dark';
    try {
      const stored = localStorage.getItem('firerunway-theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        initial = stored;
      } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        initial = 'light';
      }
    } catch { /* ignore */ }
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setMounted(true);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mounted, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
