# @biyong/application

## Purpose
Coordinates domain logic and persistence contracts. Exposes command/query use cases for accounts, transactions, shared and private groups, budgets, goals, and wealth management.

## Ownership
Application Core Architecture.

## Public API
- `TransactionUseCases`
- `GroupUseCases`
- `BudgetUseCases`
- `GoalUseCases`
- `WealthUseCases`
- Interfaces: `AccountRepository`, `TransactionRepository`, `GroupRepository`, `BudgetRepository`, `GoalRepository`, `WealthRepository`

## Invariants
- Derived balances are computed from underlying transactions and initial balance.
- Transfers between owned accounts are never treated as income or expense.
- Group expenses validate payer and split conservation before persistence.

## Allowed Dependencies
- `@biyong/schemas`
- `@biyong/domain`

## Forbidden Dependencies
- React, React Native, UI components
- Direct SQLite or PostgreSQL connections (only repository abstractions are used)
- Network frameworks (Hono, Express, fetch)

## Verification Commands
```bash
pnpm --filter @biyong/application test
pnpm --filter @biyong/application typecheck
pnpm --filter @biyong/application build
```
