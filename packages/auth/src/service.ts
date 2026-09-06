import { createHash, randomUUID } from 'node:crypto';
import type { RegisterRequest, LoginRequest, AuthResponse, SessionUser } from '@biyong/schemas';
import type { AuthClient } from './contracts.js';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  deviceId: string;
  expiresAt: string;
}

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

export class InMemoryAuthService implements AuthClient {
  private users = new Map<string, UserRecord>(); // email -> record
  private sessions = new Map<string, SessionRecord>(); // token -> record

  async register(req: RegisterRequest, deviceId = 'device_default'): Promise<AuthResponse> {
    const email = req.email.toLowerCase().trim();
    if (this.users.has(email)) {
      throw new Error('User with this email already exists');
    }

    const salt = randomUUID();
    const passwordHash = hashPassword(req.password, salt);
    const userId = randomUUID();

    const userRecord: UserRecord = {
      id: userId,
      email,
      name: req.name.trim(),
      passwordHash,
      salt,
    };
    this.users.set(email, userRecord);

    const token = `tok_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    this.sessions.set(token, { token, userId, deviceId, expiresAt });

    return {
      user: { id: userId, email: userRecord.email, name: userRecord.name },
      token,
      expiresAt,
    };
  }

  async login(req: LoginRequest, deviceId = 'device_default'): Promise<AuthResponse> {
    const email = req.email.toLowerCase().trim();
    const userRecord = this.users.get(email);
    if (!userRecord) {
      throw new Error('Invalid email or password');
    }

    const testHash = hashPassword(req.password, userRecord.salt);
    if (testHash !== userRecord.passwordHash) {
      throw new Error('Invalid email or password');
    }

    const token = `tok_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    this.sessions.set(token, { token, userId: userRecord.id, deviceId, expiresAt });

    return {
      user: { id: userRecord.id, email: userRecord.email, name: userRecord.name },
      token,
      expiresAt,
    };
  }

  async logout(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async getCurrentUser(token: string): Promise<SessionUser | null> {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      return null;
    }

    const userRecord = Array.from(this.users.values()).find((u) => u.id === session.userId);
    if (!userRecord) return null;

    return { id: userRecord.id, email: userRecord.email, name: userRecord.name };
  }
}
