export interface GuestMigrationPlan {
  guestId: string;
  targetUserId: string;
  migrationTimestamp: string;
  entities: {
    accountsCount: number;
    transactionsCount: number;
    groupsCount: number;
    budgetsCount: number;
  };
}

export function buildGuestMigrationPlan(params: {
  guestId: string;
  targetUserId: string;
  accountsCount: number;
  transactionsCount: number;
  groupsCount: number;
  budgetsCount: number;
}): GuestMigrationPlan {
  return {
    guestId: params.guestId,
    targetUserId: params.targetUserId,
    migrationTimestamp: new Date().toISOString(),
    entities: {
      accountsCount: params.accountsCount,
      transactionsCount: params.transactionsCount,
      groupsCount: params.groupsCount,
      budgetsCount: params.budgetsCount,
    },
  };
}
