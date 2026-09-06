import type { Transaction } from '@biyong/schemas';
import type { TransactionRepository } from '@biyong/application';
import type { TransactionFilter } from '@biyong/domain';
import type { SqliteDriver } from '../driver.js';

interface TxRow {
  id: string;
  account_id: string;
  type: Transaction['type'];
  amount_minor: number;
  currency: string;
  date: string;
  category_id: string | null;
  subcategory: string | null;
  merchant: string | null;
  notes: string | null;
  to_account_id: string | null;
  is_recurring: number;
  recurring_frequency: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TxRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    amountMinor: row.amount_minor,
    currency: row.currency,
    date: row.date,
    categoryId: row.category_id,
    subcategory: row.subcategory,
    merchant: row.merchant,
    notes: row.notes,
    toAccountId: row.to_account_id,
    isRecurring: Boolean(row.is_recurring),
    recurringFrequency: row.recurring_frequency as Transaction['recurringFrequency'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private driver: SqliteDriver) {}

  async create(tx: Transaction): Promise<void> {
    await this.driver.run(
      `INSERT INTO transactions (
        id, account_id, type, amount_minor, currency, date, category_id,
        subcategory, merchant, notes, to_account_id, is_recurring,
        recurring_frequency, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.accountId,
        tx.type,
        tx.amountMinor,
        tx.currency,
        tx.date,
        tx.categoryId,
        tx.subcategory,
        tx.merchant,
        tx.notes,
        tx.toAccountId,
        tx.isRecurring ? 1 : 0,
        tx.recurringFrequency,
        tx.createdAt,
        tx.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<Transaction | null> {
    const row = await this.driver.queryOne<TxRow>('SELECT * FROM transactions WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    const rows = await this.driver.query<TxRow>(
      'SELECT * FROM transactions WHERE account_id = ? OR to_account_id = ? ORDER BY date DESC, created_at DESC',
      [accountId, accountId]
    );
    return rows.map(mapRow);
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    const rows = await this.driver.query<TxRow>(
      'SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC',
      [startDate, endDate]
    );
    return rows.map(mapRow);
  }

  async findAll(): Promise<Transaction[]> {
    const rows = await this.driver.query<TxRow>(
      'SELECT * FROM transactions ORDER BY date DESC, created_at DESC'
    );
    return rows.map(mapRow);
  }

  async findByFilter(filter: TransactionFilter): Promise<Transaction[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.accountId !== undefined) {
      conditions.push('(account_id = ? OR to_account_id = ?)');
      params.push(filter.accountId, filter.accountId);
    }

    if (filter.categoryId !== undefined) {
      conditions.push('category_id = ?');
      params.push(filter.categoryId);
    }

    if (filter.type !== undefined) {
      conditions.push('type = ?');
      params.push(filter.type);
    }

    if (filter.startDate !== undefined) {
      conditions.push('date >= ?');
      params.push(filter.startDate);
    }

    if (filter.endDate !== undefined) {
      conditions.push('date <= ?');
      params.push(filter.endDate);
    }

    if (filter.searchQuery !== undefined && filter.searchQuery.trim().length > 0) {
      conditions.push('(merchant LIKE ? OR notes LIKE ? OR subcategory LIKE ?)');
      const pattern = `%${filter.searchQuery.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    let sql = 'SELECT * FROM transactions';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY date DESC, created_at DESC';

    const rows = await this.driver.query<TxRow>(sql, params);
    return rows.map(mapRow);
  }

  async update(tx: Transaction): Promise<void> {
    await this.driver.run(
      `UPDATE transactions SET
        account_id = ?, type = ?, amount_minor = ?, currency = ?, date = ?,
        category_id = ?, subcategory = ?, merchant = ?, notes = ?,
        to_account_id = ?, is_recurring = ?, recurring_frequency = ?, updated_at = ?
       WHERE id = ?`,
      [
        tx.accountId,
        tx.type,
        tx.amountMinor,
        tx.currency,
        tx.date,
        tx.categoryId,
        tx.subcategory,
        tx.merchant,
        tx.notes,
        tx.toAccountId,
        tx.isRecurring ? 1 : 0,
        tx.recurringFrequency,
        tx.updatedAt,
        tx.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM transactions WHERE id = ?', [id]);
  }
}
