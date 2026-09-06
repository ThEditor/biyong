import { describe, it, expect } from 'vitest';
import {
  createMoney,
  addMoney,
  subtractMoney,
  distributeEqually,
  formatMoney,
  calculateSplit,
  validatePayers,
  calculateNetBalances,
  simplifyDebts,
  explainMemberSettlement,
  buildDependencyGraph,
  calculateBudgetStatus,
  calculateGoalProgress,
  calculateNetWorth,
  generateMonthlyReport,
  filterTransactions,
} from '../index.js';
import type { GroupExpense, Settlement, Budget, Goal, Investment, Liability, Transaction, Category } from '@biyong/schemas';

describe('Domain: Money calculations', () => {
  it('correctly creates and formats money in minor units', () => {
    const m = createMoney(12345, 'INR');
    expect(m.amountMinor).toBe(12345);
    expect(formatMoney(12345, 'INR')).toBe('₹123.45');
    expect(formatMoney(-5000, 'INR')).toBe('-₹50.00');
  });

  it('rejects floating point numbers', () => {
    expect(() => createMoney(12.34 as unknown as number)).toThrow();
  });

  it('distributes remainder equally with exact sum', () => {
    // 100 rupees = 10000 paise among 3 people -> 3334, 3333, 3333 = 10000
    const parts = distributeEqually(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    const sum = parts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
  });
});

describe('Domain: Expense splits', () => {
  it('handles equal split accurately', () => {
    const splits = calculateSplit({
      totalAmountMinor: 300000, // ₹3,000
      method: 'equal',
      allocations: [
        { memberId: 'user-1' },
        { memberId: 'user-2' },
        { memberId: 'user-3' },
      ],
    });
    expect(splits).toEqual([
      { memberId: 'user-1', owedMinor: 100000 },
      { memberId: 'user-2', owedMinor: 100000 },
      { memberId: 'user-3', owedMinor: 100000 },
    ]);
  });

  it('handles percentage split accurately with remainder absorption', () => {
    const splits = calculateSplit({
      totalAmountMinor: 10000, // ₹100
      method: 'percentage',
      allocations: [
        { memberId: 'u1', percentage: 50 },
        { memberId: 'u2', percentage: 30 },
        { memberId: 'u3', percentage: 20 },
      ],
    });
    const sum = splits.reduce((acc, s) => acc + s.owedMinor, 0);
    expect(sum).toBe(10000);
    expect(splits[0]?.owedMinor).toBe(5000);
    expect(splits[1]?.owedMinor).toBe(3000);
    expect(splits[2]?.owedMinor).toBe(2000);
  });

  it('throws error if percentage does not equal 100%', () => {
    expect(() =>
      calculateSplit({
        totalAmountMinor: 10000,
        method: 'percentage',
        allocations: [
          { memberId: 'u1', percentage: 40 },
          { memberId: 'u2', percentage: 40 },
        ],
      })
    ).toThrow();
  });

  it('validates multiple payers match total amount', () => {
    expect(() =>
      validatePayers(50000, [
        { memberId: 'u1', amountMinor: 30000 },
        { memberId: 'u2', amountMinor: 20000 },
      ])
    ).not.toThrow();

    expect(() =>
      validatePayers(50000, [
        { memberId: 'u1', amountMinor: 30000 },
        { memberId: 'u2', amountMinor: 10000 },
      ])
    ).toThrow();
  });
});

describe('Domain: Settlement and Debt Simplification', () => {
  it('simplifies triangular debt correctly', () => {
    // A owes B ₹100, B owes C ₹80, C owes A ₹40
    // Net:
    // A: -100 + 40 = -60
    // B: +100 - 80 = +20
    // C: +80 - 40 = +40
    // Simplified: A pays C ₹40, A pays B ₹20. (Total transactions: 2 instead of 3)
    const balances = new Map<string, number>([
      ['A', -6000],
      ['B', 2000],
      ['C', 4000],
    ]);

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(2);
    expect(transfers).toContainEqual({
      fromMemberId: 'A',
      toMemberId: 'C',
      amountMinor: 4000,
    });
    expect(transfers).toContainEqual({
      fromMemberId: 'A',
      toMemberId: 'B',
      amountMinor: 2000,
    });
  });

  it('calculates net balances and settlement explanation', () => {
    const expense: GroupExpense = {
      id: 'exp-1',
      groupId: 'group-1',
      title: 'Goa Dinner',
      amountMinor: 60000, // ₹600
      currency: 'INR',
      date: '2026-09-06',
      createdByMemberId: 'u1',
      payers: [{ memberId: 'u1', amountMinor: 60000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'u1' },
        { memberId: 'u2' },
        { memberId: 'u3' },
      ],
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const memberIds = ['u1', 'u2', 'u3'];
    const balances = calculateNetBalances(memberIds, [expense], []);

    // u1 paid 600, owes 200 -> net +400
    // u2 owes 200 -> net -200
    // u3 owes 200 -> net -200
    expect(balances.get('u1')).toBe(40000);
    expect(balances.get('u2')).toBe(-20000);
    expect(balances.get('u3')).toBe(-20000);

    const u2Explanation = explainMemberSettlement('u2', memberIds, [expense], []);
    expect(u2Explanation.netBalanceMinor).toBe(-20000);
    expect(u2Explanation.origins).toHaveLength(1);
    expect(u2Explanation.origins[0]?.allocatedMinor).toBe(20000);
    expect(u2Explanation.origins[0]?.paidMinor).toBe(0);

    // Now record settlement: u2 pays u1 ₹200
    const settlement: Settlement = {
      id: 'set-1',
      groupId: 'group-1',
      fromMemberId: 'u2',
      toMemberId: 'u1',
      amountMinor: 20000,
      currency: 'INR',
      settledAt: new Date().toISOString(),
      notes: 'UPI payment',
    };

    const afterSettlement = calculateNetBalances(memberIds, [expense], [settlement]);
    expect(afterSettlement.get('u2')).toBe(0); // u2 is now settled!
    expect(afterSettlement.get('u1')).toBe(20000); // u1 is still owed ₹200 by u3
  });

  it('builds dependency graph nodes and edges', () => {
    const expense: GroupExpense = {
      id: 'exp-1',
      groupId: 'g1',
      title: 'Lunch',
      amountMinor: 20000,
      currency: 'INR',
      date: '2026-09-06',
      createdByMemberId: 'm1',
      payers: [{ memberId: 'm1', amountMinor: 20000 }],
      splitMethod: 'equal',
      allocations: [{ memberId: 'm1' }, { memberId: 'm2' }],
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const memberNames = new Map([
      ['m1', 'Alice'],
      ['m2', 'Bob'],
    ]);

    const graph = buildDependencyGraph(memberNames, [expense], []);
    expect(graph.nodes.length).toBe(3); // 2 members + 1 expense
    expect(graph.edges.length).toBe(3); // 1 pay edge + 2 split edges
  });
});

describe('Domain: Budgets, Goals, Wealth', () => {
  it('calculates budget progress and rollover correctly', () => {
    const budget: Budget = {
      id: 'b1',
      categoryId: 'food',
      amountMinor: 1000000, // ₹10,000
      currency: 'INR',
      period: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      rollover: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const status = calculateBudgetStatus(budget, 620000, 100000); // Spent ₹6,200, rollover +₹1,000
    expect(status.effectiveBudgetMinor).toBe(1100000); // ₹11,000
    expect(status.remainingMinor).toBe(480000); // ₹4,800 remaining
    expect(status.isOverBudget).toBe(false);
  });

  it('calculates goal progress and required monthly savings', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'Emergency Fund',
      targetAmountMinor: 30000000, // ₹3,00,000
      currentAmountMinor: 18000000, // ₹1,80,000
      currency: 'INR',
      targetDate: '2027-03-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const progress = calculateGoalProgress(goal, new Date('2026-09-01'));
    expect(progress.remainingAmountMinor).toBe(12000000); // ₹1,20,000
    expect(progress.percentageComplete).toBe(60);
    expect(progress.monthsRemaining).toBe(7);
    expect(progress.requiredMonthlySavingsMinor).toBe(Math.ceil(12000000 / 7));
  });

  it('calculates net worth as Assets - Liabilities', () => {
    const cashAccounts = [5000000, 2000000]; // ₹70,000
    const investments: Investment[] = [
      {
        id: 'inv-1',
        name: 'Nifty Index Fund',
        type: 'mutual_fund',
        investedAmountMinor: 10000000,
        currentValueMinor: 12000000, // ₹1,20,000
        currency: 'INR',
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const liabilities: Liability[] = [
      {
        id: 'liab-1',
        name: 'Credit Card Bill',
        type: 'credit_card',
        principalAmountMinor: 4000000,
        remainingAmountMinor: 3000000, // ₹30,000
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: null,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const summary = calculateNetWorth(cashAccounts, investments, liabilities);
    // Assets: 70,000 + 120,000 = 190,000 (19000000 minor)
    // Liabilities: 30,000 (3000000 minor)
    // Net Worth: 160,000 (16000000 minor)
    expect(summary.totalAssetsMinor).toBe(19000000);
    expect(summary.totalLiabilitiesMinor).toBe(3000000);
    expect(summary.netWorthMinor).toBe(16000000);
  });
});

describe('Domain: Monthly Reports', () => {
  const sampleCategories: Category[] = [
    { id: 'cat-food', name: 'Food & Dining', icon: 'utensils', parentCategoryId: null, isBuiltin: true },
    { id: 'cat-groceries', name: 'Groceries', icon: 'shopping-cart', parentCategoryId: null, isBuiltin: true },
    { id: 'cat-transport', name: 'Transportation', icon: 'car', parentCategoryId: null, isBuiltin: true },
  ];

  it('correctly aggregates income, expenses, and net savings', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 10000000, // ₹1,00,000
        currency: 'INR',
        date: '2026-09-01',
        categoryId: 'salary',
        subcategory: null,
        merchant: 'Employer Corp',
        notes: 'Monthly salary',
        toAccountId: null,
        isRecurring: true,
        recurringFrequency: 'monthly',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 3000000, // ₹30,000
        currency: 'INR',
        date: '2026-09-05',
        categoryId: 'cat-food',
        subcategory: 'dining',
        merchant: 'Taj Hotel',
        notes: 'Dinner',
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 1000000, // ₹10,000
        currency: 'INR',
        date: '2026-09-10',
        categoryId: 'cat-groceries',
        subcategory: 'vegetables',
        merchant: 'Zepto',
        notes: 'Weekly groceries',
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
      },
    ];

    const report = generateMonthlyReport(txs, 2026, 9, sampleCategories);
    expect(report.year).toBe(2026);
    expect(report.month).toBe(9);
    expect(report.totalIncomeMinor).toBe(10000000);
    expect(report.totalExpenseMinor).toBe(4000000);
    expect(report.netSavingsMinor).toBe(6000000);
    expect(report.savingsRatePercent).toBe(60); // 60,000 / 100,000 = 60%
  });

  it('CRITICAL RULE: Never counts transfers towards income or expense', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-inc',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 5000000, // ₹50,000
        currency: 'INR',
        date: '2026-09-01',
        categoryId: 'salary',
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'tx-transfer-out',
        accountId: 'acc-1',
        type: 'transfer',
        amountMinor: 2000000, // ₹20,000 transferred to acc-2
        currency: 'INR',
        date: '2026-09-02',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: 'Internal transfer',
        toAccountId: 'acc-2',
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'tx-exp',
        accountId: 'acc-2',
        type: 'expense',
        amountMinor: 1000000, // ₹10,000
        currency: 'INR',
        date: '2026-09-03',
        categoryId: 'cat-food',
        subcategory: null,
        merchant: 'Swiggy',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      },
    ];

    const report = generateMonthlyReport(txs, 2026, 9, sampleCategories);
    expect(report.totalIncomeMinor).toBe(5000000);
    expect(report.totalExpenseMinor).toBe(1000000);
    expect(report.netSavingsMinor).toBe(4000000);
    expect(report.savingsRatePercent).toBe(80);
  });

  it('handles negative savings rate and 0 income safely', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 500000, // ₹5,000
        currency: 'INR',
        date: '2026-09-01',
        categoryId: 'cat-food',
        subcategory: null,
        merchant: 'Cafe',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const report = generateMonthlyReport(txs, 2026, 9);
    expect(report.totalIncomeMinor).toBe(0);
    expect(report.totalExpenseMinor).toBe(500000);
    expect(report.netSavingsMinor).toBe(-500000);
    expect(report.savingsRatePercent).toBe(0);
  });

  it('correctly calculates category spending breakdown and top merchants', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 600000, // ₹6,000 on Food
        currency: 'INR',
        date: '2026-09-02',
        categoryId: 'cat-food',
        subcategory: 'dining',
        merchant: 'Starbucks',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 400000, // ₹4,000 on Groceries
        currency: 'INR',
        date: '2026-09-03',
        categoryId: 'cat-groceries',
        subcategory: 'market',
        merchant: 'Zepto',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 200000, // ₹2,000 on Food
        currency: 'INR',
        date: '2026-09-04',
        categoryId: 'cat-food',
        subcategory: 'coffee',
        merchant: 'Starbucks',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-09-04T00:00:00.000Z',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
      {
        id: 'tx-prev-month',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 999900,
        currency: 'INR',
        date: '2026-08-15',
        categoryId: 'cat-food',
        subcategory: null,
        merchant: 'Other',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
      },
    ];

    const report = generateMonthlyReport(txs, 2026, 9, sampleCategories);
    // Total expense for Sept: 6,000 + 4,000 + 2,000 = 12,000 (1200000 minor)
    expect(report.totalExpenseMinor).toBe(1200000);

    // Food: 8,000 (67%), Groceries: 4,000 (33%)
    expect(report.categoryBreakdown).toHaveLength(2);
    expect(report.categoryBreakdown[0]).toEqual({
      categoryId: 'cat-food',
      categoryName: 'Food & Dining',
      spentMinor: 800000,
      percentage: 67,
    });
    expect(report.categoryBreakdown[1]).toEqual({
      categoryId: 'cat-groceries',
      categoryName: 'Groceries',
      spentMinor: 400000,
      percentage: 33,
    });

    // Top merchants: Starbucks (8,000), Zepto (4,000)
    expect(report.topMerchants).toEqual([
      { merchant: 'Starbucks', spentMinor: 800000 },
      { merchant: 'Zepto', spentMinor: 400000 },
    ]);
  });
});

describe('Domain: Transaction Filters', () => {
  const txs: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-bank',
      type: 'expense',
      amountMinor: 50000,
      currency: 'INR',
      date: '2026-09-01',
      categoryId: 'food',
      subcategory: 'takeout',
      merchant: 'Swiggy',
      notes: 'Lunch at office',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'tx-2',
      accountId: 'acc-wallet',
      type: 'expense',
      amountMinor: 20000,
      currency: 'INR',
      date: '2026-09-05',
      categoryId: 'groceries',
      subcategory: 'dairy',
      merchant: 'Zepto Quick',
      notes: 'Milk and bread',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    },
    {
      id: 'tx-3',
      accountId: 'acc-bank',
      type: 'income',
      amountMinor: 5000000,
      currency: 'INR',
      date: '2026-09-10',
      categoryId: 'salary',
      subcategory: null,
      merchant: 'Acme Corp',
      notes: 'Monthly bonus',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    },
    {
      id: 'tx-4',
      accountId: 'acc-bank',
      type: 'transfer',
      amountMinor: 100000,
      currency: 'INR',
      date: '2026-09-15',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: 'Refill wallet',
      toAccountId: 'acc-wallet',
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
    },
  ];

  it('filters by accountId including transfer destinations', () => {
    const bankTxs = filterTransactions(txs, { accountId: 'acc-bank' });
    expect(bankTxs.map((t) => t.id)).toEqual(['tx-1', 'tx-3', 'tx-4']);

    const walletTxs = filterTransactions(txs, { accountId: 'acc-wallet' });
    expect(walletTxs.map((t) => t.id)).toEqual(['tx-2', 'tx-4']);
  });

  it('filters by categoryId and type', () => {
    const foodTxs = filterTransactions(txs, { categoryId: 'food' });
    expect(foodTxs).toHaveLength(1);
    expect(foodTxs[0]?.id).toBe('tx-1');

    const incomes = filterTransactions(txs, { type: 'income' });
    expect(incomes).toHaveLength(1);
    expect(incomes[0]?.id).toBe('tx-3');

    const transfers = filterTransactions(txs, { type: 'transfer' });
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.id).toBe('tx-4');
  });

  it('filters by date range', () => {
    const range = filterTransactions(txs, {
      startDate: '2026-09-02',
      endDate: '2026-09-12',
    });
    expect(range.map((t) => t.id)).toEqual(['tx-2', 'tx-3']);
  });

  it('searches query against merchant, notes, and subcategory case-insensitively', () => {
    // Search merchant
    const swiggy = filterTransactions(txs, { searchQuery: 'swiggy' });
    expect(swiggy.map((t) => t.id)).toEqual(['tx-1']);

    // Search notes
    const milk = filterTransactions(txs, { searchQuery: 'MILK' });
    expect(milk.map((t) => t.id)).toEqual(['tx-2']);

    // Search subcategory
    const takeout = filterTransactions(txs, { searchQuery: 'Takeout' });
    expect(takeout.map((t) => t.id)).toEqual(['tx-1']);
  });

  it('returns all transactions when empty filter is passed', () => {
    const all = filterTransactions(txs, {});
    expect(all).toHaveLength(4);
  });
});
