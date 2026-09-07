import { describe, it, expect, beforeEach } from 'vitest';
import type {
  Account,
  Category,
  PeerDebt,
  PeerDebtRepayment,
  ReimbursementClaim,
  SubscriptionItem,
  Transaction,
  Investment,
  Liability,
} from '@biyong/schemas';
import {
  LendingUseCases,
  ReimbursementUseCases,
  SubscriptionUseCases,
  ExportImportUseCases,
  IntelligenceUseCases,
  type AccountRepository,
  type CategoryRepository,
  type PeerDebtRepository,
  type ReceiptRepository,
  type ReimbursementRepository,
  type SubscriptionRepository,
  type TransactionRepository,
  type WealthRepository,
} from '../index.js';

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
  categories: Category[] = [];
  async findAll() { return [...this.categories]; }
  async findById(id: string) { return this.categories.find((c) => c.id === id) ?? null; }
  async create(cat: Category) { this.categories.push(cat); }
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
  async deleteInvestment(id: string) { this.investments = this.investments.filter((i) => i.id !== id); }
  async getLiabilities() { return [...this.liabilities]; }
  async findLiabilityById(id: string) { return this.liabilities.find((l) => l.id === id) ?? null; }
  async saveLiability(liab: Liability) {
    const idx = this.liabilities.findIndex((l) => l.id === liab.id);
    if (idx >= 0) this.liabilities[idx] = liab;
    else this.liabilities.push(liab);
  }
  async deleteLiability(id: string) { this.liabilities = this.liabilities.filter((l) => l.id !== id); }
}

class InMemoryPeerDebtRepo implements PeerDebtRepository {
  debts: PeerDebt[] = [];
  repayments: PeerDebtRepayment[] = [];

  async findAll() { return [...this.debts]; }
  async findById(id: string) { return this.debts.find((d) => d.id === id) ?? null; }
  async save(debt: PeerDebt) {
    const idx = this.debts.findIndex((d) => d.id === debt.id);
    if (idx >= 0) this.debts[idx] = debt;
    else this.debts.push(debt);
  }
  async delete(id: string) { this.debts = this.debts.filter((d) => d.id !== id); }
  async addRepayment(repayment: PeerDebtRepayment) { this.repayments.push(repayment); }
  async getRepayments(debtId: string) { return this.repayments.filter((r) => r.debtId === debtId); }
  async getAllRepayments() { return [...this.repayments]; }
}

class InMemoryReimbursementRepo implements ReimbursementRepository {
  claims: ReimbursementClaim[] = [];

  async findAll() { return [...this.claims]; }
  async findById(id: string) { return this.claims.find((c) => c.id === id) ?? null; }
  async save(claim: ReimbursementClaim) {
    const idx = this.claims.findIndex((c) => c.id === claim.id);
    if (idx >= 0) this.claims[idx] = claim;
    else this.claims.push(claim);
  }
  async delete(id: string) { this.claims = this.claims.filter((c) => c.id !== id); }
}

class InMemorySubscriptionRepo implements SubscriptionRepository {
  subscriptions: SubscriptionItem[] = [];

  async findAll() { return [...this.subscriptions]; }
  async findById(id: string) { return this.subscriptions.find((s) => s.id === id) ?? null; }
  async save(sub: SubscriptionItem) {
    const idx = this.subscriptions.findIndex((s) => s.id === sub.id);
    if (idx >= 0) this.subscriptions[idx] = sub;
    else this.subscriptions.push(sub);
  }
  async delete(id: string) { this.subscriptions = this.subscriptions.filter((s) => s.id !== id); }
}

describe('Application Layer: LendingUseCases', () => {
  let peerRepo: InMemoryPeerDebtRepo;
  let useCases: LendingUseCases;

  beforeEach(() => {
    peerRepo = new InMemoryPeerDebtRepo();
    useCases = new LendingUseCases(peerRepo);
  });

  it('creates, lists, and records repayments for peer debts', () => {
    const debt: PeerDebt = {
      id: 'debt-1',
      personName: 'Vikram',
      type: 'lent',
      originalAmountMinor: 100000,
      remainingAmountMinor: 100000,
      currency: 'INR',
      date: '2026-08-01',
      dueDate: '2026-09-01',
      notes: 'Weekend trip share',
      status: 'active',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    return useCases.createPeerDebt(debt).then(async () => {
      const all = await useCases.listPeerDebts();
      expect(all.length).toBe(1);

      const repaymentResult = await useCases.recordRepayment('debt-1', 40000, 'UPI partial');
      expect(repaymentResult.actualPaymentMinor).toBe(40000);
      expect(repaymentResult.updatedDebt.remainingAmountMinor).toBe(60000);
      expect(repaymentResult.isSettled).toBe(false);

      const summary = await useCases.getPeerDebtSummary();
      expect(summary.totalLentMinor).toBe(60000);
      expect(summary.netPeerBalanceMinor).toBe(60000);

      const reps = await useCases.getRepayments('debt-1');
      expect(reps.length).toBe(1);
      expect(reps[0]?.amountMinor).toBe(40000);
    });
  });
});

describe('Application Layer: ReimbursementUseCases', () => {
  let reimbursementRepo: InMemoryReimbursementRepo;
  let txRepo: InMemoryTxRepo;
  let useCases: ReimbursementUseCases;

  beforeEach(() => {
    reimbursementRepo = new InMemoryReimbursementRepo();
    txRepo = new InMemoryTxRepo();
    useCases = new ReimbursementUseCases(reimbursementRepo, txRepo);
  });

  it('manages reimbursement claims and personal spending breakdown', async () => {
    const claim: ReimbursementClaim = {
      id: 'claim-1',
      title: 'Airport Taxi',
      category: 'travel',
      amountMinor: 150000,
      currency: 'INR',
      transactionId: 'tx-taxi',
      status: 'pending',
      submittedDate: '2026-08-10',
      settledDate: null,
      notes: null,
      receiptUri: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    };

    await useCases.createClaim(claim);

    const initialSummary = await useCases.getSummary();
    expect(initialSummary.pendingMinor).toBe(150000);
    expect(initialSummary.reimbursedMinor).toBe(0);

    const reimbursedClaim = await useCases.markClaimReimbursed('claim-1', '2026-08-15');
    expect(reimbursedClaim.status).toBe('reimbursed');

    const settledSummary = await useCases.getSummary();
    expect(settledSummary.reimbursedMinor).toBe(150000);
    expect(settledSummary.personalExpenseReductionMinor).toBe(150000);

    await txRepo.create({
      id: 'tx-taxi',
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 150000,
      currency: 'INR',
      date: '2026-08-10',
      categoryId: null,
      subcategory: null,
      merchant: 'Uber',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: true,
      reimbursementStatus: 'reimbursed',
      receiptAttachmentId: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    });

    const breakdown = await useCases.getSpendingBreakdown();
    expect(breakdown.grossExpenseMinor).toBe(150000);
    expect(breakdown.reimbursableExpenseMinor).toBe(150000);
    expect(breakdown.netPersonalExpenseMinor).toBe(0);
  });
});

describe('Application Layer: SubscriptionUseCases', () => {
  let subRepo: InMemorySubscriptionRepo;
  let txRepo: InMemoryTxRepo;
  let useCases: SubscriptionUseCases;

  beforeEach(() => {
    subRepo = new InMemorySubscriptionRepo();
    txRepo = new InMemoryTxRepo();
    useCases = new SubscriptionUseCases(subRepo, txRepo);
  });

  it('manages subscriptions and calculates burn rate', async () => {
    const sub: SubscriptionItem = {
      id: 'sub-aws',
      name: 'AWS Cloud',
      category: 'Infrastructure',
      amountMinor: 500000, // 5000 monthly
      cadence: 'monthly',
      nextBillingDate: '2026-09-01',
      isAutoDetected: false,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await useCases.createSubscription(sub);

    const burnRate = await useCases.getBurnRate();
    expect(burnRate.activeCount).toBe(1);
    expect(burnRate.monthlyBurnRateMinor).toBe(500000);

    await useCases.pauseSubscription('sub-aws');
    const pausedBurn = await useCases.getBurnRate();
    expect(pausedBurn.activeCount).toBe(0);
  });

  it('detects subscriptions from transaction history', async () => {
    await txRepo.create({
      id: 't-1',
      accountId: 'a-1',
      type: 'expense',
      amountMinor: 29900,
      currency: 'INR',
      date: '2026-07-01',
      categoryId: null,
      subcategory: null,
      merchant: 'iCloud',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    await txRepo.create({
      id: 't-2',
      accountId: 'a-1',
      type: 'expense',
      amountMinor: 29900,
      currency: 'INR',
      date: '2026-07-31',
      categoryId: null,
      subcategory: null,
      merchant: 'iCloud',
      notes: null,
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
    });

    const detected = await useCases.detectSubscriptions();
    expect(detected.length).toBe(1);
    expect(detected[0]?.name).toBe('iCloud');
    expect(detected[0]?.cadence).toBe('monthly');
  });
});

describe('Application Layer: ExportImportUseCases & IntelligenceUseCases', () => {
  let accountRepo: InMemoryAccountRepo;
  let txRepo: InMemoryTxRepo;
  let categoryRepo: InMemoryCategoryRepo;
  let wealthRepo: InMemoryWealthRepo;
  let peerRepo: InMemoryPeerDebtRepo;
  let exportUseCases: ExportImportUseCases;
  let intelligenceUseCases: IntelligenceUseCases;

  beforeEach(async () => {
    accountRepo = new InMemoryAccountRepo();
    txRepo = new InMemoryTxRepo();
    categoryRepo = new InMemoryCategoryRepo();
    wealthRepo = new InMemoryWealthRepo();
    peerRepo = new InMemoryPeerDebtRepo();

    await accountRepo.create({
      id: 'acc-main',
      name: 'Savings',
      type: 'bank',
      initialBalanceMinor: 10000000, // 100,000
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await categoryRepo.create({
      id: 'cat-dining',
      name: 'Food & Dining',
      icon: 'utensils',
      parentCategoryId: null,
      isBuiltin: true,
    });

    await txRepo.create({
      id: 'tx-food',
      accountId: 'acc-main',
      type: 'expense',
      amountMinor: 120000, // 1,200
      currency: 'INR',
      date: '2026-08-01',
      categoryId: 'cat-dining',
      subcategory: null,
      merchant: 'Swiggy',
      notes: 'Lunch',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    exportUseCases = new ExportImportUseCases({
      accountRepo,
      txRepo,
      categoryRepo,
      wealthRepo,
      peerDebtRepo: peerRepo,
    });

    intelligenceUseCases = new IntelligenceUseCases({
      accountRepo,
      txRepo,
      categoryRepo,
      wealthRepo,
      peerDebtRepo: peerRepo,
    });
  });

  it('exports ledger to JSON and CSV and reconciles import', async () => {
    const jsonStr = await exportUseCases.exportToJson();
    expect(jsonStr).toContain('acc-main');

    const csvTx = await exportUseCases.exportTransactionsCsv();
    expect(csvTx).toContain('Swiggy');
    expect(csvTx).toContain('1200.00');

    const csvAcc = await exportUseCases.exportAccountsCsv();
    expect(csvAcc).toContain('Savings');

    const importResult = await exportUseCases.importAndReconcile(jsonStr);
    expect(importResult.success).toBe(true);
    expect(importResult.reconciled?.accounts.length).toBe(1);
  });

  it('answers natural language queries with intelligence use cases', async () => {
    const affordRes = await intelligenceUseCases.askQuestion('Can I afford a ₹15,000 phone?');
    expect(affordRes.matchedIntent).toBe('can_i_afford');
    expect(affordRes.supportingData?.canAfford).toBe(true);

    const merchantCategory = await intelligenceUseCases.suggestCategory('Swiggy Instamart');
    expect(merchantCategory).toBe('cat-dining');
  });
});
