# ADR-003: Monetary Storage in Integer Minor Units

## Status
Accepted

## Context
Floating-point representation (e.g. IEEE 754 `0.1 + 0.2 !== 0.3`) causes precision errors in financial balances and settlements.

## Decision
All monetary fields across database schemas, API payloads, domain calculations, and local persistence are represented as integer minor units (e.g., paise in INR, cents in USD).

## Consequences
- Total elimination of rounding bugs.
- Formatting is done at presentation boundaries only.
