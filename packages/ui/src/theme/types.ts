export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentTheme = 'default' | 'ocean' | 'forest' | 'violet' | 'amber' | 'rose';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSubtle: string;
  accentForeground: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ThemeTokens {
  mode: 'light' | 'dark';
  accent: AccentTheme;
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
}
