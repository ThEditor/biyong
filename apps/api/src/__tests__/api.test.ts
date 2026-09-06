import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('API: Hono Modular Monolith', () => {
  const app = createApp();

  it('responds to /health with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; service: string };
    expect(json.status).toBe('ok');
    expect(json.service).toBe('biyong-api');
  });

  it('registers and authenticates a new user', async () => {
    const registerRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@biyong.app',
        password: 'Password123!',
        name: 'Test User',
      }),
    });

    expect(registerRes.status).toBe(200);
    const regData = (await registerRes.json()) as { token: string; user: { email: string; name: string } };
    expect(regData.token).toBeDefined();
    expect(regData.user.email).toBe('test@biyong.app');

    // Login with same credentials
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@biyong.app',
        password: 'Password123!',
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = (await loginRes.json()) as { user: { name: string } };
    expect(loginData.user.name).toBe('Test User');
  });

  it('handles sync push idempotently', async () => {
    const operation = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      entityType: 'expense',
      entityId: 'exp-123',
      operationType: 'create',
      payload: { amountMinor: 5000 },
      timestamp: new Date().toISOString(),
      deviceId: 'mobile-dev-1',
      status: 'pending',
    };

    // First push
    const res1 = await app.request('/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: [operation] }),
    });
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as { syncedIds: string[] };
    expect(data1.syncedIds).toContain(operation.id);

    // Second push with the SAME operation ID (idempotency test)
    const res2 = await app.request('/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: [operation] }),
    });
    expect(res2.status).toBe(200);
    const data2 = (await res2.json()) as { syncedIds: string[] };
    expect(data2.syncedIds).toContain(operation.id);
  });
});
