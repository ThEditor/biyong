import type { ReimbursementClaim } from '@biyong/schemas';
import type { ReimbursementRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface ReimbursementClaimRow {
  id: string;
  title: string;
  category: ReimbursementClaim['category'];
  amount_minor: number;
  currency: string;
  transaction_id: string | null;
  status: ReimbursementClaim['status'];
  submitted_date: string;
  settled_date: string | null;
  notes: string | null;
  receipt_uri: string | null;
  created_at: string;
  updated_at: string;
}

function mapClaimRow(r: ReimbursementClaimRow): ReimbursementClaim {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    amountMinor: r.amount_minor,
    currency: r.currency,
    transactionId: r.transaction_id,
    status: r.status,
    submittedDate: r.submitted_date,
    settledDate: r.settled_date,
    notes: r.notes,
    receiptUri: r.receipt_uri,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SqliteReimbursementRepository implements ReimbursementRepository {
  constructor(private driver: SqliteDriver) {}

  async create(claim: ReimbursementClaim): Promise<void> {
    await this.driver.run(
      `INSERT INTO reimbursement_claims (
        id, title, category, amount_minor, currency, transaction_id,
        status, submitted_date, settled_date, notes, receipt_uri, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        claim.id,
        claim.title,
        claim.category,
        claim.amountMinor,
        claim.currency,
        claim.transactionId ?? null,
        claim.status,
        claim.submittedDate,
        claim.settledDate ?? null,
        claim.notes ?? null,
        claim.receiptUri ?? null,
        claim.createdAt,
        claim.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<ReimbursementClaim | null> {
    const row = await this.driver.queryOne<ReimbursementClaimRow>(
      'SELECT * FROM reimbursement_claims WHERE id = ?',
      [id]
    );
    return row ? mapClaimRow(row) : null;
  }

  async findByTransactionId(transactionId: string): Promise<ReimbursementClaim | null> {
    const row = await this.driver.queryOne<ReimbursementClaimRow>(
      'SELECT * FROM reimbursement_claims WHERE transaction_id = ?',
      [transactionId]
    );
    return row ? mapClaimRow(row) : null;
  }

  async findAll(): Promise<ReimbursementClaim[]> {
    const rows = await this.driver.query<ReimbursementClaimRow>(
      'SELECT * FROM reimbursement_claims ORDER BY submitted_date DESC, created_at DESC'
    );
    return rows.map(mapClaimRow);
  }

  async findByStatus(status: ReimbursementClaim['status']): Promise<ReimbursementClaim[]> {
    const rows = await this.driver.query<ReimbursementClaimRow>(
      'SELECT * FROM reimbursement_claims WHERE status = ? ORDER BY submitted_date DESC, created_at DESC',
      [status]
    );
    return rows.map(mapClaimRow);
  }

  async update(claim: ReimbursementClaim): Promise<void> {
    await this.driver.run(
      `UPDATE reimbursement_claims SET
        title = ?, category = ?, amount_minor = ?, currency = ?, transaction_id = ?,
        status = ?, submitted_date = ?, settled_date = ?, notes = ?, receipt_uri = ?, updated_at = ?
       WHERE id = ?`,
      [
        claim.title,
        claim.category,
        claim.amountMinor,
        claim.currency,
        claim.transactionId ?? null,
        claim.status,
        claim.submittedDate,
        claim.settledDate ?? null,
        claim.notes ?? null,
        claim.receiptUri ?? null,
        claim.updatedAt,
        claim.id,
      ]
    );
  }

  async save(claim: ReimbursementClaim): Promise<void> {
    const existing = await this.findById(claim.id);
    if (existing) {
      await this.update(claim);
    } else {
      await this.create(claim);
    }
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM reimbursement_claims WHERE id = ?', [id]);
  }
}
