import type { ReceiptAttachment } from '@biyong/schemas';
import type { ReceiptRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface ReceiptRow {
  id: string;
  transaction_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_uri: string;
  uploaded_at: string;
}

function mapReceiptRow(r: ReceiptRow): ReceiptAttachment {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    fileName: r.file_name,
    fileType: r.file_type,
    fileSizeBytes: r.file_size_bytes,
    storageUri: r.storage_uri,
    uploadedAt: r.uploaded_at,
  };
}

export class SqliteReceiptRepository implements ReceiptRepository {
  constructor(private driver: SqliteDriver) {}

  async save(receipt: ReceiptAttachment): Promise<void> {
    const existing = await this.driver.queryOne<ReceiptRow>(
      'SELECT id FROM receipt_attachments WHERE id = ?',
      [receipt.id]
    );

    if (existing) {
      await this.driver.run(
        `UPDATE receipt_attachments SET
          transaction_id = ?, file_name = ?, file_type = ?,
          file_size_bytes = ?, storage_uri = ?, uploaded_at = ?
         WHERE id = ?`,
        [
          receipt.transactionId,
          receipt.fileName,
          receipt.fileType,
          receipt.fileSizeBytes,
          receipt.storageUri,
          receipt.uploadedAt,
          receipt.id,
        ]
      );
    } else {
      await this.driver.run(
        `INSERT INTO receipt_attachments (
          id, transaction_id, file_name, file_type, file_size_bytes, storage_uri, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          receipt.id,
          receipt.transactionId,
          receipt.fileName,
          receipt.fileType,
          receipt.fileSizeBytes,
          receipt.storageUri,
          receipt.uploadedAt,
        ]
      );
    }
  }

  async create(receipt: ReceiptAttachment): Promise<void> {
    await this.save(receipt);
  }

  async findById(id: string): Promise<ReceiptAttachment | null> {
    const row = await this.driver.queryOne<ReceiptRow>(
      'SELECT * FROM receipt_attachments WHERE id = ?',
      [id]
    );
    return row ? mapReceiptRow(row) : null;
  }

  async findByTransactionId(transactionId: string): Promise<ReceiptAttachment[]> {
    const rows = await this.driver.query<ReceiptRow>(
      'SELECT * FROM receipt_attachments WHERE transaction_id = ? ORDER BY uploaded_at DESC',
      [transactionId]
    );
    return rows.map(mapReceiptRow);
  }

  async findAll(): Promise<ReceiptAttachment[]> {
    const rows = await this.driver.query<ReceiptRow>(
      'SELECT * FROM receipt_attachments ORDER BY uploaded_at DESC'
    );
    return rows.map(mapReceiptRow);
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM receipt_attachments WHERE id = ?', [id]);
  }
}
