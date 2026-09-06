import type { SyncOperation } from '@biyong/schemas';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CreateOperationParams {
  entityType: string;
  entityId: string;
  operationType: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  deviceId: string;
}

export function createSyncOperation(params: CreateOperationParams): SyncOperation {
  return {
    id: generateUUID(),
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
