import type { SyncOperation } from '@biyong/schemas';
import type { SqliteOutboxRepository } from '@biyong/local-db';

export interface SyncServerClient {
  pushOperations(ops: SyncOperation[]): Promise<{
    syncedIds: string[];
    rejected: { id: string; reason: string }[];
  }>;
  pullOperations(sinceCursor?: string): Promise<{
    operations: SyncOperation[];
    nextCursor: string;
  }>;
}

export class SyncEngine {
  constructor(
    private outboxRepo: SqliteOutboxRepository,
    private serverClient: SyncServerClient
  ) {}

  async synchronize(): Promise<{ syncedCount: number; rejectedCount: number }> {
    const pendingOps = await this.outboxRepo.getPending();
    if (pendingOps.length === 0) {
      return { syncedCount: 0, rejectedCount: 0 };
    }

    const response = await this.serverClient.pushOperations(pendingOps);

    for (const id of response.syncedIds) {
      await this.outboxRepo.markSynced(id);
    }

    for (const rej of response.rejected) {
      await this.outboxRepo.markRejected(rej.id, rej.reason);
    }

    return {
      syncedCount: response.syncedIds.length,
      rejectedCount: response.rejected.length,
    };
  }
}
