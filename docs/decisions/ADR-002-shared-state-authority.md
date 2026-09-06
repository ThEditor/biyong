# ADR-002: Server-Authoritative Shared Multi-User State

## Status
Accepted

## Context
When shared groups contain multiple real authenticated users, conflicts, permission violations, and split disagreements can arise if clients act autonomously.

## Decision
Once data crosses user boundaries (invitations, shared group membership, shared expenses, settlements), the backend server (Hono + PostgreSQL) is the sole authoritative source of truth.

## Consequences
- Prevents cross-user conflicts and malicious client tampering.
- Clients queue shared actions locally in outbox and converge onto server canonical state.
