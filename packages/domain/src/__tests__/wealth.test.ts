import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  calculateInvestmentAnalytics,
  calculateLiabilityAnalytics,
  calculateHistoricalNetWorth,
} from '../wealth.js';
import type { Investment, Liability, Transaction } from '@biyong/schemas';

describe('Domain: calculateInvestmentAnalytics', () => {
  it('handles empty investments array gracefully', () => {
    const analytics = calculateInvestmentAnalytics([]);
    expect(analytics).toEqual({
      investedAmountMinor: 0,
      currentValueMinor: 0,
      totalGainMinor: 0,
      absoluteReturnPercent: 0,
      assetClassBreakdown: [],
    });
  });

  it('correctly maps all investment types to asset classes and calculates gains and returns', () => {
    const investments: Investment[] = [
      // Equity: stock, mutual_fund, etf
      {
        id: 'inv-1',
        name: 'Reliance Stock',
        type: 'stock',
        investedAmountMinor: 100000,
        currentValueMinor: 130000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-2',
        name: 'Nifty Index Fund',
        type: 'mutual_fund',
        investedAmountMinor: 200000,
        currentValueMinor: 240000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-3',
        name: 'Gold BeES ETF',
        type: 'etf',
        investedAmountMinor: 100000,
        currentValueMinor: 130000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      // Debt: fd, rd, bond
      {
        id: 'inv-4',
        name: 'HDFC FD',
        type: 'fd',
        investedAmountMinor: 100000,
        currentValueMinor: 107000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-5',
        name: 'Post Office RD',
        type: 'rd',
        investedAmountMinor: 50000,
        currentValueMinor: 53000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-6',
        name: 'Govt Sovereign Bond',
        type: 'bond',
        investedAmountMinor: 50000,
        currentValueMinor: 50000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      // Gold: gold
      {
        id: 'inv-7',
        name: 'Digital Gold',
        type: 'gold',
        investedAmountMinor: 100000,
        currentValueMinor: 120000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      // Retirement: ppf, epf, nps
      {
        id: 'inv-8',
        name: 'SBI PPF',
        type: 'ppf',
        investedAmountMinor: 50000,
        currentValueMinor: 55000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-9',
        name: 'Company EPF',
        type: 'epf',
        investedAmountMinor: 60000,
        currentValueMinor: 66000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-10',
        name: 'Tier 1 NPS',
        type: 'nps',
        investedAmountMinor: 40000,
        currentValueMinor: 49000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      // Other: esop, other
      {
        id: 'inv-11',
        name: 'Company ESOP',
        type: 'esop',
        investedAmountMinor: 50000,
        currentValueMinor: 80000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-12',
        name: 'Art Collection',
        type: 'other',
        investedAmountMinor: 20000,
        currentValueMinor: 20000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    // Total Invested = 100k + 200k + 100k + 100k + 50k + 50k + 100k + 50k + 60k + 40k + 50k + 20k = 920,000 minor
    // Total Current  = 130k + 240k + 130k + 107k + 53k + 50k + 120k + 55k + 66k + 49k + 80k + 20k = 1,100,000 minor
    // Total Gain = 1,100,000 - 920,000 = 180,000 minor
    // Return % = Math.round((180,000 / 920,000) * 100) = 20%
    const analytics = calculateInvestmentAnalytics(investments);
    expect(analytics.investedAmountMinor).toBe(920000);
    expect(analytics.currentValueMinor).toBe(1100000);
    expect(analytics.totalGainMinor).toBe(180000);
    expect(analytics.absoluteReturnPercent).toBe(20);

    // Breakdown:
    // Equity: 130k + 240k + 130k = 500,000 (45%)
    // Debt: 107k + 53k + 50k = 210,000 (19%)
    // Gold: 120,000 (11%)
    // Retirement: 55k + 66k + 49k = 170,000 (15%)
    // Other: 80k + 20k = 100,000 (9%)
    expect(analytics.assetClassBreakdown).toEqual([
      { assetClass: 'equity', label: 'Equity', amountMinor: 500000, percentage: 45 },
      { assetClass: 'debt', label: 'Debt', amountMinor: 210000, percentage: 19 },
      { assetClass: 'gold', label: 'Gold', amountMinor: 120000, percentage: 11 },
      { assetClass: 'retirement', label: 'Retirement', amountMinor: 170000, percentage: 15 },
      { assetClass: 'other', label: 'Other', amountMinor: 100000, percentage: 9 },
    ]);
  });

  it('handles negative returns (portfolio loss) accurately', () => {
    const investments: Investment[] = [
      {
        id: 'inv-loss',
        name: 'Penny Stock',
        type: 'stock',
        investedAmountMinor: 100000,
        currentValueMinor: 75000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const analytics = calculateInvestmentAnalytics(investments);
    expect(analytics.investedAmountMinor).toBe(100000);
    expect(analytics.currentValueMinor).toBe(75000);
    expect(analytics.totalGainMinor).toBe(-25000);
    expect(analytics.absoluteReturnPercent).toBe(-25);
    expect(analytics.assetClassBreakdown).toEqual([
      { assetClass: 'equity', label: 'Equity', amountMinor: 75000, percentage: 100 },
    ]);
  });
});

describe('Domain: calculateLiabilityAnalytics', () => {
  it('handles empty liabilities array gracefully', () => {
    const analytics = calculateLiabilityAnalytics([]);
    expect(analytics).toEqual({
      totalPrincipalMinor: 0,
      totalRemainingMinor: 0,
      totalPaidMinor: 0,
      payoffProgressPercent: 0,
      typeBreakdown: [],
    });
  });

  it('computes total principal, remaining, paid off, payoff progress %, and type breakdown', () => {
    const liabilities: Liability[] = [
      {
        id: 'liab-1',
        name: 'HDFC Credit Card',
        type: 'credit_card',
        principalAmountMinor: 5000000,
        remainingAmountMinor: 3000000, // ₹30,000 left
        currency: 'INR',
        interestRatePercent: 36,
        dueDate: '2026-09-20',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'liab-2',
        name: 'ICICI Credit Card',
        type: 'credit_card',
        principalAmountMinor: 2000000,
        remainingAmountMinor: 1000000, // ₹10,000 left
        currency: 'INR',
        interestRatePercent: 40,
        dueDate: '2026-09-25',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'liab-3',
        name: 'Home Loan',
        type: 'loan',
        principalAmountMinor: 50000000, // ₹5,00,000
        remainingAmountMinor: 25000000, // ₹2,50,000
        currency: 'INR',
        interestRatePercent: 8.5,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'liab-4',
        name: 'Phone EMI',
        type: 'emi',
        principalAmountMinor: 6000000,
        remainingAmountMinor: 2000000,
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'liab-5',
        name: 'Simpl BNPL',
        type: 'bnpl',
        principalAmountMinor: 500000,
        remainingAmountMinor: 0, // Fully paid
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'liab-6',
        name: 'Friend Loan',
        type: 'other',
        principalAmountMinor: 1000000,
        remainingAmountMinor: 500000,
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    // Principal = 50k + 20k + 500k + 60k + 5k + 10k = 645,000 paise * 100 = 64,500,000 minor
    // Remaining = 30k + 10k + 250k + 20k + 0 + 5k = 315,000 * 100 = 31,500,000 minor
    // Paid = 64,500,000 - 31,500,000 = 33,000,000 minor
    // Payoff Progress % = Math.round((33,000,000 / 64,500,000) * 100) = 51%
    const analytics = calculateLiabilityAnalytics(liabilities);
    expect(analytics.totalPrincipalMinor).toBe(64500000);
    expect(analytics.totalRemainingMinor).toBe(31500000);
    expect(analytics.totalPaidMinor).toBe(33000000);
    expect(analytics.payoffProgressPercent).toBe(51);

    expect(analytics.typeBreakdown).toEqual([
      { type: 'credit_card', label: 'Credit Card', amountMinor: 4000000, count: 2 },
      { type: 'loan', label: 'Loan', amountMinor: 25000000, count: 1 },
      { type: 'emi', label: 'EMI', amountMinor: 2000000, count: 1 },
      { type: 'bnpl', label: 'BNPL', amountMinor: 0, count: 1 },
      { type: 'other', label: 'Other', amountMinor: 500000, count: 1 },
    ]);
  });
});

describe('Domain: calculateHistoricalNetWorth', () => {
  it('returns empty array when monthsCount <= 0', () => {
    const points = calculateHistoricalNetWorth([], [], [], 0);
    expect(points).toEqual([]);
  });

  it('computes monthly net worth trajectory for the last N months', () => {
    const refDate = new Date(2026, 8, 15); // Sept 15, 2026

    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 10000000, // ₹1,00,000
        currency: 'INR',
        date: '2026-07-05',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 4000000, // ₹40,000
        currency: 'INR',
        date: '2026-07-20',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-07-20T00:00:00.000Z',
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
      // Transfer between owned accounts: must NOT change total cash
      {
        id: 'tx-3',
        accountId: 'acc-1',
        toAccountId: 'acc-2',
        type: 'transfer',
        amountMinor: 2000000,
        currency: 'INR',
        date: '2026-08-01',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'tx-4',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 5000000, // ₹50,000
        currency: 'INR',
        date: '2026-08-10',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
      {
        id: 'tx-5',
        accountId: 'acc-2',
        type: 'expense',
        amountMinor: 1000000, // ₹10,000
        currency: 'INR',
        date: '2026-09-02',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
    ];

    const investments: Investment[] = [
      {
        id: 'inv-1',
        name: 'PPF',
        type: 'ppf',
        investedAmountMinor: 5000000,
        currentValueMinor: 5500000, // ₹55,000
        currency: 'INR',
        notes: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'inv-2',
        name: 'New Stock',
        type: 'stock',
        investedAmountMinor: 3000000,
        currentValueMinor: 3500000, // ₹35,000
        currency: 'INR',
        notes: null,
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
      },
    ];

    const liabilities: Liability[] = [
      {
        id: 'liab-1',
        name: 'Personal Loan',
        type: 'loan',
        principalAmountMinor: 10000000,
        remainingAmountMinor: 4000000, // ₹40,000
        currency: 'INR',
        interestRatePercent: 12,
        dueDate: null,
        notes: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ];

    // Testing 3 months: July 2026 (2026-07), August 2026 (2026-08), September 2026 (2026-09)
    const points = calculateHistoricalNetWorth(txs, investments, liabilities, 3, refDate);
    expect(points.length).toBe(3);

    // Month 1: 2026-07
    // Cash: 100k income - 40k expense = 60k (6,000,000 minor)
    // Investments: inv-1 (5,500,000 minor). inv-2 not created until Aug. Total = 5,500,000 minor.
    // Assets: 6,000,000 + 5,500,000 = 11,500,000 minor.
    // Liabilities: liab-1 = 4,000,000 minor.
    // Net Worth: 11,500,000 - 4,000,000 = 7,500,000 minor.
    expect(points[0]).toEqual({
      date: '2026-07',
      assetsMinor: 11500000,
      liabilitiesMinor: 4000000,
      netWorthMinor: 7500000,
    });

    // Month 2: 2026-08
    // Cash: 60k + 50k (tx-4) = 110k (11,000,000 minor). tx-3 transfer ignored.
    // Investments: inv-1 (5.5M) + inv-2 (3.5M) = 9,000,000 minor.
    // Assets: 11,000,000 + 9,000,000 = 20,000,000 minor.
    // Liabilities: liab-1 = 4,000,000 minor.
    // Net Worth: 20,000,000 - 4,000,000 = 16,000,000 minor.
    expect(points[1]).toEqual({
      date: '2026-08',
      assetsMinor: 20000000,
      liabilitiesMinor: 4000000,
      netWorthMinor: 16000000,
    });

    // Month 3: 2026-09
    // Cash: 110k - 10k (tx-5) = 100k (10,000,000 minor).
    // Investments: 9,000,000 minor.
    // Assets: 10,000,000 + 9,000,000 = 19,000,000 minor.
    // Liabilities: 4,000,000 minor.
    // Net Worth: 19,000,000 - 4,000,000 = 15,000,000 minor.
    expect(points[2]).toEqual({
      date: '2026-09',
      assetsMinor: 19000000,
      liabilitiesMinor: 4000000,
      netWorthMinor: 15000000,
    });
  });

  it('supports initial cash balance offset', () => {
    const refDate = new Date(2026, 8, 1);
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 500000,
        currency: 'INR',
        date: '2026-09-01',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const initialCash = 1000000; // ₹10,000 initial bank balance
    const points = calculateHistoricalNetWorth(txs, [], [], 1, refDate, initialCash);
    expect(points[0]?.assetsMinor).toBe(1500000);
    expect(points[0]?.netWorthMinor).toBe(1500000);
  });
});

describe('Domain: calculateNetWorth (backward compatibility)', () => {
  it('calculates total assets, total liabilities, and net worth accurately', () => {
    const cash = [2000000, 3000000]; // ₹50,000
    const investments: Investment[] = [
      {
        id: 'inv-1',
        name: 'Equity Fund',
        type: 'mutual_fund',
        investedAmountMinor: 10000000,
        currentValueMinor: 15000000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const liabilities: Liability[] = [
      {
        id: 'liab-1',
        name: 'Loan',
        type: 'loan',
        principalAmountMinor: 5000000,
        remainingAmountMinor: 2000000,
        currency: 'INR',
        interestRatePercent: 10,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const summary = calculateNetWorth(cash, investments, liabilities);
    expect(summary.cashBankAssetsMinor).toBe(5000000);
    expect(summary.investmentsMinor).toBe(15000000);
    expect(summary.totalAssetsMinor).toBe(20000000);
    expect(summary.totalLiabilitiesMinor).toBe(2000000);
    expect(summary.netWorthMinor).toBe(18000000);
    expect(summary.assetAllocation).toEqual([
      { category: 'Cash & Bank', amountMinor: 5000000, percentage: 25 },
      { category: 'MUTUAL_FUND', amountMinor: 15000000, percentage: 75 },
    ]);
  });
});
