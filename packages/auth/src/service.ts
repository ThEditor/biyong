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

function sha256(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = data.length;
  const bitLen = len * 8;
  const padLen = (len + 9 + 63) & ~63;
  const buf = new Uint8Array(padLen);
  buf.set(data);
  buf[len] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Int32Array(64);
  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const wt15 = W[t - 15] ?? 0;
      const wt2 = W[t - 2] ?? 0;
      const wt16 = W[t - 16] ?? 0;
      const wt7 = W[t - 7] ?? 0;
      const s0 = ((wt15 >>> 7) | (wt15 << 25)) ^
                 ((wt15 >>> 18) | (wt15 << 14)) ^
                 (wt15 >>> 3);
      const s1 = ((wt2 >>> 17) | (wt2 << 15)) ^
                 ((wt2 >>> 19) | (wt2 << 13)) ^
                 (wt2 >>> 10);
      W[t] = (wt16 + s0 + wt7 + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const kt = K[t] ?? 0;
      const wt = W[t] ?? 0;
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + kt + wt) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setInt32(0, H0, false);
  outView.setInt32(4, H1, false);
  outView.setInt32(8, H2, false);
  outView.setInt32(12, H3, false);
  outView.setInt32(16, H4, false);
  outView.setInt32(20, H5, false);
  outView.setInt32(24, H6, false);
  outView.setInt32(28, H7, false);
  return out;
}

// Cryptographic password hashing in pure TypeScript with key stretching (zero Node native dependencies)
export function hashPassword(password: string, salt: string): string {
  const encoder = new TextEncoder();
  let current = sha256(encoder.encode(`${salt}:${password}`));
  for (let i = 1; i < 2000; i++) {
    const combined = new Uint8Array(current.length + salt.length);
    combined.set(current);
    for (let j = 0; j < salt.length; j++) {
      combined[current.length + j] = salt.charCodeAt(j);
    }
    current = sha256(combined);
  }
  return Array.from(current).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
    if (!timingSafeEqualStr(testHash, userRecord.passwordHash)) {
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
