# Money Management App

## AI-First Implementation & Product Plan

**Primary stack:** React Native + Expo + Gluestack UI v5 + SQLite + Hono + PostgreSQL
**Platforms:** Android + iOS + minimal Web
**Architecture:** Local-first, server-authoritative for shared multi-user state
**Backend:** Hono modular monolith
**Database:** PostgreSQL
**Repository:** pnpm workspaces + Turborepo monorepo
**Development model:** AI-assisted, incremental, verification-driven

---

# 1. Product Thesis

Build a single financial source of truth for a person.

The application should unify:

* personal income and expenses
* cash and accounts
* budgets
* financial goals
* shared expenses
* people and settlements
* lending / borrowing
* reimbursements
* liabilities
* investments
* net worth
* financial reports
* later, intelligent insights

The core concept is:

> **Money → Account → Transaction → Person → Purpose → Asset/Liability**

Every major feature should derive from this common model instead of creating isolated data silos.

The product should eventually allow a user to move through this lifecycle:

> **Record money → Understand money → Share money → Settle money → Plan money → Grow money**

---

# 2. Non-Negotiable Architecture Rule

## Local-first by default

Do **not** put functionality on the server merely because a backend exists.

A capability should remain local when:

* it only affects the current user's data
* it does not require another real user
* it does not require external real-time information
* it does not need authoritative cross-device coordination

Examples that should work offline:

* personal expenses
* income
* transfers
* cash
* budgets
* reports
* goals
* net-worth calculations
* manually entered investments
* liabilities
* private groups using dummy users
* local split calculations
* local settlement simulation
* local search/filtering

## Server-authoritative shared state

Once information crosses a real-user boundary, the server becomes authoritative.

Examples:

* authenticated group membership
* invitations
* permissions
* shared group expenses
* edits to shared expenses
* shared settlements
* cross-user balances
* synchronization between devices
* server-side conflict resolution
* account/session state

The mobile app must remain usable while offline, but queued shared operations must converge to the server's canonical state when connectivity returns.

---

# 3. Product Principles

### 3.1 Local-first

Normal personal finance workflows should not require network access.

### 3.2 Shared data is authoritative

When multiple real users are affected, the server is the source of truth.

### 3.3 Explainability over magic

Every derived balance should be traceable to the transactions and rules that produced it.

### 3.4 One financial model

Transactions, budgets, groups, investments, liabilities and net worth should share a coherent underlying model.

### 3.5 Progressive complexity

A guest should be able to use the application locally without an account, while authenticated users can progressively unlock synchronization and shared functionality.

### 3.6 Privacy by design

Minimize what leaves the device and encrypt sensitive information wherever practical.

### 3.7 Functional verification

A phase is complete only when its end-to-end functionality works on a real device/emulator and functional tests pass.

### 3.8 AI-readable codebase

The repository must preserve architecture and product context so a fresh AI coding agent can understand the system without conversation history.

---

# 4. Product Scope

## 4.1 Transactions

Support:

* expenses
* income
* transfers
* cash transactions
* UPI transactions
* debit-card transactions
* credit-card transactions
* bank transactions
* manual entries
* recurring transactions
* transaction notes
* merchant
* category
* subcategory
* transaction attachments later
* search/filter
* editing
* deletion
* transaction rules
* automatic categorization later

Money values must never use floating point.

Store monetary values as integer minor units wherever possible.

Example:

```text
₹123.45
→ 12345 paise
```

---

# 5. Expense Categorization

Support:

* built-in categories
* custom categories
* subcategories
* category icons
* category rules
* merchant-based rules
* user corrections
* future learning/automatic categorization

Example:

```text
Food
├── Restaurants
├── Groceries
├── Delivery
├── Coffee
└── Snacks
```

A user should eventually be able to define:

```text
Merchant: Zepto
→ Category: Groceries
```

---

# 6. Shared Expense System

Shared expenses are a core product feature.

Support:

* permanent groups
* temporary groups
* private groups
* real-user groups
* dummy/local participants
* guest users
* invitations
* group owner
* group members
* multiple payers
* settlements
* expense history

Examples:

```text
Flatmates
Goa Trip
Birthday
Office Lunch
Family
```

---

# 7. Private Groups

A private group contains dummy/local users and does not require server state.

Example:

```text
Goa Trip

Members:
- Me
- Rahul
- Arjun
- Priya
```

These members may not have accounts.

The entire group must work offline.

Requirements:

* create group offline
* add dummy users
* remove dummy users
* add expenses
* calculate splits
* inspect balances
* simulate settlement
* settle balances
* edit/delete local data
* persist across app restarts

No network dependency should exist for this workflow.

---

# 8. Real Shared Groups

When a group contains real authenticated users:

* group creation may require server connectivity
* membership is server-authoritative
* invitations are server-authoritative
* permissions are server-authoritative
* shared expenses are synchronized
* settlements are synchronized
* the server validates authorization

Basic role model:

```text
Owner
Member
```

Do not introduce complex role systems unless required later.

---

# 9. Guest Users

Guest/local usage is a first-class capability.

A person should be able to:

1. open the application
2. use it without an account
3. create local financial data
4. create private groups
5. use dummy people
6. create expenses
7. calculate reports
8. later create an account
9. merge their local state into the authenticated account

Guest-to-account migration must be explicitly designed rather than bolted on later.

---

# 10. Expense Split Methods

Support:

### Equal

```text
₹3,000 / 3 people
= ₹1,000 each
```

### Exact amount

```text
A → ₹1,500
B → ₹900
C → ₹600
```

### Percentage

```text
A → 50%
B → 30%
C → 20%
```

### Shares

```text
A → 2 shares
B → 1 share
C → 1 share
```

### Itemized

Each item is assigned to a person or people.

### Multiple payers

Example:

```text
Total: ₹5,000

A paid ₹3,000
B paid ₹2,000
```

Tax, tip and discounts should be supported without compromising deterministic calculations.

---

# 11. Transparent Settlement Calculation

This is one of the primary differentiators of the application.

A settlement must not simply display:

> C owes A ₹640

It should be possible to inspect exactly why.

Example:

```text
C owes A ₹640

Origin
└── Dinner
    ├── C's food ........ ₹500
    ├── C's tax .......... ₹80
    └── C's tip .......... ₹60
                         ------
                           ₹640

Payments already made
└── C → A ............... ₹0

Final balance
└── C → A ............... ₹640
```

The system must preserve enough source information to reconstruct this explanation.

---

# 12. Dependency Graph

The group UI should provide:

* normal simple balance view
* detailed graph view when the user taps to inspect calculations

The graph should conceptually show:

```text
Expense
   ↓
Allocation
   ↓
Participant exposure
   ↓
Existing payments
   ↓
Net balances
   ↓
Debt simplification
   ↓
Settlement
```

Example:

```text
             Dinner ₹4,800
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
        A          B          C
        │          │          │
        └────── payments ─────┘
                   │
                   ↓
             Final balances
                   │
                   ↓
             Settlement graph
```

The graph is an explanation layer over deterministic financial calculations.

It is not the source of truth.

---

# 13. Settlement Simplification

The system should minimize unnecessary transfers.

Example:

```text
A owes B ₹1,000
B owes C ₹800
C owes A ₹400
```

The application may simplify this into fewer transfers.

However, the simplified result must still be explainable.

The user must be able to inspect:

> Original obligations → netting → resulting settlement

The debt simplification algorithm must live in the framework-independent domain layer.

---

# 14. Who Can Edit Shared Expenses

For real shared groups:

> The person who created the expense is the only person allowed to edit it.

Other users can:

* view it
* inspect their portion
* see the calculation graph
* settle their own amounts

The server must enforce the ownership rule.

Do not trust the mobile client to enforce permissions.

---

# 15. Accounts

An account can represent:

* cash
* bank account
* wallet
* debit account
* credit card
* investment account
* other financial accounts

Balances should preferably be derived from financial entries rather than being treated as arbitrary mutable state.

Transfers between owned accounts must not be classified as income or expense.

---

# 16. Budgets

Support:

* category budgets
* monthly budgets
* weekly budgets
* rollover budgets
* flexible/discretionary budgets
* budget progress
* budget alerts
* remaining budget
* historical budget comparison

Example:

```text
Food       ₹6,200 / ₹10,000
Transport  ₹3,100 / ₹5,000
Shopping   ₹7,400 / ₹8,000
```

Budget calculations should work fully offline.

---

# 17. Financial Goals

Support:

* savings goals
* target amount
* target date
* current progress
* contribution history
* projected completion date

Example:

```text
Emergency Fund
₹1.8L / ₹3L

Target: December 2026

Current projected completion:
February 2027
```

The system should eventually answer:

> “How much more do I need to save per month to reach this by December?”

All core calculations should be deterministic and offline-capable.

---

# 18. Reports

Support:

* weekly reports
* monthly reports
* yearly reports
* custom date ranges

Dimensions:

* category
* subcategory
* merchant
* payment method
* account
* group
* person
* recurring vs one-time
* income vs expense

Examples:

```text
How much did I spend on food this month?

How much did I spend on Swiggy this year?

How much cash did I spend?

How much of my spending was caused by shared expenses?
```

Reports must run locally when based only on local data.

---

# 19. Financial Analytics

Later analytics should include:

* spending trends
* income trends
* savings rate
* category changes
* merchant concentration
* recurring costs
* unusual spending
* month-over-month changes
* year-over-year changes
* fixed vs variable expenses
* discretionary vs committed spending

Examples:

```text
Dining is 34% higher than your 6-month average.

Your recurring commitments increased from ₹31K to ₹43K.

Your savings rate this month is 31%.
```

Insights must never modify underlying financial data.

---

# 20. Recurring Transactions

Support recurring transactions for:

* salary
* rent
* SIP
* EMI
* insurance
* subscriptions
* utilities
* memberships

Eventually detect recurring transactions automatically.

The initial system can support explicit user-defined recurring transactions.

---

# 21. Subscription Detection

Later detect:

```text
Netflix       ₹649/month
Spotify       ₹119/month
Software      ₹499/month
```

Provide:

```text
Total recurring subscriptions:
₹3,840/month
```

This should initially be based on deterministic transaction pattern detection.

---

# 22. Lending & Borrowing

Support:

```text
Rahul borrowed ₹15,000

Repaid: ₹5,000

Outstanding: ₹10,000
```

Track:

* person
* amount
* date
* expected repayment
* repayments
* outstanding balance
* notes

These balances should integrate with the broader financial picture.

---

# 23. Reimbursements

Support:

* work reimbursements
* travel reimbursements
* insurance-related claims
* shared costs awaiting repayment

Example:

```text
Personal spending
₹32,400

Reimbursable
₹7,200

Actual personal cost
₹25,200
```

---

# 24. Investments

Investment tracking should initially require no external financial integration.

Support manually entered holdings for:

### Deposits

* FD
* RD

### Market assets

* Mutual funds
* Stocks
* ETFs
* Bonds

### Government / retirement

* PPF
* EPF
* NPS

### Other assets

* Gold
* ESOPs/RSUs
* other manually tracked investments

The user must be able to use investment tracking completely offline.

Live prices are optional and belong in a later online layer.

---

# 25. Investment Analytics

Support:

* invested amount
* current value
* absolute return
* CAGR
* XIRR where appropriate
* realized gains
* unrealized gains
* allocation
* concentration
* contribution vs market movement

Example:

```text
Equity       54%
Debt         22%
Cash         14%
Gold          6%
Other         4%
```

---

# 26. Liabilities

Support manually entered:

* credit cards
* loans
* EMIs
* BNPL
* other debts

Each liability should support:

* principal/outstanding amount
* payment history
* due date
* interest information where applicable
* notes

No third-party integration is required initially.

---

# 27. Net Worth

Net worth is a first-class feature.

Conceptually:

```text
Net Worth = Assets - Liabilities
```

Example:

```text
Assets            ₹22.4L
Liabilities        ₹4.0L
-------------------------
Net Worth          ₹18.4L
```

Provide historical net-worth tracking.

The user should be able to inspect why net worth changed.

Example:

```text
Net worth change: +₹37,000

New contributions: +₹21,000
Investment movement: +₹16,000
```

---

# 28. Privacy & Security

Privacy is a product requirement, not an afterthought.

Implement:

* secure authentication
* secure session/token handling
* encrypted transport
* secure local key storage
* biometric/app lock where supported
* encrypted sensitive local data
* minimum necessary server-side data
* selective shared visibility
* private groups
* private transactions where appropriate
* account deletion
* complete data export

Use platform secure storage mechanisms for secrets/keys.

Do not put credentials or long-lived sensitive secrets into normal SQLite rows.

For server-side sensitive information, use strong encryption where practical.

Design encryption boundaries early rather than attempting to retrofit them after the schema stabilizes.

---

# 29. Data Export

Users must eventually be able to export their financial data.

Support:

* JSON
* CSV

The export should contain enough information to reconstruct the supported ledger.

Do not build the data model in a way that makes export dependent on inaccessible implementation details.

---

# 30. Core Architecture

Primary flow:

```text
React Native UI
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

The UI must not directly depend on network requests for normal local CRUD.

The network should be a synchronization mechanism, not the application's primary interaction model.

---

# 31. Architectural Layers

## UI

Responsibilities:

* screens
* navigation
* forms
* Gluestack components
* charts
* graph visualization
* validation display
* sync indicators
* loading/error states

The UI should contain minimal financial/business logic.

---

## Domain

Responsibilities:

* financial entities
* split calculations
* settlement calculations
* budgets
* goals
* net worth
* investment calculations
* invariants

Domain code must be:

* framework independent
* network independent
* React independent
* storage independent

This package is the heart of the product.

---

## Application Layer

Responsibilities:

* use cases
* commands
* queries
* orchestration
* coordinating domain + repositories

Examples:

```text
CreateExpense
SplitExpense
SettleBalance
CreateBudget
CreateGoal
RecordInvestment
CalculateNetWorth
```

---

## Local Database Layer

Use SQLite.

Responsibilities:

* schema
* migrations
* local persistence
* local projections
* local repositories
* indexes

SQLite should provide the default offline source for the mobile application.

---

## Synchronization Layer

Responsibilities:

* outbox
* inbox
* operation IDs
* pull/push
* cursors
* versioning
* retries
* idempotency
* conflict handling
* sync state

---

## API Layer

Hono responsibilities:

* authentication
* authorization
* shared group commands
* synchronization
* shared data queries
* exports where server processing is required

The API should remain a modular monolith.

Do not introduce microservices unless there is an actual requirement.

---

## PostgreSQL

PostgreSQL is the default server database.

Use:

* relational tables
* foreign keys
* unique constraints
* check constraints
* indexes
* transactions
* migrations

Use JSONB only where extensibility genuinely benefits from it.

Do not turn the core financial model into an unstructured JSON document store.

---

# 32. When Another Database Is Allowed

PostgreSQL is the default.

A different datastore may be introduced only when a specific feature demonstrates a real need.

Examples might include:

* high-volume event processing
* specialized search
* specialized graph workloads
* analytics workloads that cannot reasonably be handled by PostgreSQL

Do not introduce another datastore just because it is technically interesting.

---

# 33. Monorepo

Use:

```text
pnpm workspaces
+
Turborepo
```

Recommended structure:

```text
/
├── apps/
│   ├── mobile/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── application/
│   ├── schemas/
│   ├── database/
│   ├── local-db/
│   ├── sync/
│   ├── ui/
│   ├── api-client/
│   ├── auth/
│   └── config/
│
├── docs/
│   ├── architecture/
│   ├── domain/
│   ├── decisions/
│   └── agents/
│
├── tooling/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

The exact structure may evolve, but package responsibilities must remain clear.

---

# 34. Dependency Direction

The architecture should generally resemble:

```text
UI
 ↓
Application
 ↓
Domain
```

with infrastructure around the application:

```text
          ┌──────────── Local DB
          │
Application ─────────── API client
          │
          └──────────── Other adapters
```

The domain layer must not import:

* React
* React Native
* Hono
* SQLite libraries
* PostgreSQL libraries
* network clients

This makes the financial rules easy for AI agents to reason about and test.

---

# 35. AI-First Repository Design

The repository itself must maintain project context.

Every major package should contain a short README documenting:

* purpose
* ownership
* public API
* invariants
* allowed dependencies
* forbidden dependencies
* examples
* verification commands

Maintain:

```text
/docs/architecture
/docs/domain
/docs/decisions
/docs/agents
```

Use ADRs for meaningful architectural decisions.

Example:

```text
docs/decisions/
├── ADR-001-local-first.md
├── ADR-002-shared-state-authority.md
├── ADR-003-money-storage.md
├── ADR-004-sync-protocol.md
├── ADR-005-shared-expense-editing.md
└── ADR-006-encryption-boundaries.md
```

Maintain a living implementation log:

```text
docs/agents/implementation-log.md
```

This should tell a fresh coding agent:

* what is implemented
* what is not implemented
* current architecture
* current phase
* known constraints
* current problems
* next recommended tasks

---

# 36. AI Agent Rules

Every implementation agent must follow these rules.

### Rule 1

Before modifying code:

1. read repository root instructions
2. read relevant package README
3. read relevant ADRs
4. read the current implementation log
5. inspect existing tests

### Rule 2

New financial behavior should begin with a functional example/test at the domain or application layer.

### Rule 3

Prefer vertical slices:

```text
Schema
→ Domain rule
→ Repository
→ Application use case
→ UI
→ Functional test
```

### Rule 4

Do not move logic into UI components merely because it is convenient.

### Rule 5

Do not trust the client for server authorization.

### Rule 6

Do not use floating-point numbers for money.

### Rule 7

Do not create duplicated mutable financial totals without a strong reason.

### Rule 8

Do not introduce a backend dependency for functionality that can remain local.

### Rule 9

Do not introduce another database unless the use case demonstrates the need.

### Rule 10

Every completed phase must update:

* implementation log
* documentation
* relevant ADRs
* verification checklist

---

# 37. Offline / Online Boundary

Use this conceptual matrix:

| Capability                | Default                        | Reason                 |
| ------------------------- | ------------------------------ | ---------------------- |
| Personal expenses         | Local                          | Single-user            |
| Personal income           | Local                          | Single-user            |
| Transfers                 | Local                          | Single-user            |
| Cash                      | Local                          | Single-user            |
| Private groups            | Local                          | Dummy users            |
| Budgets                   | Local                          | Derived locally        |
| Goals                     | Local                          | Derived locally        |
| Reports                   | Local                          | Derived locally        |
| Manual investments        | Local                          | No external dependency |
| Liabilities               | Local                          | Manual user-owned data |
| Net worth                 | Local                          | Derived locally        |
| Shared group creation     | Server                         | Real membership        |
| Invitations               | Server                         | Real identity          |
| Shared expenses           | Local queue + server authority | Cross-user             |
| Shared expense edits      | Server validated               | Ownership matters      |
| Shared settlements        | Local intent + server commit   | Affects multiple users |
| Multi-device shared sync  | Server                         | Convergence point      |
| Live investment valuation | Online later                   | External data          |
| Receipt upload            | Online                         | Binary storage         |

---

# 38. Synchronization Model

Use operation-based synchronization.

Do not synchronize arbitrary local database rows blindly.

Each mutation should create a domain operation.

Conceptually:

```text
Local mutation
      ↓
Domain change
      ↓
Outbox operation
      ↓
Sync
      ↓
Server validation
      ↓
Canonical server state
      ↓
Pull / acknowledgement
      ↓
Local convergence
```

Each operation should have:

* globally unique operation ID
* entity ID
* entity type
* actor/device identity
* timestamp
* operation type
* payload
* local status
* server acknowledgement state

---

# 39. Outbox

Offline mutations are written to the local outbox.

Example:

```text
expense.create
expense.update
settlement.create
group.member.add
```

The user must not have to wait for the server before the UI updates locally.

When online:

1. push pending operations
2. receive acknowledgement/rejection
3. apply server response
4. pull missing server changes
5. mark operations synchronized

Retries must be safe.

---

# 40. Idempotency

Every operation must have a unique operation ID.

Submitting the same operation twice must not create duplicate money movements.

Example:

```text
operation_id = abc123
```

If the server receives `abc123` twice:

```text
first request  → applied
second request → return existing result
```

Never create duplicate financial entries from retries.

---

# 41. Conflict Handling

Conflict prevention is preferred over conflict resolution.

For shared expenses:

> Only the creator can edit the expense.

Therefore two arbitrary users should not be able to overwrite the same shared expense.

For low-risk multi-device metadata:

Use timestamp-based last-write-wins where appropriate.

For financial records, prefer domain-specific rules over generic LWW whenever possible.

The server remains authoritative.

---

# 42. Synchronization Safety

The system must guarantee:

* repeated sync does not duplicate transactions
* repeated settlement submission does not double-pay
* unauthorized writes are rejected
* server state eventually converges
* offline local state survives
* operations can be retried
* rejected operations are explainable to the user
* server acknowledgement does not silently corrupt local state

---

# 43. Authentication

Initial authentication modes:

### Guest

Local identity only.

### Email/password

Server-backed account.

Authentication belongs to the application's own backend.

Do not rely on a third-party authentication service unless this decision is explicitly changed later.

The authentication subsystem should support:

* secure password hashing
* sessions/tokens
* session revocation
* device/session tracking
* account deletion
* guest-to-account migration

---

# 44. Guest → Authenticated Merge

Example:

```text
Guest
│
├── 200 expenses
├── 3 private groups
├── 4 investment holdings
└── 2 budgets
        ↓
Create account
        ↓
Merge local state
        ↓
Account becomes canonical
```

The merge algorithm must be deterministic.

It must not silently duplicate data.

The merge behavior should be documented and tested before implementation.

---

# 45. Theming

Use Gluestack UI v5.

The application must have a global theme system.

Support:

* light
* dark
* system

Also support preset accent themes.

Example conceptual options:

```text
Default
Ocean
Forest
Violet
Amber
Rose
```

The chosen theme must consistently affect:

* screens
* controls
* cards
* charts
* graph visualizations
* statuses
* empty states
* dialogs

Do not hard-code colors inside individual components.

Use centralized design tokens.

---

# 46. UI Direction

Visual direction:

> **Minimal fintech**

Characteristics:

* clean layouts
* strong information hierarchy
* restrained decoration
* readable numbers
* concise controls
* fast interactions
* useful charts
* clear financial states
* accessible contrast

Avoid excessive gradients, decorative dashboards and unnecessary visual noise.

---

# 47. Web

Web is not the primary platform.

Build a minimal web application.

Primary web use cases:

* account access
* account recovery
* read-only financial overview
* reports
* data export
* basic account/settings functionality

Do not force the mobile UI architecture to become a full web application.

Mobile is the product priority.

---

# 48. Security Boundaries

Sensitive categories include:

* credentials
* authentication tokens
* encryption keys
* financial records
* shared financial relationships

Keep secrets in secure OS-backed storage.

Never log:

* passwords
* tokens
* encryption keys
* full financial payloads unnecessarily

Do not expose private information to analytics/telemetry systems without a deliberate decision.

---

# 49. File / Receipt Storage

If receipts/documents are introduced:

* store metadata in PostgreSQL
* store binary files in object storage
* keep local cached copies where useful
* do not put large blobs directly into normal relational rows unless there is a deliberate reason

Potential storage can be S3-compatible object storage.

Receipt functionality should not become a dependency for core expense tracking.

---

# 50. Deployment

Preferred deployment options:

* Cloudflare
* Vercel
* self-hosted

Initial API target:

```text
Hono
→ Cloudflare Workers
```

Keep runtime-specific code thin.

The backend should remain portable enough to move to another runtime later.

Database:

```text
PostgreSQL
```

Deployment should include:

* environment variable handling
* database migrations
* CI
* basic health checks
* structured logs
* request IDs
* backups
* restore verification

---

# 51. Testing Philosophy

Testing should be functional and valuable.

Do not write tests merely to increase coverage.

Prioritize:

### Domain tests

* split calculations
* rounding
* balance derivation
* settlement simplification
* budget calculations
* goal projections
* net worth
* investment return calculations
* XIRR where applicable
* invariant failures

### Local integration tests

* SQLite migrations
* repository operations
* restart persistence
* offline workflows

### Sync integration tests

* idempotency
* retries
* convergence
* conflict handling
* authorization failures
* owner-only expense editing

### API tests

* authentication
* membership
* group operations
* expense operations
* settlements
* sync

### Mobile E2E

Focus only on critical journeys.

Examples:

```text
Create expense
View report
Create private group
Split expense
Inspect graph
Settle
Create account
Sync
```

### Web smoke tests

Keep minimal.

---

# 52. Functional Definition of Done

A feature is not done because:

* code compiles
* a screen exists
* unit tests pass
* an endpoint responds

A feature is done when:

1. the intended user workflow works
2. relevant financial invariants hold
3. offline behavior works where required
4. server authority works where required
5. failures are understandable
6. regression tests exist for important behavior
7. documentation is updated

---

# 53. Phased Implementation Roadmap

The project should be implemented in verifiable phases.

Do not implement the entire roadmap at once.

Each phase produces a runnable product increment.

---

## PHASE 0 — Engineering Foundation

### Goal

Create a structurally correct repository before building product functionality.

### Build

* pnpm workspace
* Turborepo
* Expo mobile application
* minimal web application
* Hono API
* PostgreSQL setup
* SQLite abstraction
* Gluestack UI v5
* theme system
* light/dark/system
* preset accent themes
* domain package
* application package
* shared schemas
* database package
* local-db package
* sync package skeleton
* API client
* authentication contracts
* CI
* linting
* formatting
* type checking
* test harness
* project documentation
* AI instructions
* ADR structure
* implementation log

### Verification

The project must:

* boot mobile
* boot web
* boot API
* connect to local PostgreSQL
* initialize SQLite
* switch themes
* run all tests
* pass lint/type checks
* create a trivial local record offline

### Stop Gate

Do not proceed until the repository is boring and reliable.

---

# 54. PHASE 1 — Local Money Ledger

### Goal

Create a genuinely useful offline personal finance application.

### Build

* guest mode
* local identity
* accounts
* cash
* income
* expenses
* transfers
* categories
* subcategories
* recurring transactions
* transaction search
* transaction filtering
* edit/delete
* monthly report
* basic charts
* local net worth
* local persistence

### Important requirement

This phase must be usable with the network disabled.

### Verification

Turn off network.

Then:

```text
Create accounts
Add income
Add expenses
Add transfers
Add recurring transactions
Close app
Reopen app
View reports
View balances
View net worth
```

Everything must remain correct.

---

# 55. PHASE 2 — Budgets & Goals

### Goal

Turn the ledger into a basic personal financial management system.

### Build

* budgets
* rollover
* budget progress
* savings rate
* financial goals
* target dates
* projections
* richer reports
* charts
* fixed vs variable spending
* spending trends

### Verification

Offline:

```text
Create budget
Add expenses
Inspect remaining budget
Create goal
Add contributions
Inspect projected completion
```

All calculations must remain deterministic.

---

# 56. PHASE 3 — Private Groups & Transparent Splitting

### Goal

Build the first major product differentiator.

### Build

* local private groups
* dummy users
* group owner
* group member model
* expenses
* equal splits
* exact splits
* percentage splits
* shares
* itemized splits
* multiple payers
* balances
* settlement calculations
* debt simplification
* detailed dependency graph
* settlement explanation UI

### Verification

Create:

```text
Goa Trip
20+ expenses
4 participants
multiple payers
mixed split types
```

Then:

* inspect every balance
* open graph explanation
* settle balances
* verify balances reach zero

All while offline.

---

# 57. PHASE 4 — Authentication & Synchronization Foundation

### Goal

Introduce shared state without breaking the local-first model.

### Build

* email/password authentication
* session management
* device identity
* guest upgrade
* guest merge
* operation IDs
* local outbox
* server inbox
* pull/push sync
* cursors
* idempotency
* acknowledgements
* retry
* synchronization state
* server canonical state

### Verification

Use two devices or emulator instances.

Test:

```text
Device A offline → create local state
Device B offline → create local state
Reconnect
Sync
Verify convergence
```

Repeat operations intentionally.

Ensure no duplicates appear.

---

# 58. PHASE 5 — Real Shared Groups

### Goal

Extend private groups into real multi-user groups.

### Build

* authenticated group creation
* invitations
* real group membership
* owner/member permissions
* guest participants
* shared expense creation
* shared expense synchronization
* owner-only editing
* shared settlements
* server-side authorization
* graph visibility
* personal settlement view

### Verification

Two real users:

```text
User A creates group
User B joins
A creates expense
B views expense
B inspects graph
B settles amount
```

Then test offline:

```text
A disconnects
A creates shared expense
A reconnects
Server canonicalizes
B receives update
```

---

# 59. PHASE 6 — Investments, Liabilities & Net Worth

### Goal

Expand from spending management into wealth management.

### Build

Investments:

* FD
* RD
* mutual funds
* stocks
* ETFs
* bonds
* PPF
* EPF
* NPS
* gold
* ESOP/RSU/manual assets

Liabilities:

* credit cards
* loans
* EMI
* BNPL
* other debt

Net worth:

* assets
* liabilities
* historical net worth
* contribution changes
* value changes
* allocation

### Verification

Entire portfolio should be constructible offline.

Then verify:

```text
Assets
+
Liabilities
↓
Net Worth
```

Check historical changes and investment calculations.

---

# 60. PHASE 7 — Advanced Money Workflows

### Build

* lending
* borrowing
* repayments
* reimbursements
* recurring detection
* subscription detection
* custom reports
* advanced exports
* import
* receipt attachment foundations

### Verification

Use a realistic dataset:

```text
Salary
Bills
Trip
Reimbursement
Personal loan
Investments
Liabilities
```

Then:

* produce report
* verify balances
* export
* re-import
* compare results

---

# 61. PHASE 8 — Intelligence & Ecosystem

### Build later

* receipt extraction
* merchant categorization
* automatic categorization
* anomaly detection
* cash-flow forecasting
* financial explanations
* natural-language queries
* live investment valuation
* external integrations

Examples:

```text
Why did I spend more this month?

Who owes me money?

How much did I invest this year?

Can I afford a ₹70,000 laptop?

Why did my net worth increase?
```

Intelligence must be additive.

The deterministic financial ledger remains the source of truth.

AI must never silently modify financial state.

---

# 62. Phase Verification Standard

Every phase must prove:

### Persistence

Data survives:

* app restart
* process termination
* offline operation

### Determinism

The same source data produces the same financial result.

### Integrity

Money cannot be duplicated or lost due to retries.

### Authorization

Unauthorized shared writes are rejected.

### Synchronization

Shared data converges to canonical server state.

### Explainability

Important financial calculations can be traced to their source data.

### Offline capability

Explicitly offline features have no hidden network dependency.

---

# 63. Development Workflow for AI Agents

For every feature:

## Step 1 — Understand

Read:

* relevant domain docs
* relevant package README
* existing implementation
* related tests
* ADRs

## Step 2 — Specify

Define:

* user behavior
* domain rules
* invariants
* offline requirements
* server requirements
* data model changes

## Step 3 — Test

Write the smallest functional test that proves the requirement.

## Step 4 — Implement

Prefer:

```text
Domain
→ Application
→ Persistence
→ API/sync if required
→ UI
```

## Step 5 — Verify

Run:

* tests
* type checking
* linting
* local functional workflow
* relevant E2E workflow

## Step 6 — Document

Update:

* package README
* implementation log
* ADR if needed
* phase checklist

---

# 64. What AI Agents Must NOT Do

Do not:

* introduce a server dependency unnecessarily
* put business logic in React components
* trust client authorization
* use floats for money
* create arbitrary mutable balance totals
* use another DB without justification
* add microservices prematurely
* build all phases simultaneously
* introduce speculative abstractions
* create tests that only mirror implementation details
* hide financial behavior behind opaque AI logic
* silently change financial calculations
* ignore offline requirements
* break the phase verification gate

---

# 65. Phase-Based Verification Philosophy

The developer should be able to say:

```text
Phase 0 complete
→ verified

Phase 1 complete
→ verified

Phase 2 complete
→ verified

...
```

Every phase should end with a manually demonstrable product.

Do not continue adding features indefinitely without validating the current phase.

---

# 66. Initial Feature Priority Summary

## Tier 0 — Foundations

* monorepo
* Expo
* Gluestack
* themes
* SQLite
* domain model
* Hono
* PostgreSQL
* auth foundation
* AI documentation
* tests
* CI

## Tier 1 — MVP

* guest mode
* expenses
* income
* accounts
* categories
* cash
* reports
* private groups
* splits
* settlements
* dependency graph

## Tier 2 — Personal Finance

* budgets
* goals
* recurring expenses
* savings rate
* advanced reports
* projections

## Tier 3 — Multi-user

* authentication
* guest merge
* sync
* real groups
* invitations
* permissions
* shared settlement

## Tier 4 — Wealth

* investments
* liabilities
* net worth
* portfolio analytics

## Tier 5 — Advanced Workflows

* lending
* reimbursements
* subscriptions
* exports/imports
* receipts

## Tier 6 — Intelligence & Ecosystem

* AI queries
* automatic categorization
* anomaly detection
* forecasting
* OCR
* external integrations
* live valuations

---

# 67. Features Explicitly Deferred

Do not build these in the early phases unless the roadmap is intentionally changed:

* stock trading
* mutual fund purchasing
* payment initiation
* direct UPI payments
* credit products
* lending marketplace
* insurance marketplace
* financial advisory
* tax filing
* credit-score marketplace
* complex fintech integrations

The application should initially be a **financial management and tracking system**, not a regulated financial-services platform.

---

# 68. Product Definition of Done

The product is broadly successful when a user can:

1. open the application as a guest
2. manage money without network connectivity
3. record income and expenses
4. manage accounts and cash
5. create budgets and goals
6. create private groups
7. split expenses transparently
8. inspect settlement calculations through the graph
9. settle balances
10. create an account
11. merge guest data
12. sync across devices
13. join real shared groups
14. safely participate in shared expenses
15. track liabilities
16. track investments
17. calculate net worth
18. inspect historical reports
19. export their data
20. keep core financial operations independent of network availability

---

# 69. North Star

The application should not feel like separate products called:

* Expense Tracker
* Splitwise
* Investment Tracker
* Budget App

It should feel like one system.

A transaction should be capable of participating in multiple views.

Example:

```text
₹5,000 transaction

Account:
HDFC Credit Card

Category:
Food

Group:
Goa Trip

Paid by:
Nikhil

Owed by:
Nikhil + Rahul + Arjun

Reimbursable:
No

Settlement:
₹3,200 outstanding
```

That same data can contribute to:

```text
Personal spending
↓
Food reports
↓
Monthly budget
↓
Group balance
↓
Settlement graph
↓
Cash-flow analysis
↓
Net-worth calculation
```

This shared underlying model is more important than any individual screen.

---

# 70. Current Stack Decisions

Use:

```text
Mobile:
React Native + Expo

UI:
Gluestack UI v5

Styling:
centralized theme/design-token system

Local database:
SQLite

Backend:
Hono

Server database:
PostgreSQL

Repository:
pnpm + Turborepo

Web:
minimal React-based web client

Deployment:
Cloudflare / Vercel / self-hosted

Authentication:
own authentication system

Object storage:
S3-compatible storage when required
```

These should be treated as defaults until a documented ADR changes them.

---

# 71. Final Engineering Principle

The system should be built in this order of conceptual dependency:

```text
Financial domain
        ↓
Deterministic calculations
        ↓
Local persistence
        ↓
Useful offline application
        ↓
Private groups
        ↓
Synchronization
        ↓
Real shared groups
        ↓
Investments / liabilities / net worth
        ↓
Advanced workflows
        ↓
Intelligence / integrations
```

Do not reverse this order.

Do not build synchronization before the underlying financial model is correct.

Do not build AI intelligence before deterministic financial behavior is correct.

Do not build third-party integrations before the manual experience is valuable.

The core principle is:

> **Make the local financial engine correct first. Make sharing authoritative second. Add intelligence last.**

