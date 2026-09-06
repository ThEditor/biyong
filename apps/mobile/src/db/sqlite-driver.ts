import * as SQLite from 'expo-sqlite';
import {
  runMigrations,
  type SqliteDriver,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteCategoryRepository,
  SqliteBudgetRepository,
  SqliteGoalRepository,
  SqliteWealthRepository,
  SqliteGroupRepository,
  SqliteSyncStateRepository,
  SqliteOutboxRepository,
} from '@biyong/local-db';
import {
  AccountUseCases,
  TransactionUseCases,
  CategoryUseCases,
  BudgetUseCases,
  GoalUseCases,
  AnalyticsUseCases,
  GroupUseCases,
  WealthUseCases,
} from '@biyong/application';
import type { Account } from '@biyong/schemas';

export class ExpoSqliteDriver implements SqliteDriver {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(
    sql: string,
    params: unknown[] = []
  ): Promise<{ changes: number; lastInsertRowId?: number | bigint }> {
    const res = await this.db.runAsync(sql, params as any[]);
    return { changes: res.changes, lastInsertRowId: res.lastInsertRowId };
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.getAllAsync<T>(sql, params as any[])) as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = await this.db.getFirstAsync<T>(sql, params as any[]);
    return row ?? null;
  }
}

export interface LedgerDatabaseServices {
  driver: ExpoSqliteDriver;
  accountRepo: SqliteAccountRepository;
  txRepo: SqliteTransactionRepository;
  categoryRepo: SqliteCategoryRepository;
  budgetRepo: SqliteBudgetRepository;
  goalRepo: SqliteGoalRepository;
  wealthRepo: SqliteWealthRepository;
  groupRepo: SqliteGroupRepository;
  syncStateRepo: SqliteSyncStateRepository;
  outboxRepo: SqliteOutboxRepository;
  accountUseCases: AccountUseCases;
  txUseCases: TransactionUseCases;
  categoryUseCases: CategoryUseCases;
  budgetUseCases: BudgetUseCases;
  goalUseCases: GoalUseCases;
  analyticsUseCases: AnalyticsUseCases;
  groupUseCases: GroupUseCases;
  wealthUseCases: WealthUseCases;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;
let cachedServices: LedgerDatabaseServices | null = null;

export async function initDatabase(): Promise<LedgerDatabaseServices> {
  if (cachedServices) {
    return cachedServices;
  }

  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('biyong.db');
  }

  const driver = new ExpoSqliteDriver(dbInstance);

  // Execute migrations and builtin category seeds
  await runMigrations(driver);

  // Initialize repositories
  const accountRepo = new SqliteAccountRepository(driver);
  const txRepo = new SqliteTransactionRepository(driver);
  const categoryRepo = new SqliteCategoryRepository(driver);
  const budgetRepo = new SqliteBudgetRepository(driver);
  const goalRepo = new SqliteGoalRepository(driver);
  const wealthRepo = new SqliteWealthRepository(driver);
  const groupRepo = new SqliteGroupRepository(driver);
  const syncStateRepo = new SqliteSyncStateRepository(driver);
  const outboxRepo = new SqliteOutboxRepository(driver);

  // Initialize use cases
  const accountUseCases = new AccountUseCases(accountRepo, txRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo, categoryRepo);
  const categoryUseCases = new CategoryUseCases(categoryRepo);
  const budgetUseCases = new BudgetUseCases(budgetRepo, txRepo);
  const goalUseCases = new GoalUseCases(goalRepo);
  const analyticsUseCases = new AnalyticsUseCases(txRepo);
  const groupUseCases = new GroupUseCases(groupRepo);
  const wealthUseCases = new WealthUseCases(accountRepo, txRepo, wealthRepo);

  // App starts with no data (clean slate for user)

  cachedServices = {
    driver,
    accountRepo,
    txRepo,
    categoryRepo,
    budgetRepo,
    goalRepo,
    wealthRepo,
    groupRepo,
    syncStateRepo,
    outboxRepo,
    accountUseCases,
    txUseCases,
    categoryUseCases,
    budgetUseCases,
    goalUseCases,
    analyticsUseCases,
    groupUseCases,
    wealthUseCases,
  };

  return cachedServices;
}
