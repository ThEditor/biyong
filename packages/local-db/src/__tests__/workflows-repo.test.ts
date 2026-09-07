import { describe, it, expect, beforeEach } from 'vitest';
import {
  runMigrations,
  SqlitePeerDebtRepository,
  SqliteReimbursementRepository,
  SqliteSubscriptionRepository,
  SqliteReceiptRepository,
  SqliteTransactionRepository,
} from '../index.js';
import { MemorySqliteDriver } from '../memory-driver.js';
import type {
  PeerDebt,
  PeerDebtRepayment,
  ReimbursementClaim,
  SubscriptionItem,
  ReceiptAttachment,
  Transaction,
} from '@biyong/schemas';

describe('Local DB: Phase 7 & 8 Workflows Repositories', () => {
  let driver: MemorySqliteDriver;
  let peerDebtRepo: SqlitePeerDebtRepository;
  let reimbursementRepo: SqliteReimbursementRepository;
  let subscriptionRepo: SqliteSubscriptionRepository;
  let receiptRepo: SqliteReceiptRepository;
  let txRepo: SqliteTransactionRepository;

  beforeEach(async () => {
    driver = new MemorySqliteDriver();
    await driver.init();
    await runMigrations(driver);

    peerDebtRepo = new SqlitePeerDebtRepository(driver);
    reimbursementRepo = new SqliteReimbursementRepository(driver);
    subscriptionRepo = new SqliteSubscriptionRepository(driver);
    receiptRepo = new SqliteReceiptRepository(driver);
    txRepo = new SqliteTransactionRepository(driver);
  });

  describe('SqlitePeerDebtRepository', () => {
    it('creates, queries, repays, settles, and deletes peer debts', async () => {
      const now = new Date().toISOString();
      const debtLent: PeerDebt = {
        id: 'debt-1',
        personName: 'Rahul',
        type: 'lent',
        originalAmountMinor: 1500000, // ₹15,000
        remainingAmountMinor: 1500000,
        currency: 'INR',
        date: '2026-09-01',
        dueDate: '2026-10-01',
        notes: 'Loan for phone purchase',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const debtBorrowed: PeerDebt = {
        id: 'debt-2',
        personName: 'Priya',
        type: 'borrowed',
        originalAmountMinor: 500000, // ₹5,000
        remainingAmountMinor: 500000,
        currency: 'INR',
        date: '2026-09-03',
        dueDate: null,
        notes: 'Split dinner cash shortage',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      // 1. Create debts
      await peerDebtRepo.create(debtLent);
      await peerDebtRepo.create(debtBorrowed);

      // 2. Query debts
      const foundLent = await peerDebtRepo.findById('debt-1');
      expect(foundLent).not.toBeNull();
      expect(foundLent?.personName).toBe('Rahul');
      expect(foundLent?.type).toBe('lent');
      expect(foundLent?.originalAmountMinor).toBe(1500000);
      expect(foundLent?.remainingAmountMinor).toBe(1500000);
      expect(foundLent?.status).toBe('active');

      const allDebts = await peerDebtRepo.findAll();
      expect(allDebts).toHaveLength(2);

      const activeDebts = await peerDebtRepo.findByStatus('active');
      expect(activeDebts).toHaveLength(2);

      // 3. Add Repayments
      const repayment1: PeerDebtRepayment = {
        id: 'rep-1',
        debtId: 'debt-1',
        amountMinor: 500000, // ₹5,000 repaid
        date: '2026-09-04',
        notes: 'Partial UPI transfer',
        createdAt: new Date().toISOString(),
      };
      await peerDebtRepo.addRepayment(repayment1);

      // Update remaining balance on debt
      const updatedDebtLent: PeerDebt = {
        ...debtLent,
        remainingAmountMinor: 1000000, // ₹10,000 remaining
        updatedAt: new Date().toISOString(),
      };
      await peerDebtRepo.update(updatedDebtLent);

      const repaymentsAfter1 = await peerDebtRepo.getRepayments('debt-1');
      expect(repaymentsAfter1).toHaveLength(1);
      expect(repaymentsAfter1[0]!.amountMinor).toBe(500000);
      expect(repaymentsAfter1[0]!.debtId).toBe('debt-1');

      const checkedLent = await peerDebtRepo.findById('debt-1');
      expect(checkedLent?.remainingAmountMinor).toBe(1000000);

      // 4. Settling debt
      const repayment2: PeerDebtRepayment = {
        id: 'rep-2',
        debtId: 'debt-1',
        amountMinor: 1000000, // Remaining ₹10,000 repaid
        date: '2026-09-07',
        notes: 'Final settlement',
        createdAt: new Date().toISOString(),
      };
      await peerDebtRepo.addRepayment(repayment2);

      const settledDebt: PeerDebt = {
        ...debtLent,
        remainingAmountMinor: 0,
        status: 'settled',
        updatedAt: new Date().toISOString(),
      };
      await peerDebtRepo.update(settledDebt);

      const verifiedSettled = await peerDebtRepo.findById('debt-1');
      expect(verifiedSettled?.status).toBe('settled');
      expect(verifiedSettled?.remainingAmountMinor).toBe(0);

      const repaymentsAll = await peerDebtRepo.getRepayments('debt-1');
      expect(repaymentsAll).toHaveLength(2);

      const settledOnly = await peerDebtRepo.findByStatus('settled');
      expect(settledOnly).toHaveLength(1);
      expect(settledOnly[0]!.id).toBe('debt-1');

      // 5. Deletion
      await peerDebtRepo.delete('debt-1');
      expect(await peerDebtRepo.findById('debt-1')).toBeNull();
      const remainingRepayments = await peerDebtRepo.getRepayments('debt-1');
      expect(remainingRepayments).toHaveLength(0);

      const remainingDebts = await peerDebtRepo.findAll();
      expect(remainingDebts).toHaveLength(1);
      expect(remainingDebts[0]!.id).toBe('debt-2');
    });
  });

  describe('SqliteReimbursementRepository', () => {
    it('creates, updates, queries by status, and deletes reimbursement claims', async () => {
      const now = new Date().toISOString();
      const claim1: ReimbursementClaim = {
        id: 'claim-1',
        title: 'Client Lunch at Taj',
        category: 'work',
        amountMinor: 450000, // ₹4,500
        currency: 'INR',
        transactionId: 'tx-100',
        status: 'pending',
        submittedDate: '2026-09-02',
        settledDate: null,
        notes: 'Quarterly review team lunch',
        receiptUri: 'file:///receipts/taj-lunch.jpg',
        createdAt: now,
        updatedAt: now,
      };

      const claim2: ReimbursementClaim = {
        id: 'claim-2',
        title: 'Flight to Bangalore Tech Summit',
        category: 'travel',
        amountMinor: 850000, // ₹8,500
        currency: 'INR',
        transactionId: null,
        status: 'submitted',
        submittedDate: '2026-09-03',
        settledDate: null,
        notes: 'IndiGo flight 6E-204',
        receiptUri: 'file:///receipts/flight-ticket.pdf',
        createdAt: now,
        updatedAt: now,
      };

      // 1. Create claims
      await reimbursementRepo.create(claim1);
      await reimbursementRepo.create(claim2);

      // 2. Query claims
      const foundClaim = await reimbursementRepo.findById('claim-1');
      expect(foundClaim).not.toBeNull();
      expect(foundClaim?.title).toBe('Client Lunch at Taj');
      expect(foundClaim?.amountMinor).toBe(450000);
      expect(foundClaim?.category).toBe('work');
      expect(foundClaim?.receiptUri).toBe('file:///receipts/taj-lunch.jpg');

      const foundByTx = await reimbursementRepo.findByTransactionId('tx-100');
      expect(foundByTx?.id).toBe('claim-1');

      const allClaims = await reimbursementRepo.findAll();
      expect(allClaims).toHaveLength(2);

      // 3. Query by status
      const pendingClaims = await reimbursementRepo.findByStatus('pending');
      expect(pendingClaims).toHaveLength(1);
      expect(pendingClaims[0]!.id).toBe('claim-1');

      const submittedClaims = await reimbursementRepo.findByStatus('submitted');
      expect(submittedClaims).toHaveLength(1);
      expect(submittedClaims[0]!.id).toBe('claim-2');

      // 4. Update claim (approved & reimbursed)
      const settledDate = '2026-09-06';
      const updatedClaim: ReimbursementClaim = {
        ...claim1,
        status: 'reimbursed',
        settledDate,
        updatedAt: new Date().toISOString(),
      };
      await reimbursementRepo.update(updatedClaim);

      const verifiedUpdated = await reimbursementRepo.findById('claim-1');
      expect(verifiedUpdated?.status).toBe('reimbursed');
      expect(verifiedUpdated?.settledDate).toBe(settledDate);

      const reimbursedClaims = await reimbursementRepo.findByStatus('reimbursed');
      expect(reimbursedClaims).toHaveLength(1);
      expect(reimbursedClaims[0]!.id).toBe('claim-1');

      // 5. Delete claim
      await reimbursementRepo.delete('claim-2');
      expect(await reimbursementRepo.findById('claim-2')).toBeNull();
      expect(await reimbursementRepo.findAll()).toHaveLength(1);
    });
  });

  describe('SqliteSubscriptionRepository', () => {
    it('persists subscriptions, updates cadence, and queries by status', async () => {
      const now = new Date().toISOString();
      const sub1: SubscriptionItem = {
        id: 'sub-netflix',
        name: 'Netflix Premium',
        category: 'Entertainment',
        amountMinor: 64900, // ₹649.00
        cadence: 'monthly',
        nextBillingDate: '2026-09-15',
        isAutoDetected: false,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const sub2: SubscriptionItem = {
        id: 'sub-aws',
        name: 'AWS Cloud Services',
        category: 'Infrastructure',
        amountMinor: 250000, // ₹2,500.00
        cadence: 'monthly',
        nextBillingDate: '2026-09-10',
        isAutoDetected: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      // 1. Create subscriptions
      await subscriptionRepo.create(sub1);
      await subscriptionRepo.create(sub2);

      // 2. Query subscriptions
      const foundSub = await subscriptionRepo.findById('sub-netflix');
      expect(foundSub).not.toBeNull();
      expect(foundSub?.name).toBe('Netflix Premium');
      expect(foundSub?.amountMinor).toBe(64900);
      expect(foundSub?.cadence).toBe('monthly');
      expect(foundSub?.isAutoDetected).toBe(false);

      const foundAws = await subscriptionRepo.findById('sub-aws');
      expect(foundAws?.isAutoDetected).toBe(true);

      const allSubs = await subscriptionRepo.findAll();
      expect(allSubs).toHaveLength(2);
      // Next billing date ordered ASC: AWS (Sept 10) should precede Netflix (Sept 15)
      expect(allSubs[0]!.id).toBe('sub-aws');
      expect(allSubs[1]!.id).toBe('sub-netflix');

      // 3. Cadence update (e.g. switch to yearly plan)
      const updatedSub: SubscriptionItem = {
        ...sub1,
        cadence: 'yearly',
        amountMinor: 649000, // ₹6,490.00 yearly
        nextBillingDate: '2027-09-15',
        status: 'active',
        updatedAt: new Date().toISOString(),
      };
      await subscriptionRepo.update(updatedSub);

      const verifiedUpdated = await subscriptionRepo.findById('sub-netflix');
      expect(verifiedUpdated?.cadence).toBe('yearly');
      expect(verifiedUpdated?.amountMinor).toBe(649000);
      expect(verifiedUpdated?.nextBillingDate).toBe('2027-09-15');

      // 4. Pause and query by status
      const pausedSub: SubscriptionItem = {
        ...sub2,
        status: 'paused',
        updatedAt: new Date().toISOString(),
      };
      await subscriptionRepo.update(pausedSub);

      const activeSubs = await subscriptionRepo.findByStatus('active');
      expect(activeSubs).toHaveLength(1);
      expect(activeSubs[0]!.id).toBe('sub-netflix');

      const pausedSubs = await subscriptionRepo.findByStatus('paused');
      expect(pausedSubs).toHaveLength(1);
      expect(pausedSubs[0]!.id).toBe('sub-aws');

      // 5. Delete subscription
      await subscriptionRepo.delete('sub-netflix');
      expect(await subscriptionRepo.findById('sub-netflix')).toBeNull();
      expect(await subscriptionRepo.findAll()).toHaveLength(1);
    });
  });

  describe('SqliteReceiptRepository', () => {
    it('saves and retrieves receipt attachments', async () => {
      const now = new Date().toISOString();
      const receipt1: ReceiptAttachment = {
        id: 'receipt-1',
        transactionId: 'tx-501',
        fileName: 'uber_receipt_sept5.pdf',
        fileType: 'application/pdf',
        fileSizeBytes: 1048576, // 1MB
        storageUri: 'file:///data/receipts/uber_receipt_sept5.pdf',
        uploadedAt: now,
      };

      const receipt2: ReceiptAttachment = {
        id: 'receipt-2',
        transactionId: 'tx-501',
        fileName: 'uber_fare_breakdown.png',
        fileType: 'image/png',
        fileSizeBytes: 524288, // 512KB
        storageUri: 'file:///data/receipts/uber_fare_breakdown.png',
        uploadedAt: now,
      };

      // 1. Save receipts
      await receiptRepo.save(receipt1);
      await receiptRepo.save(receipt2);

      // 2. Query by ID
      const foundReceipt = await receiptRepo.findById('receipt-1');
      expect(foundReceipt).not.toBeNull();
      expect(foundReceipt?.fileName).toBe('uber_receipt_sept5.pdf');
      expect(foundReceipt?.fileType).toBe('application/pdf');
      expect(foundReceipt?.fileSizeBytes).toBe(1048576);
      expect(foundReceipt?.storageUri).toBe('file:///data/receipts/uber_receipt_sept5.pdf');

      // 3. Query by transaction ID
      const txReceipts = await receiptRepo.findByTransactionId('tx-501');
      expect(txReceipts).toHaveLength(2);

      // 4. Update via save (upsert)
      const updatedReceipt: ReceiptAttachment = {
        ...receipt1,
        fileName: 'uber_receipt_sept5_final.pdf',
        fileSizeBytes: 1200000,
      };
      await receiptRepo.save(updatedReceipt);

      const recheckedReceipt = await receiptRepo.findById('receipt-1');
      expect(recheckedReceipt?.fileName).toBe('uber_receipt_sept5_final.pdf');
      expect(recheckedReceipt?.fileSizeBytes).toBe(1200000);

      // 5. Query all
      const allReceipts = await receiptRepo.findAll();
      expect(allReceipts).toHaveLength(2);

      // 6. Delete receipt
      await receiptRepo.delete('receipt-2');
      expect(await receiptRepo.findById('receipt-2')).toBeNull();
      expect(await receiptRepo.findByTransactionId('tx-501')).toHaveLength(1);
    });
  });

  describe('Transactions with Phase 7 & 8 Reimbursable & Attachment fields', () => {
    it('creates, updates and retrieves transactions with reimbursable and receipt fields', async () => {
      // Create an account first
      await driver.run(
        `INSERT INTO accounts (id, name, type, initial_balance_minor, currency, is_archived, created_at, updated_at)
         VALUES ('acc-1', 'HDFC Salary', 'savings', 10000000, 'INR', 0, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')`
      );

      const tx: Transaction = {
        id: 'tx-reimb-1',
        accountId: 'acc-1',
        type: 'expense',
        amountMinor: 250000, // ₹2,500
        currency: 'INR',
        date: '2026-09-05',
        categoryId: 'cat-transport',
        subcategory: 'Taxi',
        merchant: 'Uber',
        notes: 'Airport ride for work visit',
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        isReimbursable: true,
        reimbursementStatus: 'pending',
        receiptAttachmentId: 'receipt-1',
        createdAt: '2026-09-05T10:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z',
      };

      await txRepo.create(tx);

      const retrieved = await txRepo.findById('tx-reimb-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.isReimbursable).toBe(true);
      expect(retrieved?.reimbursementStatus).toBe('pending');
      expect(retrieved?.receiptAttachmentId).toBe('receipt-1');

      // Update reimbursement status
      const updatedTx: Transaction = {
        ...tx,
        reimbursementStatus: 'reimbursed',
        updatedAt: '2026-09-07T12:00:00.000Z',
      };
      await txRepo.update(updatedTx);

      const updatedRetrieved = await txRepo.findById('tx-reimb-1');
      expect(updatedRetrieved?.reimbursementStatus).toBe('reimbursed');
    });
  });
});
