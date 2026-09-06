import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('API: Phase 5 Shared Groups Integration', () => {
  const app = createApp();

  let tokenA: string;
  let userA: { id: string; email: string; name: string };
  let tokenB: string;
  let userB: { id: string; email: string; name: string };
  let tokenC: string; // Non-member

  let groupId: string;
  let memberAId: string;
  let memberBId: string;
  let inviteCode: string;
  let expenseId: string;

  it('sets up users A, B, and C', async () => {
    // User A
    const resA = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@biyong.app',
        password: 'Password123!',
        name: 'Alice',
      }),
    });
    expect(resA.status).toBe(200);
    const dataA = (await resA.json()) as any;
    tokenA = dataA.token;
    userA = dataA.user;

    // User B
    const resB = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob@biyong.app',
        password: 'Password123!',
        name: 'Bob',
      }),
    });
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()) as any;
    tokenB = dataB.token;
    userB = dataB.user;

    // User C (outsider)
    const resC = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'charlie@biyong.app',
        password: 'Password123!',
        name: 'Charlie',
      }),
    });
    expect(resC.status).toBe(200);
    const dataC = (await resC.json()) as any;
    tokenC = dataC.token;
  });

  it('User A creates group', async () => {
    const res = await app.request('/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Goa Trip 2026',
        currency: 'INR',
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.group).toBeDefined();
    expect(data.group.name).toBe('Goa Trip 2026');
    expect(data.group.isPrivate).toBe(false);
    expect(data.group.ownerId).toBe(userA.id);

    expect(data.member).toBeDefined();
    expect(data.member.userId).toBe(userA.id);
    expect(data.member.role).toBe('owner');
    expect(data.member.name).toBe('Alice');

    groupId = data.group.id;
    memberAId = data.member.id;
  });

  it('User A lists groups and sees created group', async () => {
    const res = await app.request('/groups', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].id).toBe(groupId);
  });

  it('User A generates invite code', async () => {
    const res = await app.request(`/groups/${groupId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ email: 'bob@biyong.app' }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.invitation).toBeDefined();
    expect(data.invitation.groupId).toBe(groupId);
    expect(data.invitation.inviterUserId).toBe(userA.id);
    expect(data.invitation.inviteCode).toMatch(/^INV-[A-Z0-9]{6}$/);
    expect(data.invitation.status).toBe('pending');

    inviteCode = data.invitation.inviteCode;
  });

  it('User B joins via invite code', async () => {
    const res = await app.request('/groups/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ inviteCode }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.group.id).toBe(groupId);
    expect(data.member.userId).toBe(userB.id);
    expect(data.member.role).toBe('member');
    expect(data.member.name).toBe('Bob');

    memberBId = data.member.id;
  });

  it('User B joining again returns already member message', async () => {
    const res = await app.request('/groups/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ inviteCode }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message).toBe('Already a member');
    expect(data.member.id).toBe(memberBId);
  });

  it('User A creates expense', async () => {
    const res = await app.request(`/groups/${groupId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Villa Stay',
        amountMinor: 10000,
        currency: 'INR',
        date: '2026-09-07',
        payers: [{ memberId: memberAId, amountMinor: 10000 }],
        splitMethod: 'equal',
        allocations: [{ memberId: memberAId }, { memberId: memberBId }],
        notes: 'Villa booking in North Goa',
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.expense).toBeDefined();
    expect(data.expense.title).toBe('Villa Stay');
    expect(data.expense.amountMinor).toBe(10000);
    expect(data.expense.createdByUserId).toBe(userA.id);
    expect(data.expense.createdByMemberId).toBe(memberAId);

    expenseId = data.expense.id;
  });

  it("User B attempts to edit User A's expense -> returns 403 Forbidden", async () => {
    const res = await app.request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        title: 'Hacked Villa Title',
      }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe('Only the creator can edit this expense');
  });

  it('User A edits own expense -> returns 200 OK', async () => {
    const res = await app.request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Luxury Villa Stay',
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.expense.title).toBe('Luxury Villa Stay');
    expect(data.expense.amountMinor).toBe(10000);
  });

  it("User B attempts to delete User A's expense -> returns 403 Forbidden", async () => {
    const res = await app.request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe('Forbidden');
  });

  it('User B settles with User A -> returns 201 OK', async () => {
    const res = await app.request(`/groups/${groupId}/settlements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        fromMemberId: memberBId,
        toMemberId: memberAId,
        amountMinor: 5000,
        currency: 'INR',
        notes: 'Bob settled half of villa stay with Alice',
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.settlement).toBeDefined();
    expect(data.settlement.fromMemberId).toBe(memberBId);
    expect(data.settlement.toMemberId).toBe(memberAId);
    expect(data.settlement.amountMinor).toBe(5000);
  });

  it('Graph endpoint returns accurate nodes and edges', async () => {
    const res = await app.request(`/groups/${groupId}/graph`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.graph).toBeDefined();
    expect(data.graph.nodes).toBeDefined();
    expect(data.graph.edges).toBeDefined();

    // Member nodes
    const memberNodes = data.graph.nodes.filter((n: any) => n.type === 'member');
    expect(memberNodes).toHaveLength(2);

    // Expense node
    const expenseNodes = data.graph.nodes.filter((n: any) => n.type === 'expense');
    expect(expenseNodes).toHaveLength(1);
    expect(expenseNodes[0].label).toBe('Luxury Villa Stay');

    // Edges: 1 payment, 2 split shares, 1 settlement
    expect(data.graph.edges.length).toBeGreaterThanOrEqual(3);
    const settlementEdge = data.graph.edges.find((e: any) => e.label === 'Settled');
    expect(settlementEdge).toBeDefined();
    expect(settlementEdge.amountMinor).toBe(5000);
  });

  it('Explanation endpoint returns accurate balance and origins', async () => {
    const res = await app.request(`/groups/${groupId}/members/${memberBId}/explanation`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.explanation).toBeDefined();
    expect(data.explanation.memberId).toBe(memberBId);

    // Bob was allocated 5000 minor in the villa stay
    expect(data.explanation.origins).toHaveLength(1);
    expect(data.explanation.origins[0].allocatedMinor).toBe(5000);

    // Bob settled 5000 minor
    expect(data.explanation.settlementsMadeMinor).toBe(5000);

    // After settling 5000, Bob's net balance should be 0!
    expect(data.explanation.netBalanceMinor).toBe(0);
    expect(data.explanation.transfers).toHaveLength(0);
  });

  it('Non-member User C is rejected with 403 Forbidden', async () => {
    const res = await app.request(`/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    expect(res.status).toBe(403);
  });

  it('Unauthenticated requests are rejected with 401 Unauthorized', async () => {
    const res = await app.request(`/groups/${groupId}`);
    expect(res.status).toBe(401);
  });

  it('User A (owner) deletes expense -> returns 200 OK', async () => {
    const deleteRes = await app.request(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(deleteRes.status).toBe(200);
    const deleteData = (await deleteRes.json()) as any;
    expect(deleteData.success).toBe(true);

    // Verify expense is removed
    const groupRes = await app.request(`/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const groupData = (await groupRes.json()) as any;
    expect(groupData.expenses).toHaveLength(0);
  });
});
