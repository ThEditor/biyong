import { describe, it, expect } from 'vitest';
import { getTokens, PALETTES, type AccentTheme } from '../index.js';

describe('UI: Theme System & Tokens', () => {
  const accents: AccentTheme[] = ['default', 'ocean', 'forest', 'violet', 'amber', 'rose'];

  it('provides complete palettes for all 6 presets in light and dark mode', () => {
    for (const accent of accents) {
      const palette = PALETTES[accent];
      expect(palette).toBeDefined();
      expect(palette.light.accentPrimary).toBeDefined();
      expect(palette.dark.accentPrimary).toBeDefined();
      expect(palette.light.background).toBeDefined();
      expect(palette.dark.background).toBeDefined();
    }
  });

  it('generates consistent tokens with spacing and radius', () => {
    const tokens = getTokens('dark', 'ocean');
    expect(tokens.mode).toBe('dark');
    expect(tokens.accent).toBe('ocean');
    expect(tokens.spacing.md).toBe(16);
    expect(tokens.radius.md).toBe(12);
  });
});
