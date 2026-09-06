# ADR-001: Local-First Architecture for Single-User Workflows

## Status
Accepted

## Context
A financial tracking application must be immediately available, work offline, and never block user entry on network latency.

## Decision
All single-user features (accounts, transactions, categories, cash, budgets, goals, liabilities, investments, private groups with dummy members) are executed and persisted locally in SQLite. The network is never a prerequisite for personal money tracking.

## Consequences
- Immediate UI responsiveness.
- Zero network dependency for core workflows.
- Sync engine handles synchronization asynchronously when user connects.
