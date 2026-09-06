# ADR-004: Operation-Based Synchronization Protocol

## Status
Accepted

## Context
Blind database row replication between devices leads to complex three-way merges and silent data loss.

## Decision
Synchronization uses atomic, immutable domain operations (`create`, `update`, `delete`) with unique operation UUIDs, timestamp, and device identifier. Operations are enqueued in SQLite outbox and pushed to the server. Repeated pushes are idempotent.

## Consequences
- Retries are completely safe and do not create duplicate transactions.
- Audit trail of operations is preserved.
