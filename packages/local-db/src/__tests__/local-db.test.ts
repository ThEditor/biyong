import { describe, it, expect, beforeEach } from 'vitest';
import {
  runMigrations,
  SqliteAccountRepository,
  SqliteCategoryRepository,
  SqliteTransactionRepository,
  SqliteGroupRepository,
  SqliteOutboxRepository,
} from '../index.js';
import { MemorySqliteDriver } from '../memory-driver.js';
import type { Account, Category, Transaction, Group, GroupMember, GroupExpense } from '@biyong/schemas';

describe('Local DB: SQLite Schema & Repositories', () => {
  let driver: MemorySqliteDriver;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let txRepo: SqliteTransactionRepository;
  let groupRepo: SqliteGroupRepository;
  let outboxRepo: SqliteOutboxRepository;

  beforeEach(async () => {
    driver = new MemorySqliteDriver();
    await driver.init();
    await runMigrations(driver);

    accountRepo = new SqliteAccountRepository(driver);
    categoryRepo = new SqliteCategoryRepository(driver);
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

  it('manages categories via SqliteCategoryRepository (reading default categories, adding custom category)', async () => {
    // Reading default seeded categories
    const categories = await categoryRepo.findAll();
    expect(categories.length).toBeGreaterThanOrEqual(10);
    expect(categories.some((c) => c.id === 'cat-food' && c.isBuiltin)).toBe(true);

    const food = await categoryRepo.findById('cat-food');
    expect(food).not.toBeNull();
    expect(food?.name).toBe('Food & Dining');
    expect(food?.icon).toBe('utensils');
    expect(food?.isBuiltin).toBe(true);

    // Adding custom category
    const customCat: Category = {
      id: 'cat-custom-hobbies',
      name: 'Hobbies & Crafts',
      icon: 'palette',
      parentCategoryId: null,
      isBuiltin: false,
    };
    await categoryRepo.create(customCat);

    const fetchedCustom = await categoryRepo.findById('cat-custom-hobbies');
    expect(fetchedCustom).not.toBeNull();
    expect(fetchedCustom?.name).toBe('Hobbies & Crafts');
    expect(fetchedCustom?.isBuiltin).toBe(false);

    // Verify ordering: is_builtin DESC, name ASC (builtin first, then custom sorted by name)
    const all = await categoryRepo.findAll();
    const customIndex = all.findIndex((c) => c.id === 'cat-custom-hobbies');
    const lastBuiltinIndex = all.map((c) => c.isBuiltin).lastIndexOf(true);
    expect(customIndex).toBeGreaterThan(lastBuiltinIndex);
  });

  it('archives an account with SqliteAccountRepository.archive', async () => {
    const account: Account = {
      id: 'acc-archive-me',
      name: 'Temporary Account',
      type: 'bank',
      initialBalanceMinor: 100000,
      currency: 'INR',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await accountRepo.create(account);

    const beforeArchive = await accountRepo.findById('acc-archive-me');
    expect(beforeArchive?.isArchived).toBe(false);

    await accountRepo.archive('acc-archive-me');

    const afterArchive = await accountRepo.findById('acc-archive-me');
    expect(afterArchive).not.toBeNull();
    expect(afterArchive?.isArchived).toBe(true);
    expect(new Date(afterArchive!.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it('filters transactions using findByFilter (search by merchant/notes, filter by category and date)', async () => {
    const acc1: Account = {
      id: 'acc-main',
      name: 'Main Bank',
      type: 'bank',
      initialBalanceMinor: 10000000,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const acc2: Account = {
      id: 'acc-savings',
      name: 'Savings Pot',
      type: 'bank',
      initialBalanceMinor: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await accountRepo.create(acc1);
    await accountRepo.create(acc2);

    const tx1: Transaction = {
      id: 'tx-1',
      accountId: 'acc-main',
      type: 'expense',
      amountMinor: 45000, // ₹450
      currency: 'INR',
      date: '2026-09-01',
      categoryId: 'cat-food',
      subcategory: 'Takeout',
      merchant: 'Swiggy',
      notes: 'Lunch biryani',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
    };

    const tx2: Transaction = {
      id: 'tx-2',
      accountId: 'acc-main',
      type: 'expense',
      amountMinor: 120000, // ₹1,200
      currency: 'INR',
      date: '2026-09-03',
      categoryId: 'cat-groceries',
      subcategory: 'Veggies',
      merchant: 'Zepto',
      notes: 'Weekly fresh vegetables',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-03T10:00:00.000Z',
      updatedAt: '2026-09-03T10:00:00.000Z',
    };

    const tx3: Transaction = {
      id: 'tx-3',
      accountId: 'acc-main',
      type: 'income',
      amountMinor: 5000000, // ₹50,000
      currency: 'INR',
      date: '2026-09-05',
      categoryId: 'cat-salary',
      subcategory: null,
      merchant: 'Acme Corp',
      notes: 'Monthly salary payout',
      toAccountId: null,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-05T09:00:00.000Z',
      updatedAt: '2026-09-05T09:00:00.000Z',
    };

    const tx4: Transaction = {
      id: 'tx-4',
      accountId: 'acc-main',
      type: 'transfer',
      amountMinor: 1000000, // ₹10,000
      currency: 'INR',
      date: '2026-09-06',
      categoryId: null,
      subcategory: null,
      merchant: null,
      notes: 'Emergency fund transfer',
      toAccountId: 'acc-savings',
      isRecurring: false,
      recurringFrequency: null,
      createdAt: '2026-09-06T15:00:00.000Z',
      updatedAt: '2026-09-06T15:00:00.000Z',
    };

    await txRepo.create(tx1);
    await txRepo.create(tx2);
    await txRepo.create(tx3);
    await txRepo.create(tx4);

    // Search by merchant (case-insensitive LIKE)
    const swiggyResults = await txRepo.findByFilter({ searchQuery: 'swiggy' });
    expect(swiggyResults).toHaveLength(1);
    expect(swiggyResults[0]?.id).toBe('tx-1');

    // Search by notes
    const vegetablesResults = await txRepo.findByFilter({ searchQuery: 'vegetables' });
    expect(vegetablesResults).toHaveLength(1);
    expect(vegetablesResults[0]?.id).toBe('tx-2');

    // Search by subcategory
    const takeoutResults = await txRepo.findByFilter({ searchQuery: 'takeout' });
    expect(takeoutResults).toHaveLength(1);
    expect(takeoutResults[0]?.id).toBe('tx-1');

    // Filter by categoryId
    const foodResults = await txRepo.findByFilter({ categoryId: 'cat-food' });
    expect(foodResults).toHaveLength(1);
    expect(foodResults[0]?.id).toBe('tx-1');

    // Filter by date range (ordered date DESC, created_at DESC)
    const dateRangeResults = await txRepo.findByFilter({
      startDate: '2026-09-02',
      endDate: '2026-09-05',
    });
    expect(dateRangeResults.map((t) => t.id)).toEqual(['tx-3', 'tx-2']);

    // Filter by combined category and date range
    const combinedResults = await txRepo.findByFilter({
      categoryId: 'cat-groceries',
      startDate: '2026-09-01',
      endDate: '2026-09-04',
    });
    expect(combinedResults).toHaveLength(1);
    expect(combinedResults[0]?.id).toBe('tx-2');

    // Filter by accountId (matching toAccountId in transfer)
    const savingsTxResults = await txRepo.findByFilter({ accountId: 'acc-savings' });
    expect(savingsTxResults).toHaveLength(1);
    expect(savingsTxResults[0]?.id).toBe('tx-4');

    // Filter by type
    const incomeResults = await txRepo.findByFilter({ type: 'income' });
    expect(incomeResults).toHaveLength(1);
    expect(incomeResults[0]?.id).toBe('tx-3');
  });
});
