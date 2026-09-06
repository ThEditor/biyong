# @biyong/schemas

## Purpose
Provides centralized, shared Zod schemas and TypeScript inferred types across mobile, web, backend, and internal packages.

## Ownership
Core Foundation / Architecture.

## Public API
- `MoneySchema`, `Money`
- `AccountSchema`, `Account`, `AccountTypeSchema`
- `CategorySchema`, `Category`
- `TransactionSchema`, `Transaction`, `TransactionTypeSchema`
- `GroupSchema`, `Group`, `GroupMemberSchema`, `GroupMember`
- `GroupExpenseSchema`, `GroupExpense`, `SplitMethodSchema`, `SplitAllocationSchema`
- `SettlementSchema`, `Settlement`
- `BudgetSchema`, `Budget`
- `GoalSchema`, `Goal`
- `LiabilitySchema`, `Liability`, `LiabilityTypeSchema`
- `InvestmentSchema`, `Investment`, `InvestmentTypeSchema`
- `SyncOperationSchema`, `SyncOperation`
- `RegisterRequestSchema`, `LoginRequestSchema`, `SessionUserSchema`, `AuthResponseSchema`

## Invariants
- All monetary values represent integer minor units (e.g., paise, cents).
- No floating-point currencies.
- Strict validation before data crosses boundaries.

## Allowed Dependencies
- `zod`

## Forbidden Dependencies
- React, React Native, Expo
- Database libraries (SQLite, Drizzle, pg)
- Hono or web frameworks

## Verification Commands
```bash
pnpm --filter @biyong/schemas typecheck
pnpm --filter @biyong/schemas build
```
