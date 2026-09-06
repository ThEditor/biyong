# @biyong/database

## Purpose
PostgreSQL server database schema and client configuration using Drizzle ORM. Stores server-authoritative shared multi-user state, user credentials, sessions, real groups, and synchronized operations.

## Ownership
Backend Persistence & Infrastructure.

## Public API
- `createDatabaseClient`
- `users`, `sessions`, `sharedGroups`, `sharedGroupMembers`, `sharedExpenses`, `sharedSettlements`, `serverSyncOperations`

## Invariants
- Enforces user ownership of expenses.
- All monetary amounts stored as integer minor units.
- Idempotency via operation ID keys in `serverSyncOperations`.

## Verification Commands
```bash
pnpm --filter @biyong/database typecheck
pnpm --filter @biyong/database build
```
