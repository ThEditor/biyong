/**
 * Permissions logic for Phase 5 (Real Shared Groups)
 */

export interface ExpenseAuthorInfo {
  createdByUserId?: string | null;
}

export interface MemberUserInfo {
  userId: string | null;
}

/**
 * Checks if a user is allowed to edit an expense.
 * - If createdByUserId is defined and not null, only the creator (matching userId) can edit.
 * - If createdByUserId is null/undefined (e.g. offline private dummy group), returns true.
 */
export function canEditExpense(
  userId: string,
  expense: ExpenseAuthorInfo
): boolean {
  if (expense.createdByUserId !== undefined && expense.createdByUserId !== null) {
    return expense.createdByUserId === userId;
  }
  return true;
}

/**
 * Checks if a user is allowed to delete an expense.
 * - Returns true if userId matches groupOwnerId.
 * - OR if expense.createdByUserId matches userId.
 * - OR if expense.createdByUserId is null/undefined.
 */
export function canDeleteExpense(
  userId: string,
  expense: ExpenseAuthorInfo,
  groupOwnerId?: string
): boolean {
  if (groupOwnerId !== undefined && userId === groupOwnerId) {
    return true;
  }
  if (expense.createdByUserId !== undefined && expense.createdByUserId !== null) {
    return expense.createdByUserId === userId;
  }
  return true;
}

/**
 * Checks if a user is a member of the group.
 * Returns true if any member has userId matching the given userId.
 */
export function isGroupMember(
  userId: string,
  members: MemberUserInfo[]
): boolean {
  return members.some((m) => m.userId === userId);
}
