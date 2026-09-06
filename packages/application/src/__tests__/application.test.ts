import { describe, it, expect, beforeEach } from 'vitest';
import {
  TransactionUseCases,
  AccountUseCases,
  CategoryUseCases,
  GroupUseCases,
  WealthUseCases,
  type AccountRepository,
  type TransactionRepository,
  type CategoryRepository,
  type GroupRepository,
  type WealthRepository,
} from '../index.js';
import type {
  Account,
  Category,
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
  async findByAccountId(accountId: string) {
    return this.txs.filter((t) => t.accountId === accountId || (t.type === 'transfer' && t.toAccountId === accountId));
  }
  async findByDateRange() { return this.txs; }
  async findAll() { return this.txs; }
  async update(tx: Transaction) {
    const idx = this.txs.findIndex((t) => t.id === tx.id);
    if (idx !== -1) this.txs[idx] = tx;
  }
  async delete(id: string) { this.txs = this.txs.filter((t) => t.id !== id); }
}

class InMemoryCategoryRepo implements CategoryRepository {
  categories: Map<string, Category> = new Map();
  async create(cat: Category) { this.categories.set(cat.id, cat); }
  async findById(id: string) { return this.categories.get(id) ?? null; }
  async findAll() { return Array.from(this.categories.values()); }
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
  let categoryRepo: InMemoryCategoryRepo;
  let txUseCases: TransactionUseCases;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepo();
    txRepo = new InMemoryTxRepo();
    categoryRepo = new InMemoryCategoryRepo();
    txUseCases = new TransactionUseCases(accountRepo, txRepo, categoryRepo);
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

  it('updates an existing transaction and validates destination account on transfers', async () => {
    const acc: Account = {
      id: 'acc-main',
      name: 'Main Account',
      type: 'bank',
      initialBalanceMinor: 50000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await accountRepo.create(acc);

    const tx: Transaction = {
      id: 'tx-up-1',
      accountId: 'acc-main',
      type: 'expense',
      amountMinor: 10000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: null,
      subcategory: null,
      merchant: 'Old Merchant',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await txUseCases.createTransaction(tx);

    // Update merchant and amount
    await txUseCases.updateTransaction({
      ...tx,
      amountMinor: 15000,
      merchant: 'New Merchant',
    });

    const updated = await txRepo.findById('tx-up-1');
    expect(updated?.amountMinor).toBe(15000);
    expect(updated?.merchant).toBe('New Merchant');

    // Derived balance reflects updated amount: 50,000 - 15,000 = 35,000
    const bal = await txUseCases.getDerivedAccountBalance('acc-main');
    expect(bal).toBe(35000);

    // Throws when updating non-existent transaction
    await expect(
      txUseCases.updateTransaction({
        ...tx,
        id: 'non-existent',
      })
    ).rejects.toThrow('Transaction not found');
  });

  it('deletes an existing transaction and recalculates balance', async () => {
    const acc: Account = {
      id: 'acc-del',
      name: 'Del Account',
      type: 'bank',
      initialBalanceMinor: 10000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await accountRepo.create(acc);

    const tx: Transaction = {
      id: 'tx-del-1',
      accountId: 'acc-del',
      type: 'expense',
      amountMinor: 3000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: null,
      subcategory: null,
      merchant: 'Cafe',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await txUseCases.createTransaction(tx);
    expect(await txUseCases.getDerivedAccountBalance('acc-del')).toBe(7000);

    await txUseCases.deleteTransaction('tx-del-1');
    expect(await txRepo.findById('tx-del-1')).toBeNull();
    expect(await txUseCases.getDerivedAccountBalance('acc-del')).toBe(10000);

    await expect(txUseCases.deleteTransaction('non-existent')).rejects.toThrow('Transaction not found');
  });

  it('searches and filters transactions by query, category, and date range', async () => {
    const acc: Account = {
      id: 'acc-sf',
      name: 'SF Account',
      type: 'bank',
      initialBalanceMinor: 100000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await accountRepo.create(acc);

    await txUseCases.createTransaction({
      id: 'tx-sf-1',
      accountId: 'acc-sf',
      type: 'expense',
      amountMinor: 50000,
      currency: 'INR',
      date: '2026-09-02',
      categoryId: 'cat-groceries',
      subcategory: 'daily',
      merchant: 'Zepto',
      notes: 'Weekly fresh fruits',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await txUseCases.createTransaction({
      id: 'tx-sf-2',
      accountId: 'acc-sf',
      type: 'expense',
      amountMinor: 20000,
      currency: 'INR',
      date: '2026-09-08',
      categoryId: 'cat-food',
      subcategory: 'coffee',
      merchant: 'Blue Tokai',
      notes: 'Cold brew',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Search query on notes
    const searchResults = await txUseCases.searchAndFilter({ searchQuery: 'fruits' });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.id).toBe('tx-sf-1');

    // Filter by category
    const categoryResults = await txUseCases.searchAndFilter({ categoryId: 'cat-food' });
    expect(categoryResults).toHaveLength(1);
    expect(categoryResults[0]?.id).toBe('tx-sf-2');
  });

  it('generates monthly report with category breakdown using category repository', async () => {
    const acc: Account = {
      id: 'acc-rep',
      name: 'Report Account',
      type: 'bank',
      initialBalanceMinor: 200000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await accountRepo.create(acc);

    await categoryRepo.create({
      id: 'cat-dining',
      name: 'Dining & Restaurants',
      icon: 'utensils',
      parentCategoryId: null,
      isBuiltin: true,
    });

    // Income ₹50,000
    await txUseCases.createTransaction({
      id: 'tx-rep-1',
      accountId: 'acc-rep',
      type: 'income',
      amountMinor: 5000000,
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

    // Expense ₹10,000
    await txUseCases.createTransaction({
      id: 'tx-rep-2',
      accountId: 'acc-rep',
      type: 'expense',
      amountMinor: 1000000,
      currency: 'INR',
      date: '2026-09-05',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Italian Bistro',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const report = await txUseCases.getMonthlyReport(2026, 9);
    expect(report.year).toBe(2026);
    expect(report.month).toBe(9);
    expect(report.totalIncomeMinor).toBe(5000000);
    expect(report.totalExpenseMinor).toBe(1000000);
    expect(report.netSavingsMinor).toBe(4000000);
    expect(report.savingsRatePercent).toBe(80);
    expect(report.categoryBreakdown[0]?.categoryName).toBe('Dining & Restaurants');
    expect(report.topMerchants[0]).toEqual({
      merchant: 'Italian Bistro',
      spentMinor: 1000000,
    });
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

describe('Application: Account Use Cases', () => {
  let accountRepo: InMemoryAccountRepo;
  let txRepo: InMemoryTxRepo;
  let accountUseCases: AccountUseCases;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepo();
    txRepo = new InMemoryTxRepo();
    accountUseCases = new AccountUseCases(accountRepo, txRepo);
  });

  it('creates and retrieves accounts', async () => {
    const account: Account = {
      id: 'acc-new-1',
      name: 'Salary Account',
      type: 'bank',
      initialBalanceMinor: 250000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    await accountUseCases.createAccount(account);
    const retrieved = await accountUseCases.getAccount('acc-new-1');
    expect(retrieved).toEqual(account);

    const nonExistent = await accountUseCases.getAccount('non-existent');
    expect(nonExistent).toBeNull();
  });

  it('archives an account and throws when archiving non-existent account', async () => {
    const account: Account = {
      id: 'acc-arch-1',
      name: 'Old Wallet',
      type: 'wallet',
      initialBalanceMinor: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await accountUseCases.createAccount(account);

    await accountUseCases.archiveAccount('acc-arch-1');
    const updated = await accountUseCases.getAccount('acc-arch-1');
    expect(updated?.isArchived).toBe(true);

    await expect(accountUseCases.archiveAccount('does-not-exist')).rejects.toThrow('Account not found');
  });

  it('lists accounts with accurate derived balances from transactions', async () => {
    const bank: Account = {
      id: 'acc-b1',
      name: 'HDFC Bank',
      type: 'bank',
      initialBalanceMinor: 500000, // ₹5,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const cash: Account = {
      id: 'acc-c1',
      name: 'Pocket Cash',
      type: 'cash',
      initialBalanceMinor: 100000, // ₹1,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const oldAcc: Account = {
      id: 'acc-old',
      name: 'Closed Account',
      type: 'other',
      initialBalanceMinor: 0,
      currency: 'INR',
      isArchived: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    await accountUseCases.createAccount(bank);
    await accountUseCases.createAccount(cash);
    await accountUseCases.createAccount(oldAcc);

    // Bank receives ₹2,000 income
    await txRepo.create({
      id: 'tx-1',
      accountId: 'acc-b1',
      type: 'income',
      amountMinor: 200000,
      currency: 'INR',
      date: '2026-09-02',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    });

    // Bank transfers ₹1,000 to Cash
    await txRepo.create({
      id: 'tx-2',
      accountId: 'acc-b1',
      type: 'transfer',
      amountMinor: 100000,
      currency: 'INR',
      date: '2026-09-03',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: 'acc-c1',
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    });

    // Cash spends ₹400 on snacks
    await txRepo.create({
      id: 'tx-3',
      accountId: 'acc-c1',
      type: 'expense',
      amountMinor: 40000,
      currency: 'INR',
      date: '2026-09-04',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });

    // All accounts including archived
    const all = await accountUseCases.listAccountsWithDerivedBalances(true);
    expect(all).toHaveLength(3);

    const bankResult = all.find((a) => a.id === 'acc-b1');
    // Bank: 5,000 + 2,000 - 1,000 = 6,000 (600000 minor)
    expect(bankResult?.derivedBalanceMinor).toBe(600000);
    expect(bankResult?.account.name).toBe('HDFC Bank');

    const cashResult = all.find((a) => a.id === 'acc-c1');
    // Cash: 1,000 + 1,000 - 400 = 1,600 (160000 minor)
    expect(cashResult?.derivedBalanceMinor).toBe(160000);

    // Active accounts only
    const activeOnly = await accountUseCases.listAccountsWithDerivedBalances(false);
    expect(activeOnly).toHaveLength(2);
    expect(activeOnly.map((a) => a.id)).not.toContain('acc-old');
  });
});

describe('Application: Category Use Cases', () => {
  let categoryRepo: InMemoryCategoryRepo;
  let categoryUseCases: CategoryUseCases;

  beforeEach(() => {
    categoryRepo = new InMemoryCategoryRepo();
    categoryUseCases = new CategoryUseCases(categoryRepo);
  });

  it('lists existing categories', async () => {
    await categoryRepo.create({
      id: 'cat-1',
      name: 'Food',
      icon: 'utensils',
      parentCategoryId: null,
      isBuiltin: true,
    });
    await categoryRepo.create({
      id: 'cat-2',
      name: 'Transport',
      icon: 'car',
      parentCategoryId: null,
      isBuiltin: true,
    });

    const list = await categoryUseCases.listCategories();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.name)).toEqual(['Food', 'Transport']);
  });

  it('creates a custom category with isBuiltin set to false', async () => {
    await categoryUseCases.createCustomCategory({
      id: 'custom-cat-1',
      name: 'Board Games',
      icon: 'dice',
      parentCategoryId: null,
    });

    const categories = await categoryUseCases.listCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toEqual({
      id: 'custom-cat-1',
      name: 'Board Games',
      icon: 'dice',
      parentCategoryId: null,
      isBuiltin: false,
    });
  });
});
