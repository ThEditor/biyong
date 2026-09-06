# Architecture Overview

Biyong follows a **Local-First by Default, Server-Authoritative for Shared Multi-User State** architecture.

```text
React Native (Mobile) / React (Web)
               ↓
    Application / Domain layer
               ↓
          Local SQLite
               ↓
     Synchronization engine
               ↓
            Hono API
               ↓
           PostgreSQL
```

## Guiding Principles
1. **Local-first**: Single-user ledger workflows (expenses, income, transfers, cash, private groups, budgets, goals, wealth, net worth) never touch the network.
2. **Server-authoritative shared state**: When real authenticated users share expenses, groups, and settlements, the server validates permissions and canonicalizes order.
3. **One financial model**: Money → Account → Transaction → Person → Purpose → Asset/Liability.
4. **Zero floating-point arithmetic**: Monetary quantities are strictly represented in integer minor units (paise/cents).
