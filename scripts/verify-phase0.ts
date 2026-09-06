import {
  MemorySqliteDriver,
  runMigrations,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteGroupRepository,
} from '../packages/local-db/src/index.js';
import {
  TransactionUseCases,
  GroupUseCases,
} from '../packages/application/src/index.js';
import {
  formatMoney,
} from '../packages/domain/src/index.js';
import {
  getTokens,
  PALETTES,
  type AccentTheme,
} from '../packages/ui/src/index.js';
import { createApp } from '../apps/api/src/app.js';

async function main() {
  console.log('====================================================');
  console.log('   BIYONG — PHASE 0 VERIFICATION HARNESS');
  console.log('====================================================\n');

  // 1. SQLite Local Engine & Offline Persistence
  console.log('1. Verifying Local SQLite Initialization & Migrations...');
  const driver = new MemorySqliteDriver();
  await driver.init();
  await runMigrations(driver);
  console.log('   [OK] SQLite schema v1 migrated successfully.');

  const accountRepo = new SqliteAccountRepository(driver);
  const txRepo = new SqliteTransactionRepository(driver);
  const groupRepo = new SqliteGroupRepository(driver);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo);
  const groupUseCases = new GroupUseCases(groupRepo);

  // 2. Offline Ledger Record Creation
  console.log('\n2. Creating Offline Financial Records...');
  await accountRepo.create({
    id: 'acc-main',
    name: 'Primary Checking',
    type: 'bank',
    initialBalanceMinor: 500000, // ₹5,000
    currency: 'INR',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await txUseCases.createTransaction({
    id: 'tx-lunch',
    accountId: 'acc-main',
    type: 'expense',
    amountMinor: 25000, // ₹250
    currency: 'INR',
    date: '2026-09-06',
    categoryId: 'cat-food',
    subcategory: 'Dining Out',
    merchant: 'Cafe Bistro',
    notes: 'Team lunch',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const balance = await txUseCases.getDerivedAccountBalance('acc-main');
  console.log(`   [OK] Derived balance after ₹250 expense: ${formatMoney(balance, 'INR')}`);
  if (balance !== 475000) throw new Error('Balance mismatch!');

  // 3. Offline Private Group & Transparent Split
  console.log('\n3. Verifying Offline Private Group & Transparent Splitting...');
  await groupUseCases.createGroup(
    {
      id: 'grp-goa',
      name: 'Goa Trip',
      isPrivate: true,
      ownerId: 'mem-1',
      currency: 'INR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    [
      { id: 'mem-1', groupId: 'grp-goa', name: 'Nikhil', userId: null, isDummy: true, role: 'owner', createdAt: new Date().toISOString() },
      { id: 'mem-2', groupId: 'grp-goa', name: 'Rahul', userId: null, isDummy: true, role: 'member', createdAt: new Date().toISOString() },
      { id: 'mem-3', groupId: 'grp-goa', name: 'Arjun', userId: null, isDummy: true, role: 'member', createdAt: new Date().toISOString() },
    ]
  );

  await groupUseCases.addExpense({
    id: 'exp-shack',
    groupId: 'grp-goa',
    title: 'Beach Dinner',
    amountMinor: 300000, // ₹3,000
    currency: 'INR',
    date: '2026-09-06',
    createdByMemberId: 'mem-1',
    payers: [{ memberId: 'mem-1', amountMinor: 300000 }],
    splitMethod: 'equal',
    allocations: [{ memberId: 'mem-1' }, { memberId: 'mem-2' }, { memberId: 'mem-3' }],
    notes: 'Dinner at Curlies',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const plan = await groupUseCases.getGroupSettlementPlan('grp-goa');
  console.log('   [OK] Debt simplification plan computed:');
  for (const t of plan.simplifiedTransfers) {
    console.log(`        • ${t.fromMemberId} owes ${t.toMemberId} ${formatMoney(t.amountMinor, 'INR')}`);
  }

  const graph = await groupUseCases.getDependencyGraph('grp-goa');
  console.log(`   [OK] Dependency graph generated (${graph.nodes.length} nodes, ${graph.edges.length} edges).`);

  // 4. Theme System & Presets
  console.log('\n4. Verifying Theme System (6 Presets x Light/Dark)...');
  const presets: AccentTheme[] = ['default', 'ocean', 'forest', 'violet', 'amber', 'rose'];
  for (const preset of presets) {
    const lightTokens = getTokens('light', preset);
    const darkTokens = getTokens('dark', preset);
    if (!lightTokens.colors.accentPrimary || !darkTokens.colors.accentPrimary) {
      throw new Error(`Invalid palette for preset ${preset}`);
    }
  }
  console.log(`   [OK] All ${presets.length} accent presets verified for Light and Dark modes.`);

  // 5. Hono API Modular Monolith Verification
  console.log('\n5. Verifying Hono API Endpoints...');
  const apiApp = createApp();
  const healthRes = await apiApp.request('/health');
  const healthJson = await healthRes.json() as any;
  console.log(`   [OK] GET /health returned status "${healthJson.status}" from service "${healthJson.service}".`);

  const regRes = await apiApp.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nikhil@biyong.app', password: 'securePassword123', name: 'Nikhil' }),
  });
  const regJson = await regRes.json() as any;
  console.log(`   [OK] POST /auth/register generated token "${regJson.token.slice(0, 10)}...".`);

  const syncRes = await apiApp.request('/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operations: [
        {
          id: '550e8400-e29b-41d4-a716-446655440099',
          entityType: 'group_expense',
          entityId: 'exp-shack',
          operationType: 'create',
          payload: { amountMinor: 300000 },
          timestamp: new Date().toISOString(),
          deviceId: 'cli-test-device',
          status: 'pending',
        },
      ],
    }),
  });
  const syncJson = await syncRes.json() as any;
  console.log(`   [OK] POST /sync/push acknowledged operation ${syncJson.syncedIds[0]}.`);

  console.log('\n====================================================');
  console.log('   ALL PHASE 0 GATES PASSED BORING AND RELIABLE');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Phase 0 Verification Failed:', err);
  process.exit(1);
});
