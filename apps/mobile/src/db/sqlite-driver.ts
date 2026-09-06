import * as SQLite from 'expo-sqlite';
import {
  runMigrations,
  type SqliteDriver,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteCategoryRepository,
} from '@biyong/local-db';
import {
  AccountUseCases,
  TransactionUseCases,
  CategoryUseCases,
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
  accountUseCases: AccountUseCases;
  txUseCases: TransactionUseCases;
  categoryUseCases: CategoryUseCases;
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

  // Initialize use cases
  const accountUseCases = new AccountUseCases(accountRepo, txRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo, categoryRepo);
  const categoryUseCases = new CategoryUseCases(categoryRepo);

  // Check if default accounts exist, seed initial if ledger is pristine
  const existingAccounts = await accountRepo.findAll();
  if (existingAccounts.length === 0) {
    const now = new Date().toISOString();
    const defaultAccounts: Account[] = [
      {
        id: 'acc-bank-primary',
        name: 'Primary Bank Account',
        type: 'bank',
        initialBalanceMinor: 2500000, // ₹25,000.00
        currency: 'INR',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'acc-cash',
        name: 'Cash in Hand',
        type: 'cash',
        initialBalanceMinor: 500000, // ₹5,000.00
        currency: 'INR',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const acc of defaultAccounts) {
      await accountUseCases.createAccount(acc);
    }
  }

  cachedServices = {
    driver,
    accountRepo,
    txRepo,
    categoryRepo,
    accountUseCases,
    txUseCases,
    categoryUseCases,
  };

  return cachedServices;
}
