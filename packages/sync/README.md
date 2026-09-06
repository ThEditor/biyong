# @biyong/sync

## Purpose
Coordinates operation-based synchronization between the mobile/local SQLite outbox and the Hono/PostgreSQL server.

## Ownership
Data Synchronization & Networking.

## Public API
- `createSyncOperation`
- `SyncEngine`
- `SyncServerClient` interface

## Invariants
- **Operation-based**: Changes are atomic operations with immutable UUIDv4/UUIDv7 IDs.
- **Idempotency**: Pushing duplicate operation IDs must never execute double mutations.
- **Offline persistence**: Operations are enqueued in SQLite outbox until acknowledged.

## Verification Commands
```bash
pnpm --filter @biyong/sync typecheck
pnpm --filter @biyong/sync build
```
