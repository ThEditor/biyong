# ADR-006: Encryption Boundaries and Sensitive Storage

## Status
Accepted

## Context
Financial records and credentials demand privacy guarantees on device and in transit.

## Decision
- Client secrets, session tokens, and keys must reside in platform-backed secure storage (e.g. Expo SecureStore / Keychain / Keystore).
- Secrets and tokens must never be written to plaintext SQLite tables.
- All network communications require TLS.
