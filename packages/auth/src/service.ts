import type { RegisterRequest, LoginRequest, AuthResponse, SessionUser } from '@biyong/schemas';
import type { AuthClient } from './contracts.js';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Deterministic 64-bit MurmurHash3 in pure TypeScript (zero Node native dependencies)
export function hashPassword(password: string, salt: string): string {
  const str = `${salt}:${password}`;
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `hash_${part1}${part2}`;
}

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

export class InMemoryAuthService implements AuthClient {
  private users = new Map<string, UserRecord>(); // email -> record
  private sessions = new Map<string, SessionRecord>(); // token -> record

  async register(req: RegisterRequest, deviceId = 'device_default'): Promise<AuthResponse> {
    const email = req.email.toLowerCase().trim();
    if (this.users.has(email)) {
      throw new Error('User with this email already exists');
    }

    const salt = generateUUID();
    const passwordHash = hashPassword(req.password, salt);
    const userId = generateUUID();

    const userRecord: UserRecord = {
      id: userId,
      email,
      name: req.name.trim(),
      passwordHash,
      salt,
    };
    this.users.set(email, userRecord);

    const token = `tok_${generateUUID()}`;
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

    const token = `tok_${generateUUID()}`;
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
