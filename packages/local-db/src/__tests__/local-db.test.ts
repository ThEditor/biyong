import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemorySqliteDriver,
  runMigrations,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteGroupRepository,
  SqliteOutboxRepository,
} from '../index.js';
import type { Account, Transaction, Group, GroupMember, GroupExpense } from '@biyong/schemas';

describe('Local DB: SQLite Schema & Repositories', () => {
  let driver: MemorySqliteDriver;
  let accountRepo: SqliteAccountRepository;
  let txRepo: SqliteTransactionRepository;
  let groupRepo: SqliteGroupRepository;
  let outboxRepo: SqliteOutboxRepository;

  beforeEach(async () => {
    driver = new MemorySqliteDriver();
    await driver.init();
    await runMigrations(driver);

    accountRepo = new SqliteAccountRepository(driver);
    txRepo = new SqliteTransactionRepository(driver);
    groupRepo = new SqliteGroupRepository(driver);
    outboxRepo = new SqliteOutboxRepository(driver);
  });

  it('runs migrations and seeds builtin categories', async () => {
    const cats = await driver.query<{ id: string; name: string }>('SELECT * FROM categories');
    expect(cats.length).toBeGreaterThanOrEqual(10);
    expect(cats.some((c) => c.name === 'Food & Dining')).toBe(true);
  });

  it('creates, retrieves, and updates accounts offline', async () => {
    const account: Account = {
      id: 'acc-hdfc',
      name: 'HDFC Savings',
      type: 'bank',
      initialBalanceMinor: 5000000, // ₹50,000
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await accountRepo.create(account);
    const fetched = await accountRepo.findById('acc-hdfc');
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('HDFC Savings');
    expect(fetched?.initialBalanceMinor).toBe(5000000);

    const updated = { ...account, name: 'HDFC Salary Account' };
    await accountRepo.update(updated);
    const reFetched = await accountRepo.findById('acc-hdfc');
    expect(reFetched?.name).toBe('HDFC Salary Account');
  });

  it('creates and queries transactions by account and date', async () => {
    const account: Account = {
      id: 'acc-wallet',
      name: 'Cash',
      type: 'cash',
      initialBalanceMinor: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await accountRepo.create(account);

    const tx: Transaction = {
      id: 'tx-chai',
      accountId: 'acc-wallet',
      type: 'expense',
      amountMinor: 2000, // ₹20
      currency: 'INR',
      date: '2026-09-06',
      categoryId: 'cat-food',
      subcategory: 'Chai',
      merchant: 'Tapri',
      notes: 'Morning tea',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await txRepo.create(tx);
    const txs = await txRepo.findByAccountId('acc-wallet');
    expect(txs).toHaveLength(1);
    expect(txs[0]?.merchant).toBe('Tapri');
    expect(txs[0]?.amountMinor).toBe(2000);
  });

  it('handles offline private groups, members, and expenses', async () => {
    const group: Group = {
      id: 'grp-trip',
      name: 'Manali Trip',
      isPrivate: true,
      ownerId: 'usr-1',
      currency: 'INR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await groupRepo.create(group);

    const m1: GroupMember = {
      id: 'm1',
      groupId: 'grp-trip',
      name: 'Aman',
      userId: null,
      isDummy: true,
      role: 'owner',
      createdAt: new Date().toISOString(),
    };
    const m2: GroupMember = {
      id: 'm2',
      groupId: 'grp-trip',
      name: 'Rohit',
      userId: null,
      isDummy: true,
      role: 'member',
      createdAt: new Date().toISOString(),
    };

    await groupRepo.addMember(m1);
    await groupRepo.addMember(m2);

    const members = await groupRepo.getMembers('grp-trip');
    expect(members).toHaveLength(2);

    const expense: GroupExpense = {
      id: 'exp-hotel',
      groupId: 'grp-trip',
      title: 'Hotel Stay',
      amountMinor: 800000, // ₹8,000
      currency: 'INR',
      date: '2026-09-06',
      createdByMemberId: 'm1',
      payers: [{ memberId: 'm1', amountMinor: 800000 }],
      splitMethod: 'equal',
      allocations: [{ memberId: 'm1' }, { memberId: 'm2' }],
      notes: '2 nights',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await groupRepo.addExpense(expense);
    const expenses = await groupRepo.getExpenses('grp-trip');
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.title).toBe('Hotel Stay');
    expect(expenses[0]?.payers[0]?.amountMinor).toBe(800000);
  });

  it('queues and marks operations in outbox', async () => {
    await outboxRepo.enqueue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      entityType: 'group_expense',
      entityId: 'exp-hotel',
      operationType: 'create',
      payload: { title: 'Hotel Stay', amountMinor: 800000 },
      timestamp: new Date().toISOString(),
      deviceId: 'dev-1',
      status: 'pending',
      rejectionReason: null,
    });

    const pending = await outboxRepo.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.entityId).toBe('exp-hotel');

    await outboxRepo.markSynced('550e8400-e29b-41d4-a716-446655440000');
    const remainingPending = await outboxRepo.getPending();
    expect(remainingPending).toHaveLength(0);
  });
});
