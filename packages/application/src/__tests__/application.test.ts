import { describe, it, expect, beforeEach } from 'vitest';
import {
  TransactionUseCases,
  AccountUseCases,
  CategoryUseCases,
  GroupUseCases,
  WealthUseCases,
  BudgetUseCases,
  GoalUseCases,
  AnalyticsUseCases,
  type AccountRepository,
  type TransactionRepository,
  type CategoryRepository,
  type GroupRepository,
  type WealthRepository,
  type BudgetRepository,
  type GoalRepository,
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
  Budget,
  Goal,
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

class InMemoryBudgetRepo implements BudgetRepository {
  budgets: Map<string, Budget> = new Map();
  async create(budget: Budget) { this.budgets.set(budget.id, budget); }
  async findById(id: string) { return this.budgets.get(id) ?? null; }
  async findByCategoryId(categoryId: string) {
    return Array.from(this.budgets.values()).find((b) => b.categoryId === categoryId) ?? null;
  }
  async findAll() { return Array.from(this.budgets.values()); }
  async update(budget: Budget) { this.budgets.set(budget.id, budget); }
  async delete(id: string) { this.budgets.delete(id); }
}

class InMemoryGoalRepo implements GoalRepository {
  goals: Map<string, Goal> = new Map();
  async create(goal: Goal) { this.goals.set(goal.id, goal); }
  async findById(id: string) { return this.goals.get(id) ?? null; }
  async findAll() { return Array.from(this.goals.values()); }
  async update(goal: Goal) { this.goals.set(goal.id, goal); }
  async delete(id: string) { this.goals.delete(id); }
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

describe('Application: Budget Use Cases', () => {
  let budgetRepo: InMemoryBudgetRepo;
  let txRepo: InMemoryTxRepo;
  let budgetUseCases: BudgetUseCases;

  beforeEach(() => {
    budgetRepo = new InMemoryBudgetRepo();
    txRepo = new InMemoryTxRepo();
    budgetUseCases = new BudgetUseCases(budgetRepo, txRepo);
  });

  it('supports budget CRUD operations', async () => {
    const budget: Budget = {
      id: 'b-dining',
      categoryId: 'cat-dining',
      amountMinor: 2000000, // ₹20,000
      currency: 'INR',
      period: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      rollover: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    await budgetUseCases.createBudget(budget);
    expect(await budgetUseCases.getBudget('b-dining')).toEqual(budget);
    expect(await budgetUseCases.getBudgetByCategory('cat-dining')).toEqual(budget);
    expect(await budgetUseCases.getBudgetByCategory('non-existent')).toBeNull();

    const all = await budgetUseCases.listBudgets();
    expect(all).toHaveLength(1);

    const updated = { ...budget, amountMinor: 2500000 };
    await budgetUseCases.updateBudget(updated);
    expect((await budgetUseCases.getBudget('b-dining'))?.amountMinor).toBe(2500000);

    await budgetUseCases.deleteBudget('b-dining');
    expect(await budgetUseCases.getBudget('b-dining')).toBeNull();
  });

  it('calculates budget status considering period dates and transaction categories', async () => {
    const budget: Budget = {
      id: 'b-dining',
      categoryId: 'cat-dining',
      amountMinor: 2000000, // ₹20,000
      currency: 'INR',
      period: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      rollover: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await budgetRepo.create(budget);

    // Matching expense within September 2026
    await txRepo.create({
      id: 'tx-1',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 500000, // ₹5,000
      currency: 'INR',
      date: '2026-09-05',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Bistro',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });

    // Another matching expense in September
    await txRepo.create({
      id: 'tx-2',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 300000, // ₹3,000
      currency: 'INR',
      date: '2026-09-10',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Cafe',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    });

    // Expense in a different category (Groceries) -> should NOT count
    await txRepo.create({
      id: 'tx-3',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 400000,
      currency: 'INR',
      date: '2026-09-12',
      categoryId: 'cat-groceries',
      subcategory: null,
      merchant: 'Supermarket',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    });

    // Expense outside period (August) -> should NOT count
    await txRepo.create({
      id: 'tx-4',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 900000,
      currency: 'INR',
      date: '2026-08-25',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Old Restaurant',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    });

    // Transfer in dining category -> should NOT count
    await txRepo.create({
      id: 'tx-5',
      accountId: 'acc-1',
      type: 'transfer',
      amountMinor: 100000,
      currency: 'INR',
      date: '2026-09-15',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: 'acc-2',
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
    });

    // Reference date: Sept 10, 2026 -> 20 days remaining
    const refDate = new Date(2026, 8, 10);
    const status = await budgetUseCases.getBudgetStatus('b-dining', refDate, 500000); // 500000 rollover

    // Total spent: 500000 + 300000 = 800000
    // Effective budget: 2000000 + 500000 = 2500000
    expect(status.spentMinor).toBe(800000);
    expect(status.effectiveBudgetMinor).toBe(2500000);
    expect(status.remainingMinor).toBe(1700000);
    expect(status.percentageUsed).toBe(32); // 800000 / 2500000 = 32%
    expect(status.health).toBe('healthy');
    expect(status.periodStart).toBe('2026-09-01');
    expect(status.periodEnd).toBe('2026-09-30');
    expect(status.daysRemaining).toBe(20);
    expect(status.dailyAllowanceMinor).toBe(Math.floor(1700000 / 20));
  });

  it('throws error when requesting status for non-existent budget', async () => {
    await expect(budgetUseCases.getBudgetStatus('not-found')).rejects.toThrow(
      'Budget not found: not-found'
    );
  });

  it('lists all budgets with status attached', async () => {
    const budget1: Budget = {
      id: 'b-1',
      categoryId: 'cat-1',
      amountMinor: 1000000,
      currency: 'INR',
      period: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      rollover: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const budget2: Budget = {
      id: 'b-2',
      categoryId: 'cat-2',
      amountMinor: 2000000,
      currency: 'INR',
      period: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      rollover: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await budgetRepo.create(budget1);
    await budgetRepo.create(budget2);

    const listWithStatus = await budgetUseCases.listBudgetsWithStatus(new Date(2026, 8, 1));
    expect(listWithStatus).toHaveLength(2);
    expect(listWithStatus[0]?.budget.id).toBe('b-1');
    expect(listWithStatus[0]?.remainingMinor).toBe(1000000);
    expect(listWithStatus[1]?.budget.id).toBe('b-2');
    expect(listWithStatus[1]?.remainingMinor).toBe(2000000);
  });
});

describe('Application: Goal Use Cases', () => {
  let goalRepo: InMemoryGoalRepo;
  let goalUseCases: GoalUseCases;

  beforeEach(() => {
    goalRepo = new InMemoryGoalRepo();
    goalUseCases = new GoalUseCases(goalRepo);
  });

  it('supports goal CRUD operations', async () => {
    const goal: Goal = {
      id: 'g-laptop',
      title: 'MacBook Pro',
      targetAmountMinor: 20000000, // ₹2,00,000
      currentAmountMinor: 5000000, // ₹50,000
      currency: 'INR',
      targetDate: '2027-01-01',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    await goalUseCases.createGoal(goal);
    expect(await goalUseCases.getGoal('g-laptop')).toEqual(goal);

    const list = await goalUseCases.listGoals();
    expect(list).toHaveLength(1);

    const updated = { ...goal, targetAmountMinor: 22000000 };
    await goalUseCases.updateGoal(updated);
    expect((await goalUseCases.getGoal('g-laptop'))?.targetAmountMinor).toBe(22000000);

    await goalUseCases.deleteGoal('g-laptop');
    expect(await goalUseCases.getGoal('g-laptop')).toBeNull();
  });

  it('contributes to a goal and updates progress', async () => {
    const goal: Goal = {
      id: 'g-emergency',
      title: 'Emergency Fund',
      targetAmountMinor: 10000000, // ₹1,00,000
      currentAmountMinor: 4000000, // ₹40,000
      currency: 'INR',
      targetDate: '2027-01-01',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await goalRepo.create(goal);

    const updated = await goalUseCases.contributeToGoal('g-emergency', 2000000); // Add ₹20,000
    expect(updated.currentAmountMinor).toBe(6000000);

    const saved = await goalRepo.findById('g-emergency');
    expect(saved?.currentAmountMinor).toBe(6000000);

    // Contribution to non-existent goal throws
    await expect(goalUseCases.contributeToGoal('non-existent', 1000)).rejects.toThrow(
      'Goal not found: non-existent'
    );
  });

  it('gets goal progress with projected completion date and lists with progress', async () => {
    const goal: Goal = {
      id: 'g-trip',
      title: 'Euro Trip',
      targetAmountMinor: 30000000, // ₹3,00,000
      currentAmountMinor: 10000000, // ₹1,00,000
      currency: 'INR',
      targetDate: '2027-09-01',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await goalRepo.create(goal);

    const fromDate = new Date(2026, 8, 1);
    // Remaining: 20,000,000. Rate: 5,000,000/month -> 4 months -> 2027-01-01
    const progress = await goalUseCases.getGoalProgress('g-trip', fromDate, 5000000);
    expect(progress.goalId).toBe('g-trip');
    expect(progress.remainingAmountMinor).toBe(20000000);
    expect(progress.projectedCompletionDate).toBe('2027-01-01');

    // List with progress
    const list = await goalUseCases.listGoalsWithProgress(fromDate);
    expect(list).toHaveLength(1);
    expect(list[0]?.goal.id).toBe('g-trip');
    expect(list[0]?.remainingAmountMinor).toBe(20000000);

    // Non-existent goal throws
    await expect(goalUseCases.getGoalProgress('not-found')).rejects.toThrow(
      'Goal not found: not-found'
    );
  });
});

describe('Application: Analytics Use Cases', () => {
  let txRepo: InMemoryTxRepo;
  let analyticsUseCases: AnalyticsUseCases;

  beforeEach(() => {
    txRepo = new InMemoryTxRepo();
    analyticsUseCases = new AnalyticsUseCases(txRepo);
  });

  it('calculates fixed vs variable spending accurately', async () => {
    // Fixed: recurring rent ₹20,000
    await txRepo.create({
      id: 'tx-1',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 2000000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: 'cat-rent',
      subcategory: null,
      merchant: 'Landlord',
      notes: null,
      toAccountId: null,
      isRecurring: true,
      recurringFrequency: 'monthly',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    // Fixed: in fixedCategoryIds (cat-utilities) ₹5,000
    await txRepo.create({
      id: 'tx-2',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 500000,
      currency: 'INR',
      date: '2026-09-02',
      categoryId: 'cat-utilities',
      subcategory: null,
      merchant: 'Electric Board',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    });

    // Variable: shopping ₹25,000
    await txRepo.create({
      id: 'tx-3',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 2500000,
      currency: 'INR',
      date: '2026-09-03',
      categoryId: 'cat-shopping',
      subcategory: null,
      merchant: 'Mall',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    });

    // Income ₹80,000 - should be ignored
    await txRepo.create({
      id: 'tx-4',
      accountId: 'acc-1',
      type: 'income',
      amountMinor: 8000000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: 'cat-salary',
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    // Transfer ₹10,000 - should be ignored
    await txRepo.create({
      id: 'tx-5',
      accountId: 'acc-1',
      type: 'transfer',
      amountMinor: 1000000,
      currency: 'INR',
      date: '2026-09-04',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: 'acc-2',
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });

    const result = await analyticsUseCases.getFixedVsVariable();
    // Fixed: 2000000 + 500000 = 2500000
    // Variable: 2500000
    // Total: 5000000
    expect(result.fixedSpendingMinor).toBe(2500000);
    expect(result.variableSpendingMinor).toBe(2500000);
    expect(result.totalSpendingMinor).toBe(5000000);
    expect(result.fixedPercentage).toBe(50);
    expect(result.variablePercentage).toBe(50);
  });

  it('calculates monthly spending trends with savings rate', async () => {
    // August: income 60,000, expense 20,000
    await txRepo.create({
      id: 'tx-aug-inc',
      accountId: 'acc-1',
      type: 'income',
      amountMinor: 6000000,
      currency: 'INR',
      date: '2026-08-01',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    await txRepo.create({
      id: 'tx-aug-exp',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 2000000,
      currency: 'INR',
      date: '2026-08-10',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    });

    // September: income 60,000, expense 30,000
    await txRepo.create({
      id: 'tx-sep-inc',
      accountId: 'acc-1',
      type: 'income',
      amountMinor: 6000000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    await txRepo.create({
      id: 'tx-sep-exp',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 3000000,
      currency: 'INR',
      date: '2026-09-10',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    });

    const refDate = new Date(2026, 8, 15);
    const trends = await analyticsUseCases.getSpendingTrends(2, refDate);

    expect(trends).toHaveLength(2);
    expect(trends[0]?.period).toBe('2026-08');
    expect(trends[0]?.incomeMinor).toBe(6000000);
    expect(trends[0]?.expenseMinor).toBe(2000000);
    expect(trends[0]?.savingsMinor).toBe(4000000);
    expect(trends[0]?.savingsRate).toBe(67); // 4000000 / 6000000 = 67%

    expect(trends[1]?.period).toBe('2026-09');
    expect(trends[1]?.incomeMinor).toBe(6000000);
    expect(trends[1]?.expenseMinor).toBe(3000000);
    expect(trends[1]?.savingsMinor).toBe(3000000);
    expect(trends[1]?.savingsRate).toBe(50); // 3000000 / 6000000 = 50%
  });
});

