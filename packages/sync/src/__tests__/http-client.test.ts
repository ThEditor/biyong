import { describe, it, expect, vi } from 'vitest';
import {
  HttpSyncServerClient,
  SyncNetworkError,
  createSyncOperation,
  SyncEngine,
} from '../index.js';
import { runMigrations, SqliteOutboxRepository } from '@biyong/local-db';
import { MemorySqliteDriver } from '@biyong/local-db/memory';
import type { SyncOperation } from '@biyong/schemas';

describe('HttpSyncServerClient', () => {
  const baseUrl = 'https://api.biyong.app/v1';

  const sampleOp: SyncOperation = createSyncOperation({
    entityType: 'expense',
    entityId: 'exp-123',
    operationType: 'create',
    payload: { amountMinor: 5000, description: 'Lunch' },
    deviceId: 'device-1',
  });

  describe('constructor & URL normalization', () => {
    it('normalizes trailing slashes on baseUrl', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ syncedIds: ['exp-123'], rejected: [] }), { status: 200 })
      );

      const client = new HttpSyncServerClient('https://api.biyong.app/v1///', () => 'tok_test', mockFetch as unknown as typeof fetch);
      await client.pushOperations([sampleOp]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.biyong.app/v1/sync/push',
        expect.anything()
      );
    });

    it('attaches Authorization header when getAuthToken returns a token', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ operations: [], nextCursor: 'c1' }), { status: 200 })
      );

      const client = new HttpSyncServerClient(
        baseUrl,
        () => 'secret-jwt-token',
        mockFetch as unknown as typeof fetch
      );
      await client.pullOperations();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.biyong.app/v1/sync/pull',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-jwt-token',
          }),
        })
      );
    });

    it('omits Authorization header when token is null or undefined', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ operations: [], nextCursor: 'c1' }), { status: 200 })
      );

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      await client.pullOperations();

      const call = mockFetch.mock.calls[0];
      const headers = (call?.[1]?.headers ?? {}) as Record<string, string>;
      expect(headers?.Authorization).toBeUndefined();
    });
  });

  describe('pushOperations', () => {
    it('returns empty results immediately when ops array is empty without calling fetch', async () => {
      const mockFetch = vi.fn();
      const client = new HttpSyncServerClient(baseUrl, () => null, mockFetch as unknown as typeof fetch);

      const result = await client.pushOperations([]);

      expect(result).toEqual({ syncedIds: [], rejected: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('successfully pushes operations to server', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            syncedIds: [sampleOp.id],
            rejected: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new HttpSyncServerClient(baseUrl, () => 'token_123', mockFetch as unknown as typeof fetch);
      const res = await client.pushOperations([sampleOp]);

      expect(res.syncedIds).toEqual([sampleOp.id]);
      expect(res.rejected).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.biyong.app/v1/sync/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token_123',
          }),
          body: JSON.stringify({ operations: [sampleOp] }),
        })
      );
    });

    it('handles rejected operations from server', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            syncedIds: [],
            rejected: [{ id: sampleOp.id, reason: 'Conflict detected' }],
          }),
          { status: 200 }
        )
      );

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      const res = await client.pushOperations([sampleOp]);

      expect(res.syncedIds).toEqual([]);
      expect(res.rejected).toEqual([{ id: sampleOp.id, reason: 'Conflict detected' }]);
    });

    it('returns empty arrays when offline / network is unreachable by default', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      const res = await client.pushOperations([sampleOp]);

      expect(res).toEqual({ syncedIds: [], rejected: [] });
    });

    it('throws SyncNetworkError when throwOnOffline option is enabled', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new HttpSyncServerClient(baseUrl, {
        customFetch: mockFetch as unknown as typeof fetch,
        throwOnOffline: true,
      });

      await expect(client.pushOperations([sampleOp])).rejects.toThrow(SyncNetworkError);
    });

    it('throws error when server responds with 400 Bad Request or 500 Error', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid schema' }), { status: 400 })
      );

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      await expect(client.pushOperations([sampleOp])).rejects.toThrow('Invalid schema');
    });
  });

  describe('pullOperations', () => {
    it('pulls operations without cursor', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            operations: [sampleOp],
            nextCursor: '2026-09-07T00:00:00.000Z',
          }),
          { status: 200 }
        )
      );

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      const res = await client.pullOperations();

      expect(res.operations).toHaveLength(1);
      expect(res.nextCursor).toBe('2026-09-07T00:00:00.000Z');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.biyong.app/v1/sync/pull',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('pulls operations with encoded cursor', async () => {
      const cursor = '2026-09-07T00:00:00.000Z';
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            operations: [],
            nextCursor: cursor,
          }),
          { status: 200 }
        )
      );

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      await client.pullOperations(cursor);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.biyong.app/v1/sync/pull?cursor=${encodeURIComponent(cursor)}`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('gracefully handles offline network error and returns empty operations with cursor', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network offline'));

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      const res = await client.pullOperations('cursor-abc');

      expect(res).toEqual({ operations: [], nextCursor: 'cursor-abc' });

      const resNoCursor = await client.pullOperations();
      expect(resNoCursor).toEqual({ operations: [], nextCursor: '' });
    });

    it('throws SyncNetworkError when throwOnOffline option is enabled for pull', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network offline'));

      const client = new HttpSyncServerClient(baseUrl, {
        customFetch: mockFetch as unknown as typeof fetch,
        throwOnOffline: true,
      });

      await expect(client.pullOperations()).rejects.toThrow(SyncNetworkError);
    });

    it('throws error on non-ok HTTP status', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized request' }), { status: 401 })
      );

      const client = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);
      await expect(client.pullOperations()).rejects.toThrow('Unauthorized request');
    });
  });

  describe('Integration with SyncEngine offline handling', () => {
    it('leaves outbox items pending when offline during sync', async () => {
      const driver = new MemorySqliteDriver();
      await driver.init();
      await runMigrations(driver);
      const outboxRepo = new SqliteOutboxRepository(driver);

      await outboxRepo.enqueue(sampleOp);

      // Simulate offline fetch
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('No internet connection'));
      const httpClient = new HttpSyncServerClient(baseUrl, undefined, mockFetch as unknown as typeof fetch);

      const engine = new SyncEngine(outboxRepo, httpClient);
      const result = await engine.synchronize();

      expect(result.syncedCount).toBe(0);
      expect(result.rejectedCount).toBe(0);

      // Verify the operation is still pending in the outbox
      const pending = await outboxRepo.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(sampleOp.id);
    });
  });
});
