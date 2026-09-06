# @biyong/domain

## Purpose
The pure, framework-independent financial domain engine for Biyong. Contains all business logic, invariants, money arithmetic, split calculations, debt simplification, settlement explanation generation, budgets, goals, and wealth calculations.

## Ownership
Core Financial Engineering.

## Public API
- `createMoney`, `addMoney`, `subtractMoney`, `distributeEqually`, `formatMoney`
- `calculateSplit`, `validatePayers`
- `calculateNetBalances`, `simplifyDebts`, `explainMemberSettlement`, `buildDependencyGraph`
- `calculateBudgetStatus`
- `calculateGoalProgress`
- `calculateNetWorth`

## Invariants
- **No floating point arithmetic**: Monetary calculations are done in integer minor units (paise/cents).
- **Split conservation**: Sum of allocations must strictly equal total expense minor units.
- **Payer conservation**: Sum of payer contributions must strictly equal total expense minor units.
- **Deterministic debt simplification**: Minimizes transfers without altering net financial positions.
- **Zero external dependencies**: Zero imports from React, Expo, Hono, SQLite, or network adapters.

## Allowed Dependencies
- `@biyong/schemas`

## Forbidden Dependencies
- React, React Native, Expo
- SQLite, Postgres, ORMs
- Web/HTTP clients or servers

## Verification Commands
```bash
pnpm --filter @biyong/domain test
pnpm --filter @biyong/domain typecheck
pnpm --filter @biyong/domain build
```
