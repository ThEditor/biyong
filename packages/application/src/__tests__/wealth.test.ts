import { describe, it, expect, beforeEach } from 'vitest';
import {
  WealthUseCases,
  type AccountRepository,
  type TransactionRepository,
  type WealthRepository,
} from '../index.js';
import type { Account, Transaction, Investment, Liability } from '@biyong/schemas';

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

class InMemoryWealthRepo implements WealthRepository {
  investments: Investment[] = [];
  liabilities: Liability[] = [];

  async getInvestments() { return [...this.investments]; }
  async findInvestmentById(id: string) { return this.investments.find((i) => i.id === id) ?? null; }
  async saveInvestment(inv: Investment) {
    const idx = this.investments.findIndex((i) => i.id === inv.id);
    if (idx >= 0) this.investments[idx] = inv;
    else this.investments.push(inv);
  }
  async deleteInvestment(id: string) {
    this.investments = this.investments.filter((i) => i.id !== id);
  }

  async getLiabilities() { return [...this.liabilities]; }
  async findLiabilityById(id: string) { return this.liabilities.find((l) => l.id === id) ?? null; }
  async saveLiability(liab: Liability) {
    const idx = this.liabilities.findIndex((l) => l.id === liab.id);
    if (idx >= 0) this.liabilities[idx] = liab;
    else this.liabilities.push(liab);
  }
  async deleteLiability(id: string) {
    this.liabilities = this.liabilities.filter((l) => l.id !== id);
  }
}

describe('Application: WealthUseCases', () => {
  let accountRepo: InMemoryAccountRepo;
  let txRepo: InMemoryTxRepo;
  let wealthRepo: InMemoryWealthRepo;
  let wealthUseCases: WealthUseCases;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepo();
    txRepo = new InMemoryTxRepo();
    wealthRepo = new InMemoryWealthRepo();
    wealthUseCases = new WealthUseCases(accountRepo, txRepo, wealthRepo);
  });

  describe('getNetWorthSummary', () => {
    it('derives net worth from accounts, transactions, investments, and liabilities', async () => {
      // Setup accounts
      const acc1: Account = {
        id: 'acc-1',
        name: 'HDFC Savings',
        type: 'bank',
        currency: 'INR',
        initialBalanceMinor: 5000000, // ₹50,000
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const acc2: Account = {
        id: 'acc-2',
        name: 'Cash Wallet',
        type: 'cash',
        currency: 'INR',
        initialBalanceMinor: 2000000, // ₹20,000
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      await accountRepo.create(acc1);
      await accountRepo.create(acc2);

      // Setup transactions
      await txRepo.create({
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 3000000, // +₹30,000
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
      });
      await txRepo.create({
        id: 'tx-2',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 1000000, // -₹10,000
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
      });
      // Transfer ₹5,000 from acc-1 to acc-2
      await txRepo.create({
        id: 'tx-3',
        accountId: 'acc-1',
        toAccountId: 'acc-2',
        type: 'transfer',
        amountMinor: 500000,
        currency: 'INR',
        date: '2026-09-03',
        categoryId: null,
        subcategory: null,
        merchant: null,
        notes: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      });

      // Derived balances:
      // acc-1: 50k + 30k - 10k - 5k = 65k (6,500,000 minor)
      // acc-2: 20k + 5k = 25k (2,500,000 minor)
      // Total Cash = 90k (9,000,000 minor)

      // Setup investments
      await wealthRepo.saveInvestment({
        id: 'inv-1',
        name: 'Nifty 50 ETF',
        type: 'etf',
        investedAmountMinor: 10000000,
        currentValueMinor: 12000000, // ₹1,20,000
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      // Setup liabilities
      await wealthRepo.saveLiability({
        id: 'liab-1',
        name: 'Car Loan',
        type: 'loan',
        principalAmountMinor: 5000000,
        remainingAmountMinor: 3000000, // ₹30,000
        currency: 'INR',
        interestRatePercent: 9,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const summary = await wealthUseCases.getNetWorthSummary();
      // Cash: 90,000
      // Investments: 120,000
      // Total Assets: 210,000 (21,000,000 minor)
      // Total Liabilities: 30,000 (3,000,000 minor)
      // Net Worth: 180,000 (18,000,000 minor)
      expect(summary.cashBankAssetsMinor).toBe(9000000);
      expect(summary.investmentsMinor).toBe(12000000);
      expect(summary.totalAssetsMinor).toBe(21000000);
      expect(summary.totalLiabilitiesMinor).toBe(3000000);
      expect(summary.netWorthMinor).toBe(18000000);
    });
  });

  describe('getInvestmentAnalytics', () => {
    it('computes investment performance and asset allocation breakdown', async () => {
      await wealthRepo.saveInvestment({
        id: 'inv-1',
        name: 'Bluechip Fund',
        type: 'mutual_fund',
        investedAmountMinor: 10000000,
        currentValueMinor: 12500000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      await wealthRepo.saveInvestment({
        id: 'inv-2',
        name: 'Fixed Deposit',
        type: 'fd',
        investedAmountMinor: 5000000,
        currentValueMinor: 5250000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const analytics = await wealthUseCases.getInvestmentAnalytics();
      expect(analytics.investedAmountMinor).toBe(15000000);
      expect(analytics.currentValueMinor).toBe(17750000);
      expect(analytics.totalGainMinor).toBe(2750000);
      // Absolute return: 2,750,000 / 15,000,000 = 18.33% -> 18%
      expect(analytics.absoluteReturnPercent).toBe(18);
      expect(analytics.assetClassBreakdown).toEqual([
        { assetClass: 'equity', label: 'Equity', amountMinor: 12500000, percentage: 70 },
        { assetClass: 'debt', label: 'Debt', amountMinor: 5250000, percentage: 30 },
      ]);
    });
  });

  describe('getLiabilityAnalytics', () => {
    it('computes liability metrics and payoff progress', async () => {
      await wealthRepo.saveLiability({
        id: 'liab-1',
        name: 'Education Loan',
        type: 'loan',
        principalAmountMinor: 20000000,
        remainingAmountMinor: 10000000,
        currency: 'INR',
        interestRatePercent: 8,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const analytics = await wealthUseCases.getLiabilityAnalytics();
      expect(analytics.totalPrincipalMinor).toBe(20000000);
      expect(analytics.totalRemainingMinor).toBe(10000000);
      expect(analytics.totalPaidMinor).toBe(10000000);
      expect(analytics.payoffProgressPercent).toBe(50);
      expect(analytics.typeBreakdown).toEqual([
        { type: 'loan', label: 'Loan', amountMinor: 10000000, count: 1 },
      ]);
    });
  });

  describe('getHistoricalNetWorth', () => {
    it('computes monthly net worth trajectory over time', async () => {
      const refDate = new Date(2026, 8, 15); // Sept 15, 2026

      await accountRepo.create({
        id: 'acc-1',
        name: 'Bank',
        type: 'bank',
        currency: 'INR',
        initialBalanceMinor: 1000000, // ₹10,000 initial balance
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      await txRepo.create({
        id: 'tx-1',
        accountId: 'acc-1',
        type: 'income',
        amountMinor: 5000000,
        currency: 'INR',
        date: '2026-08-05',
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
        createdAt: '2026-08-05T00:00:00.000Z',
        updatedAt: '2026-08-05T00:00:00.000Z',
      });

      await wealthRepo.saveInvestment({
        id: 'inv-1',
        name: 'PPF',
        type: 'ppf',
        investedAmountMinor: 10000000,
        currentValueMinor: 10000000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });

      await wealthRepo.saveLiability({
        id: 'liab-1',
        name: 'Card',
        type: 'credit_card',
        principalAmountMinor: 2000000,
        remainingAmountMinor: 2000000,
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: null,
        notes: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });

      const trajectory = await wealthUseCases.getHistoricalNetWorth(2, refDate);
      expect(trajectory.length).toBe(2);

      // Month 1: 2026-08
      // Cash = initial 1M + tx 5M = 6M
      // Investments = 10M
      // Assets = 16M
      // Liabilities = 2M
      // Net Worth = 14M
      expect(trajectory[0]).toEqual({
        date: '2026-08',
        assetsMinor: 16000000,
        liabilitiesMinor: 2000000,
        netWorthMinor: 14000000,
      });

      // Month 2: 2026-09
      expect(trajectory[1]).toEqual({
        date: '2026-09',
        assetsMinor: 16000000,
        liabilitiesMinor: 2000000,
        netWorthMinor: 14000000,
      });
    });
  });

  describe('Investments CRUD', () => {
    it('creates, lists, updates, and deletes investments', async () => {
      const inv: Investment = {
        id: 'inv-test-1',
        name: 'Tata Motors',
        type: 'stock',
        investedAmountMinor: 500000,
        currentValueMinor: 600000,
        currency: 'INR',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      await wealthUseCases.createInvestment(inv);
      const listAfterCreate = await wealthUseCases.listInvestments();
      expect(listAfterCreate).toHaveLength(1);
      expect(listAfterCreate[0]?.name).toBe('Tata Motors');

      const updatedInv = { ...inv, currentValueMinor: 750000 };
      await wealthUseCases.updateInvestment(updatedInv);
      const listAfterUpdate = await wealthUseCases.listInvestments();
      expect(listAfterUpdate[0]?.currentValueMinor).toBe(750000);

      await wealthUseCases.deleteInvestment('inv-test-1');
      const listAfterDelete = await wealthUseCases.listInvestments();
      expect(listAfterDelete).toHaveLength(0);
    });
  });

  describe('Liabilities CRUD & payLiability', () => {
    it('creates, lists, updates, and deletes liabilities', async () => {
      const liab: Liability = {
        id: 'liab-test-1',
        name: 'Amazon Pay Later',
        type: 'bnpl',
        principalAmountMinor: 1000000,
        remainingAmountMinor: 1000000,
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: '2026-10-01',
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      await wealthUseCases.createLiability(liab);
      const listAfterCreate = await wealthUseCases.listLiabilities();
      expect(listAfterCreate).toHaveLength(1);
      expect(listAfterCreate[0]?.name).toBe('Amazon Pay Later');

      const updatedLiab = { ...liab, name: 'Amazon Pay BNPL' };
      await wealthUseCases.updateLiability(updatedLiab);
      const listAfterUpdate = await wealthUseCases.listLiabilities();
      expect(listAfterUpdate[0]?.name).toBe('Amazon Pay BNPL');

      await wealthUseCases.deleteLiability('liab-test-1');
      const listAfterDelete = await wealthUseCases.listLiabilities();
      expect(listAfterDelete).toHaveLength(0);
    });

    it('processes liability payment and reduces remaining amount', async () => {
      const liab: Liability = {
        id: 'liab-pay-1',
        name: 'Axis Credit Card',
        type: 'credit_card',
        principalAmountMinor: 5000000, // ₹50,000
        remainingAmountMinor: 3000000, // ₹30,000
        currency: 'INR',
        interestRatePercent: 42,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      await wealthUseCases.createLiability(liab);

      // Make partial payment of ₹10,000 (1,000,000 minor)
      const afterPayment = await wealthUseCases.payLiability('liab-pay-1', 1000000);
      expect(afterPayment.remainingAmountMinor).toBe(2000000);

      // Make overpayment of ₹25,000 (2,500,000 minor): remaining should clamp to 0
      const afterOverpayment = await wealthUseCases.payLiability('liab-pay-1', 2500000);
      expect(afterOverpayment.remainingAmountMinor).toBe(0);
    });

    it('throws error when paying non-existent liability', async () => {
      await expect(wealthUseCases.payLiability('non-existent', 50000)).rejects.toThrow(
        'Liability not found: non-existent'
      );
    });

    it('throws error when payment amount is negative', async () => {
      const liab: Liability = {
        id: 'liab-neg',
        name: 'Card',
        type: 'credit_card',
        principalAmountMinor: 500000,
        remainingAmountMinor: 500000,
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      await wealthUseCases.createLiability(liab);

      await expect(wealthUseCases.payLiability('liab-neg', -100)).rejects.toThrow(
        'Payment amount must be non-negative'
      );
    });
  });
});
