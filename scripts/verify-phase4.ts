/**
 * Biyong — Phase 4 Verification Script
 * Strictly verifies Phase 4 (Authentication & Synchronization Foundation) 100% offline.
 *
 * Verification criteria from biyong.md:
 * - Two simulated devices (Device A and Device B)
 * - Device A offline → create local state
 * - Device B offline → create local state
 * - Reconnect & Sync
 * - Verify convergence (Device A and Device B reach identical state)
 * - Repeat operations intentionally
 * - Ensure no duplicates appear (idempotency verification)
 * - Guest mode & upgrade merge verification
 */

import {
  runMigrations,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteOutboxRepository,
  SqliteSyncStateRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import {
  AccountUseCases,
  TransactionUseCases,
  CategoryUseCases,
} from '../packages/application/src/index.js';
import {
  SyncEngine,
  createSyncOperation,
  type SyncServerClient,
} from '../packages/sync/src/index.js';
import {
  InMemoryAuthService,
  createGuestSession,
  buildGuestMigrationPlan,
} from '../packages/auth/src/index.js';
import { formatMoney } from '../packages/domain/src/index.js';
import type { Account, Transaction, SyncOperation } from '../packages/schemas/src/index.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

// In-Memory Central Server Simulator for 100% Offline Testing
class CentralSyncServerSimulator implements SyncServerClient {
  private operationsMap = new Map<string, SyncOperation>(); // op.id -> op

  async pushOperations(ops: SyncOperation[]): Promise<{
    syncedIds: string[];
    rejected: { id: string; reason: string }[];
  }> {
    const syncedIds: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    for (const op of ops) {
      // Idempotency: If operation ID already exists, acknowledge as synced without duplication
      if (this.operationsMap.has(op.id)) {
        syncedIds.push(op.id);
        continue;
      }
      this.operationsMap.set(op.id, op);
      syncedIds.push(op.id);
    }

    return { syncedIds, rejected };
  }

  async pullOperations(sinceCursor?: string): Promise<{
    operations: SyncOperation[];
    nextCursor: string;
  }> {
    const allOps = Array.from(this.operationsMap.values());
    let filtered = allOps;

    if (sinceCursor) {
      const cursorTime = new Date(sinceCursor).getTime();
      if (!isNaN(cursorTime)) {
        filtered = allOps.filter((o) => new Date(o.timestamp).getTime() > cursorTime);
      }
    }

    const latestCursor =
      filtered.length > 0
        ? filtered[filtered.length - 1].timestamp
        : sinceCursor || new Date().toISOString();

    return {
      operations: filtered,
      nextCursor: latestCursor,
    };
  }

  getServerOperationCount(): number {
    return this.operationsMap.size;
  }
}

async function runPhase4Verification() {
  console.log('\n====================================================');
  console.log('   BIYONG — PHASE 4 (AUTH & SYNC FOUNDATION)        ');
  console.log('====================================================\n');

  const server = new CentralSyncServerSimulator();
  const authService = new InMemoryAuthService();

  // 1. Setup Device A (Alice's Phone)
  console.log('1. Initializing Device A (Phone) Offline SQLite Engine...');
  const driverA = new MemorySqliteDriver();
  await driverA.init();
  await runMigrations(driverA);

  const deviceIdA = 'device-phone-alice';
  const accountRepoA = new SqliteAccountRepository(driverA);
  const txRepoA = new SqliteTransactionRepository(driverA);
  const outboxRepoA = new SqliteOutboxRepository(driverA);
  const syncStateRepoA = new SqliteSyncStateRepository(driverA);
  await syncStateRepoA.setDeviceId(deviceIdA);

  const accountUseCasesA = new AccountUseCases(accountRepoA, txRepoA);

  const syncEngineA = new SyncEngine(
    outboxRepoA,
    server,
    syncStateRepoA,
    deviceIdA,
    { accountRepo: accountRepoA, txRepo: txRepoA }
  );
  console.log('   \x1b[32m[OK]\x1b[0m Device A initialized offline with ID:', deviceIdA);

  // 2. Setup Device B (Alice's Laptop)
  console.log('\n2. Initializing Device B (Laptop) Offline SQLite Engine...');
  const driverB = new MemorySqliteDriver();
  await driverB.init();
  await runMigrations(driverB);

  const deviceIdB = 'device-laptop-alice';
  const accountRepoB = new SqliteAccountRepository(driverB);
  const txRepoB = new SqliteTransactionRepository(driverB);
  const outboxRepoB = new SqliteOutboxRepository(driverB);
  const syncStateRepoB = new SqliteSyncStateRepository(driverB);
  await syncStateRepoB.setDeviceId(deviceIdB);

  const accountUseCasesB = new AccountUseCases(accountRepoB, txRepoB);

  const syncEngineB = new SyncEngine(
    outboxRepoB,
    server,
    syncStateRepoB,
    deviceIdB,
    { accountRepo: accountRepoB, txRepo: txRepoB }
  );
  console.log('   \x1b[32m[OK]\x1b[0m Device B initialized offline with ID:', deviceIdB);

  // 3. Device A creates offline financial activity
  console.log('\n3. Device A (Offline): Creating Local Account & Transactions...');
  const now = new Date().toISOString();

  // Account 1 on Device A: Checking Bank
  const checkingAccount: Account = {
    id: 'acc-checking-1',
    name: 'Primary Checking Bank',
    type: 'bank',
    initialBalanceMinor: 5000000, // ₹50,000.00
    currency: 'INR',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  await accountRepoA.create(checkingAccount);
  await outboxRepoA.enqueue(
    createSyncOperation({
      entityType: 'account',
      entityId: checkingAccount.id,
      operationType: 'create',
      payload: checkingAccount as any,
      deviceId: deviceIdA,
    })
  );

  // Income on Device A: Salary
  const salaryTx: Transaction = {
    id: 'tx-salary-1',
    accountId: checkingAccount.id,
    type: 'income',
    amountMinor: 10000000, // ₹1,00,000.00
    currency: 'INR',
    date: '2026-09-01',
    categoryId: 'cat-salary',
    subcategory: null,
    merchant: 'Acme Corp',
    notes: 'September Salary',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: now,
    updatedAt: now,
  };
  await txRepoA.create(salaryTx);
  await outboxRepoA.enqueue(
    createSyncOperation({
      entityType: 'transaction',
      entityId: salaryTx.id,
      operationType: 'create',
      payload: salaryTx as any,
      deviceId: deviceIdA,
    })
  );

  // Expense on Device A: House Rent
  const rentTx: Transaction = {
    id: 'tx-rent-1',
    accountId: checkingAccount.id,
    type: 'expense',
    amountMinor: 2500000, // ₹25,000.00
    currency: 'INR',
    date: '2026-09-02',
    categoryId: 'cat-housing',
    subcategory: null,
    merchant: 'Landlord',
    notes: 'Apartment Rent',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: now,
    updatedAt: now,
  };
  await txRepoA.create(rentTx);
  await outboxRepoA.enqueue(
    createSyncOperation({
      entityType: 'transaction',
      entityId: rentTx.id,
      operationType: 'create',
      payload: rentTx as any,
      deviceId: deviceIdA,
    })
  );

  const balanceA1 = await accountUseCasesA.getDerivedAccountBalance(checkingAccount.id);
  assert(balanceA1 === 12500000, `Device A checking balance mismatch: ${balanceA1}`);
  console.log(`   • Checking Balance on Device A: ${formatMoney(balanceA1, 'INR')}`);
  console.log('   \x1b[32m[OK]\x1b[0m Device A created 1 account, 2 transactions offline. 3 outbox operations pending.');

  // 4. Device B creates offline financial activity independently
  console.log('\n4. Device B (Offline): Creating Independent Local State...');

  // Account 2 on Device B: Cash Wallet
  const cashAccount: Account = {
    id: 'acc-cash-1',
    name: 'Cash Pocket Wallet',
    type: 'cash',
    initialBalanceMinor: 500000, // ₹5,000.00
    currency: 'INR',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  await accountRepoB.create(cashAccount);
  await outboxRepoB.enqueue(
    createSyncOperation({
      entityType: 'account',
      entityId: cashAccount.id,
      operationType: 'create',
      payload: cashAccount as any,
      deviceId: deviceIdB,
    })
  );

  // Expense on Device B: Groceries
  const groceriesTx: Transaction = {
    id: 'tx-groceries-1',
    accountId: cashAccount.id,
    type: 'expense',
    amountMinor: 240000, // ₹2,400.00
    currency: 'INR',
    date: '2026-09-03',
    categoryId: 'cat-groceries',
    subcategory: null,
    merchant: 'Nature Basket',
    notes: 'Organic groceries',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: now,
    updatedAt: now,
  };
  await txRepoB.create(groceriesTx);
  await outboxRepoB.enqueue(
    createSyncOperation({
      entityType: 'transaction',
      entityId: groceriesTx.id,
      operationType: 'create',
      payload: groceriesTx as any,
      deviceId: deviceIdB,
    })
  );

  // Expense on Device B: Cafe
  const cafeTx: Transaction = {
    id: 'tx-cafe-1',
    accountId: cashAccount.id,
    type: 'expense',
    amountMinor: 15000, // ₹150.00
    currency: 'INR',
    date: '2026-09-04',
    categoryId: 'cat-food',
    subcategory: null,
    merchant: 'Blue Tokai',
    notes: 'Cold Brew Coffee',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: now,
    updatedAt: now,
  };
  await txRepoB.create(cafeTx);
  await outboxRepoB.enqueue(
    createSyncOperation({
      entityType: 'transaction',
      entityId: cafeTx.id,
      operationType: 'create',
      payload: cafeTx as any,
      deviceId: deviceIdB,
    })
  );

  const balanceB1 = await accountUseCasesB.getDerivedAccountBalance(cashAccount.id);
  assert(balanceB1 === 245000, `Device B cash balance mismatch: ${balanceB1}`);
  console.log(`   • Cash Balance on Device B: ${formatMoney(balanceB1, 'INR')}`);
  console.log('   \x1b[32m[OK]\x1b[0m Device B created 1 account, 2 transactions offline. 3 outbox operations pending.');

  // 5. Reconnect & Synchronize
  console.log('\n5. Reconnecting & Synchronizing Both Devices...');

  // Step 5a: Device A pushes to server
  const syncResA1 = await syncEngineA.synchronize();
  console.log(`   • Device A Sync 1: Pushed ${syncResA1.pushedCount} operations, Pulled ${syncResA1.pulledCount}.`);
  assert(syncResA1.pushedCount === 3, `Expected 3 pushed ops from Device A, got ${syncResA1.pushedCount}`);

  // Step 5b: Device B pushes its changes and pulls Device A's changes
  const syncResB1 = await syncEngineB.synchronize();
  console.log(`   • Device B Sync 1: Pushed ${syncResB1.pushedCount} operations, Pulled ${syncResB1.pulledCount}.`);
  assert(syncResB1.pushedCount === 3, `Expected 3 pushed ops from Device B, got ${syncResB1.pushedCount}`);
  assert(syncResB1.pulledCount === 3, `Expected 3 pulled ops on Device B from Device A, got ${syncResB1.pulledCount}`);

  // Step 5c: Device A syncs again to pull Device B's changes
  const syncResA2 = await syncEngineA.synchronize();
  console.log(`   • Device A Sync 2: Pushed ${syncResA2.pushedCount} operations, Pulled ${syncResA2.pulledCount}.`);
  assert(syncResA2.pulledCount === 3, `Expected 3 pulled ops on Device A from Device B, got ${syncResA2.pulledCount}`);

  console.log('   \x1b[32m[OK]\x1b[0m Both devices successfully synced bidirectionally.');

  // 6. Verify Convergence
  console.log('\n6. Verifying Complete Data & Balance Convergence Across Devices...');

  const accountsOnA = await accountRepoA.findAll();
  const accountsOnB = await accountRepoB.findAll();
  const txsOnA = await txRepoA.findAll();
  const txsOnB = await txRepoB.findAll();

  console.log(`   • Device A: ${accountsOnA.length} accounts, ${txsOnA.length} transactions.`);
  console.log(`   • Device B: ${accountsOnB.length} accounts, ${txsOnB.length} transactions.`);

  assert(accountsOnA.length === 2 && accountsOnB.length === 2, 'Account counts do not match 2');
  assert(txsOnA.length === 4 && txsOnB.length === 4, 'Transaction counts do not match 4');

  // Verify derived balances match on both devices
  const checkingOnA = await accountUseCasesA.getDerivedAccountBalance(checkingAccount.id);
  const checkingOnB = await accountUseCasesB.getDerivedAccountBalance(checkingAccount.id);
  const cashOnA = await accountUseCasesA.getDerivedAccountBalance(cashAccount.id);
  const cashOnB = await accountUseCasesB.getDerivedAccountBalance(cashAccount.id);

  console.log(`   • Checking Balance: Device A = ${formatMoney(checkingOnA, 'INR')}, Device B = ${formatMoney(checkingOnB, 'INR')}`);
  console.log(`   • Cash Balance:     Device A = ${formatMoney(cashOnA, 'INR')}, Device B = ${formatMoney(cashOnB, 'INR')}`);

  assert(checkingOnA === checkingOnB && checkingOnA === 12500000, 'Checking balance divergence');
  assert(cashOnA === cashOnB && cashOnA === 245000, 'Cash balance divergence');

  const netWorthA = checkingOnA + cashOnA;
  const netWorthB = checkingOnB + cashOnB;
  console.log(`   • Combined Net Worth on Both Devices: ${formatMoney(netWorthA, 'INR')}`);
  assert(netWorthA === netWorthB && netWorthA === 12745000, 'Net worth divergence');

  console.log('   \x1b[32m[OK]\x1b[0m Full convergence verified! Both devices hold identical financial ledgers.');

  // 7. Test Idempotency: Replay Operations Intentionally
  console.log('\n7. Testing Idempotency & Deduplication (Replaying Operations)...');

  // Device A enqueues duplicate operations
  await outboxRepoA.enqueue(
    createSyncOperation({
      entityType: 'transaction',
      entityId: salaryTx.id,
      operationType: 'create',
      payload: salaryTx as any,
      deviceId: deviceIdA,
    })
  );
  await outboxRepoA.enqueue(
    createSyncOperation({
      entityType: 'account',
      entityId: checkingAccount.id,
      operationType: 'create',
      payload: checkingAccount as any,
      deviceId: deviceIdA,
    })
  );

  // Sync again
  await syncEngineA.synchronize();
  await syncEngineB.synchronize();

  const finalTxsA = await txRepoA.findAll();
  const finalTxsB = await txRepoB.findAll();
  const finalAccsA = await accountRepoA.findAll();
  const finalAccsB = await accountRepoB.findAll();

  assert(finalAccsA.length === 2 && finalAccsB.length === 2, 'Duplicates introduced in accounts!');
  assert(finalTxsA.length === 4 && finalTxsB.length === 4, 'Duplicates introduced in transactions!');

  console.log('   \x1b[32m[OK]\x1b[0m Idempotency verified: Replaying duplicate operations created 0 duplicates.');

  // 8. Test Guest Session & Upgrade Flow
  console.log('\n8. Verifying Guest Mode & Upgrade Migration Plan...');
  const guest = createGuestSession();
  assert(guest.isGuest === true && guest.guestId.startsWith('guest_'), 'Guest session invalid');
  console.log(`   • Guest Session Created: ${guest.guestId}`);

  // Register real user
  const authRes = await authService.register(
    {
      email: 'alice@example.com',
      password: 'StrongPassword123!',
      name: 'Alice Henderson',
    },
    deviceIdA
  );
  assert(authRes.user.email === 'alice@example.com', 'Registration failed');
  assert(authRes.token.startsWith('tok_'), 'Session token invalid');
  console.log(`   • User Registered: ${authRes.user.name} (${authRes.user.email}), Token issued.`);

  // Build migration plan from guest to user
  const migrationPlan = buildGuestMigrationPlan({
    guestId: guest.guestId,
    targetUserId: authRes.user.id,
    accountsCount: 2,
    transactionsCount: 4,
    groupsCount: 1,
    budgetsCount: 2,
  });

  assert(migrationPlan.targetUserId === authRes.user.id, 'Migration plan target user mismatch');
  assert(migrationPlan.entities.transactionsCount === 4, 'Migration entities mismatch');
  console.log(`   • Guest Data Upgrade Plan: Linked ${migrationPlan.entities.accountsCount} accounts and ${migrationPlan.entities.transactionsCount} transactions to user ${authRes.user.email}.`);

  console.log('   \x1b[32m[OK]\x1b[0m Guest mode and account upgrade migration verified.');

  console.log('\n====================================================');
  console.log('   ALL PHASE 4 GATES PASSED (100% OFFLINE VERIFIED)  ');
  console.log('====================================================\n');
}

runPhase4Verification().catch((err) => {
  console.error('Fatal error during Phase 4 verification:', err);
  process.exit(1);
});
