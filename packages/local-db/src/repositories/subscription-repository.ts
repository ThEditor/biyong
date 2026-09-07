import type { SubscriptionItem } from '@biyong/schemas';
import type { SubscriptionRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface SubscriptionRow {
  id: string;
  name: string;
  category: string;
  amount_minor: number;
  cadence: SubscriptionItem['cadence'];
  next_billing_date: string;
  is_auto_detected: number;
  status: SubscriptionItem['status'];
  created_at: string;
  updated_at: string;
}

function mapSubRow(r: SubscriptionRow): SubscriptionItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    amountMinor: r.amount_minor,
    cadence: r.cadence,
    nextBillingDate: r.next_billing_date,
    isAutoDetected: Boolean(r.is_auto_detected),
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SqliteSubscriptionRepository implements SubscriptionRepository {
  constructor(private driver: SqliteDriver) {}

  async create(sub: SubscriptionItem): Promise<void> {
    await this.driver.run(
      `INSERT INTO subscriptions (
        id, name, category, amount_minor, cadence, next_billing_date,
        is_auto_detected, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sub.id,
        sub.name,
        sub.category,
        sub.amountMinor,
        sub.cadence,
        sub.nextBillingDate,
        sub.isAutoDetected ? 1 : 0,
        sub.status,
        sub.createdAt,
        sub.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<SubscriptionItem | null> {
    const row = await this.driver.queryOne<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE id = ?',
      [id]
    );
    return row ? mapSubRow(row) : null;
  }

  async findAll(): Promise<SubscriptionItem[]> {
    const rows = await this.driver.query<SubscriptionRow>(
      'SELECT * FROM subscriptions ORDER BY next_billing_date ASC, created_at DESC'
    );
    return rows.map(mapSubRow);
  }

  async findByStatus(status: SubscriptionItem['status']): Promise<SubscriptionItem[]> {
    const rows = await this.driver.query<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE status = ? ORDER BY next_billing_date ASC, created_at DESC',
      [status]
    );
    return rows.map(mapSubRow);
  }

  async update(sub: SubscriptionItem): Promise<void> {
    await this.driver.run(
      `UPDATE subscriptions SET
        name = ?, category = ?, amount_minor = ?, cadence = ?,
        next_billing_date = ?, is_auto_detected = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        sub.name,
        sub.category,
        sub.amountMinor,
        sub.cadence,
        sub.nextBillingDate,
        sub.isAutoDetected ? 1 : 0,
        sub.status,
        sub.updatedAt,
        sub.id,
      ]
    );
  }

  async save(subscription: SubscriptionItem): Promise<void> {
    const existing = await this.findById(subscription.id);
    if (existing) {
      await this.update(subscription);
    } else {
      await this.create(subscription);
    }
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM subscriptions WHERE id = ?', [id]);
  }
}
