import type { Account } from '@biyong/schemas';
import type { AccountRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface AccountRow {
  id: string;
  name: string;
  type: Account['type'];
  initial_balance_minor: number;
  currency: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalanceMinor: row.initial_balance_minor,
    currency: row.currency,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private driver: SqliteDriver) {}

  async create(account: Account): Promise<void> {
    await this.driver.run(
      `INSERT INTO accounts (id, name, type, initial_balance_minor, currency, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.type,
        account.initialBalanceMinor,
        account.currency,
        account.isArchived ? 1 : 0,
        account.createdAt,
        account.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.driver.queryOne<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  async findAll(): Promise<Account[]> {
    const rows = await this.driver.query<AccountRow>('SELECT * FROM accounts ORDER BY created_at ASC');
    return rows.map(mapRow);
  }

  async update(account: Account): Promise<void> {
    await this.driver.run(
      `UPDATE accounts SET name = ?, type = ?, initial_balance_minor = ?, currency = ?, is_archived = ?, updated_at = ?
       WHERE id = ?`,
      [
        account.name,
        account.type,
        account.initialBalanceMinor,
        account.currency,
        account.isArchived ? 1 : 0,
        account.updatedAt,
        account.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM accounts WHERE id = ?', [id]);
  }
}
