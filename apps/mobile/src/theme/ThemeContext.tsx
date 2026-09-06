import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  PALETTES,
  getTokens,
  type ThemeMode,
  type AccentTheme,
  type ThemeColors,
  type ThemeTokens,
} from '@biyong/ui';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { gluestackConfig } from './gluestack.config';

export interface MobileThemeContextValue {
  mode: ThemeMode;
  accent: AccentTheme;
  resolvedMode: 'light' | 'dark';
  tokens: ThemeTokens;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentTheme) => void;
}

const MobileThemeContext = createContext<MobileThemeContextValue | null>(null);

export interface MobileThemeProviderProps {
  initialMode?: ThemeMode;
  initialAccent?: AccentTheme;
  children: React.ReactNode;
}

export const MobileThemeProvider: React.FC<MobileThemeProviderProps> = ({
  initialMode = 'dark',
  initialAccent = 'default',
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [accent, setAccent] = useState<AccentTheme>(initialAccent);

  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
  }, [mode, systemColorScheme]);

  const tokens = useMemo(() => getTokens(resolvedMode, accent), [resolvedMode, accent]);

  const value = useMemo(
    () => ({
      mode,
      accent,
      resolvedMode,
      tokens,
      colors: tokens.colors,
      setMode,
      setAccent,
    }),
    [mode, accent, resolvedMode, tokens]
  );

  return (
    <MobileThemeContext.Provider value={value}>
      <GluestackUIProvider config={gluestackConfig} colorMode={resolvedMode}>
        {children}
      </GluestackUIProvider>
    </MobileThemeContext.Provider>
  );
};

export function useAppTheme(): MobileThemeContextValue {
  const context = useContext(MobileThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a MobileThemeProvider');
  }
  return context;
}
