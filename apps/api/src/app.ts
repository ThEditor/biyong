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
  type Group,
  type GroupMember,
  type GroupExpense,
  type Settlement,
  type GroupInvitation,
} from '@biyong/schemas';
import {
  canEditExpense,
  canDeleteExpense,
  isGroupMember,
  validatePayers,
  calculateSplit,
  buildDependencyGraph,
  explainMemberSettlement,
} from '@biyong/domain';
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

  // In-memory store for shared groups (Phase 5)
  const groupsMap = new Map<string, Group>();
  const groupMembersMap = new Map<string, GroupMember[]>(); // groupId -> GroupMember[]
  const groupExpensesMap = new Map<string, GroupExpense[]>(); // groupId -> GroupExpense[]
  const settlementsMap = new Map<string, Settlement[]>(); // groupId -> Settlement[]
  const invitesMap = new Map<string, GroupInvitation>(); // inviteCode -> GroupInvitation

  // Helper to authenticate request from Authorization header
  function getAuthUser(c: any): { id: string; email: string; name: string } | null {
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const session = sessionsMap.get(token);
    if (!session) return null;

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
    const user = getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

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
    let filteredOps = allOps;

    if (cursor) {
      const cursorTime = new Date(cursor).getTime();
      if (!isNaN(cursorTime)) {
        filteredOps = allOps.filter((op) => new Date(op.timestamp).getTime() > cursorTime);
      }
    }

    const latestTimestamp =
      filteredOps.length > 0
        ? filteredOps[filteredOps.length - 1].timestamp
        : cursor || new Date().toISOString();

    return c.json({
      operations: filteredOps,
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

    // Generate 6-char random invite code (e.g. INV-XXXXXX)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codePart = '';
    for (let i = 0; i < 6; i++) {
      codePart += chars.charAt(Math.floor(Math.random() * chars.length));
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

  return app;
}
