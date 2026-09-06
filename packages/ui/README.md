# @biyong/ui

## Purpose
Design tokens, Gluestack theme abstractions, and shared UI primitives for both mobile and web.

## Ownership
Design System & Frontend Architecture.

## Public API
- `ThemeMode` ('light' | 'dark' | 'system')
- `AccentTheme` ('default' | 'ocean' | 'forest' | 'violet' | 'amber' | 'rose')
- `ThemeProvider`, `useTheme`, `getTokens`
- `CurrencyText`, `Card`, `StatBox`

## Invariants
- Consistent color tokens and typography hierarchy across screens.
- Zero hard-coded color strings inside individual components.
- Direct integration with domain minor-unit formatting.

## Verification Commands
```bash
pnpm --filter @biyong/ui typecheck
pnpm --filter @biyong/ui build
```
