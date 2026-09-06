import { randomUUID } from 'node:crypto';
import type { SyncOperation } from '@biyong/schemas';

export interface CreateOperationParams {
  entityType: string;
  entityId: string;
  operationType: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  deviceId: string;
}

export function createSyncOperation(params: CreateOperationParams): SyncOperation {
  return {
    id: randomUUID(),
    entityType: params.entityType,
    entityId: params.entityId,
    operationType: params.operationType,
    payload: params.payload,
    timestamp: new Date().toISOString(),
    deviceId: params.deviceId,
    status: 'pending',
    rejectionReason: null,
  };
}
