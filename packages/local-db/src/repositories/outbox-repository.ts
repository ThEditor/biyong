import type { SyncOperation } from '@biyong/schemas';
import type { SqliteDriver } from '../driver.js';

interface OutboxRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation_type: SyncOperation['operationType'];
  payload_json: string;
  timestamp: string;
  device_id: string;
  status: SyncOperation['status'];
  rejection_reason: string | null;
}

export class SqliteOutboxRepository {
  constructor(private driver: SqliteDriver) {}

  async enqueue(op: SyncOperation): Promise<void> {
    await this.driver.run(
      `INSERT INTO outbox_operations (id, entity_type, entity_id, operation_type, payload_json, timestamp, device_id, status, rejection_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        op.id,
        op.entityType,
        op.entityId,
        op.operationType,
        JSON.stringify(op.payload),
        op.timestamp,
        op.deviceId,
        op.status,
        op.rejectionReason,
      ]
    );
  }

  async getPending(): Promise<SyncOperation[]> {
    const rows = await this.driver.query<OutboxRow>(
      "SELECT * FROM outbox_operations WHERE status = 'pending' ORDER BY timestamp ASC"
    );
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      operationType: r.operation_type,
      payload: JSON.parse(r.payload_json),
      timestamp: r.timestamp,
      deviceId: r.device_id,
      status: r.status,
      rejectionReason: r.rejection_reason,
    }));
  }

  async markSynced(id: string): Promise<void> {
    await this.driver.run("UPDATE outbox_operations SET status = 'synced' WHERE id = ?", [id]);
  }

  async markRejected(id: string, reason: string): Promise<void> {
    await this.driver.run(
      "UPDATE outbox_operations SET status = 'rejected', rejection_reason = ? WHERE id = ?",
      [reason, id]
    );
  }
}
