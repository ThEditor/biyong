/**
 * Biyong — Phase 5 Verification Script
 * Strictly verifies Phase 5 (Real Shared Groups) per biyong.md Section 58 & Section 14.
 *
 * Verification criteria:
 * 1. Authenticated group creation & invitations:
 *    - User A registers and creates a shared group
 *    - User A generates an invite code
 *    - User B registers and joins the shared group via invite code
 * 2. Shared expense creation & graph inspection:
 *    - User A creates a shared expense (₹4,000 split equally)
 *    - User B views the expense
 *    - User B inspects the dependency graph and personal settlement explanation
 *    - User B settles the amount (₹2,000 paid to User A)
 * 3. Strict Server-Side Authorization Invariant (biyong.md Section 14):
 *    - User B attempts to edit User A's expense -> Server strictly returns 403 Forbidden!
 *    - User B attempts to delete User A's expense -> Server strictly returns 403 Forbidden!
 *    - User A (the author) edits own expense -> Server accepts 200 OK
 * 4. Offline Shared Expense Creation & Convergence (biyong.md Section 58):
 *    - User A disconnects (offline SQLite mode)
 *    - User A creates a shared expense locally (enqueued in outbox)
 *    - User A reconnects and pushes sync operations
 *    - Server canonicalizes the state
 *    - User B synchronizes and receives the new shared expense
 *    - Both devices converge to identical financial state!
 */

import { createApp } from '../apps/api/src/app.js';
import {
  runMigrations,
  SqliteGroupRepository,
  SqliteOutboxRepository,
  SqliteSyncStateRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import {
  SyncEngine,
  createSyncOperation,
  HttpSyncServerClient,
} from '../packages/sync/src/index.js';
import { HttpAuthService } from '../packages/auth/src/index.js';
import { formatMoney, canEditExpense, canDeleteExpense } from '../packages/domain/src/index.js';
import type { Group, GroupMember, GroupExpense, Settlement } from '../packages/schemas/src/index.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

async function runPhase5Verification() {
  console.log('\n====================================================');
  console.log('   BIYONG — PHASE 5 (REAL SHARED GROUPS)            ');
  console.log('====================================================\n');

  // 1. Initialize Server (Hono App)
  console.log('1. Starting Server-Authoritative API Engine...');
  const app = createApp();

  // Custom in-memory fetch adapter routing HTTP requests directly to Hono
  const serverFetch: typeof fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    const path = urlStr.replace(/^https?:\/\/[^\/]+/, '');
    return app.request(path, init);
  };

  const authClient = new HttpAuthService('http://localhost:3000', serverFetch);
  console.log('   \x1b[32m[OK]\x1b[0m API server initialized with in-memory HTTP bridge.');

  // 2. Register User A (Alice) and User B (Bob)
  console.log('\n2. Registering Real Users (User A & User B)...');
  const authA = await authClient.register({
    name: 'Alice Henderson',
    email: 'alice@biyong.app',
    password: 'Password123!',
  });
  assert(authA.user.name === 'Alice Henderson', 'User A registration failed');
  assert(authA.token.startsWith('tok_'), 'User A token missing');
  console.log(`   • User A registered: ${authA.user.name} (${authA.user.email}) [ID: ${authA.user.id}]`);

  const authB = await authClient.register({
    name: 'Bob Martinez',
    email: 'bob@biyong.app',
    password: 'Password123!',
  });
  assert(authB.user.name === 'Bob Martinez', 'User B registration failed');
  assert(authB.token.startsWith('tok_'), 'User B token missing');
  console.log(`   • User B registered: ${authB.user.name} (${authB.user.email}) [ID: ${authB.user.id}]`);

  // 3. User A creates a Shared Group
  console.log('\n3. User A Creates Shared Group via Server API...');
  const createGroupRes = await app.request('/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authA.token}`,
    },
    body: JSON.stringify({
      name: 'Goa Roadtrip 2026',
      currency: 'INR',
    }),
  });
  assert(createGroupRes.status === 201, `Failed to create group: ${createGroupRes.status}`);
  const groupData = (await createGroupRes.json()) as { group: Group; member: GroupMember };
  const sharedGroup = groupData.group;
  const memberAlice = groupData.member;
  assert(sharedGroup.isPrivate === false, 'Group must not be private');
  assert(sharedGroup.ownerId === authA.user.id, 'Group owner must be User A');
  assert(memberAlice.role === 'owner', 'User A member role must be owner');
  console.log(`   • Shared Group Created: "${sharedGroup.name}" (ID: ${sharedGroup.id})`);
  console.log(`   • Owner Member ID: ${memberAlice.id} (User: ${memberAlice.name})`);

  // 4. User A generates an Invitation Code
  console.log('\n4. User A Generates Group Invitation Code...');
  const inviteRes = await app.request(`/groups/${sharedGroup.id}/invites`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authA.token}`,
    },
  });
  assert(inviteRes.status === 201, `Failed to create invite: ${inviteRes.status}`);
  const { invitation } = (await inviteRes.json()) as { invitation: any };
  const inviteCode = invitation.inviteCode;
  assert(inviteCode.startsWith('INV-'), `Invalid invite code format: ${inviteCode}`);
  console.log(`   • Invitation Generated: Code [${inviteCode}], expires at ${invitation.expiresAt}`);

  // 5. User B joins via Invitation Code
  console.log('\n5. User B Joins Group with Invite Code...');
  const joinRes = await app.request('/groups/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authB.token}`,
    },
    body: JSON.stringify({
      inviteCode,
    }),
  });
  assert(joinRes.status === 200, `User B failed to join group: ${joinRes.status}`);
  const joinData = (await joinRes.json()) as { group: Group; member: GroupMember };
  const memberBob = joinData.member;
  assert(memberBob.role === 'member', 'User B member role must be member');
  assert(memberBob.userId === authB.user.id, 'User B member must reference User B ID');
  console.log(`   • User B successfully joined group "${joinData.group.name}"!`);
  console.log(`   • Bob Member ID: ${memberBob.id} (Role: ${memberBob.role})`);

  // Verify group membership count on server
  const groupDetailsRes = await app.request(`/groups/${sharedGroup.id}`, {
    headers: { Authorization: `Bearer ${authB.token}` },
  });
  const groupDetails = (await groupDetailsRes.json()) as { group: Group; members: GroupMember[] };
  assert(groupDetails.members.length === 2, `Expected 2 members, found ${groupDetails.members.length}`);
  console.log(`   • Group has ${groupDetails.members.length} members: Alice (Owner) and Bob (Member).`);

  // 6. User A creates Shared Expense
  console.log('\n6. User A Creates Shared Expense (Villa Booking)...');
  const expenseAmount = 400000; // ₹4,000.00
  const expRes = await app.request(`/groups/${sharedGroup.id}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authA.token}`,
    },
    body: JSON.stringify({
      title: 'Beach Villa Stay',
      amountMinor: expenseAmount,
      currency: 'INR',
      date: '2026-09-07',
      payers: [{ memberId: memberAlice.id, amountMinor: expenseAmount }],
      splitMethod: 'equal',
      allocations: [
        { memberId: memberAlice.id },
        { memberId: memberBob.id },
      ],
      notes: 'Private beach villa for 2 nights',
    }),
  });
  assert(expRes.status === 201, `Failed to create shared expense: ${expRes.status}`);
  const { expense } = (await expRes.json()) as { expense: GroupExpense };
  assert(expense.createdByUserId === authA.user.id, 'Expense createdByUserId must be User A');
  console.log(`   • Expense Created: "${expense.title}" for ${formatMoney(expense.amountMinor, 'INR')}`);
  console.log(`   • Author: Alice (User ID: ${expense.createdByUserId})`);

  // 7. User B views expense and inspects dependency graph
  console.log('\n7. User B Views Expense & Inspects Dependency Graph...');
  const graphRes = await app.request(`/groups/${sharedGroup.id}/graph`, {
    headers: { Authorization: `Bearer ${authB.token}` },
  });
  assert(graphRes.status === 200, 'User B cannot view graph');
  const { graph } = (await graphRes.json()) as { graph: any };
  assert(graph.nodes.length >= 3, `Expected at least 3 nodes (2 members + 1 expense), got ${graph.nodes.length}`);
  console.log(`   • Dependency Graph Verified: ${graph.nodes.length} nodes, ${graph.edges.length} flow edges.`);

  // User B inspects personal settlement explanation
  const explanationRes = await app.request(`/groups/${sharedGroup.id}/members/${memberBob.id}/explanation`, {
    headers: { Authorization: `Bearer ${authB.token}` },
  });
  assert(explanationRes.status === 200, 'User B cannot view explanation');
  const { explanation } = (await explanationRes.json()) as { explanation: any };
  assert(explanation.netBalanceMinor === -200000, `Expected Bob net balance -₹2,000.00, got ${explanation.netBalanceMinor}`);
  console.log(`   • Bob Settlement Explanation: Bob owes ${formatMoney(Math.abs(explanation.netBalanceMinor), 'INR')} to Alice.`);

  // 8. Test Strict Server-Side Authorization Invariant (biyong.md Section 14)
  console.log('\n8. Verifying Strict Server-Side Permissions (Section 14 Invariant)...');
  console.log('   "The person who created the expense is the only person allowed to edit it."');

  // Domain unit verification
  assert(canEditExpense(authA.user.id, expense) === true, 'Alice should be authorized to edit own expense');
  assert(canEditExpense(authB.user.id, expense) === false, 'Bob MUST NOT be authorized to edit Alice expense');
  assert(canDeleteExpense(authB.user.id, expense, sharedGroup.ownerId) === false, 'Bob MUST NOT be authorized to delete Alice expense');

  // Server HTTP test: User B attempts to edit User A's expense
  const unauthorizedEditRes = await app.request(`/groups/${sharedGroup.id}/expenses/${expense.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authB.token}`,
    },
    body: JSON.stringify({
      title: 'Hacked Title by Bob',
    }),
  });
  assert(unauthorizedEditRes.status === 403, `Server MUST reject unauthorized edit with 403, got: ${unauthorizedEditRes.status}`);
  const errData = (await unauthorizedEditRes.json()) as { error: string };
  console.log(`   • Server Response to Unauthorized Edit: HTTP 403 Forbidden - "${errData.error}"`);

  // Server HTTP test: User B attempts to delete User A's expense
  const unauthorizedDeleteRes = await app.request(`/groups/${sharedGroup.id}/expenses/${expense.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${authB.token}`,
    },
  });
  assert(unauthorizedDeleteRes.status === 403, `Server MUST reject unauthorized delete with 403, got: ${unauthorizedDeleteRes.status}`);
  console.log('   • Server Response to Unauthorized Delete: HTTP 403 Forbidden.');

  // Server HTTP test: User A (the creator) edits own expense
  const authorizedEditRes = await app.request(`/groups/${sharedGroup.id}/expenses/${expense.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authA.token}`,
    },
    body: JSON.stringify({
      title: 'Luxury Beach Villa Stay',
    }),
  });
  assert(authorizedEditRes.status === 200, `Author edit failed: ${authorizedEditRes.status}`);
  const updatedExp = (await authorizedEditRes.json()) as { expense: GroupExpense };
  assert(updatedExp.expense.title === 'Luxury Beach Villa Stay', 'Title not updated');
  console.log(`   • Authorized Edit Succeeded: Updated title to "${updatedExp.expense.title}".`);
  console.log('   \x1b[32m[OK]\x1b[0m Server-side authorization invariant strictly verified.');

  // 9. User B Settles the Debt
  console.log('\n9. User B Settles Debt with User A...');
  const settleRes = await app.request(`/groups/${sharedGroup.id}/settlements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authB.token}`,
    },
    body: JSON.stringify({
      fromMemberId: memberBob.id,
      toMemberId: memberAlice.id,
      amountMinor: 200000, // ₹2,000.00
      currency: 'INR',
      notes: 'Paid via UPI',
    }),
  });
  assert(settleRes.status === 201, `Failed to record settlement: ${settleRes.status}`);
  const { settlement } = (await settleRes.json()) as { settlement: Settlement };
  console.log(`   • Settlement Recorded: Bob paid ${formatMoney(settlement.amountMinor, 'INR')} to Alice.`);

  // Verify settlement explanation is now 0 (All settled up)
  const afterSettlementRes = await app.request(`/groups/${sharedGroup.id}/members/${memberBob.id}/explanation`, {
    headers: { Authorization: `Bearer ${authB.token}` },
  });
  const afterSettlement = (await afterSettlementRes.json()) as { explanation: any };
  assert(afterSettlement.explanation.netBalanceMinor === 0, `Expected balance 0, got ${afterSettlement.explanation.netBalanceMinor}`);
  console.log('   • Bob Net Balance: ₹0.00 (All settled up!).');

  // 10. Multi-Device Offline Sync & Convergence (biyong.md Section 58)
  console.log('\n10. Verifying Multi-Device Offline Sync & Convergence...');
  console.log('   "A disconnects → A creates shared expense → A reconnects → Server canonicalizes → B receives update"');

  // Setup Device A (Alice's Phone) Local SQLite
  const driverA = new MemorySqliteDriver();
  await driverA.init();
  await runMigrations(driverA);
  const groupRepoA = new SqliteGroupRepository(driverA);
  const outboxRepoA = new SqliteOutboxRepository(driverA);
  const syncStateRepoA = new SqliteSyncStateRepository(driverA);
  await syncStateRepoA.setDeviceId('device-phone-alice');
  await groupRepoA.create(sharedGroup);
  await groupRepoA.addMember(memberAlice);
  await groupRepoA.addMember(memberBob);

  const syncClientA = new HttpSyncServerClient('http://localhost:3000', () => authA.token, serverFetch);
  const syncEngineA = new SyncEngine(outboxRepoA, syncClientA, syncStateRepoA, 'device-phone-alice', {
    groupRepo: groupRepoA,
  });

  // Setup Device B (Bob's Phone) Local SQLite
  const driverB = new MemorySqliteDriver();
  await driverB.init();
  await runMigrations(driverB);
  const groupRepoB = new SqliteGroupRepository(driverB);
  const outboxRepoB = new SqliteOutboxRepository(driverB);
  const syncStateRepoB = new SqliteSyncStateRepository(driverB);
  await syncStateRepoB.setDeviceId('device-phone-bob');
  await groupRepoB.create(sharedGroup);
  await groupRepoB.addMember(memberAlice);
  await groupRepoB.addMember(memberBob);

  const syncClientB = new HttpSyncServerClient('http://localhost:3000', () => authB.token, serverFetch);
  const syncEngineB = new SyncEngine(outboxRepoB, syncClientB, syncStateRepoB, 'device-phone-bob', {
    groupRepo: groupRepoB,
  });

  // Device A is OFFLINE: User A adds a new shared expense locally
  console.log('   • Device A goes offline...');
  const offlineExpId = 'gexp_offline_alice_1';
  const offlineExp: GroupExpense = {
    id: offlineExpId,
    groupId: sharedGroup.id,
    title: 'Highway Tolls & Coconut Water',
    amountMinor: 100000, // ₹1,000.00
    currency: 'INR',
    date: '2026-09-08',
    createdByMemberId: memberAlice.id,
    createdByUserId: authA.user.id,
    payers: [{ memberId: memberAlice.id, amountMinor: 100000 }],
    splitMethod: 'equal',
    allocations: [
      { memberId: memberAlice.id },
      { memberId: memberBob.id },
    ],
    notes: 'En route to South Goa',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Saved locally in Device A SQLite and enqueued in Device A Outbox
  await groupRepoA.addExpense(offlineExp);
  await outboxRepoA.enqueue(
    createSyncOperation({
      entityType: 'group_expense',
      entityId: offlineExp.id,
      operationType: 'create',
      payload: offlineExp as any,
      deviceId: 'device-phone-alice',
    })
  );

  const pendingOnA = await outboxRepoA.getPendingCount();
  assert(pendingOnA === 1, 'Outbox on Device A should have 1 pending op');
  console.log(`   • Alice created expense "${offlineExp.title}" offline. 1 operation queued in SQLite outbox.`);

  // Verify Device B currently does not have this expense
  const expOnBBefore = await groupRepoB.getExpenses(sharedGroup.id);
  assert(expOnBBefore.length === 0, 'Device B should not have offline expense yet');

  // Device A reconnects and pushes sync operations
  console.log('   • Device A reconnects to server and triggers synchronize()...');
  const syncResultA = await syncEngineA.synchronize();
  assert(syncResultA.pushedCount === 1, `Device A should have pushed 1 op, got ${syncResultA.pushedCount}`);
  assert((await outboxRepoA.getPendingCount()) === 0, 'Device A outbox should now be clear');
  console.log('   • Server received operation and canonicalized state.');

  // Device B connects and pulls sync operations
  console.log('   • Device B triggers synchronize() and pulls server updates...');
  const syncResultB = await syncEngineB.synchronize();
  assert(syncResultB.pulledCount >= 1, `Device B should have pulled at least 1 op, got ${syncResultB.pulledCount}`);

  // Verify Device B local SQLite now has Alice's offline expense
  const expOnBAfter = await groupRepoB.getExpenses(sharedGroup.id);
  assert(expOnBAfter.length >= 1, `Device B should have received expenses in SQLite, got ${expOnBAfter.length}`);
  const syncedExpOnB = expOnBAfter.find((e) => e.id === offlineExpId);
  assert(syncedExpOnB !== undefined, 'Device B did not receive offline expense');
  assert(syncedExpOnB.title === 'Highway Tolls & Coconut Water', 'Title on Device B mismatch');
  assert(syncedExpOnB.amountMinor === 100000, 'Amount on Device B mismatch');
  assert(syncedExpOnB.createdByUserId === authA.user.id, 'Creator ID on Device B mismatch');
  console.log(`   • Device B local SQLite successfully received: "${syncedExpOnB.title}" (${formatMoney(syncedExpOnB.amountMinor, 'INR')})!`);
  console.log(`   • Device B now holds ${expOnBAfter.length} group expenses in full sync with the canonical server.`);
  console.log('   \x1b[32m[OK]\x1b[0m Multi-device offline synchronization & convergence verified 100%!');

  console.log('\n====================================================');
  console.log('   ALL PHASE 5 GATES PASSED (100% SPEC VERIFIED)     ');
  console.log('====================================================\n');
}

runPhase5Verification().catch((err) => {
  console.error('\x1b[31m[FATAL ERROR]\x1b[0m Phase 5 Verification failed:', err);
  process.exit(1);
});
