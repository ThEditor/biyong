import { describe, it, expect, beforeEach } from 'vitest';
import {
  TransactionUseCases,
  GroupUseCases,
  WealthUseCases,
  type AccountRepository,
  type TransactionRepository,
  type GroupRepository,
  type WealthRepository,
} from '../index.js';
import type {
  Account,
  Transaction,
  Group,
  GroupMember,
  GroupExpense,
  Settlement,
  Investment,
  Liability,
} from '@biyong/schemas';

class InMemoryAccountRepo implements AccountRepository {
  accounts: Map<string, Account> = new Map();
  async create(account: Account) { this.accounts.set(account.id, account); }
  async findById(id: string) { return this.accounts.get(id) ?? null; }
  async findAll() { return Array.from(this.accounts.values()); }
  async update(account: Account) { this.accounts.set(account.id, account); }
  async delete(id: string) { this.accounts.delete(id); }
}

class InMemoryTxRepo implements TransactionRepository {
  txs: Transaction[] = [];
  async create(tx: Transaction) { this.txs.push(tx); }
  async findById(id: string) { return this.txs.find((t) => t.id === id) ?? null; }
  async findByAccountId(accountId: string) { return this.txs.filter((t) => t.accountId === accountId); }
  async findByDateRange() { return this.txs; }
  async findAll() { return this.txs; }
  async update(tx: Transaction) {
    const idx = this.txs.findIndex((t) => t.id === tx.id);
    if (idx !== -1) this.txs[idx] = tx;
  }
  async delete(id: string) { this.txs = this.txs.filter((t) => t.id !== id); }
}

class InMemoryGroupRepo implements GroupRepository {
  groups: Map<string, Group> = new Map();
  members: GroupMember[] = [];
  expenses: GroupExpense[] = [];
  settlements: Settlement[] = [];

  async create(g: Group) { this.groups.set(g.id, g); }
  async findById(id: string) { return this.groups.get(id) ?? null; }
  async findAll() { return Array.from(this.groups.values()); }
  async addMember(m: GroupMember) { this.members.push(m); }
  async getMembers(groupId: string) { return this.members.filter((m) => m.groupId === groupId); }
  async addExpense(e: GroupExpense) { this.expenses.push(e); }
  async getExpenses(groupId: string) { return this.expenses.filter((e) => e.groupId === groupId); }
  async addSettlement(s: Settlement) { this.settlements.push(s); }
  async getSettlements(groupId: string) { return this.settlements.filter((s) => s.groupId === groupId); }
}

class InMemoryWealthRepo implements WealthRepository {
  investments: Investment[] = [];
  liabilities: Liability[] = [];
  async getInvestments() { return this.investments; }
  async saveInvestment(inv: Investment) { this.investments.push(inv); }
  async getLiabilities() { return this.liabilities; }
  async saveLiability(liab: Liability) { this.liabilities.push(liab); }
}

describe('Application: Transactions & Derived Balances', () => {
  let accountRepo: InMemoryAccountRepo;
  let txRepo: InMemoryTxRepo;
  let txUseCases: TransactionUseCases;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepo();
    txRepo = new InMemoryTxRepo();
    txUseCases = new TransactionUseCases(accountRepo, txRepo);
  });

  it('correctly calculates derived account balance through income, expenses, transfers', async () => {
    const checking: Account = {
      id: 'acc-1',
      name: 'Checking Bank',
      type: 'bank',
      initialBalanceMinor: 100000, // ₹1,000
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const cash: Account = {
      id: 'acc-2',
      name: 'Cash Wallet',
      type: 'cash',
      initialBalanceMinor: 20000, // ₹200
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await accountRepo.create(checking);
    await accountRepo.create(cash);

    // Income: Salary ₹5,000 into Checking
    await txUseCases.createTransaction({
      id: 'tx-1',
      accountId: 'acc-1',
      type: 'income',
      amountMinor: 500000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: 'salary',
      subcategory: null,
      merchant: 'Company',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Expense: Grocery ₹1,200 from Checking
    await txUseCases.createTransaction({
      id: 'tx-2',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 120000,
      currency: 'INR',
      date: '2026-09-02',
      categoryId: 'grocery',
      subcategory: null,
      merchant: 'Supermarket',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Transfer: ATM Withdrawal ₹1,000 from Checking to Cash
    await txUseCases.createTransaction({
      id: 'tx-3',
      accountId: 'acc-1',
      type: 'transfer',
      amountMinor: 100000,
      currency: 'INR',
      date: '2026-09-03',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: 'ATM Cash',
      toAccountId: 'acc-2',
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Checking: 1,000 + 5,000 - 1,200 - 1,000 = 3,800 (380000 minor)
    const checkingBal = await txUseCases.getDerivedAccountBalance('acc-1');
    expect(checkingBal).toBe(380000);

    // Cash: 200 + 1,000 = 1,200 (120000 minor)
    const cashBal = await txUseCases.getDerivedAccountBalance('acc-2');
    expect(cashBal).toBe(120000);
  });
});

describe('Application: Groups & Settlements', () => {
  it('orchestrates group creation, expense addition, and settlement explanation', async () => {
    const groupRepo = new InMemoryGroupRepo();
    const groupUseCases = new GroupUseCases(groupRepo);

    const group: Group = {
      id: 'g-trip',
      name: 'Goa Trip',
      isPrivate: true,
      ownerId: 'm1',
      currency: 'INR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const members: GroupMember[] = [
      { id: 'm1', groupId: 'g-trip', name: 'Nikhil', userId: null, isDummy: true, role: 'owner', createdAt: new Date().toISOString() },
      { id: 'm2', groupId: 'g-trip', name: 'Rahul', userId: null, isDummy: true, role: 'member', createdAt: new Date().toISOString() },
      { id: 'm3', groupId: 'g-trip', name: 'Arjun', userId: null, isDummy: true, role: 'member', createdAt: new Date().toISOString() },
    ];

    await groupUseCases.createGroup(group, members);

    // Nikhil pays ₹3,000 for Beach Shack, split equally
    await groupUseCases.addExpense({
      id: 'exp-beach',
      groupId: 'g-trip',
      title: 'Beach Shack Lunch',
      amountMinor: 300000,
      currency: 'INR',
      date: '2026-09-06',
      createdByMemberId: 'm1',
      payers: [{ memberId: 'm1', amountMinor: 300000 }],
      splitMethod: 'equal',
      allocations: [{ memberId: 'm1' }, { memberId: 'm2' }, { memberId: 'm3' }],
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const plan = await groupUseCases.getGroupSettlementPlan('g-trip');
    expect(plan.simplifiedTransfers).toHaveLength(2);
    // m2 owes m1 ₹1,000; m3 owes m1 ₹1,000
    expect(plan.simplifiedTransfers).toContainEqual({
      fromMemberId: 'm2',
      toMemberId: 'm1',
      amountMinor: 100000,
    });
    expect(plan.simplifiedTransfers).toContainEqual({
      fromMemberId: 'm3',
      toMemberId: 'm1',
      amountMinor: 100000,
    });

    const explanation = await groupUseCases.explainSettlement('g-trip', 'm2');
    expect(explanation.netBalanceMinor).toBe(-100000);
    expect(explanation.origins[0]?.expenseTitle).toBe('Beach Shack Lunch');
  });
});
