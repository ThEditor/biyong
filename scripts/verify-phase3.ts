/**
 * Biyong — Phase 3 Verification Script
 * Strictly verifies Phase 3 (Private Groups, Splits & Settlements) 100% offline.
 *
 * Verification criteria from biyong.md:
 * - Create "Goa Trip" group
 * - 4 participants (Alice, Bob, Charlie, Diana)
 * - 20+ expenses with multiple payers and mixed split types:
 *   - Equal splits
 *   - Exact splits
 *   - Percentage splits
 *   - Shares splits
 *   - Itemized splits
 * - Inspect every balance
 * - Open graph explanation & dependency graph
 * - Settle balances using deterministic debt simplification
 * - Verify all member balances reach EXACTLY zero minor units
 */

import {
  runMigrations,
  SqliteGroupRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import { GroupUseCases } from '../packages/application/src/index.js';
import { formatMoney } from '../packages/domain/src/index.js';
import type { Group, GroupMember, GroupExpense, Settlement } from '../packages/schemas/src/index.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

async function runPhase3Verification() {
  console.log('\n====================================================');
  console.log('   BIYONG — PHASE 3 (GROUPS & SPLITS) VERIFIER     ');
  console.log('====================================================\n');

  // 1. Initialize SQLite offline memory driver & repositories
  console.log('1. Initializing 100% Offline Database & Repositories...');
  const driver = new MemorySqliteDriver();
  await driver.init();
  await runMigrations(driver);

  const groupRepo = new SqliteGroupRepository(driver);
  const groupUseCases = new GroupUseCases(groupRepo);
  console.log('   \x1b[32m[OK]\x1b[0m Database and GroupUseCases ready.');

  // 2. Create "Goa Trip" group with 4 participants
  console.log('\n2. Creating "Goa Trip" Private Group & Members...');
  const now = new Date().toISOString();
  const groupId = 'group-goa-trip';

  const goaTrip: Group = {
    id: groupId,
    name: 'Goa Trip',
    isPrivate: true,
    ownerId: 'member-alice',
    currency: 'INR',
    createdAt: now,
    updatedAt: now,
  };

  const members: GroupMember[] = [
    { id: 'member-alice', groupId, name: 'Alice', userId: null, isDummy: true, role: 'owner', createdAt: now },
    { id: 'member-bob', groupId, name: 'Bob', userId: null, isDummy: true, role: 'member', createdAt: now },
    { id: 'member-charlie', groupId, name: 'Charlie', userId: null, isDummy: true, role: 'member', createdAt: now },
    { id: 'member-diana', groupId, name: 'Diana', userId: null, isDummy: true, role: 'member', createdAt: now },
  ];

  await groupUseCases.createGroup(goaTrip, members);
  const savedGroup = await groupUseCases.getGroup(groupId);
  assert(savedGroup !== null && savedGroup.name === 'Goa Trip', 'Group creation failed');
  const savedMembers = await groupUseCases.getMembers(groupId);
  assert(savedMembers.length === 4, `Expected 4 members, got ${savedMembers.length}`);
  console.log('   \x1b[32m[OK]\x1b[0m Group "Goa Trip" created with 4 participants: Alice, Bob, Charlie, Diana.');

  // 3. Add 22 Expenses with mixed split types and multiple payers
  console.log('\n3. Recording 22 Expenses with Mixed Split Types & Multiple Payers...');

  const expensesData: Omit<GroupExpense, 'id' | 'groupId' | 'currency' | 'createdAt' | 'updatedAt'>[] = [
    // 1. Equal Split — Villa Booking (Paid by Alice: ₹40,000)
    {
      title: 'Luxury Villa 3-Night Stay',
      amountMinor: 4000000,
      date: '2026-09-01',
      createdByMemberId: 'member-alice',
      payers: [{ memberId: 'member-alice', amountMinor: 4000000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: 'Anjuna private pool villa',
    },
    // 2. Equal Split — Airport Taxi (Paid by Bob: ₹2,400)
    {
      title: 'Dabolim Airport Innova Taxi',
      amountMinor: 240000,
      date: '2026-09-01',
      createdByMemberId: 'member-bob',
      payers: [{ memberId: 'member-bob', amountMinor: 240000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: null,
    },
    // 3. Exact Split — Water Sports Activity (Paid by Charlie: ₹12,500)
    {
      title: 'Calangute Water Sports Package',
      amountMinor: 1250000,
      date: '2026-09-01',
      createdByMemberId: 'member-charlie',
      payers: [{ memberId: 'member-charlie', amountMinor: 1250000 }],
      splitMethod: 'exact',
      allocations: [
        { memberId: 'member-alice', amountMinor: 350000 },   // Parasailing + Jet Ski
        { memberId: 'member-bob', amountMinor: 250000 },     // Jet Ski
        { memberId: 'member-charlie', amountMinor: 400000 }, // Parasailing + Banana ride
        { memberId: 'member-diana', amountMinor: 250000 },   // Bumper ride
      ],
      notes: 'Custom activities per person',
    },
    // 4. Percentage Split — Self-drive Car & Scooters (Paid by Diana: ₹16,000)
    // Alice & Bob drove the SUV (35% each), Charlie & Diana used scooters (15% each)
    {
      title: 'Vehicle Rentals 3 Days',
      amountMinor: 1600000,
      date: '2026-09-01',
      createdByMemberId: 'member-diana',
      payers: [{ memberId: 'member-diana', amountMinor: 1600000 }],
      splitMethod: 'percentage',
      allocations: [
        { memberId: 'member-alice', percentage: 35 },
        { memberId: 'member-bob', percentage: 35 },
        { memberId: 'member-charlie', percentage: 15 },
        { memberId: 'member-diana', percentage: 15 },
      ],
      notes: '1 Thar + 2 Activas',
    },
    // 5. Shares Split — Beach Sunset Cocktails (Paid by Alice: ₹8,000)
    // Alice 3 drinks, Bob 2 drinks, Charlie 2 drinks, Diana 1 drink = 8 shares
    {
      title: 'Curlies Sunset Drinks',
      amountMinor: 800000,
      date: '2026-09-01',
      createdByMemberId: 'member-alice',
      payers: [{ memberId: 'member-alice', amountMinor: 800000 }],
      splitMethod: 'shares',
      allocations: [
        { memberId: 'member-alice', shares: 3 },
        { memberId: 'member-bob', shares: 2 },
        { memberId: 'member-charlie', shares: 2 },
        { memberId: 'member-diana', shares: 1 },
      ],
      notes: '3:2:2:1 shares split',
    },
    // 6. Itemized Split — Thalassa Greek Dinner (Paid by Bob: ₹14,200)
    {
      title: 'Thalassa Siolim Dinner',
      amountMinor: 1420000,
      date: '2026-09-01',
      createdByMemberId: 'member-bob',
      payers: [{ memberId: 'member-bob', amountMinor: 1420000 }],
      splitMethod: 'itemized',
      allocations: [
        {
          memberId: 'member-alice',
          items: [
            { description: 'Lamb Souvlaki', amountMinor: 240000 },
            { description: 'White Wine', amountMinor: 120000 },
          ],
        },
        {
          memberId: 'member-bob',
          items: [
            { description: 'Ribeye Steak', amountMinor: 320000 },
            { description: 'Craft Beer', amountMinor: 80000 },
          ],
        },
        {
          memberId: 'member-charlie',
          items: [
            { description: 'Prawn Saganaki', amountMinor: 280000 },
            { description: 'Cocktail', amountMinor: 100000 },
          ],
        },
        {
          memberId: 'member-diana',
          items: [
            { description: 'Greek Salad', amountMinor: 180000 },
            { description: 'Baklava', amountMinor: 100000 },
          ],
        },
      ],
      notes: 'Exact dish itemization',
    },
    // 7. Multiple Payers — Yacht Sunset Cruise (Paid by Alice: ₹15,000, Charlie: ₹9,000 -> Total ₹24,000)
    {
      title: 'Mandovi River Yacht Charter',
      amountMinor: 2400000,
      date: '2026-09-02',
      createdByMemberId: 'member-alice',
      payers: [
        { memberId: 'member-alice', amountMinor: 1500000 },
        { memberId: 'member-charlie', amountMinor: 900000 },
      ],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: 'Co-paid 2-hour cruise',
    },
    // 8. Equal Split — Villa Grocery Haul (Paid by Charlie: ₹6,800)
    {
      title: 'Villa Kitchen Groceries',
      amountMinor: 680000,
      date: '2026-09-02',
      createdByMemberId: 'member-charlie',
      payers: [{ memberId: 'member-charlie', amountMinor: 680000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: 'Eggs, breads, fruits, beverages',
    },
    // 9. Equal Split — Fort Aguada Guided Tour (Paid by Diana: ₹2,000)
    {
      title: 'Fort Aguada Entry & Guide',
      amountMinor: 200000,
      date: '2026-09-02',
      createdByMemberId: 'member-diana',
      payers: [{ memberId: 'member-diana', amountMinor: 200000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: null,
    },
    // 10. Shares Split — Artjuna Cafe Brunch (Paid by Alice: ₹4,500)
    {
      title: 'Artjuna Garden Cafe Brunch',
      amountMinor: 450000,
      date: '2026-09-02',
      createdByMemberId: 'member-alice',
      payers: [{ memberId: 'member-alice', amountMinor: 450000 }],
      splitMethod: 'shares',
      allocations: [
        { memberId: 'member-alice', shares: 1 },
        { memberId: 'member-bob', shares: 1 },
        { memberId: 'member-charlie', shares: 1 },
        { memberId: 'member-diana', shares: 1 },
      ],
      notes: null,
    },
    // 11. Exact Split — Scuba Diving at Grande Island (Paid by Bob: ₹18,000)
    {
      title: 'Grande Island Scuba Diving',
      amountMinor: 1800000,
      date: '2026-09-02',
      createdByMemberId: 'member-bob',
      payers: [{ memberId: 'member-bob', amountMinor: 1800000 }],
      splitMethod: 'exact',
      allocations: [
        { memberId: 'member-alice', amountMinor: 500000 },
        { memberId: 'member-bob', amountMinor: 500000 },
        { memberId: 'member-charlie', amountMinor: 450000 },
        { memberId: 'member-diana', amountMinor: 350000 },
      ],
      notes: 'Different video gear packages',
    },
    // 12. Equal Split — Beach Bed & Umbrella Rental (Paid by Charlie: ₹1,600)
    {
      title: 'Morjim Beach Beds & Umbrella',
      amountMinor: 160000,
      date: '2026-09-02',
      createdByMemberId: 'member-charlie',
      payers: [{ memberId: 'member-charlie', amountMinor: 160000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: null,
    },
    // 13. Multiple Payers — Club Cubana VIP Night (Paid by Bob: ₹10,000, Diana: ₹6,000 -> Total ₹16,000)
    {
      title: 'Club Cubana VIP Entry & Table',
      amountMinor: 1600000,
      date: '2026-09-02',
      createdByMemberId: 'member-bob',
      payers: [
        { memberId: 'member-bob', amountMinor: 1000000 },
        { memberId: 'member-diana', amountMinor: 600000 },
      ],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: 'Nightclub entry',
    },
    // 14. Percentage Split — Fuel Refill for SUV & Bikes (Paid by Alice: ₹5,000)
    {
      title: 'Indian Oil Petrol Refills',
      amountMinor: 500000,
      date: '2026-09-03',
      createdByMemberId: 'member-alice',
      payers: [{ memberId: 'member-alice', amountMinor: 500000 }],
      splitMethod: 'percentage',
      allocations: [
        { memberId: 'member-alice', percentage: 35 },
        { memberId: 'member-bob', percentage: 35 },
        { memberId: 'member-charlie', percentage: 15 },
        { memberId: 'member-diana', percentage: 15 },
      ],
      notes: null,
    },
    // 15. Equal Split — French Bakery Breakfast (Paid by Diana: ₹2,800)
    {
      title: 'Baba Au Rhum Breakfast',
      amountMinor: 280000,
      date: '2026-09-03',
      createdByMemberId: 'member-diana',
      payers: [{ memberId: 'member-diana', amountMinor: 280000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: 'Croissants and coffees',
    },
    // 16. Shares Split — Spice Plantation Tour & Lunch (Paid by Charlie: ₹7,200)
    {
      title: 'Sahakari Spice Farm Tour & Buffet',
      amountMinor: 720000,
      date: '2026-09-03',
      createdByMemberId: 'member-charlie',
      payers: [{ memberId: 'member-charlie', amountMinor: 720000 }],
      splitMethod: 'shares',
      allocations: [
        { memberId: 'member-alice', shares: 1 },
        { memberId: 'member-bob', shares: 1 },
        { memberId: 'member-charlie', shares: 1 },
        { memberId: 'member-diana', shares: 1 },
      ],
      notes: null,
    },
    // 17. Equal Split — Souvenirs & Cashew Nuts (Paid by Alice: ₹4,800)
    {
      title: 'Zantye Organic Cashews & Feni',
      amountMinor: 480000,
      date: '2026-09-03',
      createdByMemberId: 'member-alice',
      payers: [{ memberId: 'member-alice', amountMinor: 480000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: 'Group gift stash',
    },
    // 18. Exact Split — Beach Spa & Massage (Paid by Diana: ₹11,000)
    {
      title: 'Ayurvedic Wellness Spa',
      amountMinor: 1100000,
      date: '2026-09-03',
      createdByMemberId: 'member-diana',
      payers: [{ memberId: 'member-diana', amountMinor: 1100000 }],
      splitMethod: 'exact',
      allocations: [
        { memberId: 'member-alice', amountMinor: 300000 },
        { memberId: 'member-bob', amountMinor: 250000 },
        { memberId: 'member-charlie', amountMinor: 250000 },
        { memberId: 'member-diana', amountMinor: 300000 },
      ],
      notes: null,
    },
    // 19. Equal Split — Sunset Kayaking in Backwaters (Paid by Bob: ₹3,600)
    {
      title: 'Chapora River Kayaking Guide',
      amountMinor: 360000,
      date: '2026-09-03',
      createdByMemberId: 'member-bob',
      payers: [{ memberId: 'member-bob', amountMinor: 360000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: null,
    },
    // 20. Itemized Split — Fisherman's Wharf Farewell Feast (Paid by Alice: ₹13,500)
    {
      title: 'Fishermans Wharf Seafood Dinner',
      amountMinor: 1350000,
      date: '2026-09-03',
      createdByMemberId: 'member-alice',
      payers: [{ memberId: 'member-alice', amountMinor: 1350000 }],
      splitMethod: 'itemized',
      allocations: [
        {
          memberId: 'member-alice',
          items: [{ description: 'Butter Garlic Crab', amountMinor: 450000 }],
        },
        {
          memberId: 'member-bob',
          items: [{ description: 'Kingfish Rawa Fry & Rice', amountMinor: 320000 }],
        },
        {
          memberId: 'member-charlie',
          items: [{ description: 'Prawn Balchao & Naan', amountMinor: 330000 }],
        },
        {
          memberId: 'member-diana',
          items: [{ description: 'Goan Fish Curry Thali', amountMinor: 250000 }],
        },
      ],
      notes: 'Final grand dinner',
    },
    // 21. Equal Split — Villa Final Cleaning Tip (Paid by Charlie: ₹1,000)
    {
      title: 'Villa Caretaker & Housekeeping Tip',
      amountMinor: 100000,
      date: '2026-09-04',
      createdByMemberId: 'member-charlie',
      payers: [{ memberId: 'member-charlie', amountMinor: 100000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: null,
    },
    // 22. Equal Split — Return Airport Cabs (Paid by Diana: ₹2,400)
    {
      title: 'Airport Drop Off Cabs',
      amountMinor: 240000,
      date: '2026-09-04',
      createdByMemberId: 'member-diana',
      payers: [{ memberId: 'member-diana', amountMinor: 240000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: 'member-alice' },
        { memberId: 'member-bob' },
        { memberId: 'member-charlie' },
        { memberId: 'member-diana' },
      ],
      notes: null,
    },
  ];

  let expIndex = 1;
  let totalTripMinor = 0;
  for (const exp of expensesData) {
    totalTripMinor += exp.amountMinor;
    await groupUseCases.addExpense({
      ...exp,
      id: `expense-goa-${expIndex++}`,
      groupId,
      currency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
  }

  const savedExpenses = await groupUseCases.getExpenses(groupId);
  assert(savedExpenses.length === 22, `Expected 22 expenses, got ${savedExpenses.length}`);
  console.log(`   \x1b[32m[OK]\x1b[0m 22 expenses recorded successfully. Total trip spend: ${formatMoney(totalTripMinor, 'INR')}`);

  // 4. Inspect every member's balance
  console.log('\n4. Inspecting Every Member Balance...');
  const plan = await groupUseCases.getGroupSettlementPlan(groupId);
  let netSum = 0;

  for (const m of members) {
    const net = plan.balances.get(m.id) ?? 0;
    netSum += net;
    const sign = net > 0 ? '+' : '';
    const status = net > 0 ? 'GETS BACK' : net < 0 ? 'OWES' : 'SETTLED';
    console.log(`   • ${m.name.padEnd(8)}: ${sign}${formatMoney(net, 'INR').padStart(12)} (${status})`);
  }

  assert(netSum === 0, `Zero-sum invariant violated! Sum of balances: ${netSum}`);
  console.log('   \x1b[32m[OK]\x1b[0m Financial Invariant Verified: Total net sum = 0 paise (exact zero-sum conservation).');

  // 5. Open and verify graph explanation
  console.log('\n5. Verifying Transparent Settlement Explanations & Dependency Graph...');
  for (const m of members) {
    const explanation = await groupUseCases.explainSettlement(groupId, m.id);
    assert(explanation.origins.length > 0, `Explanation missing origins for ${m.name}`);
    assert(explanation.netBalanceMinor === plan.balances.get(m.id), `Net balance mismatch in explanation for ${m.name}`);
  }
  console.log('   \x1b[32m[OK]\x1b[0m All 4 members have fully transparent mathematical explanations.');

  const graph = await groupUseCases.getDependencyGraph(groupId);
  assert(graph.nodes.length === 26, `Expected 26 graph nodes (4 members + 22 expenses), got ${graph.nodes.length}`);
  assert(graph.edges.length > 50, `Expected over 50 edges (payers + splits), got ${graph.edges.length}`);
  console.log(`   \x1b[32m[OK]\x1b[0m Dependency Graph successfully computed: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);

  // 6. Inspect Simplified Debt Settlements
  console.log('\n6. Computing Deterministic Debt Simplification (Min-Cash-Flow)...');
  console.log(`   Found ${plan.simplifiedTransfers.length} simplified transfer(s) to settle entire trip:`);
  for (const transfer of plan.simplifiedTransfers) {
    const fromName = members.find((m) => m.id === transfer.fromMemberId)?.name ?? transfer.fromMemberId;
    const toName = members.find((m) => m.id === transfer.toMemberId)?.name ?? transfer.toMemberId;
    console.log(`   • ${fromName} pays ${toName}: ${formatMoney(transfer.amountMinor, 'INR')}`);
  }

  // 7. Settle all balances
  console.log('\n7. Executing Settlement Transactions...');
  let settleIdx = 1;
  for (const transfer of plan.simplifiedTransfers) {
    const settlement: Settlement = {
      id: `settle-goa-${settleIdx++}`,
      groupId,
      fromMemberId: transfer.fromMemberId,
      toMemberId: transfer.toMemberId,
      amountMinor: transfer.amountMinor,
      currency: 'INR',
      settledAt: new Date().toISOString(),
      notes: 'Automated settlement from simplified plan',
    };
    await groupUseCases.addSettlement(settlement);
  }

  const savedSettlements = await groupUseCases.getSettlements(groupId);
  assert(savedSettlements.length === plan.simplifiedTransfers.length, 'Settlement recording count mismatch');
  console.log(`   \x1b[32m[OK]\x1b[0m ${savedSettlements.length} settlement transaction(s) recorded in local database.`);

  // 8. Verify all balances reach EXACTLY ZERO
  console.log('\n8. Verifying Final Post-Settlement Balances...');
  const postPlan = await groupUseCases.getGroupSettlementPlan(groupId);
  for (const m of members) {
    const finalNet = postPlan.balances.get(m.id) ?? 0;
    console.log(`   • ${m.name.padEnd(8)} balance: ${formatMoney(finalNet, 'INR')} [SETTLED]`);
    assert(finalNet === 0, `Member ${m.name} balance is not zero: ${finalNet}`);
  }

  assert(postPlan.simplifiedTransfers.length === 0, 'Transfers still remaining after settlement!');
  console.log('   \x1b[32m[OK]\x1b[0m All member balances are EXACTLY ₹0.00 minor units. Group fully settled!');

  console.log('\n====================================================');
  console.log('   ALL PHASE 3 GATES PASSED (100% OFFLINE VERIFIED)  ');
  console.log('====================================================\n');
}

runPhase3Verification().catch((err) => {
  console.error('Fatal error during Phase 3 verification:', err);
  process.exit(1);
});
