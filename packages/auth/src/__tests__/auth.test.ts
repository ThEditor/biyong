import { describe, it, expect } from 'vitest';
import {
  createGuestSession,
  isGuestSession,
  buildGuestMigrationPlan,
  InMemoryAuthService,
  hashPassword,
} from '../index.js';

describe('Auth: Guest Sessions & Migration', () => {
  it('creates and validates guest session', () => {
    const session = createGuestSession();
    expect(session.isGuest).toBe(true);
    expect(session.guestId).toMatch(/^guest_/);
    expect(isGuestSession(session)).toBe(true);
  });

  it('builds guest migration plan deterministically', () => {
    const plan = buildGuestMigrationPlan({
      guestId: 'guest_123',
      targetUserId: 'user_456',
      accountsCount: 3,
      transactionsCount: 25,
      groupsCount: 2,
      budgetsCount: 4,
    });

    expect(plan.guestId).toBe('guest_123');
    expect(plan.targetUserId).toBe('user_456');
    expect(plan.entities.transactionsCount).toBe(25);
  });
});

describe('Auth: InMemoryAuthService & Password Hashing', () => {
  it('registers and logs in user with cryptographic hashing', async () => {
    const authService = new InMemoryAuthService();
    const reg = await authService.register({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'SuperSecretPassword123!',
    });

    expect(reg.user.name).toBe('Alice');
    expect(reg.user.email).toBe('alice@example.com');
    expect(reg.token).toBeDefined();

    const current = await authService.getCurrentUser(reg.token);
    expect(current?.email).toBe('alice@example.com');

    // Login with correct password
    const loginRes = await authService.login({
      email: 'alice@example.com',
      password: 'SuperSecretPassword123!',
    });
    expect(loginRes.user.id).toBe(reg.user.id);

    // Login with incorrect password
    await expect(
      authService.login({
        email: 'alice@example.com',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow('Invalid email or password');

    // Logout
    await authService.logout(loginRes.token);
    const loggedOut = await authService.getCurrentUser(loginRes.token);
    expect(loggedOut).toBeNull();
  });

  it('produces unique hashes with different salts', () => {
    const hash1 = hashPassword('test-password', 'salt-1');
    const hash2 = hashPassword('test-password', 'salt-2');
    expect(hash1).not.toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
