import type { SyncOperation } from '@biyong/schemas';
import type { SqliteOutboxRepository, SqliteSyncStateRepository } from '@biyong/local-db';
import { applyRemoteOperation, type SyncLocalRepositories } from './applier.js';

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

export interface SyncResult {
  syncedCount: number;
  pushedCount: number;
  pulledCount: number;
  rejectedCount: number;
  cursor: string | null;
}

export class SyncEngine {
  constructor(
    private outboxRepo: SqliteOutboxRepository,
    private serverClient: SyncServerClient,
    private syncStateRepo?: SqliteSyncStateRepository,
    private localDeviceId?: string,
    private localRepositories?: SyncLocalRepositories
  ) {}

  async push(): Promise<{ syncedCount: number; pushedCount: number; rejectedCount: number }> {
    const pendingOps = await this.outboxRepo.getPending();
    if (pendingOps.length === 0) {
      return { syncedCount: 0, pushedCount: 0, rejectedCount: 0 };
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
      pushedCount: response.syncedIds.length,
      rejectedCount: response.rejected.length,
    };
  }

  async pull(): Promise<{ pulledCount: number; nextCursor: string }> {
    const currentCursor = this.syncStateRepo
      ? (await this.syncStateRepo.getCursor()) ?? undefined
      : undefined;

    const response = await this.serverClient.pullOperations(currentCursor);
    let appliedCount = 0;

    for (const op of response.operations) {
      // Avoid re-applying operations originated by this device
      if (this.localDeviceId && op.deviceId === this.localDeviceId) {
        continue;
      }

      if (this.localRepositories) {
        await applyRemoteOperation(op, this.localRepositories);
        appliedCount++;
      }
    }

    if (this.syncStateRepo && response.nextCursor) {
      await this.syncStateRepo.setCursor(response.nextCursor);
    }

    return {
      pulledCount: appliedCount,
      nextCursor: response.nextCursor,
    };
  }

  async synchronize(): Promise<SyncResult> {
    const pushRes = await this.push();
    const pullRes = await this.pull();

    const cursor = this.syncStateRepo ? await this.syncStateRepo.getCursor() : pullRes.nextCursor;

    return {
      syncedCount: pushRes.syncedCount,
      pushedCount: pushRes.pushedCount,
      pulledCount: pullRes.pulledCount,
      rejectedCount: pushRes.rejectedCount,
      cursor,
    };
  }
}
