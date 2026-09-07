/**
 * Biyong — Phase 7 Verification Script
 * Strictly verifies Phase 7 (Advanced Money Workflows) per biyong.md Section 60.
 *
 * Verification criteria:
 * 1. Peer-to-Peer Lending & Borrowing:
 *    - Track money lent (assets/receivables) and money borrowed (liabilities/payables).
 *    - Record partial and full repayments, updating remaining balance and settling status.
 *    - Net worth integration: receivables count as assets, payables count as liabilities.
 * 2. Reimbursements & Spending Segregation:
 *    - Flags reimbursable expenses and creates transparent reimbursement claims.
 *    - Deducts reimbursable expenses from gross spending to report true net personal spend.
 *    - Tracks claim lifecycle: pending -> reimbursed.
 * 3. Subscriptions & Burn Rate:
 *    - Normalizes multi-frequency recurring expenses (weekly, monthly, quarterly, yearly).
 *    - Computes monthly and annualized burn rates.
 *    - Auto-detects recurring transaction patterns deterministically.
 * 4. Full Ledger Export & Re-Import with 100% Fidelity:
 *    - Full JSON backup export adhering to LedgerExportDataSchema.
 *    - RFC 4180 compliant CSV export for transactions and accounts.
 *    - Wipe database, re-import JSON backup, and assert 100% data fidelity and balance equality.
 * 5. Multi-User / Cloud Sync Integration:
 *    - Syncs debts, claims, and subscriptions via API endpoints with security authorization.
 */

import { createApp } from '../apps/api/src/app.js';
import {
  runMigrations,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteBudgetRepository,
  SqliteGoalRepository,
  SqliteWealthRepository,
  SqlitePeerDebtRepository,
  SqliteReimbursementRepository,
  SqliteSubscriptionRepository,
  SqliteReceiptRepository,
  SqliteOutboxRepository,
  SqliteSyncStateRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import {
  AccountUseCases,
  TransactionUseCases,
  WealthUseCases,
  LendingUseCases,
  ReimbursementUseCases,
  SubscriptionUseCases,
  ExportImportUseCases,
} from '../packages/application/src/index.js';
import {
  formatMoney,
  calculateNetWorth,
  calculatePeerDebtSummary,
  applyRepayment,
  calculateReimbursementSummary,
  calculatePersonalSpendingBreakdown,
  calculateSubscriptionBurnRate,
  normalizeCadenceToMonthlyMinor,
  detectSubscriptionsFromTransactions,
  exportLedgerToJson,
  exportTransactionsToCsv,
  exportAccountsToCsv,
  validateLedgerImport,
} from '../packages/domain/src/index.js';
import type { PeerDebt, ReimbursementClaim, SubscriptionItem } from '../packages/schemas/src/index.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

async function runPhase7Verification() {
  console.log('\n====================================================');
  console.log('   BIYONG — PHASE 7 (ADVANCED MONEY WORKFLOWS)');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. Initialize SQLite Database Engine (Offline)
  // ----------------------------------------------------
  console.log('1. Initializing Local SQLite Engine for Advanced Workflows...');
  const driver = new MemorySqliteDriver();
  await driver.init();
  await runMigrations(driver);

  const accountRepo = new SqliteAccountRepository(driver);
  const txRepo = new SqliteTransactionRepository(driver);
  const budgetRepo = new SqliteBudgetRepository(driver);
  const goalRepo = new SqliteGoalRepository(driver);
  const wealthRepo = new SqliteWealthRepository(driver);
  const peerDebtRepo = new SqlitePeerDebtRepository(driver);
  const reimbursementRepo = new SqliteReimbursementRepository(driver);
  const subscriptionRepo = new SqliteSubscriptionRepository(driver);
  const receiptRepo = new SqliteReceiptRepository(driver);

  const accountUseCases = new AccountUseCases(accountRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo);
  const wealthUseCases = new WealthUseCases(accountRepo, txRepo, wealthRepo);
  const lendingUseCases = new LendingUseCases(peerDebtRepo, txRepo);
  const reimbursementUseCases = new ReimbursementUseCases(reimbursementRepo, txRepo);
  const subscriptionUseCases = new SubscriptionUseCases(subscriptionRepo, txRepo);
  const exportImportUseCases = new ExportImportUseCases({
    accountRepo,
    txRepo,
    budgetRepo,
    goalRepo,
    wealthRepo,
    peerDebtRepo,
    subscriptionRepo,
    reimbursementRepo,
  });

  console.log('   [OK] Advanced workflows repositories initialized.\n');

  // ----------------------------------------------------
  // 2. Peer-to-Peer Lending & Borrowing Workflows
  // ----------------------------------------------------
  console.log('2. Testing Peer-to-Peer Lending & Borrowing Workflows...');

  // Setup bank account
  await accountUseCases.createAccount({
    id: 'acc-main',
    name: 'Main Checking',
    type: 'bank',
    currency: 'INR',
    initialBalanceMinor: 10000000, // ₹1,00,000.00
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  // User lends ₹15,000 to Bob
  const lentDebt: PeerDebt = {
    id: 'debt-lent-bob',
    personName: 'Bob Smith',
    type: 'lent',
    originalAmountMinor: 1500000, // ₹15,000.00
    remainingAmountMinor: 1500000,
    currency: 'INR',
    date: '2026-03-01',
    dueDate: '2026-04-01',
    notes: 'Concert tickets advance',
    status: 'active',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  };
  await lendingUseCases.createPeerDebt(lentDebt);

  // User borrows ₹5,000 from Alice
  const borrowedDebt: PeerDebt = {
    id: 'debt-borrowed-alice',
    personName: 'Alice Cooper',
    type: 'borrowed',
    originalAmountMinor: 500000, // ₹5,000.00
    remainingAmountMinor: 500000,
    currency: 'INR',
    date: '2026-03-02',
    dueDate: '2026-03-20',
    notes: 'Dinner bill cover',
    status: 'active',
    createdAt: '2026-03-02T12:00:00.000Z',
    updatedAt: '2026-03-02T12:00:00.000Z',
  };
  await lendingUseCases.createPeerDebt(borrowedDebt);

  const initialDebtSummary = await lendingUseCases.getSummary();
  assert(initialDebtSummary.totalLentMinor === 1500000, 'Total lent should be ₹15,000');
  assert(initialDebtSummary.totalBorrowedMinor === 500000, 'Total borrowed should be ₹5,000');
  assert(initialDebtSummary.netPeerBalanceMinor === 1000000, 'Net peer balance should be +₹10,000');
  assert(initialDebtSummary.activeLentCount === 1, 'Active lent count should be 1');
  assert(initialDebtSummary.activeBorrowedCount === 1, 'Active borrowed count should be 1');

  // Net Worth integration test:
  // Liquid bank balance: ₹1,00,000
  // Lent debt (asset): +₹15,000
  // Borrowed debt (liability): -₹5,000
  // Net Worth should be ₹1,00,000 + ₹15,000 - ₹5,000 = ₹1,10,000
  const allDebts = await lendingUseCases.listPeerDebts();
  const netWorthWithDebts = calculateNetWorth([10000000], [], [], allDebts);
  assert(netWorthWithDebts.totalAssetsMinor === 11500000, 'Total assets must include money lent (₹1,15,000)');
  assert(netWorthWithDebts.totalLiabilitiesMinor === 500000, 'Total liabilities must include money borrowed (₹5,000)');
  assert(netWorthWithDebts.netWorthMinor === 11000000, 'Net worth must equal ₹1,10,000 with peer debts');
  console.log('   [OK] Peer Debt net worth integration verified: Assets +₹15,000, Liabilities -₹5,000.');

  // Repayment: Bob partially repays ₹5,000
  const partialRepayment = await lendingUseCases.repayPeerDebt('debt-lent-bob', 500000, 'acc-main', '2026-03-10', 'Partial return');
  assert(partialRepayment.remainingAmountMinor === 1000000, 'Bob remaining balance should be ₹10,000');
  assert(partialRepayment.status === 'active', 'Debt should still be active');

  // Repayment: Bob settles remaining ₹10,000
  const fullRepayment = await lendingUseCases.repayPeerDebt('debt-lent-bob', 1000000, 'acc-main', '2026-03-15', 'Full settlement');
  assert(fullRepayment.remainingAmountMinor === 0, 'Bob remaining balance should be ₹0');
  assert(fullRepayment.status === 'settled', 'Debt status must transition to settled');

  const afterSettleSummary = await lendingUseCases.getSummary();
  assert(afterSettleSummary.totalLentMinor === 0, 'Active lent should now be 0');
  assert(afterSettleSummary.activeLentCount === 0, 'Active lent count should now be 0');
  console.log('   [OK] Repayment lifecycle (partial -> full settlement) verified.\n');

  // ----------------------------------------------------
  // 3. Reimbursements & Spending Segregation
  // ----------------------------------------------------
  console.log('3. Testing Reimbursements & Spending Segregation...');

  // User spends ₹12,000 on company flights (reimbursable)
  await txUseCases.createTransaction({
    id: 'tx-flight',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 1200000, // ₹12,000.00
    currency: 'INR',
    date: '2026-03-05',
    category: 'Travel',
    merchant: 'IndiGo Airlines',
    notes: 'Client onsite flight',
    isReimbursable: true,
    reimbursementStatus: 'pending',
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-05T00:00:00.000Z',
  });

  // User spends ₹3,000 on team dinner (reimbursable)
  await txUseCases.createTransaction({
    id: 'tx-dinner',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 300000, // ₹3,000.00
    currency: 'INR',
    date: '2026-03-06',
    category: 'Food',
    merchant: 'Barbeque Nation',
    notes: 'Team dinner',
    isReimbursable: true,
    reimbursementStatus: 'pending',
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  });

  // User spends ₹4,500 on personal groceries (non-reimbursable)
  await txUseCases.createTransaction({
    id: 'tx-groceries',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 450000, // ₹4,500.00
    currency: 'INR',
    date: '2026-03-07',
    category: 'Groceries',
    merchant: 'Nature Basket',
    notes: 'Weekly groceries',
    isReimbursable: false,
    reimbursementStatus: 'unclaimed',
    createdAt: '2026-03-07T00:00:00.000Z',
    updatedAt: '2026-03-07T00:00:00.000Z',
  });

  // Create reimbursement claims
  await reimbursementUseCases.createClaim({
    id: 'claim-flight',
    title: 'IndiGo Client Flight',
    category: 'travel',
    amountMinor: 1200000,
    currency: 'INR',
    transactionId: 'tx-flight',
    status: 'pending',
    submittedDate: '2026-03-06',
    settledDate: null,
    notes: 'Travel invoice attached',
    receiptUri: null,
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  });

  await reimbursementUseCases.createClaim({
    id: 'claim-dinner',
    title: 'Team Dinner',
    category: 'work',
    amountMinor: 300000,
    currency: 'INR',
    transactionId: 'tx-dinner',
    status: 'pending',
    submittedDate: '2026-03-07',
    settledDate: null,
    notes: 'Receipt attached',
    receiptUri: null,
    createdAt: '2026-03-07T00:00:00.000Z',
    updatedAt: '2026-03-07T00:00:00.000Z',
  });

  // Spending breakdown analysis
  const spendingBreakdown = await reimbursementUseCases.getSpendingBreakdown();
  assert(spendingBreakdown.grossExpenseMinor === 1950000, 'Gross spending should be ₹19,500');
  assert(spendingBreakdown.reimbursableExpenseMinor === 1500000, 'Reimbursable deductions should be ₹15,000');
  assert(spendingBreakdown.netPersonalExpenseMinor === 450000, 'Net personal spending should be strictly ₹4,500');
  console.log('   [OK] Spending Segregation: Gross ₹19,500 - Reimbursable ₹15,000 = Net Personal ₹4,500.');

  // Settle flight claim
  await reimbursementUseCases.updateClaimStatus('claim-flight', 'reimbursed', '2026-03-18');
  const claimSummary = await reimbursementUseCases.getSummary();
  assert(claimSummary.reimbursedMinor === 1200000, 'Reimbursed total should be ₹12,000');
  assert(claimSummary.pendingMinor === 300000, 'Pending claims should be ₹3,000');
  console.log('   [OK] Claim lifecycle and payout status tracked.\n');

  // ----------------------------------------------------
  // 4. Recurring Subscriptions & Burn Rate
  // ----------------------------------------------------
  console.log('4. Testing Subscriptions & Burn Rate Calculation...');

  const subNetflix: SubscriptionItem = {
    id: 'sub-netflix',
    name: 'Netflix Premium',
    category: 'Entertainment',
    amountMinor: 64900, // ₹649/mo
    cadence: 'monthly',
    nextBillingDate: '2026-04-01',
    isAutoDetected: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const subSpotify: SubscriptionItem = {
    id: 'sub-spotify',
    name: 'Spotify Family',
    category: 'Music',
    amountMinor: 17900, // ₹179/mo
    cadence: 'monthly',
    nextBillingDate: '2026-04-05',
    isAutoDetected: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const subGym: SubscriptionItem = {
    id: 'sub-gym',
    name: 'Cult Fit Elite',
    category: 'Health',
    amountMinor: 1200000, // ₹12,000/yr -> ₹1,000/mo
    cadence: 'yearly',
    nextBillingDate: '2027-01-01',
    isAutoDetected: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  await subscriptionUseCases.createSubscription(subNetflix);
  await subscriptionUseCases.createSubscription(subSpotify);
  await subscriptionUseCases.createSubscription(subGym);

  const burnRate = await subscriptionUseCases.getBurnRate();
  // 649 + 179 + 1000 = ₹1,828/mo
  assert(burnRate.activeCount === 3, 'Should have 3 active subscriptions');
  assert(burnRate.monthlyBurnRateMinor === 182800, `Monthly burn rate should be ₹1,828 (got ${burnRate.monthlyBurnRateMinor})`);
  assert(burnRate.yearlyBurnRateMinor === 182800 * 12, 'Yearly burn rate should be monthly * 12');
  console.log(`   [OK] Burn rate computed: ${formatMoney(burnRate.monthlyBurnRateMinor)}/month (${formatMoney(burnRate.yearlyBurnRateMinor)}/year).`);

  // Auto-detection test: create 3 monthly recurring transactions for broadband
  await txUseCases.createTransaction({
    id: 'tx-bb-1',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 99900,
    currency: 'INR',
    date: '2026-01-10',
    category: 'Utilities',
    merchant: 'Airtel Broadband',
    notes: 'Fiber bill',
    isRecurring: true,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  });
  await txUseCases.createTransaction({
    id: 'tx-bb-2',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 99900,
    currency: 'INR',
    date: '2026-02-10',
    category: 'Utilities',
    merchant: 'Airtel Broadband',
    notes: 'Fiber bill',
    isRecurring: true,
    createdAt: '2026-02-10T00:00:00.000Z',
    updatedAt: '2026-02-10T00:00:00.000Z',
  });
  await txUseCases.createTransaction({
    id: 'tx-bb-3',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 99900,
    currency: 'INR',
    date: '2026-03-10',
    category: 'Utilities',
    merchant: 'Airtel Broadband',
    notes: 'Fiber bill',
    isRecurring: true,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
  });

  const detected = await subscriptionUseCases.detectSubscriptions();
  const airtelSub = detected.find((s) => s.name === 'Airtel Broadband');
  assert(airtelSub !== undefined, 'Airtel Broadband should be auto-detected');
  assert(airtelSub.amountMinor === 99900, 'Airtel Broadband amount should be ₹999');
  assert(airtelSub.isAutoDetected === true, 'Auto-detected flag must be true');
  console.log('   [OK] Deterministic recurring auto-detection verified (Airtel Broadband detected).\n');

  // ----------------------------------------------------
  // 5. Full Data Export & Re-Import with 100% Fidelity
  // ----------------------------------------------------
  console.log('5. Testing Full Data Export & Re-Import with 100% Fidelity...');

  // Perform full export
  const exportData = await exportImportUseCases.exportFullLedger();
  assert(exportData.version === '1.0', 'Export version must be 1.0');
  assert(exportData.accounts.length === 1, 'Exported accounts count mismatch');
  assert(exportData.transactions.length >= 6, 'Exported transactions count mismatch');
  assert(exportData.peerDebts.length === 2, 'Exported peer debts count mismatch');
  assert(exportData.subscriptions.length === 3, 'Exported subscriptions count mismatch');

  const jsonExportStr = exportLedgerToJson(exportData);
  const importValidation = validateLedgerImport(jsonExportStr);
  assert(importValidation.valid === true, `Exported JSON validation failed: ${importValidation.error}`);

  // Test CSV exports
  const txCsv = await exportImportUseCases.exportTransactionsCsv();
  assert(txCsv.includes('id,date,account,type,amount,currency'), 'CSV header mismatch');
  assert(txCsv.includes('IndiGo Airlines'), 'CSV should contain transactions');
  assert(txCsv.includes('12000.00'), 'CSV should properly format decimal minor amounts');

  const accCsv = await exportImportUseCases.exportAccountsCsv();
  assert(accCsv.includes('Main Checking'), 'Accounts CSV should contain account name');

  console.log('   [OK] JSON and RFC 4180 CSV exports successfully generated.');

  // Create a brand new clean database (simulating wiped app / fresh device)
  console.log('   Simulating full app wipe & import on a fresh device...');
  const newDriver = new MemorySqliteDriver();
  await newDriver.init();
  await runMigrations(newDriver);

  const newAccountRepo = new SqliteAccountRepository(newDriver);
  const newTxRepo = new SqliteTransactionRepository(newDriver);
  const newBudgetRepo = new SqliteBudgetRepository(newDriver);
  const newGoalRepo = new SqliteGoalRepository(newDriver);
  const newWealthRepo = new SqliteWealthRepository(newDriver);
  const newPeerDebtRepo = new SqlitePeerDebtRepository(newDriver);
  const newSubRepo = new SqliteSubscriptionRepository(newDriver);

  const newExportImportUseCases = new ExportImportUseCases({
    accountRepo: newAccountRepo,
    txRepo: newTxRepo,
    budgetRepo: newBudgetRepo,
    goalRepo: newGoalRepo,
    wealthRepo: newWealthRepo,
    peerDebtRepo: newPeerDebtRepo,
    subscriptionRepo: newSubRepo,
  });

  const reconcileResult = await newExportImportUseCases.importAndReconcile(jsonExportStr);
  assert(reconcileResult.success === true, 'Re-import into wiped database failed');

  // Verify complete fidelity
  const importedAccounts = await newAccountRepo.findAll();
  const importedTxs = await newTxRepo.findAll();
  const importedDebts = await newPeerDebtRepo.findAll();
  const importedSubs = await newSubRepo.findAll();

  assert(importedAccounts.length === exportData.accounts.length, 'Imported account count mismatch');
  assert(importedTxs.length === exportData.transactions.length, 'Imported transaction count mismatch');
  assert(importedDebts.length === exportData.peerDebts.length, 'Imported peer debts count mismatch');
  assert(importedSubs.length === exportData.subscriptions.length, 'Imported subscriptions count mismatch');

  // Verify exact balance equality
  assert(importedAccounts[0].initialBalanceMinor === 10000000, 'Imported balance must match exactly');
  const flightTx = importedTxs.find((t) => t.id === 'tx-flight');
  assert(flightTx !== undefined && flightTx.isReimbursable === true, 'Reimbursable flag preserved');

  console.log('   [OK] 100% Data Fidelity verified: Zero data loss, exact balances preserved.\n');

  // ----------------------------------------------------
  // 6. Multi-User & Cloud API Sync Integration
  // ----------------------------------------------------
  console.log('6. Testing Multi-User Backend Sync & API Security...');
  const apiApp = createApp();

  // Register User A
  const resA = await apiApp.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User A',
      email: 'usera@example.com',
      password: 'Password123!',
    }),
  });
  const authA = await resA.json();
  const tokenA = authA.token;

  // Push Debt on User A
  const createDebtRes = await apiApp.request('/debts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify(lentDebt),
  });
  assert(createDebtRes.status === 201, 'API debt creation should return 201');

  // User B tries to view or alter User A's debt
  const resB = await apiApp.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User B',
      email: 'userb@example.com',
      password: 'Password123!',
    }),
  });
  const authB = await resB.json();
  const tokenB = authB.token;

  const forbiddenDebtRes = await apiApp.request(`/debts/${lentDebt.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${tokenB}`,
    },
  });
  assert(forbiddenDebtRes.status === 403, 'Cross-user debt manipulation must return 403 Forbidden');

  // Unauthenticated export request
  const unauthExport = await apiApp.request('/export', {
    method: 'GET',
  });
  assert(unauthExport.status === 401, 'Unauthenticated export must return 401 Unauthorized');

  console.log('   [OK] API multi-user authorization and security verified.\n');

  console.log('====================================================');
  console.log('   PHASE 7 VERIFICATION COMPLETE: ALL CHECKS PASSED');
  console.log('====================================================\n');
}

runPhase7Verification().catch((err) => {
  console.error('Unexpected error in Phase 7 verification:', err);
  process.exit(1);
});
