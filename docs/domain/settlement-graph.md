# Transparent Settlement & Dependency Graph

## Explainability Over Magic
Rather than presenting arbitrary balances like "Rahul owes Nikhil ₹640", Biyong preserves the derivation chain:

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

## Debt Simplification Algorithm
Implemented in `@biyong/domain/src/settlements.ts`. Uses a greedy min-cash-flow algorithm to minimize total transactions between debtors and creditors without modifying net balances.
