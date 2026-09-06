import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  SessionUser,
  Group,
  GroupExpense,
  Settlement,
  SyncOperation,
} from '@biyong/schemas';

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null;
}

export class BiyongApiClient {
  constructor(private config: ApiClientConfig) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.config.getToken ? this.config.getToken() : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`API Error [${res.status}]: ${errorBody}`);
    }

    return res.json() as Promise<T>;
  }

  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  // Auth endpoints
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async me(): Promise<SessionUser> {
    return this.request('/auth/me');
  }

  // Sync endpoints
  async pushSyncOperations(operations: SyncOperation[]): Promise<{
    syncedIds: string[];
    rejected: { id: string; reason: string }[];
  }> {
    return this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });
  }

  async pullSyncOperations(sinceCursor?: string): Promise<{
    operations: SyncOperation[];
    nextCursor: string;
  }> {
    const query = sinceCursor ? `?cursor=${encodeURIComponent(sinceCursor)}` : '';
    return this.request(`/sync/pull${query}`);
  }
}
