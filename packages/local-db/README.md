# @biyong/local-db

## Purpose
SQLite local persistence engine for Biyong's local-first architecture. Handles local tables, migrations, repositories, and outbox queue for offline changes.

## Ownership
Persistence & Infrastructure.

## Public API
- `SqliteDriver`, `MemorySqliteDriver`
- `runMigrations`, `INITIAL_MIGRATION_V1`, `BUILTIN_CATEGORIES`
- `SqliteAccountRepository`
- `SqliteTransactionRepository`
- `SqliteGroupRepository`
- `SqliteBudgetRepository`
- `SqliteGoalRepository`
- `SqliteWealthRepository`
- `SqliteOutboxRepository`

## Invariants
- Works 100% offline without network access.
- Integers for all monetary fields in minor units.
- Foreign keys and indexes maintain local ledger integrity.
- Outbox operations persist changes until synced.

## Allowed Dependencies
- `@biyong/schemas`
- `@biyong/domain`
- `@biyong/application`

## Verification Commands
```bash
pnpm --filter @biyong/local-db test
pnpm --filter @biyong/local-db typecheck
pnpm --filter @biyong/local-db build
```
