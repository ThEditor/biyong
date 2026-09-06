import { describe, it, expect } from 'vitest';
import { createGuestSession, isGuestSession, buildGuestMigrationPlan } from '../index.js';

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
