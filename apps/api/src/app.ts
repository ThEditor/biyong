import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  SyncOperationSchema,
} from '@biyong/schemas';
import { randomUUID } from 'node:crypto';

export function createApp() {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  // Health check
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      service: 'biyong-api',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });

  // In-memory store for Phase 0 demonstration (can switch to Drizzle DB client when PG URL provided)
  const usersMap = new Map<string, { id: string; email: string; name: string; password: string }>();
  const sessionsMap = new Map<string, { userId: string; token: string; expiresAt: string }>();
  const syncedOpsMap = new Map<string, any>();

  // Auth Routes
  app.post('/auth/register', async (c) => {
    const body = await c.req.json();
    const parsed = RegisterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const { email, password, name } = parsed.data;
    if (usersMap.has(email)) {
      return c.json({ error: 'User already exists' }, 409);
    }

    const userId = randomUUID();
    usersMap.set(email, { id: userId, email, name, password });

    const token = `tok_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    sessionsMap.set(token, { userId, token, expiresAt });

    return c.json({
      user: { id: userId, email, name },
      token,
      expiresAt,
    });
  });

  app.post('/auth/login', async (c) => {
    const body = await c.req.json();
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const { email, password } = parsed.data;
    const user = usersMap.get(email);
    if (!user || user.password !== password) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = `tok_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    sessionsMap.set(token, { userId: user.id, token, expiresAt });

    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
      expiresAt,
    });
  });

  app.get('/auth/me', (c) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const session = sessionsMap.get(token);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    const user = Array.from(usersMap.values()).find((u) => u.id === session.userId);
    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json({ id: user.id, email: user.email, name: user.name });
  });

  // Sync Routes
  app.post('/sync/push', async (c) => {
    const body = await c.req.json();
    const operations = body.operations;
    if (!Array.isArray(operations)) {
      return c.json({ error: 'Invalid operations array' }, 400);
    }

    const syncedIds: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    for (const rawOp of operations) {
      const parsed = SyncOperationSchema.safeParse(rawOp);
      if (!parsed.success) {
        rejected.push({ id: rawOp.id || 'unknown', reason: 'Schema validation failed' });
        continue;
      }

      const op = parsed.data;
      // Idempotency check: if already processed, return as synced without re-applying
      if (syncedOpsMap.has(op.id)) {
        syncedIds.push(op.id);
        continue;
      }

      syncedOpsMap.set(op.id, op);
      syncedIds.push(op.id);
    }

    return c.json({ syncedIds, rejected });
  });

  app.get('/sync/pull', (c) => {
    const cursor = c.req.query('cursor');
    const allOps = Array.from(syncedOpsMap.values());
    return c.json({
      operations: allOps,
      nextCursor: new Date().toISOString(),
    });
  });

  return app;
}
