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
  SqlitePeerDebtRepository,
  SqliteReimbursementRepository,
  SqliteSubscriptionRepository,
  SqliteReceiptRepository,
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
  LendingUseCases,
  ReimbursementUseCases,
  SubscriptionUseCases,
  ExportImportUseCases,
  IntelligenceUseCases,
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
  peerDebtRepo: SqlitePeerDebtRepository;
  reimbursementRepo: SqliteReimbursementRepository;
  subscriptionRepo: SqliteSubscriptionRepository;
  receiptRepo: SqliteReceiptRepository;
  accountUseCases: AccountUseCases;
  txUseCases: TransactionUseCases;
  categoryUseCases: CategoryUseCases;
  budgetUseCases: BudgetUseCases;
  goalUseCases: GoalUseCases;
  analyticsUseCases: AnalyticsUseCases;
  groupUseCases: GroupUseCases;
  wealthUseCases: WealthUseCases;
  lendingUseCases: LendingUseCases;
  reimbursementUseCases: ReimbursementUseCases;
  subscriptionUseCases: SubscriptionUseCases;
  exportImportUseCases: ExportImportUseCases;
  intelligenceUseCases: IntelligenceUseCases;
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
  const peerDebtRepo = new SqlitePeerDebtRepository(driver);
  const reimbursementRepo = new SqliteReimbursementRepository(driver);
  const subscriptionRepo = new SqliteSubscriptionRepository(driver);
  const receiptRepo = new SqliteReceiptRepository(driver);

  // Initialize use cases
  const accountUseCases = new AccountUseCases(accountRepo, txRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo, categoryRepo);
  const categoryUseCases = new CategoryUseCases(categoryRepo);
  const budgetUseCases = new BudgetUseCases(budgetRepo, txRepo);
  const goalUseCases = new GoalUseCases(goalRepo);
  const analyticsUseCases = new AnalyticsUseCases(txRepo);
  const groupUseCases = new GroupUseCases(groupRepo);
  const wealthUseCases = new WealthUseCases(accountRepo, txRepo, wealthRepo);
  const lendingUseCases = new LendingUseCases(peerDebtRepo);
  const reimbursementUseCases = new ReimbursementUseCases(reimbursementRepo, txRepo);
  const subscriptionUseCases = new SubscriptionUseCases(subscriptionRepo, txRepo);
  const exportImportUseCases = new ExportImportUseCases({
    accountRepo,
    txRepo,
    categoryRepo,
    budgetRepo,
    goalRepo,
    wealthRepo,
    peerDebtRepo,
    reimbursementRepo,
    subscriptionRepo,
  });
  const intelligenceUseCases = new IntelligenceUseCases({
    accountRepo,
    txRepo,
    categoryRepo,
    budgetRepo,
    wealthRepo,
    peerDebtRepo,
    subscriptionRepo,
  });

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
    peerDebtRepo,
    reimbursementRepo,
    subscriptionRepo,
    receiptRepo,
    accountUseCases,
    txUseCases,
    categoryUseCases,
    budgetUseCases,
    goalUseCases,
    analyticsUseCases,
    groupUseCases,
    wealthUseCases,
    lendingUseCases,
    reimbursementUseCases,
    subscriptionUseCases,
    exportImportUseCases,
    intelligenceUseCases,
  };

  return cachedServices;
}
