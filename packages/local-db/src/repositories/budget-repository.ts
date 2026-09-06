import type { Budget } from '@biyong/schemas';
import type { BudgetRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface BudgetRow {
  id: string;
  category_id: string;
  amount_minor: number;
  currency: string;
  period: Budget['period'];
  start_date: string;
  end_date: string | null;
  rollover: number;
  created_at: string;
  updated_at: string;
}

function mapRow(r: BudgetRow): Budget {
  return {
    id: r.id,
    categoryId: r.category_id,
    amountMinor: r.amount_minor,
    currency: r.currency,
    period: r.period,
    startDate: r.start_date,
    endDate: r.end_date,
    rollover: Boolean(r.rollover),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private driver: SqliteDriver) {}

  async create(budget: Budget): Promise<void> {
    await this.driver.run(
      `INSERT INTO budgets (id, category_id, amount_minor, currency, period, start_date, end_date, rollover, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budget.id,
        budget.categoryId,
        budget.amountMinor,
        budget.currency,
        budget.period,
        budget.startDate,
        budget.endDate ?? null,
        budget.rollover ? 1 : 0,
        budget.createdAt,
        budget.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<Budget | null> {
    const row = await this.driver.queryOne<BudgetRow>('SELECT * FROM budgets WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  async findByCategoryId(categoryId: string): Promise<Budget | null> {
    const row = await this.driver.queryOne<BudgetRow>('SELECT * FROM budgets WHERE category_id = ?', [categoryId]);
    return row ? mapRow(row) : null;
  }

  async findAll(): Promise<Budget[]> {
    const rows = await this.driver.query<BudgetRow>('SELECT * FROM budgets ORDER BY created_at DESC');
    return rows.map(mapRow);
  }

  async update(budget: Budget): Promise<void> {
    await this.driver.run(
      `UPDATE budgets SET amount_minor = ?, currency = ?, period = ?, start_date = ?, end_date = ?, rollover = ?, updated_at = ?
       WHERE id = ?`,
      [
        budget.amountMinor,
        budget.currency,
        budget.period,
        budget.startDate,
        budget.endDate ?? null,
        budget.rollover ? 1 : 0,
        budget.updatedAt,
        budget.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM budgets WHERE id = ?', [id]);
  }
}
