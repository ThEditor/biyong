import type { PeerDebt, PeerDebtRepayment } from '@biyong/schemas';
import type { PeerDebtRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface PeerDebtRow {
  id: string;
  person_name: string;
  type: PeerDebt['type'];
  original_amount_minor: number;
  remaining_amount_minor: number;
  currency: string;
  date: string;
  due_date: string | null;
  notes: string | null;
  status: PeerDebt['status'];
  created_at: string;
  updated_at: string;
}

interface PeerDebtRepaymentRow {
  id: string;
  debt_id: string;
  amount_minor: number;
  date: string;
  notes: string | null;
  created_at: string;
}

function mapDebtRow(r: PeerDebtRow): PeerDebt {
  return {
    id: r.id,
    personName: r.person_name,
    type: r.type,
    originalAmountMinor: r.original_amount_minor,
    remainingAmountMinor: r.remaining_amount_minor,
    currency: r.currency,
    date: r.date,
    dueDate: r.due_date,
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRepaymentRow(r: PeerDebtRepaymentRow): PeerDebtRepayment {
  return {
    id: r.id,
    debtId: r.debt_id,
    amountMinor: r.amount_minor,
    date: r.date,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export class SqlitePeerDebtRepository implements PeerDebtRepository {
  constructor(private driver: SqliteDriver) {}

  async create(debt: PeerDebt): Promise<void> {
    await this.driver.run(
      `INSERT INTO peer_debts (
        id, person_name, type, original_amount_minor, remaining_amount_minor,
        currency, date, due_date, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        debt.id,
        debt.personName,
        debt.type,
        debt.originalAmountMinor,
        debt.remainingAmountMinor,
        debt.currency,
        debt.date,
        debt.dueDate ?? null,
        debt.notes ?? null,
        debt.status,
        debt.createdAt,
        debt.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<PeerDebt | null> {
    const row = await this.driver.queryOne<PeerDebtRow>(
      'SELECT * FROM peer_debts WHERE id = ?',
      [id]
    );
    return row ? mapDebtRow(row) : null;
  }

  async findAll(): Promise<PeerDebt[]> {
    const rows = await this.driver.query<PeerDebtRow>(
      'SELECT * FROM peer_debts ORDER BY date DESC, created_at DESC'
    );
    return rows.map(mapDebtRow);
  }

  async findByStatus(status: PeerDebt['status']): Promise<PeerDebt[]> {
    const rows = await this.driver.query<PeerDebtRow>(
      'SELECT * FROM peer_debts WHERE status = ? ORDER BY date DESC, created_at DESC',
      [status]
    );
    return rows.map(mapDebtRow);
  }

  async update(debt: PeerDebt): Promise<void> {
    await this.driver.run(
      `UPDATE peer_debts SET
        person_name = ?, type = ?, original_amount_minor = ?, remaining_amount_minor = ?,
        currency = ?, date = ?, due_date = ?, notes = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        debt.personName,
        debt.type,
        debt.originalAmountMinor,
        debt.remainingAmountMinor,
        debt.currency,
        debt.date,
        debt.dueDate ?? null,
        debt.notes ?? null,
        debt.status,
        debt.updatedAt,
        debt.id,
      ]
    );
  }

  async save(debt: PeerDebt): Promise<void> {
    const existing = await this.findById(debt.id);
    if (existing) {
      await this.update(debt);
    } else {
      await this.create(debt);
    }
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM peer_debt_repayments WHERE debt_id = ?', [id]);
    await this.driver.run('DELETE FROM peer_debts WHERE id = ?', [id]);
  }

  async addRepayment(repayment: PeerDebtRepayment): Promise<void> {
    await this.driver.run(
      `INSERT INTO peer_debt_repayments (id, debt_id, amount_minor, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        repayment.id,
        repayment.debtId,
        repayment.amountMinor,
        repayment.date,
        repayment.notes ?? null,
        repayment.createdAt,
      ]
    );
  }

  async getRepayments(debtId: string): Promise<PeerDebtRepayment[]> {
    const rows = await this.driver.query<PeerDebtRepaymentRow>(
      'SELECT * FROM peer_debt_repayments WHERE debt_id = ? ORDER BY date DESC, created_at DESC',
      [debtId]
    );
    return rows.map(mapRepaymentRow);
  }

  async getAllRepayments(): Promise<PeerDebtRepayment[]> {
    const rows = await this.driver.query<PeerDebtRepaymentRow>(
      'SELECT * FROM peer_debt_repayments ORDER BY date DESC, created_at DESC'
    );
    return rows.map(mapRepaymentRow);
  }

  async deleteRepayment(id: string): Promise<void> {
    await this.driver.run('DELETE FROM peer_debt_repayments WHERE id = ?', [id]);
  }
}
