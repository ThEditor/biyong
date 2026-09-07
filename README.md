# Biyong (비용)

> **The Single Financial Source of Truth.**  
> Local-first by default. Server-authoritative for shared multi-user state. Deterministic, explainable, and zero silent mutations.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444.svg)](https://turbo.build/)
[![React Native](https://img.shields.io/badge/React_Native-Expo_52-61dafb.svg)](https://reactnative.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Local--First-003B57.svg)](https://sqlite.org/)
[![Hono](https://img.shields.io/badge/Hono-Modular_Monolith-E36002.svg)](https://hono.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 1. Product Thesis

Biyong unifies a person's entire financial life into an integrated, non-siloed data model:

```text
Money → Account → Transaction → Person → Purpose → Asset / Liability
```

It guides users across the full financial lifecycle:
```text
Record money → Understand money → Share money → Settle money → Plan money → Grow money
```

### Non-Negotiable Invariants
1. **Local-First by Default**: Personal accounts, cash, transactions, budgets, goals, investments, and private split groups operate **100% offline** on-device using local SQLite. No network required.
2. **Server-Authoritative Shared State**: Real multi-user group collaborations, invitations, permissions, and cross-device sync synchronize through the server using an outbox queue with conflict resolution.
3. **Financial Precision**: All monetary values are strictly represented as **integers in minor currency units** (paisa/cents). Zero floating-point rounding errors.
4. **Additive Invariant**: The intelligence and query engine strictly observes ledger state and **never mutates data silently**.

For the complete 67-section product specification, see [docs/biyong.md](docs/biyong.md).

---

## 2. Feature Matrix

Biyong has completed all foundational and advanced development phases:

### 📱 Personal Ledger & Cash Management (Phase 1)
- **Multi-Account Tracking**: Bank accounts, cash wallets, credit cards, and savings accounts.
- **Double-Entry Transfers**: Atomic fund movement between accounts without balance drift.
- **Category Hierarchy**: Built-in standard categories plus custom user categories.
- **Transaction Filters & Full-Text Search**: Instant search by merchant, notes, account, category, and date range.
- **Reports & Analytics**: Income vs. Expense breakdowns, category percentages, and top merchants.

### 🎯 Budgets, Goals & Trends (Phase 2)
- **Flexible Budgets**: Weekly or monthly cadences with proactive health badges (`Healthy`, `Warning`, `Exceeded`).
- **Surplus Rollover**: Optional carry-forward of unspent balances into subsequent periods.
- **Savings Goals**: Target tracking, required monthly savings rate calculation, and projected completion dates.
- **Spending Trends**: Fixed vs. variable spending segregation and monthly savings rate tracking.

### 👥 Groups, Splits & Settlements (Phase 3 & Phase 5)
- **Private & Shared Groups**: Seamless support for 100% offline private groups (with dummy members) and real cloud-synced multi-user groups.
- **4 Split Strategies**: Equal splits, Exact amounts, Percentages, and Custom shares.
- **Debt Simplification**: Greedy minimum-cash-flow algorithm reducing complex group debts to the absolute minimum transactions.
- **Interactive Directional Debt Graph**:
  - Drag-and-drop nodes with smooth gesture physics.
  - Pinch-to-zoom and two-finger panning.
  - Auto-offset parallel edges preventing overlapping arrows.
- **Transparent Audit Trail**: Settlement explanation modal detailing exactly *why* a member owes or is owed money.
- **Invite Codes & Permissions**: 6-character invite codes (`INV-XXXXXX`) and strict author-only edit/delete rights.
- **Transaction Splitting**: Link any personal ledger transaction directly into a group split, with automatic re-linking capability if deleted.

### ☁️ Authentication & Cloud Sync (Phase 4)
- **Guest-First Experience**: Open the app and start recording transactions immediately without creating an account.
- **Zero-Loss Account Upgrade**: Linking an email/password preserves and migrates all existing offline ledger data.
- **Outbox Sync Engine**: Offline mutations are queued into an SQLite outbox, automatically pushing and pulling upon reconnection.

### 📈 Wealth, Investments & Net Worth (Phase 6)
- **Portfolio Tracking**: Equity (Stocks, Mutual Funds, ETFs), Fixed Income (FD, RD, Bonds), Gold, and Retirement accounts (PPF, EPF, NPS).
- **Liabilities Management**: Home loans, personal loans, car loans, and credit cards with payment tracking.
- **Comprehensive Net Worth**: Real-time formula incorporating cash balances, investments, peer debt receivables, liabilities, and peer payables.
- **Historical Net Worth Trajectory**: 6-month visual progression of total assets and liabilities.

### 💼 Advanced Money Workflows (Phase 7)
- **Peer-to-Peer Lending & Borrowing**: Track money lent (assets) and borrowed (liabilities) with partial repayment histories.
- **Spending Segregation & Reimbursements**: Segregates **Gross Expenses** from **Net Personal Spending**; tracks reimbursement claims from submission to payout.
- **Subscription Detection & Burn Rate**: Multi-cadence normalization (`weekly`, `monthly`, `quarterly`, `yearly`) with auto-detected recurring patterns.
- **100% Data Fidelity Portability**: Full JSON ledger backup and RFC 4180 CSV exports/imports.

### 🧠 Financial Intelligence & Ecosystem (Phase 8)
- **Deterministic Natural Language Query Engine**:
  - *"Who owes me money?"*
  - *"How much did I invest this year?"*
  - *"Can I afford a ₹X laptop?"* (validates against a 30% liquid reserve buffer)
  - *"Why did I spend more this month?"* (month-over-month category variance)
  - *"Why did my net worth change?"*
- **Financial Anomaly Detection**: Proactive alerts for duplicate charges within 24 hours and spending spikes ($> 2.5\times$ category rolling average).
- **60-Day Liquid Runway Cash Flow Forecasting**: Forward-looking liquid cash projections incorporating recurring subscriptions, debt repayments, and liabilities.
- **Heuristic Merchant Categorization**: Automatic merchant classification into standardized categories.

---

## 3. Monorepo Architecture

The repository is organized as a Turborepo monorepo with clean separation of concerns:

```text
biyong/
├── apps/
│   ├── mobile/             # React Native + Expo mobile application
│   │   ├── src/components/ # Reusable UI components & modals (Strictly no emojis)
│   │   ├── src/screens/    # Primary screens (Home, NetWorth, Reports, Groups, Budgets, Intelligence, Settings)
│   │   ├── src/context/    # React Context provider orchestrating local-first state
│   │   └── src/db/         # SQLite driver and service bootstrapping
│   └── api/                # Modular Hono HTTP backend (Auth, Sync, Groups, Wealth, Intelligence)
│
├── packages/
│   ├── schemas/            # Canonical Zod schemas and TypeScript interfaces
│   ├── domain/             # Pure financial domain logic, math, and algorithms (Zero external dependencies)
│   ├── application/        # Application use cases and repository contracts
│   ├── local-db/           # SQLite schema migrations, repositories, and in-memory test driver
│   ├── auth/               # Guest session management, password hashing, and HTTP auth client
│   └── sync/               # Outbox replication engine and conflict resolution
│
├── docs/
│   ├── biyong.md           # Master 67-section Product & Architecture Specification
│   ├── architecture/       # Architectural decisions & system designs
│   └── decisions/          # Architecture Decision Records (ADRs)
│
└── scripts/
    ├── verify-phase7.ts    # End-to-end verification script for Phase 7 (Workflows)
    └── verify-phase8.ts    # End-to-end verification script for Phase 8 (Intelligence)
```

---

## 4. Getting Started

### Prerequisites
- **Node.js**: v20.x or later
- **pnpm**: v9.x or later (`npm install -g pnpm`)

### Installation
```bash
# Clone repository
git clone https://github.com/your-username/biyong.git
cd biyong

# Install all dependencies across monorepo
pnpm install

# Build all internal packages
pnpm build
```

---

## 5. Development & Running

### Starting the API Server
```bash
pnpm --filter @biyong/api dev
```
The Hono backend will start on `http://localhost:3000`.

### Starting the Mobile App (Expo)
```bash
pnpm --filter @biyong/mobile start
```
You can then run on:
- **Android Emulator / Device**: Press `a`
- **iOS Simulator / Device**: Press `i`
- **Expo Go**: Scan the QR code with the Expo Go app

---

## 6. Testing & Verification

Biyong follows a strict **Verification Standard** (see `docs/biyong.md` Section 62):

```bash
# Run unit and integration tests across all packages
pnpm test

# Run strict TypeScript typechecking on the mobile application
pnpm --filter @biyong/mobile typecheck

# Verify production Metro bundle generation
cd apps/mobile && npx expo export -p android --no-bytecode

# Run end-to-end Phase 7 verification (Workflows & Export/Import Fidelity)
pnpm run verify:phase7

# Run end-to-end Phase 8 verification (Intelligence Engine & Invariants)
pnpm run verify:phase8
```

---

## 7. Design System & Tokens

The mobile app implements a clean, high-contrast, professional fintech design system:
- **Color Palette**: Minimalist dark and light themes (Slate, Neutral, Emerald for gains, Rose for debts/expenses, Amber for warnings, Indigo/Sky for transfers).
- **Typography & Iconography**: Standard system fonts with `@expo/vector-icons` (`Ionicons` and `Feather`). Emojis are strictly prohibited in the UI.
- **Interactive Visualizations**: Custom SVG implementations for debt graphs, historical net-worth charts, and runway projections.

---

## 8. License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
