import type { Investment, Liability } from '@biyong/schemas';
import type { WealthRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface InvestmentRow {
  id: string;
  name: string;
  type: Investment['type'];
  invested_amount_minor: number;
  current_value_minor: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LiabilityRow {
  id: string;
  name: string;
  type: Liability['type'];
  principal_amount_minor: number;
  remaining_amount_minor: number;
  currency: string;
  interest_rate_percent: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteWealthRepository implements WealthRepository {
  constructor(private driver: SqliteDriver) {}

  private mapInvestmentRow(r: InvestmentRow): Investment {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      investedAmountMinor: r.invested_amount_minor,
      currentValueMinor: r.current_value_minor,
      currency: r.currency,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapLiabilityRow(r: LiabilityRow): Liability {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      principalAmountMinor: r.principal_amount_minor,
      remainingAmountMinor: r.remaining_amount_minor,
      currency: r.currency,
      interestRatePercent: r.interest_rate_percent,
      dueDate: r.due_date,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getInvestments(): Promise<Investment[]> {
    const rows = await this.driver.query<InvestmentRow>('SELECT * FROM investments ORDER BY created_at DESC');
    return rows.map((r) => this.mapInvestmentRow(r));
  }

  async findInvestmentById(id: string): Promise<Investment | null> {
    const row = await this.driver.queryOne<InvestmentRow>('SELECT * FROM investments WHERE id = ?', [id]);
    return row ? this.mapInvestmentRow(row) : null;
  }

  async saveInvestment(inv: Investment): Promise<void> {
    const existing = await this.driver.queryOne<InvestmentRow>(
      'SELECT id FROM investments WHERE id = ?',
      [inv.id]
    );

    if (existing) {
      await this.driver.run(
        `UPDATE investments SET name = ?, type = ?, invested_amount_minor = ?, current_value_minor = ?,
         currency = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [
          inv.name,
          inv.type,
          inv.investedAmountMinor,
          inv.currentValueMinor,
          inv.currency,
          inv.notes,
          inv.updatedAt,
          inv.id,
        ]
      );
    } else {
      await this.driver.run(
        `INSERT INTO investments (id, name, type, invested_amount_minor, current_value_minor, currency, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.id,
          inv.name,
          inv.type,
          inv.investedAmountMinor,
          inv.currentValueMinor,
          inv.currency,
          inv.notes,
          inv.createdAt,
          inv.updatedAt,
        ]
      );
    }
  }

  async deleteInvestment(id: string): Promise<void> {
    await this.driver.run('DELETE FROM investments WHERE id = ?', [id]);
  }

  async getLiabilities(): Promise<Liability[]> {
    const rows = await this.driver.query<LiabilityRow>('SELECT * FROM liabilities ORDER BY created_at DESC');
    return rows.map((r) => this.mapLiabilityRow(r));
  }

  async findLiabilityById(id: string): Promise<Liability | null> {
    const row = await this.driver.queryOne<LiabilityRow>('SELECT * FROM liabilities WHERE id = ?', [id]);
    return row ? this.mapLiabilityRow(row) : null;
  }

  async saveLiability(liab: Liability): Promise<void> {
    const existing = await this.driver.queryOne<LiabilityRow>(
      'SELECT id FROM liabilities WHERE id = ?',
      [liab.id]
    );

    if (existing) {
      await this.driver.run(
        `UPDATE liabilities SET name = ?, type = ?, principal_amount_minor = ?, remaining_amount_minor = ?,
         currency = ?, interest_rate_percent = ?, due_date = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [
          liab.name,
          liab.type,
          liab.principalAmountMinor,
          liab.remainingAmountMinor,
          liab.currency,
          liab.interestRatePercent,
          liab.dueDate,
          liab.notes,
          liab.updatedAt,
          liab.id,
        ]
      );
    } else {
      await this.driver.run(
        `INSERT INTO liabilities (id, name, type, principal_amount_minor, remaining_amount_minor, currency, interest_rate_percent, due_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          liab.id,
          liab.name,
          liab.type,
          liab.principalAmountMinor,
          liab.remainingAmountMinor,
          liab.currency,
          liab.interestRatePercent,
          liab.dueDate,
          liab.notes,
          liab.createdAt,
          liab.updatedAt,
        ]
      );
    }
  }

  async deleteLiability(id: string): Promise<void> {
    await this.driver.run('DELETE FROM liabilities WHERE id = ?', [id]);
  }
}
