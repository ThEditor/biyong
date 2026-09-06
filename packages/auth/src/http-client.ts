import type { RegisterRequest, LoginRequest, AuthResponse, SessionUser } from '@biyong/schemas';
import type { AuthClient } from './contracts.js';

export class AuthNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AuthNetworkError';
    Object.setPrototypeOf(this, AuthNetworkError.prototype);
  }
}

export class HttpAuthService implements AuthClient {
  readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(baseUrl: string, customFetch?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchFn = customFetch ?? ((input, init) => fetch(input, init));
  }

  private async parseErrorResponse(res: Response, fallbackMessage: string): Promise<Error> {
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
      return new Error(`${fallbackMessage} (${res.status})`);
    }
  }

  private handleNetworkError(err: unknown, action: string): never {
    const details = err instanceof Error ? err.message : String(err);
    throw new AuthNetworkError(`Network error during ${action}: ${details}`, err);
  }

  async register(req: RegisterRequest): Promise<AuthResponse> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
      });
    } catch (err) {
      this.handleNetworkError(err, 'register');
    }

    if (!res.ok) {
      throw await this.parseErrorResponse(res, 'Registration failed');
    }

    return (await res.json()) as AuthResponse;
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
      });
    } catch (err) {
      this.handleNetworkError(err, 'login');
    }

    if (!res.ok) {
      throw await this.parseErrorResponse(res, 'Login failed');
    }

    return (await res.json()) as AuthResponse;
  }

  async logout(token: string): Promise<void> {
    if (!token) return;

    try {
      await this.fetchFn(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Graceful offline/no-op: local logout proceeds even if server cannot be contacted
    }
  }

  async getCurrentUser(token: string): Promise<SessionUser | null> {
    if (!token) {
      return null;
    }

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      this.handleNetworkError(err, 'getCurrentUser');
    }

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw await this.parseErrorResponse(res, 'Failed to fetch current user');
    }

    return (await res.json()) as SessionUser;
  }
}
