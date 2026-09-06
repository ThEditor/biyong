# @biyong/auth

## Purpose
Contracts and helpers for authentication, guest session handling, and deterministic guest-to-account data migration.

## Ownership
Security & Identity.

## Public API
- `AuthClient`
- `createGuestSession`, `isGuestSession`
- `buildGuestMigrationPlan`

## Invariants
- Guests have first-class offline identities without requiring email or server registration.
- Migration to an authenticated user is deterministic and verifiable.

## Verification Commands
```bash
pnpm --filter @biyong/auth typecheck
pnpm --filter @biyong/auth build
```
