import { describe, it, expect, beforeEach } from 'vitest';
import {
  runMigrations,
  SqliteAccountRepository,
  SqliteCategoryRepository,
  SqliteTransactionRepository,
  SqliteGroupRepository,
  SqliteOutboxRepository,
  SqliteBudgetRepository,
  SqliteGoalRepository,
  SqliteWealthRepository,
} from '../index.js';
import { MemorySqliteDriver } from '../memory-driver.js';
import type {
  Account,
  Category,
  Transaction,
  Group,
  GroupMember,
  GroupExpense,
  Budget,
  Goal,
  Investment,
  Liability,
} from '@biyong/schemas';

describe('Local DB: SQLite Schema & Repositories', () => {
  let driver: MemorySqliteDriver;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let txRepo: SqliteTransactionRepository;
  let groupRepo: SqliteGroupRepository;
  let outboxRepo: SqliteOutboxRepository;
  let budgetRepo: SqliteBudgetRepository;
  let goalRepo: SqliteGoalRepository;
  let wealthRepo: SqliteWealthRepository;

  beforeEach(async () => {
    driver = new MemorySqliteDriver();
    await driver.init();
    await runMigrations(driver);

    accountRepo = new SqliteAccountRepository(driver);
    categoryRepo = new SqliteCategoryRepository(driver);
    txRepo = new SqliteTransactionRepository(driver);
    groupRepo = new SqliteGroupRepository(driver);
    outboxRepo = new SqliteOutboxRepository(driver);
    budgetRepo = new SqliteBudgetRepository(driver);
    goalRepo = new SqliteGoalRepository(driver);
    wealthRepo = new SqliteWealthRepository(driver);
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
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
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
      createdByUserId: null,
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
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
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
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
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
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
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
      isReimbursable: false,
      reimbursementStatus: null,
      receiptAttachmentId: null,
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

  describe('SqliteBudgetRepository', () => {
    it('creates weekly and monthly budgets with and without rollover', async () => {
      const monthlyBudget: Budget = {
        id: 'bgt-food',
        categoryId: 'cat-food',
        amountMinor: 1500000, // ₹15,000
        currency: 'INR',
        period: 'monthly',
        startDate: '2026-09-01',
        endDate: null,
        rollover: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      const weeklyBudget: Budget = {
        id: 'bgt-entertainment',
        categoryId: 'cat-entertainment',
        amountMinor: 200000, // ₹2,000
        currency: 'INR',
        period: 'weekly',
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        rollover: false,
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      };

      await budgetRepo.create(monthlyBudget);
      await budgetRepo.create(weeklyBudget);

      const fetchedMonthly = await budgetRepo.findById('bgt-food');
      expect(fetchedMonthly).not.toBeNull();
      expect(fetchedMonthly).toEqual(monthlyBudget);
      expect(fetchedMonthly?.period).toBe('monthly');
      expect(fetchedMonthly?.rollover).toBe(true);
      expect(fetchedMonthly?.endDate).toBeNull();

      const fetchedWeekly = await budgetRepo.findById('bgt-entertainment');
      expect(fetchedWeekly).not.toBeNull();
      expect(fetchedWeekly).toEqual(weeklyBudget);
      expect(fetchedWeekly?.period).toBe('weekly');
      expect(fetchedWeekly?.rollover).toBe(false);
      expect(fetchedWeekly?.endDate).toBe('2026-09-07');
    });

    it('queries budget by ID and by category ID', async () => {
      const budget: Budget = {
        id: 'bgt-groceries',
        categoryId: 'cat-groceries',
        amountMinor: 800000, // ₹8,000
        currency: 'INR',
        period: 'monthly',
        startDate: '2026-09-01',
        endDate: null,
        rollover: false,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      };

      await budgetRepo.create(budget);

      // Query by ID
      const byId = await budgetRepo.findById('bgt-groceries');
      expect(byId).not.toBeNull();
      expect(byId?.id).toBe('bgt-groceries');
      expect(byId?.amountMinor).toBe(800000);

      // Query by Category ID
      const byCategory = await budgetRepo.findByCategoryId('cat-groceries');
      expect(byCategory).not.toBeNull();
      expect(byCategory?.id).toBe('bgt-groceries');
      expect(byCategory?.categoryId).toBe('cat-groceries');

      // Non-existent lookups
      const notFoundId = await budgetRepo.findById('bgt-non-existent');
      expect(notFoundId).toBeNull();

      const notFoundCategory = await budgetRepo.findByCategoryId('cat-non-existent');
      expect(notFoundCategory).toBeNull();
    });

    it('updates budget amount, period, and rollover flag', async () => {
      const budget: Budget = {
        id: 'bgt-utilities',
        categoryId: 'cat-utilities',
        amountMinor: 300000, // ₹3,000
        currency: 'INR',
        period: 'monthly',
        startDate: '2026-09-01',
        endDate: null,
        rollover: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      await budgetRepo.create(budget);

      // Update amount, period, rollover, and endDate
      const updatedBudget: Budget = {
        ...budget,
        amountMinor: 450000, // ₹4,500
        period: 'weekly',
        rollover: true,
        endDate: '2026-09-30',
        updatedAt: '2026-09-06T12:00:00.000Z',
      };

      await budgetRepo.update(updatedBudget);

      const fetched = await budgetRepo.findById('bgt-utilities');
      expect(fetched).not.toBeNull();
      expect(fetched?.amountMinor).toBe(450000);
      expect(fetched?.period).toBe('weekly');
      expect(fetched?.rollover).toBe(true);
      expect(fetched?.endDate).toBe('2026-09-30');
      expect(fetched?.updatedAt).toBe('2026-09-06T12:00:00.000Z');
    });

    it('lists all budgets ordered by created_at DESC', async () => {
      const b1: Budget = {
        id: 'bgt-1',
        categoryId: 'cat-food',
        amountMinor: 1000000,
        currency: 'INR',
        period: 'monthly',
        startDate: '2026-09-01',
        endDate: null,
        rollover: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
      const b2: Budget = {
        id: 'bgt-2',
        categoryId: 'cat-travel',
        amountMinor: 500000,
        currency: 'INR',
        period: 'weekly',
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        rollover: false,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      };
      const b3: Budget = {
        id: 'bgt-3',
        categoryId: 'cat-shopping',
        amountMinor: 2000000,
        currency: 'INR',
        period: 'monthly',
        startDate: '2026-09-01',
        endDate: null,
        rollover: false,
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      };

      await budgetRepo.create(b1);
      await budgetRepo.create(b2);
      await budgetRepo.create(b3);

      const all = await budgetRepo.findAll();
      expect(all).toHaveLength(3);
      // Ordered by created_at DESC: bgt-3, bgt-2, bgt-1
      expect(all.map((b) => b.id)).toEqual(['bgt-3', 'bgt-2', 'bgt-1']);
    });

    it('deletes budget by ID', async () => {
      const budget: Budget = {
        id: 'bgt-del',
        categoryId: 'cat-food',
        amountMinor: 500000,
        currency: 'INR',
        period: 'monthly',
        startDate: '2026-09-01',
        endDate: null,
        rollover: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      await budgetRepo.create(budget);
      expect(await budgetRepo.findById('bgt-del')).not.toBeNull();

      await budgetRepo.delete('bgt-del');
      expect(await budgetRepo.findById('bgt-del')).toBeNull();

      const all = await budgetRepo.findAll();
      expect(all.find((b) => b.id === 'bgt-del')).toBeUndefined();
    });
  });

  describe('SqliteGoalRepository', () => {
    it('creates savings goals (emergency fund, vacation)', async () => {
      const emergencyFund: Goal = {
        id: 'goal-emergency',
        title: 'Emergency Fund',
        targetAmountMinor: 30000000, // ₹3,00,000
        currentAmountMinor: 10000000, // ₹1,00,000
        currency: 'INR',
        targetDate: '2026-12-31',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      const vacationGoal: Goal = {
        id: 'goal-vacation',
        title: 'Japan Vacation',
        targetAmountMinor: 20000000, // ₹2,00,000
        currentAmountMinor: 0,
        currency: 'INR',
        targetDate: '2027-04-15',
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      };

      await goalRepo.create(emergencyFund);
      await goalRepo.create(vacationGoal);

      const fetchedEmergency = await goalRepo.findById('goal-emergency');
      expect(fetchedEmergency).not.toBeNull();
      expect(fetchedEmergency).toEqual(emergencyFund);
      expect(fetchedEmergency?.title).toBe('Emergency Fund');
      expect(fetchedEmergency?.targetAmountMinor).toBe(30000000);
      expect(fetchedEmergency?.currentAmountMinor).toBe(10000000);

      const fetchedVacation = await goalRepo.findById('goal-vacation');
      expect(fetchedVacation).not.toBeNull();
      expect(fetchedVacation).toEqual(vacationGoal);
      expect(fetchedVacation?.currentAmountMinor).toBe(0);
    });

    it('queries goal by ID', async () => {
      const goal: Goal = {
        id: 'goal-laptop',
        title: 'MacBook Pro M3',
        targetAmountMinor: 18000000, // ₹1,80,000
        currentAmountMinor: 6000000, // ₹60,000
        currency: 'INR',
        targetDate: '2026-11-30',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      await goalRepo.create(goal);

      const fetched = await goalRepo.findById('goal-laptop');
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe('MacBook Pro M3');
      expect(fetched?.targetAmountMinor).toBe(18000000);
      expect(fetched?.currentAmountMinor).toBe(6000000);

      const notFound = await goalRepo.findById('goal-non-existent');
      expect(notFound).toBeNull();
    });

    it('updates goal progress (current_amount_minor)', async () => {
      const goal: Goal = {
        id: 'goal-bike',
        title: 'New Bicycle',
        targetAmountMinor: 2500000, // ₹25,000
        currentAmountMinor: 500000, // ₹5,000
        currency: 'INR',
        targetDate: '2026-10-31',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      await goalRepo.create(goal);

      // Progress update: added ₹10,000
      const updated: Goal = {
        ...goal,
        currentAmountMinor: 1500000, // ₹15,000
        updatedAt: '2026-09-06T15:00:00.000Z',
      };

      await goalRepo.update(updated);

      const fetched = await goalRepo.findById('goal-bike');
      expect(fetched).not.toBeNull();
      expect(fetched?.currentAmountMinor).toBe(1500000);
      expect(fetched?.updatedAt).toBe('2026-09-06T15:00:00.000Z');
    });

    it('lists all goals sorted by target_date ASC', async () => {
      const g1: Goal = {
        id: 'goal-far',
        title: 'Home Renovation',
        targetAmountMinor: 50000000,
        currentAmountMinor: 10000000,
        currency: 'INR',
        targetDate: '2027-12-31',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
      const g2: Goal = {
        id: 'goal-near',
        title: 'Festival Shopping',
        targetAmountMinor: 3000000,
        currentAmountMinor: 1500000,
        currency: 'INR',
        targetDate: '2026-10-15',
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      };
      const g3: Goal = {
        id: 'goal-mid',
        title: 'Annual Insurance',
        targetAmountMinor: 2000000,
        currentAmountMinor: 500000,
        currency: 'INR',
        targetDate: '2027-03-01',
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      };

      await goalRepo.create(g1);
      await goalRepo.create(g2);
      await goalRepo.create(g3);

      const all = await goalRepo.findAll();
      expect(all).toHaveLength(3);
      // Ordered by target_date ASC: goal-near (2026-10-15), goal-mid (2027-03-01), goal-far (2027-12-31)
      expect(all.map((g) => g.id)).toEqual(['goal-near', 'goal-mid', 'goal-far']);
    });

    it('deletes goal by ID', async () => {
      const goal: Goal = {
        id: 'goal-del',
        title: 'Temporary Goal',
        targetAmountMinor: 1000000,
        currentAmountMinor: 0,
        currency: 'INR',
        targetDate: '2026-12-01',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      await goalRepo.create(goal);
      expect(await goalRepo.findById('goal-del')).not.toBeNull();

      await goalRepo.delete('goal-del');
      expect(await goalRepo.findById('goal-del')).toBeNull();

      const all = await goalRepo.findAll();
      expect(all.find((g) => g.id === 'goal-del')).toBeUndefined();
    });
  });

  describe('SqliteWealthRepository', () => {
    describe('Investments (FD, Stocks, Mutual Funds, Gold)', () => {
      it('creates and saves investments of various types (FD, Stocks, Mutual Funds, Gold)', async () => {
        const fd: Investment = {
          id: 'inv-fd-1',
          name: 'HDFC Fixed Deposit 1Y',
          type: 'fd',
          investedAmountMinor: 10000000, // ₹1,00,000
          currentValueMinor: 10700000, // ₹1,07,000
          currency: 'INR',
          notes: '7.0% interest p.a.',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        const stock: Investment = {
          id: 'inv-stock-1',
          name: 'Reliance Industries Ltd',
          type: 'stock',
          investedAmountMinor: 5000000, // ₹50,000
          currentValueMinor: 5850000, // ₹58,500
          currency: 'INR',
          notes: '20 shares @ ₹2,500',
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        };

        const mutualFund: Investment = {
          id: 'inv-mf-1',
          name: 'Parag Parikh Flexi Cap Fund',
          type: 'mutual_fund',
          investedAmountMinor: 15000000, // ₹1,50,000
          currentValueMinor: 18200000, // ₹1,82,000
          currency: 'INR',
          notes: 'Monthly SIP',
          createdAt: '2026-09-03T00:00:00.000Z',
          updatedAt: '2026-09-03T00:00:00.000Z',
        };

        const gold: Investment = {
          id: 'inv-gold-1',
          name: 'Sovereign Gold Bond 2026',
          type: 'gold',
          investedAmountMinor: 6500000, // ₹65,000
          currentValueMinor: 7400000, // ₹74,000
          currency: 'INR',
          notes: '10g digital gold equivalent',
          createdAt: '2026-09-04T00:00:00.000Z',
          updatedAt: '2026-09-04T00:00:00.000Z',
        };

        await wealthRepo.saveInvestment(fd);
        await wealthRepo.saveInvestment(stock);
        await wealthRepo.saveInvestment(mutualFund);
        await wealthRepo.saveInvestment(gold);

        const fetchedFd = await wealthRepo.findInvestmentById('inv-fd-1');
        expect(fetchedFd).toEqual(fd);
        expect(fetchedFd?.type).toBe('fd');
        expect(fetchedFd?.investedAmountMinor).toBe(10000000);
        expect(fetchedFd?.currentValueMinor).toBe(10700000);

        const fetchedStock = await wealthRepo.findInvestmentById('inv-stock-1');
        expect(fetchedStock).toEqual(stock);
        expect(fetchedStock?.type).toBe('stock');

        const fetchedMf = await wealthRepo.findInvestmentById('inv-mf-1');
        expect(fetchedMf).toEqual(mutualFund);
        expect(fetchedMf?.type).toBe('mutual_fund');

        const fetchedGold = await wealthRepo.findInvestmentById('inv-gold-1');
        expect(fetchedGold).toEqual(gold);
        expect(fetchedGold?.type).toBe('gold');
      });

      it('queries investments ordered by created_at DESC and returns null for non-existent ID', async () => {
        const inv1: Investment = {
          id: 'inv-early',
          name: 'Early PPF',
          type: 'ppf',
          investedAmountMinor: 5000000,
          currentValueMinor: 5500000,
          currency: 'INR',
          notes: null,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        };

        const inv2: Investment = {
          id: 'inv-later',
          name: 'NPS Tier 1',
          type: 'nps',
          investedAmountMinor: 10000000,
          currentValueMinor: 11200000,
          currency: 'INR',
          notes: null,
          createdAt: '2026-09-05T10:00:00.000Z',
          updatedAt: '2026-09-05T10:00:00.000Z',
        };

        await wealthRepo.saveInvestment(inv1);
        await wealthRepo.saveInvestment(inv2);

        const all = await wealthRepo.getInvestments();
        expect(all).toHaveLength(2);
        expect(all[0]?.id).toBe('inv-later');
        expect(all[1]?.id).toBe('inv-early');

        const notFound = await wealthRepo.findInvestmentById('inv-does-not-exist');
        expect(notFound).toBeNull();
      });

      it('updates existing investment without creating duplicates', async () => {
        const stock: Investment = {
          id: 'inv-tcs',
          name: 'TCS Shares',
          type: 'stock',
          investedAmountMinor: 4000000, // ₹40,000
          currentValueMinor: 4200000, // ₹42,000
          currency: 'INR',
          notes: '10 shares',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        await wealthRepo.saveInvestment(stock);

        // Update current valuation and notes
        const updated: Investment = {
          ...stock,
          currentValueMinor: 4800000, // Gain to ₹48,000
          notes: 'Q2 earnings rally',
          updatedAt: '2026-09-06T15:00:00.000Z',
        };

        await wealthRepo.saveInvestment(updated);

        const fetched = await wealthRepo.findInvestmentById('inv-tcs');
        expect(fetched).not.toBeNull();
        expect(fetched?.currentValueMinor).toBe(4800000);
        expect(fetched?.notes).toBe('Q2 earnings rally');
        expect(fetched?.updatedAt).toBe('2026-09-06T15:00:00.000Z');

        const all = await wealthRepo.getInvestments();
        expect(all).toHaveLength(1);
      });

      it('deletes an investment by ID', async () => {
        const inv: Investment = {
          id: 'inv-del-1',
          name: 'Closed FD',
          type: 'fd',
          investedAmountMinor: 2000000,
          currentValueMinor: 2100000,
          currency: 'INR',
          notes: null,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        await wealthRepo.saveInvestment(inv);
        expect(await wealthRepo.findInvestmentById('inv-del-1')).not.toBeNull();

        await wealthRepo.deleteInvestment('inv-del-1');
        expect(await wealthRepo.findInvestmentById('inv-del-1')).toBeNull();

        const all = await wealthRepo.getInvestments();
        expect(all.find((i) => i.id === 'inv-del-1')).toBeUndefined();
      });
    });

    describe('Liabilities (Loans, Credit Cards, EMIs)', () => {
      it('creates and saves liabilities of various types (Loans, Credit Cards, EMIs)', async () => {
        const homeLoan: Liability = {
          id: 'liab-loan-1',
          name: 'SBI Home Loan',
          type: 'loan',
          principalAmountMinor: 450000000, // ₹45,00,000
          remainingAmountMinor: 412500000, // ₹41,25,000
          currency: 'INR',
          interestRatePercent: 8.5,
          dueDate: '2046-03-31',
          notes: '20-year floating tenure',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        const creditCard: Liability = {
          id: 'liab-cc-1',
          name: 'HDFC Regalia Credit Card',
          type: 'credit_card',
          principalAmountMinor: 7500000, // ₹75,000
          remainingAmountMinor: 4200000, // ₹42,000
          currency: 'INR',
          interestRatePercent: 42.0,
          dueDate: '2026-09-20',
          notes: 'Billing cycle ends 5th',
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        };

        const emi: Liability = {
          id: 'liab-emi-1',
          name: 'MacBook No-Cost EMI',
          type: 'emi',
          principalAmountMinor: 12000000, // ₹1,20,000
          remainingAmountMinor: 6000000, // ₹60,000
          currency: 'INR',
          interestRatePercent: 0,
          dueDate: '2027-03-05',
          notes: '6 of 12 installments remaining',
          createdAt: '2026-09-03T00:00:00.000Z',
          updatedAt: '2026-09-03T00:00:00.000Z',
        };

        await wealthRepo.saveLiability(homeLoan);
        await wealthRepo.saveLiability(creditCard);
        await wealthRepo.saveLiability(emi);

        const fetchedLoan = await wealthRepo.findLiabilityById('liab-loan-1');
        expect(fetchedLoan).toEqual(homeLoan);
        expect(fetchedLoan?.type).toBe('loan');
        expect(fetchedLoan?.principalAmountMinor).toBe(450000000);
        expect(fetchedLoan?.remainingAmountMinor).toBe(412500000);
        expect(fetchedLoan?.interestRatePercent).toBe(8.5);

        const fetchedCc = await wealthRepo.findLiabilityById('liab-cc-1');
        expect(fetchedCc).toEqual(creditCard);
        expect(fetchedCc?.type).toBe('credit_card');
        expect(fetchedCc?.interestRatePercent).toBe(42.0);

        const fetchedEmi = await wealthRepo.findLiabilityById('liab-emi-1');
        expect(fetchedEmi).toEqual(emi);
        expect(fetchedEmi?.type).toBe('emi');
        expect(fetchedEmi?.interestRatePercent).toBe(0);
      });

      it('queries liabilities ordered by created_at DESC and returns null for non-existent ID', async () => {
        const l1: Liability = {
          id: 'liab-first',
          name: 'Personal Loan',
          type: 'loan',
          principalAmountMinor: 5000000,
          remainingAmountMinor: 3000000,
          currency: 'INR',
          interestRatePercent: 12.5,
          dueDate: null,
          notes: null,
          createdAt: '2026-09-01T08:00:00.000Z',
          updatedAt: '2026-09-01T08:00:00.000Z',
        };

        const l2: Liability = {
          id: 'liab-second',
          name: 'BNPL Purchase',
          type: 'bnpl',
          principalAmountMinor: 1500000,
          remainingAmountMinor: 500000,
          currency: 'INR',
          interestRatePercent: 0,
          dueDate: '2026-09-30',
          notes: null,
          createdAt: '2026-09-05T08:00:00.000Z',
          updatedAt: '2026-09-05T08:00:00.000Z',
        };

        await wealthRepo.saveLiability(l1);
        await wealthRepo.saveLiability(l2);

        const all = await wealthRepo.getLiabilities();
        expect(all).toHaveLength(2);
        expect(all[0]?.id).toBe('liab-second');
        expect(all[1]?.id).toBe('liab-first');

        const notFound = await wealthRepo.findLiabilityById('liab-non-existent');
        expect(notFound).toBeNull();
      });

      it('updates existing liability details and repayment balance', async () => {
        const loan: Liability = {
          id: 'liab-car',
          name: 'Auto Loan',
          type: 'loan',
          principalAmountMinor: 80000000, // ₹8,00,000
          remainingAmountMinor: 60000000, // ₹6,00,000
          currency: 'INR',
          interestRatePercent: 9.0,
          dueDate: '2029-12-31',
          notes: 'Prepayment allowed',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        await wealthRepo.saveLiability(loan);

        // Prepayment made: remaining amount decreased to ₹4,00,000, rate lowered to 8.75%
        const updated: Liability = {
          ...loan,
          remainingAmountMinor: 40000000,
          interestRatePercent: 8.75,
          notes: 'Prepayment ₹2,00,000 made on Sept 6',
          updatedAt: '2026-09-06T12:00:00.000Z',
        };

        await wealthRepo.saveLiability(updated);

        const fetched = await wealthRepo.findLiabilityById('liab-car');
        expect(fetched).not.toBeNull();
        expect(fetched?.remainingAmountMinor).toBe(40000000);
        expect(fetched?.interestRatePercent).toBe(8.75);
        expect(fetched?.notes).toBe('Prepayment ₹2,00,000 made on Sept 6');
        expect(fetched?.updatedAt).toBe('2026-09-06T12:00:00.000Z');

        const all = await wealthRepo.getLiabilities();
        expect(all).toHaveLength(1);
      });

      it('deletes a liability by ID', async () => {
        const cc: Liability = {
          id: 'liab-del-cc',
          name: 'Closed Card',
          type: 'credit_card',
          principalAmountMinor: 1000000,
          remainingAmountMinor: 0,
          currency: 'INR',
          interestRatePercent: 36.0,
          dueDate: null,
          notes: 'Paid off and closed',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        await wealthRepo.saveLiability(cc);
        expect(await wealthRepo.findLiabilityById('liab-del-cc')).not.toBeNull();

        await wealthRepo.deleteLiability('liab-del-cc');
        expect(await wealthRepo.findLiabilityById('liab-del-cc')).toBeNull();

        const all = await wealthRepo.getLiabilities();
        expect(all.find((l) => l.id === 'liab-del-cc')).toBeUndefined();
      });
    });

    describe('Transactions & Offline Persistence', () => {
      it('supports atomic SQLite transactions with clean rollback on error', async () => {
        const inv: Investment = {
          id: 'tx-inv-roll',
          name: 'Rolled Back Investment',
          type: 'fd',
          investedAmountMinor: 1000000,
          currentValueMinor: 1000000,
          currency: 'INR',
          notes: null,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        const liab: Liability = {
          id: 'tx-liab-roll',
          name: 'Rolled Back Liability',
          type: 'loan',
          principalAmountMinor: 2000000,
          remainingAmountMinor: 2000000,
          currency: 'INR',
          interestRatePercent: 10,
          dueDate: null,
          notes: null,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        // Begin transaction, execute writes, then rollback
        await driver.exec('BEGIN TRANSACTION');
        await wealthRepo.saveInvestment(inv);
        await wealthRepo.saveLiability(liab);
        await driver.exec('ROLLBACK');

        // Verify neither record was committed
        expect(await wealthRepo.findInvestmentById('tx-inv-roll')).toBeNull();
        expect(await wealthRepo.findLiabilityById('tx-liab-roll')).toBeNull();

        // Successful transaction commit
        await driver.exec('BEGIN TRANSACTION');
        await wealthRepo.saveInvestment(inv);
        await wealthRepo.saveLiability(liab);
        await driver.exec('COMMIT');

        // Verify both records committed
        expect(await wealthRepo.findInvestmentById('tx-inv-roll')).not.toBeNull();
        expect(await wealthRepo.findLiabilityById('tx-liab-roll')).not.toBeNull();
      });

      it('persists investments and liabilities 100% offline and preserves integer minor units', async () => {
        const highPrecisionInv: Investment = {
          id: 'inv-offline-large',
          name: 'Large Tech Holdings',
          type: 'stock',
          investedAmountMinor: 1234567890, // ₹1,23,45,678.90
          currentValueMinor: 2345678901,  // ₹2,34,56,789.01
          currency: 'INR',
          notes: 'High value offline portfolio test',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        const highPrecisionLiab: Liability = {
          id: 'liab-offline-large',
          name: 'Commercial Mortgage',
          type: 'loan',
          principalAmountMinor: 9876543210, // ₹9,87,65,432.10
          remainingAmountMinor: 8765432109, // ₹8,76,54,321.09
          currency: 'INR',
          interestRatePercent: 7.85,
          dueDate: '2040-01-01',
          notes: 'Exact integer minor units test',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        };

        await wealthRepo.saveInvestment(highPrecisionInv);
        await wealthRepo.saveLiability(highPrecisionLiab);

        const fetchedInv = await wealthRepo.findInvestmentById('inv-offline-large');
        expect(fetchedInv?.investedAmountMinor).toBe(1234567890);
        expect(fetchedInv?.currentValueMinor).toBe(2345678901);
        expect(Number.isInteger(fetchedInv?.investedAmountMinor)).toBe(true);
        expect(Number.isInteger(fetchedInv?.currentValueMinor)).toBe(true);

        const fetchedLiab = await wealthRepo.findLiabilityById('liab-offline-large');
        expect(fetchedLiab?.principalAmountMinor).toBe(9876543210);
        expect(fetchedLiab?.remainingAmountMinor).toBe(8765432109);
        expect(fetchedLiab?.interestRatePercent).toBe(7.85);
        expect(Number.isInteger(fetchedLiab?.principalAmountMinor)).toBe(true);
        expect(Number.isInteger(fetchedLiab?.remainingAmountMinor)).toBe(true);
      });
    });
  });
});

