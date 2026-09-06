# @biyong/api

## Purpose
The Biyong backend modular monolith built with Hono. Provides endpoints for authentication, shared group synchronization, and server-side authorization.

## Ownership
Backend & Cloud Engineering.

## Public API
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /sync/push`
- `GET /sync/pull`

## Invariants
- Enforces user ownership and permissions.
- Idempotent sync operation processing.
- Portable across Node.js, Bun, and Cloudflare Workers.

## Verification Commands
```bash
pnpm --filter @biyong/api test
pnpm --filter @biyong/api typecheck
pnpm --filter @biyong/api build
```
