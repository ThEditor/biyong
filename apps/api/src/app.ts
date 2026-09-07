import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  SyncOperationSchema,
  CreateSharedGroupRequestSchema,
  JoinGroupRequestSchema,
  CreateSharedExpenseRequestSchema,
  UpdateSharedExpenseRequestSchema,
  CreateSettlementRequestSchema,
  InvestmentSchema,
  LiabilitySchema,
  PeerDebtSchema,
  PeerDebtRepaymentSchema,
  ReimbursementClaimSchema,
  SubscriptionItemSchema,
  LedgerExportDataSchema,
  type Group,
  type GroupMember,
  type GroupExpense,
  type Settlement,
  type GroupInvitation,
  type Investment,
  type Liability,
  type PeerDebt,
  type PeerDebtRepayment,
  type ReimbursementClaim,
  type SubscriptionItem,
  type LedgerExportData,
  type Account,
  type Category,
  type Transaction,
  type Budget,
  type Goal,
} from '@biyong/schemas';
import {
  canEditExpense,
  canDeleteExpense,
  isGroupMember,
  validatePayers,
  calculateSplit,
  buildDependencyGraph,
  calculateNetBalances,
  simplifyDebts,
  explainMemberSettlement,
  type DependencyGraphNode,
  type DependencyGraphEdge,
  calculateNetWorth,
  calculatePeerDebtSummary,
  calculateReimbursementSummary,
  calculateSubscriptionBurnRate,
  processFinancialQuery,
  forecastCashFlow,
  detectAnomalies,
} from '@biyong/domain';
import { randomUUID, randomInt, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const bufExpected = Buffer.from(expectedHash, 'hex');
    if (hash.length !== bufExpected.length) return false;
    return timingSafeEqual(hash, bufExpected);
  } catch {
    return false;
  }
}

export function createApp() {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  // Global Error Handler
  app.onError((err, c) => {
    console.error('Unhandled API Error:', err);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  });

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
  const usersMap = new Map<string, { id: string; email: string; name: string; passwordHash: string; salt: string }>();
  const sessionsMap = new Map<string, { userId: string; token: string; expiresAt: string }>();
  const syncedOpsMap = new Map<string, any>();

  // In-memory store for shared groups (Phase 5)
  const groupsMap = new Map<string, Group>();
  const groupMembersMap = new Map<string, GroupMember[]>(); // groupId -> GroupMember[]
  const groupExpensesMap = new Map<string, GroupExpense[]>(); // groupId -> GroupExpense[]
  const settlementsMap = new Map<string, Settlement[]>(); // groupId -> Settlement[]
  const invitesMap = new Map<string, GroupInvitation>(); // inviteCode -> GroupInvitation

  // In-memory store for wealth: investments and liabilities (Phase 6)
  const investmentsMap = new Map<string, Investment & { userId: string }>();
  const liabilitiesMap = new Map<string, Liability & { userId: string }>();

  // In-memory store for Phase 7 & 8 (debts, reimbursements, subscriptions, ledger)
  const peerDebtsMap = new Map<string, PeerDebt & { userId: string }>();
  const peerRepaymentsMap = new Map<string, PeerDebtRepayment[]>(); // debtId -> repayments
  const reimbursementsMap = new Map<string, ReimbursementClaim & { userId: string }>();
  const subscriptionsMap = new Map<string, SubscriptionItem & { userId: string }>();
  const accountsMap = new Map<string, Account & { userId: string }>();
  const categoriesMap = new Map<string, Category & { userId: string }>();
  const transactionsMap = new Map<string, Transaction & { userId: string }>();
  const budgetsMap = new Map<string, Budget & { userId: string }>();
  const goalsMap = new Map<string, Goal & { userId: string }>();

  // Helper to authenticate request from Authorization header with expiry validation
  function getAuthUser(c: any): { id: string; email: string; name: string } | null {
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const session = sessionsMap.get(token);
    if (!session) return null;

    // Validate expiration
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      sessionsMap.delete(token);
      return null;
    }

    const user = Array.from(usersMap.values()).find((u) => u.id === session.userId);
    if (!user) return null;

    return { id: user.id, email: user.email, name: user.name };
  }

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
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    usersMap.set(email, { id: userId, email, name, passwordHash, salt });

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
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
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

  app.post('/auth/logout', (c) => {
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token) {
        sessionsMap.delete(token);
      }
    }
    return c.json({ success: true, message: 'Logged out successfully' }, 200);
  });

  app.get('/auth/me', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    return c.json({ id: user.id, email: user.email, name: user.name });
  });

  // Sync Routes
  app.post('/sync/push', async (c) => {
    const body = await c.req.json();
    const operations = body?.operations;
    if (!Array.isArray(operations)) {
      return c.json({ error: 'Invalid operations array' }, 400);
    }
    if (operations.length > 1000) {
      return c.json({ error: 'Operations batch exceeds limit of 1000' }, 400);
    }

    const syncedIds: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    const authUser = getAuthUser(c);

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

      const opUserId = authUser?.id || (op.payload as any)?.userId || (op.deviceId ? `guest_${op.deviceId}` : 'default');
      const payload = op.payload as any;

      if (payload) {
        // Multi-tenant check: do not allow overwriting or deleting an entity belonging to another registered user
        const checkOwnership = (existing: { userId?: string } | undefined): boolean => {
          if (!existing || !existing.userId) return true;
          return existing.userId === opUserId;
        };

        if (op.entityType === 'account') {
          if (!checkOwnership(accountsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') accountsMap.delete(op.entityId);
          else accountsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'category') {
          if (!checkOwnership(categoriesMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') categoriesMap.delete(op.entityId);
          else categoriesMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'transaction') {
          if (!checkOwnership(transactionsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') transactionsMap.delete(op.entityId);
          else transactionsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'budget') {
          if (!checkOwnership(budgetsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') budgetsMap.delete(op.entityId);
          else budgetsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'goal') {
          if (!checkOwnership(goalsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') goalsMap.delete(op.entityId);
          else goalsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'investment') {
          if (!checkOwnership(investmentsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') investmentsMap.delete(op.entityId);
          else investmentsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'liability') {
          if (!checkOwnership(liabilitiesMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') liabilitiesMap.delete(op.entityId);
          else liabilitiesMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'peer_debt') {
          if (!checkOwnership(peerDebtsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') peerDebtsMap.delete(op.entityId);
          else peerDebtsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'reimbursement_claim') {
          if (!checkOwnership(reimbursementsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') reimbursementsMap.delete(op.entityId);
          else reimbursementsMap.set(op.entityId, { ...payload, userId: opUserId });
        } else if (op.entityType === 'subscription') {
          if (!checkOwnership(subscriptionsMap.get(op.entityId))) {
            rejected.push({ id: op.id, reason: 'Forbidden: entity belongs to another user' });
            continue;
          }
          if (op.operationType === 'delete') subscriptionsMap.delete(op.entityId);
          else subscriptionsMap.set(op.entityId, { ...payload, userId: opUserId });
        }
      }

      syncedOpsMap.set(op.id, op);
      syncedIds.push(op.id);
    }

    return c.json({ syncedIds, rejected });
  });

  app.get('/sync/pull', (c) => {
    const authUser = getAuthUser(c);
    const cursor = c.req.query('cursor');
    const allOps = Array.from(syncedOpsMap.values());
    let filteredOps = allOps;

    if (cursor) {
      const cursorTime = new Date(cursor).getTime();
      if (!isNaN(cursorTime)) {
        filteredOps = allOps.filter((op) => new Date(op.timestamp).getTime() > cursorTime);
      }
    }

    // Tenant isolation: if authenticated, filter by user/groups.
    // If not authenticated, only return non-user operations, never registered user data.
    const userGroupIds = new Set<string>();
    if (authUser) {
      for (const [groupId, members] of groupMembersMap.entries()) {
        if (members.some((m) => m.userId === authUser.id)) {
          userGroupIds.add(groupId);
        }
      }
    }

    const authorizedOps = filteredOps.filter((op) => {
      const payload = op.payload as any;
      if (authUser) {
        if (payload?.userId === authUser.id) return true;
        if (payload?.ownerId === authUser.id) return true;
        if (op.entityType === 'group' && userGroupIds.has(op.entityId)) return true;
        if (
          (op.entityType === 'group_member' ||
            op.entityType === 'group_expense' ||
            op.entityType === 'settlement') &&
          userGroupIds.has(payload?.groupId)
        ) {
          return true;
        }
        // Check stored entity ownership
        if (accountsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (transactionsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (budgetsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (goalsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (investmentsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (liabilitiesMap.get(op.entityId)?.userId === authUser.id) return true;
        if (peerDebtsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (reimbursementsMap.get(op.entityId)?.userId === authUser.id) return true;
        if (subscriptionsMap.get(op.entityId)?.userId === authUser.id) return true;
        return false;
      } else {
        // Unauthenticated client cannot access any registered user data
        return !payload?.userId && !payload?.ownerId;
      }
    });

    const latestTimestamp =
      authorizedOps.length > 0
        ? authorizedOps[authorizedOps.length - 1].timestamp
        : cursor || new Date().toISOString();

    return c.json({
      operations: authorizedOps,
      nextCursor: latestTimestamp,
    });
  });

  // ==========================================
  // Phase 5: Shared Groups Endpoints
  // ==========================================

  // POST /groups: Create a shared group
  app.post('/groups', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const parsed = CreateSharedGroupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const now = new Date().toISOString();
    const group: Group = {
      id: randomUUID(),
      name: parsed.data.name,
      currency: parsed.data.currency,
      isPrivate: false,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const member: GroupMember = {
      id: randomUUID(),
      groupId: group.id,
      name: user.name,
      userId: user.id,
      isDummy: false,
      role: 'owner',
      createdAt: now,
    };

    groupsMap.set(group.id, group);
    groupMembersMap.set(group.id, [member]);
    groupExpensesMap.set(group.id, []);
    settlementsMap.set(group.id, []);

    // Also register group and owner member in syncedOpsMap
    const groupOp = {
      id: randomUUID(),
      entityType: 'group',
      entityId: group.id,
      operationType: 'create',
      payload: group as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(groupOp.id, groupOp);

    const memberOp = {
      id: randomUUID(),
      entityType: 'group_member',
      entityId: member.id,
      operationType: 'create',
      payload: member as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(memberOp.id, memberOp);

    return c.json({ group, member }, 201);
  });

  // GET /groups: List groups where user is a member
  app.get('/groups', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userGroups: Group[] = [];
    for (const [groupId, members] of groupMembersMap.entries()) {
      if (members.some((m) => m.userId === user.id)) {
        const group = groupsMap.get(groupId);
        if (group) {
          userGroups.push(group);
        }
      }
    }

    return c.json({ groups: userGroups }, 200);
  });

  // POST /groups/join: Join a shared group via invite code
  app.post('/groups/join', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const parsed = JoinGroupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const { inviteCode } = parsed.data;
    const invitation = invitesMap.get(inviteCode);
    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.status !== 'pending') {
      return c.json({ error: 'Invitation is no longer valid' }, 400);
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      invitation.status = 'expired';
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    // Security check: If the invite was restricted to a specific email, verify match
    if (invitation.email && invitation.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      return c.json({ error: 'This invitation was issued to a different email address' }, 403);
    }

    const group = groupsMap.get(invitation.groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(group.id) || [];
    const existingMember = members.find((m) => m.userId === user.id);
    if (existingMember) {
      return c.json({ group, member: existingMember, message: 'Already a member' }, 200);
    }

    const now = new Date().toISOString();
    const newMember: GroupMember = {
      id: randomUUID(),
      groupId: group.id,
      name: user.name,
      userId: user.id,
      isDummy: false,
      role: 'member',
      createdAt: now,
    };

    members.push(newMember);
    groupMembersMap.set(group.id, members);

    const syncOp = {
      id: randomUUID(),
      entityType: 'group_member',
      entityId: newMember.id,
      operationType: 'create',
      payload: newMember as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ group, member: newMember }, 200);
  });

  // GET /groups/:id: Group details with members, expenses, settlements
  app.get('/groups/:id', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const expenses = groupExpensesMap.get(groupId) || [];
    const settlements = settlementsMap.get(groupId) || [];

    return c.json(
      {
        group,
        members,
        expenses,
        settlements,
      },
      200
    );
  });

  // POST /groups/:id/invites: Generate invitation code
  app.post('/groups/:id/invites', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    let email: string | null = null;
    try {
      const body = await c.req.json();
      if (body && typeof body.email === 'string') {
        email = body.email;
      }
    } catch {
      // Body is optional
    }

    const now = new Date();

    // Reuse existing active invite code if available for this group
    const existingInvite = Array.from(invitesMap.values()).find(
      (inv) =>
        inv.groupId === groupId &&
        inv.status === 'pending' &&
        new Date(inv.expiresAt).getTime() > now.getTime() &&
        (!email || inv.email === email)
    );
    if (existingInvite) {
      return c.json({ invitation: existingInvite }, 200);
    }

    // Generate 6-char cryptographically secure random invite code (e.g. INV-XXXXXX)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codePart = '';
    for (let i = 0; i < 6; i++) {
      codePart += chars.charAt(randomInt(0, chars.length));
    }
    const inviteCode = `INV-${codePart}`;

    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invitation: GroupInvitation = {
      id: randomUUID(),
      groupId,
      inviterUserId: user.id,
      inviteCode,
      email,
      status: 'pending',
      expiresAt,
      createdAt: now.toISOString(),
    };

    invitesMap.set(inviteCode, invitation);

    return c.json({ invitation }, 201);
  });

  // POST /groups/:id/expenses: Create shared expense
  app.post('/groups/:id/expenses', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    const callerMember = members.find((m) => m.userId === user.id);
    if (!callerMember) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const parsed = CreateSharedExpenseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    // Validate payers and allocations using domain helpers
    try {
      validatePayers(parsed.data.amountMinor, parsed.data.payers);
      calculateSplit({
        totalAmountMinor: parsed.data.amountMinor,
        method: parsed.data.splitMethod,
        allocations: parsed.data.allocations,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Validation failed' }, 400);
    }

    const now = new Date().toISOString();
    const expense: GroupExpense = {
      id: randomUUID(),
      groupId,
      title: parsed.data.title,
      amountMinor: parsed.data.amountMinor,
      currency: parsed.data.currency,
      date: parsed.data.date,
      createdByMemberId: callerMember.id,
      createdByUserId: user.id,
      payers: parsed.data.payers,
      splitMethod: parsed.data.splitMethod,
      allocations: parsed.data.allocations,
      notes: parsed.data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const expenses = groupExpensesMap.get(groupId) || [];
    expenses.push(expense);
    groupExpensesMap.set(groupId, expenses);

    const syncOp = {
      id: randomUUID(),
      entityType: 'group_expense',
      entityId: expense.id,
      operationType: 'create',
      payload: expense as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ expense }, 201);
  });

  // PUT /groups/:id/expenses/:expenseId: Edit shared expense
  app.put('/groups/:id/expenses/:expenseId', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const expenseId = c.req.param('expenseId');

    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const expenses = groupExpensesMap.get(groupId) || [];
    const expenseIndex = expenses.findIndex((e) => e.id === expenseId);
    if (expenseIndex === -1) {
      return c.json({ error: 'Expense not found' }, 404);
    }

    const expense = expenses[expenseIndex]!;

    // Strict Authorization check: only creator can edit
    if (!canEditExpense(user.id, expense)) {
      return c.json({ error: 'Only the creator can edit this expense' }, 403);
    }

    const body = await c.req.json();
    const parsed = UpdateSharedExpenseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const now = new Date().toISOString();
    const updatedExpense: GroupExpense = {
      ...expense,
      title: parsed.data.title ?? expense.title,
      amountMinor: parsed.data.amountMinor ?? expense.amountMinor,
      currency: parsed.data.currency ?? expense.currency,
      date: parsed.data.date ?? expense.date,
      payers: parsed.data.payers ?? expense.payers,
      splitMethod: parsed.data.splitMethod ?? expense.splitMethod,
      allocations: parsed.data.allocations ?? expense.allocations,
      notes: parsed.data.notes !== undefined ? parsed.data.notes : expense.notes,
      updatedAt: now,
    };

    // Validate payers and allocations if amounts/payers/splits were modified
    try {
      validatePayers(updatedExpense.amountMinor, updatedExpense.payers);
      calculateSplit({
        totalAmountMinor: updatedExpense.amountMinor,
        method: updatedExpense.splitMethod,
        allocations: updatedExpense.allocations,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Validation failed' }, 400);
    }

    expenses[expenseIndex] = updatedExpense;
    groupExpensesMap.set(groupId, expenses);

    const syncOp = {
      id: randomUUID(),
      entityType: 'group_expense',
      entityId: updatedExpense.id,
      operationType: 'update',
      payload: updatedExpense as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ expense: updatedExpense }, 200);
  });

  // DELETE /groups/:id/expenses/:expenseId: Delete shared expense
  app.delete('/groups/:id/expenses/:expenseId', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const expenseId = c.req.param('expenseId');

    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const expenses = groupExpensesMap.get(groupId) || [];
    const expenseIndex = expenses.findIndex((e) => e.id === expenseId);
    if (expenseIndex === -1) {
      return c.json({ error: 'Expense not found' }, 404);
    }

    const expense = expenses[expenseIndex]!;

    // Strict Authorization check: group owner or creator
    if (!canDeleteExpense(user.id, expense, group.ownerId)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    expenses.splice(expenseIndex, 1);
    groupExpensesMap.set(groupId, expenses);

    const now = new Date().toISOString();
    const syncOp = {
      id: randomUUID(),
      entityType: 'group_expense',
      entityId: expenseId,
      operationType: 'delete',
      payload: { id: expenseId, groupId },
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ success: true }, 200);
  });

  // POST /groups/:id/settlements: Record a settlement
  app.post('/groups/:id/settlements', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const parsed = CreateSettlementRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const fromMember = members.find((m) => m.id === parsed.data.fromMemberId);
    const toMember = members.find((m) => m.id === parsed.data.toMemberId);
    if (!fromMember || !toMember) {
      return c.json({ error: 'Members specified in settlement must belong to the group' }, 400);
    }

    const callerMember = members.find((m) => m.userId === user.id);
    if (
      callerMember &&
      callerMember.id !== parsed.data.fromMemberId &&
      callerMember.id !== parsed.data.toMemberId &&
      group.ownerId !== user.id
    ) {
      return c.json({ error: 'Settlement must involve the recording member or group owner' }, 403);
    }

    const now = new Date().toISOString();
    const settlement: Settlement = {
      id: randomUUID(),
      groupId,
      fromMemberId: parsed.data.fromMemberId,
      toMemberId: parsed.data.toMemberId,
      amountMinor: parsed.data.amountMinor,
      currency: parsed.data.currency,
      settledAt: now,
      notes: parsed.data.notes ?? null,
    };

    const settlements = settlementsMap.get(groupId) || [];
    settlements.push(settlement);
    settlementsMap.set(groupId, settlements);

    const syncOp = {
      id: randomUUID(),
      entityType: 'settlement',
      entityId: settlement.id,
      operationType: 'create',
      payload: settlement as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ settlement }, 201);
  });

  // GET /groups/:id/graph: Visual dependency graph
  app.get('/groups/:id/graph', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const memberNames = new Map<string, string>();
    for (const m of members) {
      memberNames.set(m.id, m.name);
    }

    const expenses = groupExpensesMap.get(groupId) || [];
    const settlements = settlementsMap.get(groupId) || [];

    // ?simplify=true collapses the graph to net member-to-member transfers
    // using greedy min-cash-flow on net balances (fewest payments path).
    const simplify = c.req.query('simplify') === 'true';
    if (simplify) {
      const memberIds = members.map((m) => m.id);
      const balances = calculateNetBalances(memberIds, expenses, settlements);
      const transfers = simplifyDebts(balances);
      const nodes: DependencyGraphNode[] = [];
      for (const m of members) {
        nodes.push({ id: `member-${m.id}`, label: m.name, type: 'member', data: { memberId: m.id } });
      }
      const edges: DependencyGraphEdge[] = transfers.map((t, i) => ({
        id: `net-${i}-${t.fromMemberId}-${t.toMemberId}`,
        source: `member-${t.fromMemberId}`,
        target: `member-${t.toMemberId}`,
        label: 'Net owed',
        amountMinor: t.amountMinor,
      }));
      return c.json({ graph: { nodes, edges }, simplified: true }, 200);
    }

    const graph = buildDependencyGraph(memberNames, expenses, settlements);

    return c.json({ graph }, 200);
  });

  // GET /groups/:id/members/:memberId/explanation: Settlement explanation
  app.get('/groups/:id/members/:memberId/explanation', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('id');
    const memberId = c.req.param('memberId');

    const group = groupsMap.get(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const members = groupMembersMap.get(groupId) || [];
    if (!isGroupMember(user.id, members)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) {
      return c.json({ error: 'Member not found' }, 404);
    }

    const memberIds = members.map((m) => m.id);
    const expenses = groupExpensesMap.get(groupId) || [];
    const settlements = settlementsMap.get(groupId) || [];

    const explanation = explainMemberSettlement(memberId, memberIds, expenses, settlements);

    return c.json({ explanation }, 200);
  });

  // ==========================================
  // Phase 6: Wealth Endpoints (Investments & Liabilities)
  // ==========================================

  // GET /wealth/investments: List user's investments
  app.get('/wealth/investments', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const investments = Array.from(investmentsMap.values()).filter(
      (inv) => inv.userId === user.id
    );

    return c.json({ investments }, 200);
  });

  // POST /wealth/investments: Create an investment
  app.post('/wealth/investments', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id: body.id || randomUUID(),
      name: body.name,
      type: body.type,
      investedAmountMinor: body.investedAmountMinor,
      currentValueMinor: body.currentValueMinor,
      currency: body.currency,
      notes: body.notes ?? null,
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    };

    const parsed = InvestmentSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const investment: Investment & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    if (investmentsMap.has(investment.id) && investmentsMap.get(investment.id)!.userId !== user.id) {
      return c.json({ error: 'Conflict: resource with this ID is owned by another user' }, 409);
    }

    investmentsMap.set(investment.id, investment);

    const syncOp = {
      id: randomUUID(),
      entityType: 'investment',
      entityId: investment.id,
      operationType: 'create',
      payload: investment as unknown as Record<string, unknown>,
      timestamp: investment.createdAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ investment }, 201);
  });

  // PUT /wealth/investments/:id: Update an investment owned by user
  app.put('/wealth/investments/:id', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = investmentsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Investment not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id,
      name: body.name ?? existing.name,
      type: body.type ?? existing.type,
      investedAmountMinor: body.investedAmountMinor ?? existing.investedAmountMinor,
      currentValueMinor: body.currentValueMinor ?? existing.currentValueMinor,
      currency: body.currency ?? existing.currency,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      createdAt: body.createdAt || existing.createdAt,
      updatedAt: body.updatedAt || now,
    };

    const parsed = InvestmentSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated: Investment & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    investmentsMap.set(id, updated);

    const syncOp = {
      id: randomUUID(),
      entityType: 'investment',
      entityId: id,
      operationType: 'update',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: updated.updatedAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ investment: updated }, 200);
  });

  // DELETE /wealth/investments/:id: Delete an investment owned by user
  app.delete('/wealth/investments/:id', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = investmentsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Investment not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    investmentsMap.delete(id);

    const now = new Date().toISOString();
    const syncOp = {
      id: randomUUID(),
      entityType: 'investment',
      entityId: id,
      operationType: 'delete',
      payload: { id },
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ success: true }, 200);
  });

  // GET /wealth/liabilities: List user's liabilities
  app.get('/wealth/liabilities', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const liabilities = Array.from(liabilitiesMap.values()).filter(
      (liab) => liab.userId === user.id
    );

    return c.json({ liabilities }, 200);
  });

  // POST /wealth/liabilities: Create a liability
  app.post('/wealth/liabilities', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id: body.id || randomUUID(),
      name: body.name,
      type: body.type,
      principalAmountMinor: body.principalAmountMinor,
      remainingAmountMinor:
        body.remainingAmountMinor !== undefined
          ? body.remainingAmountMinor
          : body.principalAmountMinor,
      currency: body.currency,
      interestRatePercent: body.interestRatePercent ?? 0,
      dueDate: body.dueDate ?? null,
      notes: body.notes ?? null,
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    };

    const parsed = LiabilitySchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const liability: Liability & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    if (liabilitiesMap.has(liability.id) && liabilitiesMap.get(liability.id)!.userId !== user.id) {
      return c.json({ error: 'Conflict: resource with this ID is owned by another user' }, 409);
    }

    liabilitiesMap.set(liability.id, liability);

    const syncOp = {
      id: randomUUID(),
      entityType: 'liability',
      entityId: liability.id,
      operationType: 'create',
      payload: liability as unknown as Record<string, unknown>,
      timestamp: liability.createdAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ liability }, 201);
  });

  // PUT /wealth/liabilities/:id: Update a liability owned by user
  app.put('/wealth/liabilities/:id', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = liabilitiesMap.get(id);
    if (!existing) {
      return c.json({ error: 'Liability not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id,
      name: body.name ?? existing.name,
      type: body.type ?? existing.type,
      principalAmountMinor: body.principalAmountMinor ?? existing.principalAmountMinor,
      remainingAmountMinor:
        body.remainingAmountMinor !== undefined
          ? body.remainingAmountMinor
          : existing.remainingAmountMinor,
      currency: body.currency ?? existing.currency,
      interestRatePercent:
        body.interestRatePercent !== undefined
          ? body.interestRatePercent
          : existing.interestRatePercent,
      dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      createdAt: body.createdAt || existing.createdAt,
      updatedAt: body.updatedAt || now,
    };

    const parsed = LiabilitySchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated: Liability & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    liabilitiesMap.set(id, updated);

    const syncOp = {
      id: randomUUID(),
      entityType: 'liability',
      entityId: id,
      operationType: 'update',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: updated.updatedAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ liability: updated }, 200);
  });

  // DELETE /wealth/liabilities/:id: Delete a liability owned by user
  app.delete('/wealth/liabilities/:id', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = liabilitiesMap.get(id);
    if (!existing) {
      return c.json({ error: 'Liability not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    liabilitiesMap.delete(id);

    const now = new Date().toISOString();
    const syncOp = {
      id: randomUUID(),
      entityType: 'liability',
      entityId: id,
      operationType: 'delete',
      payload: { id },
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ success: true }, 200);
  });

  // POST /wealth/liabilities/:id/pay: Record payment towards liability
  app.post('/wealth/liabilities/:id/pay', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = liabilitiesMap.get(id);
    if (!existing) {
      return c.json({ error: 'Liability not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const amountMinor = body?.amountMinor;
    if (typeof amountMinor !== 'number' || isNaN(amountMinor) || amountMinor <= 0) {
      return c.json({ error: 'Invalid payment amount' }, 400);
    }

    const paymentMinor = Math.round(amountMinor);
    const newRemaining = Math.max(0, existing.remainingAmountMinor - paymentMinor);
    const now = new Date().toISOString();
    const updated: Liability & { userId: string } = {
      ...existing,
      remainingAmountMinor: newRemaining,
      updatedAt: now,
    };

    liabilitiesMap.set(id, updated);

    const syncOp = {
      id: randomUUID(),
      entityType: 'liability',
      entityId: id,
      operationType: 'update',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ liability: updated, paymentMinor }, 200);
  });

  // GET /wealth/summary: Net worth summary using domain logic
  app.get('/wealth/summary', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const investments = Array.from(investmentsMap.values()).filter(
      (inv) => inv.userId === user.id
    );
    const liabilities = Array.from(liabilitiesMap.values()).filter(
      (liab) => liab.userId === user.id
    );

    const summary = calculateNetWorth([], investments, liabilities);

    return c.json({ summary }, 200);
  });

  // ==========================================
  // Phase 7 & 8: Peer Debts, Reimbursements, Subscriptions, Export/Import, Intelligence
  // ==========================================

  // ------------------------------------------
  // Peer Debts (Lending & Borrowing)
  // ------------------------------------------

  // GET /debts: returns user's peer debts and summary (calculatePeerDebtSummary)
  app.get('/debts', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userDebts = Array.from(peerDebtsMap.values()).filter(
      (debt) => debt.userId === user.id
    );

    const summary = calculatePeerDebtSummary(userDebts);

    return c.json({ debts: userDebts, summary }, 200);
  });

  // POST /debts: creates peer debt, pushes sync op, returns { debt } (201)
  app.post('/debts', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id: body.id || randomUUID(),
      personName: body.personName,
      type: body.type,
      originalAmountMinor: body.originalAmountMinor,
      remainingAmountMinor:
        body.remainingAmountMinor !== undefined
          ? body.remainingAmountMinor
          : body.originalAmountMinor,
      currency: body.currency || 'INR',
      date: body.date || now,
      dueDate: body.dueDate ?? null,
      notes: body.notes ?? null,
      status: body.status || 'active',
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    };

    const parsed = PeerDebtSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const debt: PeerDebt & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    if (peerDebtsMap.has(debt.id) && peerDebtsMap.get(debt.id)!.userId !== user.id) {
      return c.json({ error: 'Conflict: resource with this ID is owned by another user' }, 409);
    }

    peerDebtsMap.set(debt.id, debt);

    const syncOp = {
      id: randomUUID(),
      entityType: 'peer_debt',
      entityId: debt.id,
      operationType: 'create',
      payload: debt as unknown as Record<string, unknown>,
      timestamp: debt.createdAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ debt }, 201);
  });

  // PUT /debts/:id: updates peer debt owned by user (404/403 guards), returns { debt } (200)
  app.put('/debts/:id', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = peerDebtsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Debt not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id,
      personName: body.personName ?? existing.personName,
      type: body.type ?? existing.type,
      originalAmountMinor: body.originalAmountMinor ?? existing.originalAmountMinor,
      remainingAmountMinor:
        body.remainingAmountMinor !== undefined
          ? body.remainingAmountMinor
          : existing.remainingAmountMinor,
      currency: body.currency ?? existing.currency,
      date: body.date ?? existing.date,
      dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      status: body.status ?? existing.status,
      createdAt: body.createdAt || existing.createdAt,
      updatedAt: body.updatedAt || now,
    };

    const parsed = PeerDebtSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated: PeerDebt & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    peerDebtsMap.set(id, updated);

    const syncOp = {
      id: randomUUID(),
      entityType: 'peer_debt',
      entityId: id,
      operationType: 'update',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: updated.updatedAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ debt: updated }, 200);
  });

  // DELETE /debts/:id: deletes peer debt owned by user (200)
  app.delete('/debts/:id', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = peerDebtsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Debt not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    peerDebtsMap.delete(id);

    const now = new Date().toISOString();
    const syncOp = {
      id: randomUUID(),
      entityType: 'peer_debt',
      entityId: id,
      operationType: 'delete',
      payload: { id },
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ success: true }, 200);
  });

  // POST /debts/:id/repay: records repayment, updates remainingAmountMinor, sets status='settled' if 0, returns { debt, repayment } (200)
  app.post('/debts/:id/repay', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = peerDebtsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Debt not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const amountMinor = body?.amountMinor;
    if (typeof amountMinor !== 'number' || isNaN(amountMinor) || amountMinor <= 0) {
      return c.json({ error: 'Invalid repayment amount' }, 400);
    }

    const paymentMinor = Math.round(amountMinor);
    const newRemaining = Math.max(0, existing.remainingAmountMinor - paymentMinor);
    const isSettled = newRemaining === 0;
    const now = new Date().toISOString();

    const updatedDebt: PeerDebt & { userId: string } = {
      ...existing,
      remainingAmountMinor: newRemaining,
      status: isSettled ? 'settled' : existing.status,
      updatedAt: now,
    };

    peerDebtsMap.set(id, updatedDebt);

    const repayment: PeerDebtRepayment = {
      id: body.id || randomUUID(),
      debtId: id,
      amountMinor: paymentMinor,
      date: body.date || now,
      notes: body.notes ?? null,
      createdAt: now,
    };

    const repayments = peerRepaymentsMap.get(id) || [];
    repayments.push(repayment);
    peerRepaymentsMap.set(id, repayments);

    const syncDebtOp = {
      id: randomUUID(),
      entityType: 'peer_debt',
      entityId: id,
      operationType: 'update',
      payload: updatedDebt as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncDebtOp.id, syncDebtOp);

    const syncRepayOp = {
      id: randomUUID(),
      entityType: 'peer_debt_repayment',
      entityId: repayment.id,
      operationType: 'create',
      payload: repayment as unknown as Record<string, unknown>,
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncRepayOp.id, syncRepayOp);

    return c.json({ debt: updatedDebt, repayment }, 200);
  });

  // ------------------------------------------
  // Reimbursements
  // ------------------------------------------

  // GET /reimbursements: returns user's claims and summary (calculateReimbursementSummary)
  app.get('/reimbursements', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userClaims = Array.from(reimbursementsMap.values()).filter(
      (claim) => claim.userId === user.id
    );
    const summary = calculateReimbursementSummary(userClaims);

    return c.json({ claims: userClaims, summary }, 200);
  });

  // POST /reimbursements: creates claim, returns { claim } (201)
  app.post('/reimbursements', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id: body.id || randomUUID(),
      title: body.title,
      category: body.category || 'work',
      amountMinor: body.amountMinor,
      currency: body.currency || 'INR',
      transactionId: body.transactionId ?? null,
      status: body.status || 'pending',
      submittedDate: body.submittedDate || now,
      settledDate: body.settledDate ?? null,
      notes: body.notes ?? null,
      receiptUri: body.receiptUri ?? null,
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    };

    const parsed = ReimbursementClaimSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const claim: ReimbursementClaim & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    if (reimbursementsMap.has(claim.id) && reimbursementsMap.get(claim.id)!.userId !== user.id) {
      return c.json({ error: 'Conflict: resource with this ID is owned by another user' }, 409);
    }

    reimbursementsMap.set(claim.id, claim);

    const syncOp = {
      id: randomUUID(),
      entityType: 'reimbursement_claim',
      entityId: claim.id,
      operationType: 'create',
      payload: claim as unknown as Record<string, unknown>,
      timestamp: claim.createdAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ claim }, 201);
  });

  // PUT /reimbursements/:id: updates claim (status, amount, etc.), returns { claim } (200)
  app.put('/reimbursements/:id', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = reimbursementsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Claim not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id,
      title: body.title ?? existing.title,
      category: body.category ?? existing.category,
      amountMinor: body.amountMinor ?? existing.amountMinor,
      currency: body.currency ?? existing.currency,
      transactionId:
        body.transactionId !== undefined ? body.transactionId : existing.transactionId,
      status: body.status ?? existing.status,
      submittedDate: body.submittedDate ?? existing.submittedDate,
      settledDate: body.settledDate !== undefined ? body.settledDate : existing.settledDate,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      receiptUri: body.receiptUri !== undefined ? body.receiptUri : existing.receiptUri,
      createdAt: body.createdAt || existing.createdAt,
      updatedAt: body.updatedAt || now,
    };

    const parsed = ReimbursementClaimSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated: ReimbursementClaim & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    reimbursementsMap.set(id, updated);

    const syncOp = {
      id: randomUUID(),
      entityType: 'reimbursement_claim',
      entityId: id,
      operationType: 'update',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: updated.updatedAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ claim: updated }, 200);
  });

  // DELETE /reimbursements/:id: deletes claim (200)
  app.delete('/reimbursements/:id', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = reimbursementsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Claim not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    reimbursementsMap.delete(id);

    const now = new Date().toISOString();
    const syncOp = {
      id: randomUUID(),
      entityType: 'reimbursement_claim',
      entityId: id,
      operationType: 'delete',
      payload: { id },
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ success: true }, 200);
  });

  // ------------------------------------------
  // Subscriptions
  // ------------------------------------------

  // GET /subscriptions: returns user's subscriptions and burn rate (calculateSubscriptionBurnRate)
  app.get('/subscriptions', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userSubs = Array.from(subscriptionsMap.values()).filter(
      (sub) => sub.userId === user.id
    );
    const burnRate = calculateSubscriptionBurnRate(userSubs);

    return c.json({ subscriptions: userSubs, burnRate }, 200);
  });

  // POST /subscriptions: creates subscription, returns { subscription } (201)
  app.post('/subscriptions', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id: body.id || randomUUID(),
      name: body.name,
      category: body.category || 'Subscriptions',
      amountMinor: body.amountMinor,
      cadence: body.cadence || 'monthly',
      nextBillingDate: body.nextBillingDate || now,
      isAutoDetected: body.isAutoDetected ?? false,
      status: body.status || 'active',
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    };

    const parsed = SubscriptionItemSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const subscription: SubscriptionItem & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    if (subscriptionsMap.has(subscription.id) && subscriptionsMap.get(subscription.id)!.userId !== user.id) {
      return c.json({ error: 'Conflict: resource with this ID is owned by another user' }, 409);
    }

    subscriptionsMap.set(subscription.id, subscription);

    const syncOp = {
      id: randomUUID(),
      entityType: 'subscription',
      entityId: subscription.id,
      operationType: 'create',
      payload: subscription as unknown as Record<string, unknown>,
      timestamp: subscription.createdAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ subscription }, 201);
  });

  // PUT /subscriptions/:id: updates subscription, returns { subscription } (200)
  app.put('/subscriptions/:id', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = subscriptionsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const now = new Date().toISOString();
    const input = {
      id,
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      amountMinor: body.amountMinor ?? existing.amountMinor,
      cadence: body.cadence ?? existing.cadence,
      nextBillingDate: body.nextBillingDate ?? existing.nextBillingDate,
      isAutoDetected:
        body.isAutoDetected !== undefined ? body.isAutoDetected : existing.isAutoDetected,
      status: body.status ?? existing.status,
      createdAt: body.createdAt || existing.createdAt,
      updatedAt: body.updatedAt || now,
    };

    const parsed = SubscriptionItemSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated: SubscriptionItem & { userId: string } = {
      ...parsed.data,
      userId: user.id,
    };

    subscriptionsMap.set(id, updated);

    const syncOp = {
      id: randomUUID(),
      entityType: 'subscription',
      entityId: id,
      operationType: 'update',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: updated.updatedAt,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ subscription: updated }, 200);
  });

  // DELETE /subscriptions/:id: deletes subscription (200)
  app.delete('/subscriptions/:id', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const existing = subscriptionsMap.get(id);
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404);
    }
    if (existing.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    subscriptionsMap.delete(id);

    const now = new Date().toISOString();
    const syncOp = {
      id: randomUUID(),
      entityType: 'subscription',
      entityId: id,
      operationType: 'delete',
      payload: { id },
      timestamp: now,
      deviceId: 'server',
      status: 'synced',
    };
    syncedOpsMap.set(syncOp.id, syncOp);

    return c.json({ success: true }, 200);
  });

  // ------------------------------------------
  // Full Data Export & Import
  // ------------------------------------------

  // GET /export: returns full ledger JSON export (LedgerExportData)
  app.get('/export', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const accounts = Array.from(accountsMap.values())
      .filter((a) => a.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const categories = Array.from(categoriesMap.values())
      .filter((cat) => cat.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const transactions = Array.from(transactionsMap.values())
      .filter((tx) => tx.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const budgets = Array.from(budgetsMap.values())
      .filter((b) => b.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const goals = Array.from(goalsMap.values())
      .filter((g) => g.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const investments = Array.from(investmentsMap.values())
      .filter((i) => i.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const liabilities = Array.from(liabilitiesMap.values())
      .filter((l) => l.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const peerDebts = Array.from(peerDebtsMap.values())
      .filter((d) => d.userId === user.id)
      .map(({ userId, ...rest }) => rest);

    const debtIds = new Set(peerDebts.map((d) => d.id));
    const peerRepayments: PeerDebtRepayment[] = [];
    for (const [debtId, reps] of peerRepaymentsMap.entries()) {
      if (debtIds.has(debtId)) {
        peerRepayments.push(...reps);
      }
    }

    const reimbursements = Array.from(reimbursementsMap.values())
      .filter((r) => r.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const subscriptions = Array.from(subscriptionsMap.values())
      .filter((s) => s.userId === user.id)
      .map(({ userId, ...rest }) => rest);

    const exportData: LedgerExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      investments,
      liabilities,
      peerDebts,
      peerRepayments,
      reimbursements,
      subscriptions,
    };

    return c.json(exportData, 200);
  });

  // POST /import: validates incoming LedgerExportData, merges/reconciles deterministically into user's ledger, returns { success: true, count: number }
  app.post('/import', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const parsed = LedgerExportDataSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const data = parsed.data;
    const idMap = new Map<string, string>();
    let count = 0;

    for (const acc of data.accounts) {
      let accId = acc.id;
      if (accountsMap.has(accId) && accountsMap.get(accId)!.userId !== user.id) {
        accId = randomUUID();
        idMap.set(acc.id, accId);
      }
      accountsMap.set(accId, { ...acc, id: accId, userId: user.id });
      count++;
    }
    for (const cat of data.categories) {
      let catId = cat.id;
      if (categoriesMap.has(catId) && categoriesMap.get(catId)!.userId !== user.id) {
        catId = randomUUID();
        idMap.set(cat.id, catId);
      }
      categoriesMap.set(catId, { ...cat, id: catId, userId: user.id });
      count++;
    }
    for (const tx of data.transactions) {
      let txId = tx.id;
      if (transactionsMap.has(txId) && transactionsMap.get(txId)!.userId !== user.id) {
        txId = randomUUID();
        idMap.set(tx.id, txId);
      }
      const accountId = idMap.get(tx.accountId) ?? tx.accountId;
      const categoryId = idMap.get(tx.categoryId) ?? tx.categoryId;
      const toAccountId = tx.toAccountId ? (idMap.get(tx.toAccountId) ?? tx.toAccountId) : undefined;
      transactionsMap.set(txId, {
        ...tx,
        id: txId,
        accountId,
        categoryId,
        toAccountId,
        userId: user.id,
      });
      count++;
    }
    for (const b of data.budgets) {
      let bId = b.id;
      if (budgetsMap.has(bId) && budgetsMap.get(bId)!.userId !== user.id) {
        bId = randomUUID();
        idMap.set(b.id, bId);
      }
      const categoryId = idMap.get(b.categoryId) ?? b.categoryId;
      budgetsMap.set(bId, { ...b, id: bId, categoryId, userId: user.id });
      count++;
    }
    for (const g of data.goals) {
      let gId = g.id;
      if (goalsMap.has(gId) && goalsMap.get(gId)!.userId !== user.id) {
        gId = randomUUID();
        idMap.set(g.id, gId);
      }
      goalsMap.set(gId, { ...g, id: gId, userId: user.id });
      count++;
    }
    for (const inv of data.investments) {
      let invId = inv.id;
      if (investmentsMap.has(invId) && investmentsMap.get(invId)!.userId !== user.id) {
        invId = randomUUID();
        idMap.set(inv.id, invId);
      }
      investmentsMap.set(invId, { ...inv, id: invId, userId: user.id });
      count++;
    }
    for (const liab of data.liabilities) {
      let liabId = liab.id;
      if (liabilitiesMap.has(liabId) && liabilitiesMap.get(liabId)!.userId !== user.id) {
        liabId = randomUUID();
        idMap.set(liab.id, liabId);
      }
      liabilitiesMap.set(liabId, { ...liab, id: liabId, userId: user.id });
      count++;
    }
    for (const debt of data.peerDebts ?? []) {
      let debtId = debt.id;
      if (peerDebtsMap.has(debtId) && peerDebtsMap.get(debtId)!.userId !== user.id) {
        debtId = randomUUID();
        idMap.set(debt.id, debtId);
      }
      peerDebtsMap.set(debtId, { ...debt, id: debtId, userId: user.id });
      count++;
    }
    for (const rep of data.peerRepayments ?? []) {
      const mappedDebtId = idMap.get(rep.debtId) ?? rep.debtId;
      const debt = peerDebtsMap.get(mappedDebtId);
      if (debt && debt.userId === user.id) {
        const reps = peerRepaymentsMap.get(mappedDebtId) || [];
        const existingIdx = reps.findIndex((r) => r.id === rep.id);
        if (existingIdx >= 0) {
          reps[existingIdx] = { ...rep, debtId: mappedDebtId };
        } else {
          reps.push({ ...rep, debtId: mappedDebtId });
        }
        peerRepaymentsMap.set(mappedDebtId, reps);
        count++;
      }
    }
    for (const claim of data.reimbursements ?? []) {
      let claimId = claim.id;
      if (reimbursementsMap.has(claimId) && reimbursementsMap.get(claimId)!.userId !== user.id) {
        claimId = randomUUID();
        idMap.set(claim.id, claimId);
      }
      const transactionId = claim.transactionId
        ? (idMap.get(claim.transactionId) ?? claim.transactionId)
        : null;
      reimbursementsMap.set(claimId, { ...claim, id: claimId, transactionId, userId: user.id });
      count++;
    }
    for (const sub of data.subscriptions ?? []) {
      let subId = sub.id;
      if (subscriptionsMap.has(subId) && subscriptionsMap.get(subId)!.userId !== user.id) {
        subId = randomUUID();
        idMap.set(sub.id, subId);
      }
      subscriptionsMap.set(subId, { ...sub, id: subId, userId: user.id });
      count++;
    }

    return c.json({ success: true, count }, 200);
  });

  // ------------------------------------------
  // Intelligence & Explanations
  // ------------------------------------------

  // POST /intelligence/query: accepts { query: string }, runs processFinancialQuery, returns NaturalLanguageQueryResponse
  app.post('/intelligence/query', async (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const queryText = body?.query ?? body?.question;
    if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const accounts = Array.from(accountsMap.values())
      .filter((a) => a.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const categories = Array.from(categoriesMap.values())
      .filter((cat) => cat.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const transactions = Array.from(transactionsMap.values())
      .filter((tx) => tx.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const budgets = Array.from(budgetsMap.values())
      .filter((b) => b.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const investments = Array.from(investmentsMap.values())
      .filter((i) => i.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const liabilities = Array.from(liabilitiesMap.values())
      .filter((l) => l.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const peerDebts = Array.from(peerDebtsMap.values())
      .filter((d) => d.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const reimbursements = Array.from(reimbursementsMap.values())
      .filter((r) => r.userId === user.id)
      .map(({ userId, ...rest }) => rest);
    const subscriptions = Array.from(subscriptionsMap.values())
      .filter((s) => s.userId === user.id)
      .map(({ userId, ...rest }) => rest);

    const response = processFinancialQuery({
      query: queryText,
      accounts,
      transactions,
      categories,
      budgets,
      investments,
      liabilities,
      peerDebts,
      reimbursements,
      subscriptions,
    });

    return c.json({ ...response, response }, 200);
  });

  // GET /intelligence/forecast: runs forecastCashFlow, returns { forecast: CashFlowForecastPoint[] }
  app.get('/intelligence/forecast', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const accounts = Array.from(accountsMap.values()).filter((a) => a.userId === user.id);
    const transactions = Array.from(transactionsMap.values()).filter(
      (tx) => tx.userId === user.id
    );
    const subscriptions = Array.from(subscriptionsMap.values()).filter(
      (s) => s.userId === user.id
    );
    const liabilities = Array.from(liabilitiesMap.values()).filter(
      (l) => l.userId === user.id
    );

    let currentBalanceMinor = 0;
    for (const acc of accounts) {
      if (acc.type === 'bank' || acc.type === 'cash' || acc.type === 'wallet') {
        currentBalanceMinor += acc.initialBalanceMinor;
      }
    }
    for (const tx of transactions) {
      if (tx.type === 'income') currentBalanceMinor += tx.amountMinor;
      else if (tx.type === 'expense') currentBalanceMinor -= tx.amountMinor;
    }

    const forecast = forecastCashFlow({
      currentBalanceMinor,
      subscriptions,
      liabilities,
      transactions,
    });

    return c.json({ forecast }, 200);
  });

  // GET /intelligence/anomalies: runs detectAnomalies, returns { anomalies: FinancialAnomaly[] }
  app.get('/intelligence/anomalies', (c) => {
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const transactions = Array.from(transactionsMap.values()).filter(
      (tx) => tx.userId === user.id
    );
    const subscriptions = Array.from(subscriptionsMap.values()).filter(
      (s) => s.userId === user.id
    );
    const liabilities = Array.from(liabilitiesMap.values()).filter(
      (l) => l.userId === user.id
    );

    const anomalies = detectAnomalies({
      transactions,
      subscriptions,
      liabilities,
    });

    return c.json({ anomalies }, 200);
  });

  return app;
}
