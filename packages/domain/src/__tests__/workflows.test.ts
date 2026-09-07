import { describe, it, expect } from 'vitest';
import type {
  Account,
  Category,
  LedgerExportData,
  PeerDebt,
  ReimbursementClaim,
  SubscriptionItem,
  Transaction,
} from '@biyong/schemas';
import {
  calculatePeerDebtSummary,
  applyRepayment,
} from '../lending.js';
import {
  calculateReimbursementSummary,
  calculatePersonalSpendingBreakdown,
} from '../reimbursements.js';
import {
  calculateSubscriptionBurnRate,
  detectSubscriptionsFromTransactions,
  normalizeCadenceToMonthlyMinor,
} from '../subscriptions.js';
import {
  exportLedgerToJson,
  exportTransactionsToCsv,
  exportAccountsToCsv,
  validateLedgerImport,
  reconcileLedgerImport,
} from '../export-import.js';
import { calculateNetWorth } from '../wealth.js';

describe('Phase 7 Workflows: Peer Lending & Borrowing', () => {
  const mockDebts: PeerDebt[] = [
    {
      id: 'debt-1',
      personName: 'Alice',
      type: 'lent',
      originalAmountMinor: 50000,
      remainingAmountMinor: 30000,
      currency: 'INR',
      date: '2026-08-01',
      dueDate: '2026-09-01',
      notes: 'Dinner loan',
      status: 'active',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 'debt-2',
      personName: 'Bob',
      type: 'lent',
      originalAmountMinor: 20000,
      remainingAmountMinor: 20000,
      currency: 'INR',
      date: '2026-08-10',
      dueDate: null,
      notes: null,
      status: 'active',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    },
    {
      id: 'debt-3',
      personName: 'Charlie',
      type: 'borrowed',
      originalAmountMinor: 15000,
      remainingAmountMinor: 10000,
      currency: 'INR',
      date: '2026-08-15',
      dueDate: '2026-09-15',
      notes: 'Borrow for tickets',
      status: 'active',
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    },
    {
      id: 'debt-4',
      personName: 'Diana',
      type: 'lent',
      originalAmountMinor: 10000,
      remainingAmountMinor: 0,
      currency: 'INR',
      date: '2026-07-01',
      dueDate: null,
      notes: 'Already settled',
      status: 'settled',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    },
  ];

  it('calculates peer debt summary accurately for active debts only', () => {
    const summary = calculatePeerDebtSummary(mockDebts);

    expect(summary.totalLentMinor).toBe(50000); // 30000 + 20000
    expect(summary.totalBorrowedMinor).toBe(10000);
    expect(summary.netPeerBalanceMinor).toBe(40000); // 50000 - 10000
    expect(summary.activeLentCount).toBe(2);
    expect(summary.activeBorrowedCount).toBe(1);
  });

  it('applies partial repayment without settling debt', () => {
    const debt = mockDebts[0];
    const { updatedDebt, actualPaymentMinor, isSettled } = applyRepayment(debt, 10000);

    expect(actualPaymentMinor).toBe(10000);
    expect(updatedDebt.remainingAmountMinor).toBe(20000);
    expect(updatedDebt.status).toBe('active');
    expect(isSettled).toBe(false);
  });

  it('applies exact repayment and marks debt as settled', () => {
    const debt = mockDebts[0];
    const { updatedDebt, actualPaymentMinor, isSettled } = applyRepayment(debt, 30000);

    expect(actualPaymentMinor).toBe(30000);
    expect(updatedDebt.remainingAmountMinor).toBe(0);
    expect(updatedDebt.status).toBe('settled');
    expect(isSettled).toBe(true);
  });

  it('clamps overpayment to remaining amount and settles debt', () => {
    const debt = mockDebts[0]; // remaining 30000
    const { updatedDebt, actualPaymentMinor, isSettled } = applyRepayment(debt, 50000);

    expect(actualPaymentMinor).toBe(30000);
    expect(updatedDebt.remainingAmountMinor).toBe(0);
    expect(updatedDebt.status).toBe('settled');
    expect(isSettled).toBe(true);
  });

  it('throws when repayment amount is non-positive', () => {
    expect(() => applyRepayment(mockDebts[0], 0)).toThrow('Payment amount must be positive');
    expect(() => applyRepayment(mockDebts[0], -100)).toThrow('Payment amount must be positive');
  });
});

describe('Phase 7 Workflows: Reimbursements', () => {
  const claims: ReimbursementClaim[] = [
    {
      id: 'claim-1',
      title: 'Client Lunch',
      category: 'work',
      amountMinor: 250000, // 2,500
      currency: 'INR',
      transactionId: 'tx-1',
      status: 'reimbursed',
      submittedDate: '2026-08-01',
      settledDate: '2026-08-10',
      notes: null,
      receiptUri: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    },
    {
      id: 'claim-2',
      title: 'Flight Tickets',
      category: 'travel',
      amountMinor: 800000, // 8,000
      currency: 'INR',
      transactionId: 'tx-2',
      status: 'pending',
      submittedDate: '2026-08-15',
      settledDate: null,
      notes: null,
      receiptUri: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    },
    {
      id: 'claim-3',
      title: 'Team Dinner',
      category: 'work',
      amountMinor: 150000,
      currency: 'INR',
      transactionId: null,
      status: 'approved',
      submittedDate: '2026-08-20',
      settledDate: null,
      notes: null,
      receiptUri: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    },
    {
      id: 'claim-4',
      title: 'Invalid Cab',
      category: 'travel',
      amountMinor: 50000,
      currency: 'INR',
      transactionId: null,
      status: 'rejected',
      submittedDate: '2026-08-22',
      settledDate: null,
      notes: 'No receipt',
      receiptUri: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    },
  ];

  it('calculates reimbursement summary correctly', () => {
    const summary = calculateReimbursementSummary(claims);

    expect(summary.totalClaimedMinor).toBe(1250000);
    expect(summary.reimbursedMinor).toBe(250000);
    expect(summary.pendingMinor).toBe(950000); // 800000 (pending) + 150000 (approved)
    expect(summary.personalExpenseReductionMinor).toBe(250000);
  });

  it('calculates personal spending breakdown by transparently deducting reimbursables', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 250000,
        currency: 'INR',
        date: '2026-08-01',
        categoryId: 'cat-food',
        subcategory: null,
        merchant: 'Bistro',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: true,
        reimbursementStatus: 'reimbursed',
        receiptAttachmentId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 500000,
        currency: 'INR',
        date: '2026-08-05',
        categoryId: 'cat-groceries',
        subcategory: null,
        merchant: 'Supermarket',
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
        accountId: 'acc-1',
        type: 'transfer', // Transfers never count as expense
        amountMinor: 100000,
        currency: 'INR',
        date: '2026-08-06',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        toAccountId: 'acc-2',
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-08-06T00:00:00.000Z',
        updatedAt: '2026-08-06T00:00:00.000Z',
      },
    ];

    const breakdown = calculatePersonalSpendingBreakdown(transactions, claims.slice(0, 1));
    expect(breakdown.grossExpenseMinor).toBe(750000); // 250000 + 500000
    expect(breakdown.reimbursableExpenseMinor).toBe(250000);
    expect(breakdown.netPersonalExpenseMinor).toBe(500000);
  });
});

describe('Phase 7 Workflows: Subscriptions & Recurring Burn Rate', () => {
  const subscriptions: SubscriptionItem[] = [
    {
      id: 'sub-1',
      name: 'Netflix',
      category: 'Entertainment',
      amountMinor: 64900, // 649 monthly
      cadence: 'monthly',
      nextBillingDate: '2026-09-15',
      isAutoDetected: false,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sub-2',
      name: 'Gym',
      category: 'Health',
      amountMinor: 150000, // 1500 weekly
      cadence: 'weekly',
      nextBillingDate: '2026-09-08',
      isAutoDetected: false,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sub-3',
      name: 'Domain Renewal',
      category: 'Software',
      amountMinor: 120000, // 1200 yearly
      cadence: 'yearly',
      nextBillingDate: '2026-12-01',
      isAutoDetected: false,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sub-4',
      name: 'Magazine',
      category: 'Entertainment',
      amountMinor: 30000, // 300 quarterly
      cadence: 'quarterly',
      nextBillingDate: '2026-11-01',
      isAutoDetected: false,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('normalizes cadences to monthly correctly', () => {
    expect(normalizeCadenceToMonthlyMinor(1000, 'monthly')).toBe(1000);
    expect(normalizeCadenceToMonthlyMinor(1000, 'weekly')).toBe(4333); // 1000 * 4.333 rounded
    expect(normalizeCadenceToMonthlyMinor(3000, 'quarterly')).toBe(1000);
    expect(normalizeCadenceToMonthlyMinor(12000, 'yearly')).toBe(1000);
  });

  it('computes subscription burn rate excluding non-active items', () => {
    const burnRate = calculateSubscriptionBurnRate(subscriptions);

    expect(burnRate.activeCount).toBe(3);
    // monthly: 64900 (Netflix) + (150000 * 4.333 = 649950) + (120000 / 12 = 10000)
    // = 64900 + 649950 + 10000 = 724850
    expect(burnRate.monthlyBurnRateMinor).toBe(724850);
    expect(burnRate.yearlyBurnRateMinor).toBe(724850 * 12);
    expect(burnRate.categoryBreakdown.length).toBe(3);
  });

  it('detects recurring monthly and weekly subscriptions from transactions', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 49900,
        currency: 'INR',
        date: '2026-06-01',
        categoryId: null,
        subcategory: null,
        merchant: 'Spotify India',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 49900,
        currency: 'INR',
        date: '2026-07-01', // ~30 days later
        categoryId: null,
        subcategory: null,
        merchant: 'Spotify India',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 20000,
        currency: 'INR',
        date: '2026-07-01',
        categoryId: null,
        subcategory: null,
        merchant: 'Milk Delivery',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'tx-4',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 20000,
        currency: 'INR',
        date: '2026-07-08', // 7 days later
        categoryId: null,
        subcategory: null,
        merchant: 'Milk Delivery',
        notes: null,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z',
      },
    ];

    const detected = detectSubscriptionsFromTransactions(txs);
    expect(detected.length).toBe(2);

    const spotify = detected.find((s) => s.name === 'Spotify India');
    expect(spotify).toBeDefined();
    expect(spotify?.cadence).toBe('monthly');
    expect(spotify?.amountMinor).toBe(49900);
    expect(spotify?.isAutoDetected).toBe(true);

    const milk = detected.find((s) => s.name === 'Milk Delivery');
    expect(milk).toBeDefined();
    expect(milk?.cadence).toBe('weekly');
    expect(milk?.amountMinor).toBe(20000);
  });
});

describe('Phase 7 Workflows: Export and Import', () => {
  const accounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Main Checking',
      type: 'bank',
      initialBalanceMinor: 100000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const categories: Category[] = [
    {
      id: 'cat-1',
      name: 'Groceries',
      icon: 'shopping-cart',
      parentCategoryId: null,
      isBuiltin: true,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 125050, // 1250.50
      currency: 'INR',
      date: '2026-08-01',
      categoryId: 'cat-1',
      subcategory: 'Organic',
      merchant: 'Fresh Market, Inc.',
      notes: 'Weekly groceries "special"',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ];

  it('exports transactions to valid RFC 4180 CSV with quotes and commas escaped', () => {
    const csv = exportTransactionsToCsv(transactions, accounts, categories);

    expect(csv).toContain('id,date,account,type,amount,currency,category,subcategory,merchant,notes,isRecurring,isReimbursable');
    expect(csv).toContain('"Fresh Market, Inc."');
    expect(csv).toContain('"Weekly groceries ""special"""');
    expect(csv).toContain('1250.50');
    expect(csv).toContain('Main Checking');
    expect(csv).toContain('Groceries');
  });

  it('exports accounts to CSV with derived balances', () => {
    const balances = new Map<string, number>([['acc-1', 500000]]);
    const csv = exportAccountsToCsv(accounts, balances);

    expect(csv).toContain('id,name,type,currency,balance');
    expect(csv).toContain('acc-1,Main Checking,bank,INR,5000.00');
  });

  it('validates ledger import json using schema', () => {
    const exportData: LedgerExportData = {
      version: '1.0',
      exportedAt: '2026-08-01T00:00:00.000Z',
      accounts,
      categories,
      transactions,
      budgets: [],
      goals: [],
      investments: [],
      liabilities: [],
      peerDebts: [],
      peerRepayments: [],
      reimbursements: [],
      subscriptions: [],
    };

    const jsonStr = exportLedgerToJson(exportData);
    const result = validateLedgerImport(jsonStr);

    expect(result.valid).toBe(true);
    expect(result.data?.accounts.length).toBe(1);

    const invalid = validateLedgerImport('{"invalid": true}');
    expect(invalid.valid).toBe(false);
  });

  it('reconciles ledger import deterministically keeping newer timestamps', () => {
    const existing: LedgerExportData = {
      version: '1.0',
      exportedAt: '2026-08-01T00:00:00.000Z',
      accounts: [
        {
          id: 'acc-1',
          name: 'Old Checking Name',
          type: 'bank',
          initialBalanceMinor: 100000,
          currency: 'INR',
          isArchived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      categories: [],
      transactions: [],
      budgets: [],
      goals: [],
      investments: [],
      liabilities: [],
      peerDebts: [],
      peerRepayments: [],
      reimbursements: [],
      subscriptions: [],
    };

    const incoming: LedgerExportData = {
      version: '1.0',
      exportedAt: '2026-08-02T00:00:00.000Z',
      accounts: [
        {
          id: 'acc-1',
          name: 'Updated Checking Name',
          type: 'bank',
          initialBalanceMinor: 100000,
          currency: 'INR',
          isArchived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
        {
          id: 'acc-2',
          name: 'New Savings',
          type: 'bank',
          initialBalanceMinor: 200000,
          currency: 'INR',
          isArchived: false,
          createdAt: '2026-08-02T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      categories: [],
      transactions: [],
      budgets: [],
      goals: [],
      investments: [],
      liabilities: [],
      peerDebts: [],
      peerRepayments: [],
      reimbursements: [],
      subscriptions: [],
    };

    const reconciled = reconcileLedgerImport(existing, incoming);
    expect(reconciled.accounts.length).toBe(2);
    expect(reconciled.accounts.find((a) => a.id === 'acc-1')?.name).toBe('Updated Checking Name');
  });

  it('incorporates peer debts in calculateNetWorth', () => {
    const peerDebts: PeerDebt[] = [
      {
        id: 'pd-1',
        personName: 'Ravi',
        type: 'lent',
        originalAmountMinor: 100000,
        remainingAmountMinor: 50000, // asset: +50000
        currency: 'INR',
        date: '2026-08-01',
        dueDate: null,
        notes: null,
        status: 'active',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'pd-2',
        personName: 'Sita',
        type: 'borrowed',
        originalAmountMinor: 30000,
        remainingAmountMinor: 20000, // liability: +20000
        currency: 'INR',
        date: '2026-08-01',
        dueDate: null,
        notes: null,
        status: 'active',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ];

    const netWorthWithoutPeer = calculateNetWorth([100000], [], []);
    expect(netWorthWithoutPeer.totalAssetsMinor).toBe(100000);
    expect(netWorthWithoutPeer.totalLiabilitiesMinor).toBe(0);
    expect(netWorthWithoutPeer.netWorthMinor).toBe(100000);

    const netWorthWithPeer = calculateNetWorth([100000], [], [], peerDebts);
    expect(netWorthWithPeer.totalAssetsMinor).toBe(150000); // 100000 cash + 50000 lent
    expect(netWorthWithPeer.totalLiabilitiesMinor).toBe(20000); // 20000 borrowed
    expect(netWorthWithPeer.netWorthMinor).toBe(130000);
  });
});
