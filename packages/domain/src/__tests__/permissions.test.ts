import { describe, it, expect } from 'vitest';
import { canEditExpense, canDeleteExpense, isGroupMember } from '../permissions.js';

describe('Domain: Permissions', () => {
  describe('canEditExpense', () => {
    it('allows editing when createdByUserId is undefined (e.g. offline private dummy group)', () => {
      expect(canEditExpense('user-1', {})).toBe(true);
    });

    it('allows editing when createdByUserId is null', () => {
      expect(canEditExpense('user-1', { createdByUserId: null })).toBe(true);
    });

    it('allows editing when userId matches createdByUserId', () => {
      expect(canEditExpense('user-1', { createdByUserId: 'user-1' })).toBe(true);
    });

    it('denies editing when userId does not match createdByUserId', () => {
      expect(canEditExpense('user-2', { createdByUserId: 'user-1' })).toBe(false);
    });
  });

  describe('canDeleteExpense', () => {
    it('allows deletion when userId is the group owner, even if created by another user', () => {
      expect(
        canDeleteExpense('owner-1', { createdByUserId: 'member-1' }, 'owner-1')
      ).toBe(true);
    });

    it('allows deletion when userId is the creator of the expense', () => {
      expect(
        canDeleteExpense('member-1', { createdByUserId: 'member-1' }, 'owner-1')
      ).toBe(true);
    });

    it('allows deletion when createdByUserId is undefined', () => {
      expect(canDeleteExpense('user-1', {}, 'owner-1')).toBe(true);
      expect(canDeleteExpense('user-1', {})).toBe(true);
    });

    it('allows deletion when createdByUserId is null', () => {
      expect(canDeleteExpense('user-1', { createdByUserId: null }, 'owner-1')).toBe(true);
      expect(canDeleteExpense('user-1', { createdByUserId: null })).toBe(true);
    });

    it('denies deletion when user is neither the creator nor the group owner', () => {
      expect(
        canDeleteExpense('member-2', { createdByUserId: 'member-1' }, 'owner-1')
      ).toBe(false);
    });
  });

  describe('isGroupMember', () => {
    it('returns true when user is a group member', () => {
      const members = [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: null },
      ];
      expect(isGroupMember('user-1', members)).toBe(true);
      expect(isGroupMember('user-2', members)).toBe(true);
    });

    it('returns false when user is not in the group', () => {
      const members = [
        { userId: 'user-1' },
        { userId: null },
      ];
      expect(isGroupMember('user-3', members)).toBe(false);
    });

    it('returns false for empty member list', () => {
      expect(isGroupMember('user-1', [])).toBe(false);
    });
  });
});
