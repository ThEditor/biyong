import type { Goal } from '@biyong/schemas';
import type { GoalRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface GoalRow {
  id: string;
  title: string;
  target_amount_minor: number;
  current_amount_minor: number;
  currency: string;
  target_date: string;
  created_at: string;
  updated_at: string;
}

function mapRow(r: GoalRow): Goal {
  return {
    id: r.id,
    title: r.title,
    targetAmountMinor: r.target_amount_minor,
    currentAmountMinor: r.current_amount_minor,
    currency: r.currency,
    targetDate: r.target_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SqliteGoalRepository implements GoalRepository {
  constructor(private driver: SqliteDriver) {}

  async create(goal: Goal): Promise<void> {
    await this.driver.run(
      `INSERT INTO goals (id, title, target_amount_minor, current_amount_minor, currency, target_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goal.id,
        goal.title,
        goal.targetAmountMinor,
        goal.currentAmountMinor,
        goal.currency,
        goal.targetDate,
        goal.createdAt,
        goal.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<Goal | null> {
    const row = await this.driver.queryOne<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  async findAll(): Promise<Goal[]> {
    const rows = await this.driver.query<GoalRow>('SELECT * FROM goals ORDER BY target_date ASC');
    return rows.map(mapRow);
  }

  async update(goal: Goal): Promise<void> {
    await this.driver.run(
      `UPDATE goals SET title = ?, target_amount_minor = ?, current_amount_minor = ?, currency = ?, target_date = ?, updated_at = ?
       WHERE id = ?`,
      [
        goal.title,
        goal.targetAmountMinor,
        goal.currentAmountMinor,
        goal.currency,
        goal.targetDate,
        goal.updatedAt,
        goal.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM goals WHERE id = ?', [id]);
  }
}
