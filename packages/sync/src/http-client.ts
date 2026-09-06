import type { SyncOperation } from '@biyong/schemas';
import type { SyncServerClient } from './engine.js';

export class SyncNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SyncNetworkError';
    Object.setPrototypeOf(this, SyncNetworkError.prototype);
  }
}

export interface HttpSyncClientOptions {
  getAuthToken?: () => string | null;
  customFetch?: typeof fetch;
  throwOnOffline?: boolean;
}

export class HttpSyncServerClient implements SyncServerClient {
  readonly baseUrl: string;
  private readonly getAuthToken?: () => string | null;
  private readonly fetchFn: typeof fetch;
  private readonly throwOnOffline: boolean;

  constructor(
    baseUrl: string,
    getAuthTokenOrOptions?: (() => string | null) | HttpSyncClientOptions,
    customFetch?: typeof fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');

    if (typeof getAuthTokenOrOptions === 'function') {
      this.getAuthToken = getAuthTokenOrOptions;
      this.fetchFn = customFetch ?? ((input, init) => fetch(input, init));
      this.throwOnOffline = false;
    } else if (getAuthTokenOrOptions && typeof getAuthTokenOrOptions === 'object') {
      this.getAuthToken = getAuthTokenOrOptions.getAuthToken;
      this.fetchFn = getAuthTokenOrOptions.customFetch ?? customFetch ?? ((input, init) => fetch(input, init));
      this.throwOnOffline = getAuthTokenOrOptions.throwOnOffline ?? false;
    } else {
      this.getAuthToken = undefined;
      this.fetchFn = customFetch ?? ((input, init) => fetch(input, init));
      this.throwOnOffline = false;
    }
  }

  private async parseErrorResponse(res: Response, defaultMessage: string): Promise<Error> {
    try {
      const data = await res.json();
      if (data && typeof data === 'object') {
        if ('error' in data && typeof data.error === 'string') {
          return new Error(data.error);
        }
        if ('message' in data && typeof data.message === 'string') {
          return new Error(data.message);
        }
      }
      return new Error(JSON.stringify(data));
    } catch {
      try {
        const text = await res.text();
        if (text) return new Error(text);
      } catch {
        // ignore
      }
      return new Error(`${defaultMessage} (${res.status})`);
    }
  }

  async pushOperations(ops: SyncOperation[]): Promise<{
    syncedIds: string[];
    rejected: { id: string; reason: string }[];
  }> {
    if (ops.length === 0) {
      return { syncedIds: [], rejected: [] };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ operations: ops }),
      });
    } catch (err) {
      if (this.throwOnOffline) {
        throw new SyncNetworkError(
          `Network unreachable during sync push: ${err instanceof Error ? err.message : String(err)}`,
          err
        );
      }
      return { syncedIds: [], rejected: [] };
    }

    if (!res.ok) {
      throw await this.parseErrorResponse(res, 'Push operations failed');
    }

    const data = (await res.json()) as {
      syncedIds?: string[];
      rejected?: { id: string; reason: string }[];
    };

    return {
      syncedIds: Array.isArray(data.syncedIds) ? data.syncedIds : [],
      rejected: Array.isArray(data.rejected) ? data.rejected : [],
    };
  }

  async pullOperations(sinceCursor?: string): Promise<{
    operations: SyncOperation[];
    nextCursor: string;
  }> {
    const query = sinceCursor ? `?cursor=${encodeURIComponent(sinceCursor)}` : '';
    const url = `${this.baseUrl}/sync/pull${query}`;

    const headers: Record<string, string> = {};
    const token = this.getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: 'GET',
        headers,
      });
    } catch (err) {
      if (this.throwOnOffline) {
        throw new SyncNetworkError(
          `Network unreachable during sync pull: ${err instanceof Error ? err.message : String(err)}`,
          err
        );
      }
      return {
        operations: [],
        nextCursor: sinceCursor || '',
      };
    }

    if (!res.ok) {
      throw await this.parseErrorResponse(res, 'Pull operations failed');
    }

    const data = (await res.json()) as {
      operations?: SyncOperation[];
      nextCursor?: string;
    };

    return {
      operations: Array.isArray(data.operations) ? data.operations : [],
      nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : (sinceCursor || ''),
    };
  }
}
