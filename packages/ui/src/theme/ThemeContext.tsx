import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ThemeMode, AccentTheme, ThemeTokens } from './types.js';
import { getTokens } from './palettes.js';

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentTheme;
  resolvedMode: 'light' | 'dark';
  tokens: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  initialMode?: ThemeMode;
  initialAccent?: AccentTheme;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  initialMode = 'system',
  initialAccent = 'default',
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [accent, setAccent] = useState<AccentTheme>(initialAccent);

  // In Node/SSR or default, fallback system to light or dark
  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (mode === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'dark'; // Default fintech aesthetic
    }
    return mode;
  }, [mode]);

  const tokens = useMemo(() => getTokens(resolvedMode, accent), [resolvedMode, accent]);

  const value = useMemo(
    () => ({
      mode,
      accent,
      resolvedMode,
      tokens,
      setMode,
      setAccent,
    }),
    [mode, accent, resolvedMode, tokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
