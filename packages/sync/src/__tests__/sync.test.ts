import { describe, it, expect } from 'vitest';
import { createSyncOperation, SyncEngine, type SyncServerClient } from '../index.js';
import { runMigrations, SqliteOutboxRepository } from '@biyong/local-db';
import { MemorySqliteDriver } from '@biyong/local-db/memory';

describe('Sync: Operations & Engine', () => {
  it('creates valid atomic sync operation', () => {
    const op = createSyncOperation({
      entityType: 'account',
      entityId: 'acc-1',
      operationType: 'create',
      payload: { name: 'Savings' },
      deviceId: 'mobile-1',
    });

    expect(op.id).toBeDefined();
    expect(op.entityType).toBe('account');
    expect(op.status).toBe('pending');
  });

  it('synchronizes outbox with server client', async () => {
    const driver = new MemorySqliteDriver();
    await driver.init();
    await runMigrations(driver);
    const outboxRepo = new SqliteOutboxRepository(driver);

    const op = createSyncOperation({
      entityType: 'expense',
      entityId: 'exp-1',
      operationType: 'create',
      payload: { amountMinor: 1000 },
      deviceId: 'device-1',
    });
    await outboxRepo.enqueue(op);

    const mockServerClient: SyncServerClient = {
      async pushOperations(ops) {
        return {
          syncedIds: ops.map((o) => o.id),
          rejected: [],
        };
      },
      async pullOperations() {
        return { operations: [], nextCursor: '2026-09-06T00:00:00.000Z' };
      },
    };

    const engine = new SyncEngine(outboxRepo, mockServerClient);
    const result = await engine.synchronize();

    expect(result.syncedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);

    const remaining = await outboxRepo.getPending();
    expect(remaining).toHaveLength(0);
  });
});
