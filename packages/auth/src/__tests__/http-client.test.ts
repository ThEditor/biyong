import { describe, it, expect, vi } from 'vitest';
import { HttpAuthService, AuthNetworkError } from '../index.js';

describe('HttpAuthService', () => {
  const baseUrl = 'http://localhost:3000/api';

  it('normalizes base URL by stripping trailing slashes', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.com', name: 'A' }, token: 'tok_1', expiresAt: '2026-10-01' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const client = new HttpAuthService('http://localhost:3000/api///', mockFetch as unknown as typeof fetch);
    await client.login({ email: 'a@b.com', password: 'password123' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
  });

  describe('register', () => {
    it('successfully registers a user', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { id: 'u123', email: 'test@example.com', name: 'Test User' },
            token: 'tok_abc',
            expiresAt: '2026-10-07T00:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      const res = await client.register({
        email: 'test@example.com',
        password: 'securePassword1',
        name: 'Test User',
      });

      expect(res.user.id).toBe('u123');
      expect(res.token).toBe('tok_abc');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'securePassword1',
            name: 'Test User',
          }),
        })
      );
    });

    it('throws descriptive error on server error (e.g. 409 conflict)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'User already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(
        client.register({
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing',
        })
      ).rejects.toThrow('User already exists');
    });

    it('gracefully handles offline/network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(
        client.register({
          email: 'offline@example.com',
          password: 'password123',
          name: 'Offline',
        })
      ).rejects.toThrow(AuthNetworkError);

      await expect(
        client.register({
          email: 'offline@example.com',
          password: 'password123',
          name: 'Offline',
        })
      ).rejects.toThrow(/Network error during register: Failed to fetch/);
    });
  });

  describe('login', () => {
    it('successfully logs in a user', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { id: 'u456', email: 'login@example.com', name: 'Login User' },
            token: 'tok_login',
            expiresAt: '2026-10-07T00:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      const res = await client.login({
        email: 'login@example.com',
        password: 'securePassword1',
      });

      expect(res.user.email).toBe('login@example.com');
      expect(res.token).toBe('tok_login');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'login@example.com',
            password: 'securePassword1',
          }),
        })
      );
    });

    it('throws error when login fails (e.g. 401 Invalid credentials)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(
        client.login({
          email: 'bad@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('gracefully handles offline/network error during login', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(
        client.login({
          email: 'bad@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(AuthNetworkError);
    });
  });

  describe('logout', () => {
    it('calls logout endpoint with bearer token', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await client.logout('tok_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok_123',
          },
        })
      );
    });

    it('handles offline/network failure gracefully without throwing', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(client.logout('tok_123')).resolves.toBeUndefined();
    });

    it('is a no-op when token is empty', async () => {
      const mockFetch = vi.fn();
      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await client.logout('');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns SessionUser when authenticated', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'u789', email: 'user@example.com', name: 'Current User' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      const user = await client.getCurrentUser('tok_valid');

      expect(user).toEqual({ id: 'u789', email: 'user@example.com', name: 'Current User' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/me',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer tok_valid' },
        })
      );
    });

    it('returns null if token is empty', async () => {
      const mockFetch = vi.fn();
      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      const user = await client.getCurrentUser('');
      expect(user).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null on 401 Unauthorized or 404 Not Found', async () => {
      const mockFetch401 = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
      const client401 = new HttpAuthService(baseUrl, mockFetch401 as unknown as typeof fetch);
      expect(await client401.getCurrentUser('tok_invalid')).toBeNull();

      const mockFetch404 = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
      const client404 = new HttpAuthService(baseUrl, mockFetch404 as unknown as typeof fetch);
      expect(await client404.getCurrentUser('tok_invalid')).toBeNull();
    });

    it('throws error on 500 server response', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 })
      );

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(client.getCurrentUser('tok_valid')).rejects.toThrow('Internal Server Error');
    });

    it('throws AuthNetworkError on offline/network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new HttpAuthService(baseUrl, mockFetch as unknown as typeof fetch);
      await expect(client.getCurrentUser('tok_valid')).rejects.toThrow(AuthNetworkError);
    });
  });
});
