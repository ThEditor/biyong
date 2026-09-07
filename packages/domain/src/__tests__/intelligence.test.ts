import { describe, it, expect } from 'vitest';
import type {
  Account,
  Category,
  Investment,
  Liability,
  PeerDebt,
  SubscriptionItem,
  Transaction,
} from '@biyong/schemas';
import {
  NaturalLanguageQueryEngine,
  detectAnomalies,
  forecastCashFlow,
  suggestCategoryForMerchant,
} from '../intelligence.js';

describe('Phase 8 Intelligence: NaturalLanguageQueryEngine', () => {
  const accounts: Account[] = [
    {
      id: 'acc-bank',
      name: 'Salary Account',
      type: 'bank',
      initialBalanceMinor: 20000000, // ₹200,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'acc-cash',
      name: 'Cash Wallet',
      type: 'cash',
      initialBalanceMinor: 500000, // ₹5,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const categories: Category[] = [
    { id: 'cat-dining', name: 'Food & Dining', icon: 'utensils', parentCategoryId: null, isBuiltin: true },
    { id: 'cat-travel', name: 'Travel', icon: 'plane', parentCategoryId: null, isBuiltin: true },
  ];

  const transactions: Transaction[] = [
    // Month 1: 2026-07 (Dining: 5,000)
    {
      id: 'tx-1',
      accountId: 'acc-bank',
      type: 'expense',
      amountMinor: 500000,
      currency: 'INR',
      date: '2026-07-10',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Restaurant',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    },
    // Month 2: 2026-08 (Dining: 15,000, Travel: 20,000)
    {
      id: 'tx-2',
      accountId: 'acc-bank',
      type: 'expense',
      amountMinor: 1500000,
      currency: 'INR',
      date: '2026-08-05',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Fine Dining',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    },
    {
      id: 'tx-3',
      accountId: 'acc-bank',
      type: 'expense',
      amountMinor: 2000000,
      currency: 'INR',
      date: '2026-08-15',
      categoryId: 'cat-travel',
      subcategory: null,
      merchant: 'Airline',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    },
  ];

  const investments: Investment[] = [
    {
      id: 'inv-1',
      name: 'Nifty 50 Index Fund',
      type: 'mutual_fund',
      investedAmountMinor: 5000000, // 50,000
      currentValueMinor: 6500000, // 65,000 (+30%)
      currency: 'INR',
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const liabilities: Liability[] = [
    {
      id: 'liab-1',
      name: 'Personal Loan',
      type: 'loan',
      principalAmountMinor: 10000000,
      remainingAmountMinor: 4000000, // 40,000
      currency: 'INR',
      interestRatePercent: 11,
      dueDate: '2026-09-10',
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const peerDebts: PeerDebt[] = [
    {
      id: 'pd-1',
      personName: 'Rohan',
      type: 'lent',
      originalAmountMinor: 1000000,
      remainingAmountMinor: 750000, // ₹7,500
      currency: 'INR',
      date: '2026-08-01',
      dueDate: '2026-09-01',
      notes: null,
      status: 'active',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ];

  const subscriptions: SubscriptionItem[] = [
    {
      id: 'sub-1',
      name: 'Netflix',
      category: 'Entertainment',
      amountMinor: 64900,
      cadence: 'monthly',
      nextBillingDate: '2026-09-15',
      isAutoDetected: false,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const baseContext = {
    accounts,
    categories,
    transactions,
    budgets: [],
    investments,
    liabilities,
    peerDebts,
    subscriptions,
  };

  it('answers "Why did I spend more this month?" with category variance', () => {
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'Why did I spend more this month?',
      baseContext
    );

    expect(res.matchedIntent).toBe('why_spend_more');
    expect(res.headline).toContain('Spending increased');
    expect(res.explanation).toContain('Travel');
  });

  it('answers "Who owes me money?" with list of debtors and total receivable', () => {
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'Who owes me money right now?',
      baseContext
    );

    expect(res.matchedIntent).toBe('who_owes_me');
    expect(res.headline).toContain('7,500');
    expect(res.explanation).toContain('Rohan');
  });

  it('answers "How much did I invest this year?" with gain and return stats', () => {
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'How much did I invest this year?',
      baseContext
    );

    expect(res.matchedIntent).toBe('investments_ytd');
    expect(res.headline).toContain('65,000');
    expect(res.explanation).toContain('30%');
  });

  it('evaluates affordability verdict positively for reasonable expense', () => {
    // Liquid reserves = ~ ₹170,000 (200k - 35k expense + 5k cash)
    // Can afford ₹25,000 laptop
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'Can I afford a ₹25,000 laptop?',
      baseContext
    );

    expect(res.matchedIntent).toBe('can_i_afford');
    expect(res.headline).toContain('Yes, you can afford');
    expect(res.supportingData?.canAfford).toBe(true);
  });

  it('evaluates affordability verdict negatively for excessive expense', () => {
    // Item cost ₹500,000 exceeds liquid reserves
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'Can I afford a ₹500,000 luxury watch?',
      baseContext
    );

    expect(res.matchedIntent).toBe('can_i_afford');
    expect(res.headline).toContain('not recommended');
    expect(res.supportingData?.canAfford).toBe(false);
  });

  it('answers net worth query with assets vs liabilities explanation', () => {
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'Why did my net worth change?',
      baseContext
    );

    expect(res.matchedIntent).toBe('why_networth_change');
    expect(res.headline).toContain('net worth is');
  });

  it('provides a general summary fallback for general questions', () => {
    const res = NaturalLanguageQueryEngine.processFinancialQuery(
      'Give me an account overview',
      baseContext
    );

    expect(res.matchedIntent).toBe('general_summary');
    expect(res.headline).toBe('Financial Overview');
  });
});

describe('Phase 8 Intelligence: Anomaly Detection', () => {
  it('detects duplicate charges within 24 hours on same account', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 50000,
        currency: 'INR',
        date: '2026-08-01T10:00:00.000Z',
        categoryId: 'cat-1',
        subcategory: null,
        merchant: 'Cafe',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 50000,
        currency: 'INR',
        date: '2026-08-01T12:30:00.000Z', // 2.5 hours later
        categoryId: 'cat-1',
        subcategory: null,
        merchant: 'Cafe',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-01T12:30:00.000Z',
        updatedAt: '2026-08-01T12:30:00.000Z',
      },
    ];

    const anomalies = detectAnomalies(txs);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]!.type).toBe('duplicate_charge');
    expect(anomalies[0]!.severity).toBe('warning');
  });

  it('detects spending spikes exceeding 2.5x category average', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 20000, // ₹200
        currency: 'INR',
        date: '2026-08-01',
        categoryId: 'cat-coffee',
        subcategory: null,
        merchant: 'Coffee Shop',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 20000, // ₹200
        currency: 'INR',
        date: '2026-08-02',
        categoryId: 'cat-coffee',
        subcategory: null,
        merchant: 'Coffee Shop',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 200000, // ₹2000 (10x average!)
        currency: 'INR',
        date: '2026-08-10',
        categoryId: 'cat-coffee',
        subcategory: null,
        merchant: 'Artisan Coffee Roaster',
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
    ];

    const anomalies = detectAnomalies(txs);
    const spikes = anomalies.filter((a) => a.type === 'spending_spike');
    expect(spikes.length).toBe(1);
    expect(spikes[0]!.transactionId).toBe('tx-3');
    expect(spikes[0]!.severity).toBe('alert');
  });
});

describe('Phase 8 Intelligence: Cash Flow Forecasting & Category Suggestions', () => {
  it('forecasts daily cash flow over 30 days incorporating subscriptions and liabilities', () => {
    const accounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Bank',
        type: 'bank',
        initialBalanceMinor: 10000000, // 100,000
        currency: 'INR',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const refDate = new Date('2026-09-01T00:00:00.000Z');
    const subs: SubscriptionItem[] = [
      {
        id: 'sub-1',
        name: 'Netflix',
        category: 'Entertainment',
        amountMinor: 64900,
        cadence: 'monthly',
        nextBillingDate: '2026-09-05',
        isAutoDetected: false,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const liabs: Liability[] = [
      {
        id: 'l-1',
        name: 'Car Loan',
        type: 'loan',
        principalAmountMinor: 50000000,
        remainingAmountMinor: 1500000,
        currency: 'INR',
        interestRatePercent: 8,
        dueDate: '2026-09-10',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const forecast = forecastCashFlow(accounts, [], subs, liabs, [], 15, refDate);
    expect(forecast.length).toBe(15);

    const day5 = forecast.find((p) => p.date === '2026-09-05');
    expect(day5?.expectedOutflowMinor).toBe(64900);

    const day10 = forecast.find((p) => p.date === '2026-09-10');
    expect(day10?.expectedOutflowMinor).toBe(1500000);
  });

  it('suggests appropriate category for known merchants', () => {
    const categories: Category[] = [
      { id: 'cat-food', name: 'Food & Dining', icon: 'utensils', parentCategoryId: null, isBuiltin: true },
      { id: 'cat-transport', name: 'Transport', icon: 'car', parentCategoryId: null, isBuiltin: true },
      { id: 'cat-ent', name: 'Entertainment', icon: 'film', parentCategoryId: null, isBuiltin: true },
      { id: 'cat-shop', name: 'Shopping', icon: 'shopping-bag', parentCategoryId: null, isBuiltin: true },
    ];

    expect(suggestCategoryForMerchant('Swiggy Instamart', categories)).toBe('cat-food');
    expect(suggestCategoryForMerchant('Uber India', categories)).toBe('cat-transport');
    expect(suggestCategoryForMerchant('Netflix subscription', categories)).toBe('cat-ent');
    expect(suggestCategoryForMerchant('Amazon Retail', categories)).toBe('cat-shop');
    expect(suggestCategoryForMerchant('Unknown Merchant XYZ', categories)).toBeNull();
  });
});
