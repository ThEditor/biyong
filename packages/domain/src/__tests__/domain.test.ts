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
} from '../index.js';
import type { GroupExpense, Settlement, Budget, Goal, Investment, Liability } from '@biyong/schemas';

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
