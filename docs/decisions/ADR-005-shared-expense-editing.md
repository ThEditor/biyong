# ADR-005: Owner-Only Editing for Shared Expenses

## Status
Accepted

## Context
Concurrent edits by multiple members to the same shared bill result in conflicting splits and ambiguous liability.

## Decision
In shared groups with real users, only the member who created the expense is permitted to edit or delete it. Other members can view, inspect calculations, and submit settlements.

## Consequences
- Prevents split race conditions without complex distributed lock mechanisms.
- The server strictly validates creator identity before accepting edit operations.
