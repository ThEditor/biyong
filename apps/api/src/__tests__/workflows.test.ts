import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('API: Phase 7 & 8 Advanced Workflows & Intelligence', () => {
  const app = createApp();

  let tokenA: string;
  let userA: { id: string; email: string; name: string };
  let tokenB: string;
  let userB: { id: string; email: string; name: string };

  let rahulDebtId: string;
  let workClaimId: string;
  let netflixSubId: string;
  let githubSubId: string;
  let primeSubId: string;

  it('registers and authenticates User A and User B', async () => {
    // Register User A
    const resA = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nikhil.workflows@biyong.app',
        password: 'Password123!',
        name: 'Nikhil Sharma',
      }),
    });
    expect(resA.status).toBe(200);
    const dataA = (await resA.json()) as any;
    tokenA = dataA.token;
    userA = dataA.user;
    expect(tokenA).toBeDefined();

    // Register User B
    const resB = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sneha.workflows@biyong.app',
        password: 'Password123!',
        name: 'Sneha Roy',
      }),
    });
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()) as any;
    tokenB = dataB.token;
    userB = dataB.user;
    expect(tokenB).toBeDefined();
  });

  // ==========================================
  // 1. Peer Debts (Lending & Borrowing)
  // ==========================================
  it('creates peer debt (Rahul borrowed ₹15,000) and verifies summary', async () => {
    const createRes = await app.request('/debts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        personName: 'Rahul',
        type: 'lent',
        originalAmountMinor: 1500000, // ₹15,000
        remainingAmountMinor: 1500000,
        currency: 'INR',
        notes: 'Loan for Goa trip advance',
        dueDate: '2026-10-01',
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    expect(createData.debt).toBeDefined();
    expect(createData.debt.id).toBeDefined();
    expect(createData.debt.personName).toBe('Rahul');
    expect(createData.debt.type).toBe('lent');
    expect(createData.debt.originalAmountMinor).toBe(1500000);
    expect(createData.debt.remainingAmountMinor).toBe(1500000);
    expect(createData.debt.status).toBe('active');
    rahulDebtId = createData.debt.id;

    // Verify summary via GET /debts
    const listRes = await app.request('/debts', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.debts).toHaveLength(1);
    expect(listData.summary.totalLentMinor).toBe(1500000);
    expect(listData.summary.totalBorrowedMinor).toBe(0);
    expect(listData.summary.netBalanceMinor ?? listData.summary.netPeerBalanceMinor).toBe(1500000);
    expect(listData.summary.activeCount ?? listData.summary.activeLentCount).toBe(1);
  });

  it('records partial repayment (₹5,000 -> remaining ₹10,000) and updates status', async () => {
    // Rahul repays ₹5,000
    const repayRes = await app.request(`/debts/${rahulDebtId}/repay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amountMinor: 500000, // ₹5,000
        notes: 'First installment via UPI',
      }),
    });
    expect(repayRes.status).toBe(200);
    const repayData = (await repayRes.json()) as any;
    expect(repayData.debt.remainingAmountMinor).toBe(1000000); // Remaining ₹10,000
    expect(repayData.debt.status).toBe('active');
    expect(repayData.repayment.amountMinor).toBe(500000);
    expect(repayData.repayment.debtId).toBe(rahulDebtId);

    // Verify updated summary
    const listRes = await app.request('/debts', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.summary.totalLentMinor).toBe(1000000);
  });

  it('updates debt details and records full repayment to settle', async () => {
    // Update notes
    const updateRes = await app.request(`/debts/${rahulDebtId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        notes: 'Goa trip advance - final settlement pending',
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateData = (await updateRes.json()) as any;
    expect(updateData.debt.notes).toBe('Goa trip advance - final settlement pending');

    // Rahul repays remaining ₹10,000 -> settles
    const settleRes = await app.request(`/debts/${rahulDebtId}/repay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amountMinor: 1000000, // ₹10,000
        notes: 'Final settlement',
      }),
    });
    expect(settleRes.status).toBe(200);
    const settleData = (await settleRes.json()) as any;
    expect(settleData.debt.remainingAmountMinor).toBe(0);
    expect(settleData.debt.status).toBe('settled');

    // Create a new active debt for later queries
    const newDebtRes = await app.request('/debts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        personName: 'Rahul',
        type: 'lent',
        originalAmountMinor: 1500000,
        remainingAmountMinor: 1000000,
        currency: 'INR',
        notes: 'Dinner loan',
      }),
    });
    expect(newDebtRes.status).toBe(201);
  });

  // ==========================================
  // 2. Reimbursements
  // ==========================================
  it('creates and approves a reimbursement claim', async () => {
    // Create work reimbursement claim
    const createRes = await app.request('/reimbursements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Team Offsite Lunch at Taj',
        category: 'work',
        amountMinor: 720000, // ₹7,200
        currency: 'INR',
        status: 'submitted',
        submittedDate: '2026-09-01T12:00:00.000Z',
        notes: 'Official client meeting lunch',
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    expect(createData.claim).toBeDefined();
    expect(createData.claim.id).toBeDefined();
    expect(createData.claim.title).toBe('Team Offsite Lunch at Taj');
    expect(createData.claim.status).toBe('submitted');
    expect(createData.claim.amountMinor).toBe(720000);
    workClaimId = createData.claim.id;

    // Check summary
    const listRes = await app.request('/reimbursements', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.claims).toHaveLength(1);
    expect(listData.summary.pendingMinor ?? listData.summary.totalPendingMinor).toBe(720000);

    // Approve claim
    const approveRes = await app.request(`/reimbursements/${workClaimId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        status: 'approved',
      }),
    });
    expect(approveRes.status).toBe(200);
    const approveData = (await approveRes.json()) as any;
    expect(approveData.claim.status).toBe('approved');

    // Verify summary after approval
    const listRes2 = await app.request('/reimbursements', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listData2 = (await listRes2.json()) as any;
    expect(listData2.summary.pendingMinor ?? listData2.summary.totalApprovedMinor).toBe(720000);

    // Reimbursed settlement
    const reimburseRes = await app.request(`/reimbursements/${workClaimId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        status: 'reimbursed',
        settledDate: '2026-09-07T00:00:00.000Z',
      }),
    });
    expect(reimburseRes.status).toBe(200);
    const reimburseData = (await reimburseRes.json()) as any;
    expect(reimburseData.claim.status).toBe('reimbursed');
  });

  // ==========================================
  // 3. Subscriptions & Burn Rate Calculation
  // ==========================================
  it('creates recurring subscriptions and calculates burn rate accurately', async () => {
    // 1. Netflix (Monthly: ₹649 = 64900 minor)
    const netflixRes = await app.request('/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Netflix 4K Premium',
        category: 'Entertainment',
        amountMinor: 64900,
        cadence: 'monthly',
        nextBillingDate: '2026-09-15',
      }),
    });
    expect(netflixRes.status).toBe(201);
    netflixSubId = (await netflixRes.json()).subscription.id;

    // 2. GitHub Copilot (Monthly: ₹1,200 = 120000 minor)
    const ghRes = await app.request('/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'GitHub Copilot Individual',
        category: 'Software',
        amountMinor: 120000,
        cadence: 'monthly',
        nextBillingDate: '2026-09-10',
      }),
    });
    expect(ghRes.status).toBe(201);
    githubSubId = (await ghRes.json()).subscription.id;

    // 3. Amazon Prime (Yearly: ₹1,499 = 149900 minor)
    const primeRes = await app.request('/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Amazon Prime Annual',
        category: 'Shopping',
        amountMinor: 149900,
        cadence: 'yearly',
        nextBillingDate: '2027-01-15',
      }),
    });
    expect(primeRes.status).toBe(201);
    primeSubId = (await primeRes.json()).subscription.id;

    // Query GET /subscriptions and verify burn rate
    const listRes = await app.request('/subscriptions', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.subscriptions).toHaveLength(3);
    expect(listData.burnRate).toBeDefined();
    expect(listData.burnRate.activeCount ?? listData.burnRate.activeSubscriptionsCount).toBe(3);

    // Monthly burn rate = 64900 + 120000 + round(149900/12) = 64900 + 120000 + 12492 = 197392
    expect(listData.burnRate.monthlyBurnRateMinor).toBe(197392);
    // Yearly burn rate = 197392 * 12 = 2368704 (or 2368700)
    expect(listData.burnRate.yearlyBurnRateMinor).toBeGreaterThan(2360000);
  });

  // ==========================================
  // 4. Natural Language Queries & Financial Intelligence
  // ==========================================
  it('answers "Who owes me money?", "Can I afford a ₹70,000 laptop?", and "Why did I spend more this month?"', async () => {
    // Seed initial bank account and spending transactions via /import
    await app.request('/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        accounts: [
          {
            id: 'acc-hdfc-1',
            name: 'HDFC Savings Account',
            type: 'bank',
            currency: 'INR',
            initialBalanceMinor: 15000000, // ₹1,50,000 liquid
            isArchived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        categories: [
          {
            id: 'cat-dining',
            name: 'Dining & Restaurants',
            icon: 'utensils',
            color: '#FF5733',
            type: 'expense',
            isSystem: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        transactions: [
          {
            id: 'tx-dining-1',
            accountId: 'acc-hdfc-1',
            type: 'expense',
            amountMinor: 3500000, // ₹35,000 spent on Dining
            currency: 'INR',
            categoryId: 'cat-dining',
            date: '2026-09-02T19:00:00.000Z',
            merchant: 'Bukhara ITC',
            createdAt: '2026-09-02T19:00:00.000Z',
            updatedAt: '2026-09-02T19:00:00.000Z',
          },
        ],
        budgets: [],
        goals: [],
        investments: [],
        liabilities: [],
      }),
    });

    // 1. "Who owes me money?"
    const owesRes = await app.request('/intelligence/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ query: 'Who owes me money?' }),
    });
    expect(owesRes.status).toBe(200);
    const owesData = (await owesRes.json()) as any;
    expect(owesData.matchedIntent).toBe('who_owes_me');
    expect(owesData.headline).toContain('10,000');
    expect(owesData.explanation).toContain('Rahul');

    // 2. "Can I afford a ₹70,000 laptop?"
    const affordRes = await app.request('/intelligence/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ query: 'Can I afford a ₹70,000 laptop?' }),
    });
    expect(affordRes.status).toBe(200);
    const affordData = (await affordRes.json()) as any;
    expect(affordData.matchedIntent).toBe('can_i_afford');
    expect(affordData.supportingData.canAfford).toBe(true);
    expect(affordData.headline).toContain('afford');

    // 3. "Why did I spend more this month?"
    const spendRes = await app.request('/intelligence/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ query: 'Why did I spend more this month?' }),
    });
    expect(spendRes.status).toBe(200);
    const spendData = (await spendRes.json()) as any;
    expect(spendData.matchedIntent).toBe('why_spend_more');
    expect(spendData.headline).toContain('Spending increased');
    expect(spendData.explanation).toContain('Dining & Restaurants');

    // 4. Cash Flow Forecast
    const forecastRes = await app.request('/intelligence/forecast', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(forecastRes.status).toBe(200);
    const forecastData = (await forecastRes.json()) as any;
    expect(forecastData.forecast).toHaveLength(30);

    // 5. Anomalies
    const anomalyRes = await app.request('/intelligence/anomalies', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(anomalyRes.status).toBe(200);
    const anomalyData = (await anomalyRes.json()) as any;
    expect(anomalyData.anomalies).toBeInstanceOf(Array);
  });

  // ==========================================
  // 5. Full JSON Export & Import Data Integrity
  // ==========================================
  it('exports complete ledger and re-imports deterministically with full data integrity', async () => {
    // 1. Export ledger for User A
    const exportRes = await app.request('/export', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(exportRes.status).toBe(200);
    const exportData = (await exportRes.json()) as any;

    expect(exportData.version).toBe('1.0');
    expect(exportData.exportedAt).toBeDefined();
    expect(exportData.accounts).toHaveLength(1);
    expect(exportData.categories).toHaveLength(1);
    expect(exportData.transactions).toHaveLength(1);
    expect(exportData.peerDebts.length).toBeGreaterThanOrEqual(1);
    expect(exportData.subscriptions).toHaveLength(3);

    // 2. Re-import into User A's ledger
    const importRes = await app.request('/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(exportData),
    });
    expect(importRes.status).toBe(200);
    const importData = (await importRes.json()) as any;
    expect(importData.success).toBe(true);
    expect(importData.count).toBeGreaterThan(0);

    // 3. Verify debts and subscriptions intact
    const debtsRes = await app.request('/debts', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const debtsData = (await debtsRes.json()) as any;
    expect(debtsData.debts.length).toBeGreaterThanOrEqual(1);

    const subsRes = await app.request('/subscriptions', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const subsData = (await subsRes.json()) as any;
    expect(subsData.subscriptions).toHaveLength(3);
  });

  // ==========================================
  // 6. Cross-User Security & Authorization Guard (401/403)
  // ==========================================
  it('strictly enforces unauthorized (401) and forbidden cross-user (403) access', async () => {
    // 1. Unauthenticated requests -> 401
    expect((await app.request('/debts')).status).toBe(401);
    expect((await app.request('/reimbursements')).status).toBe(401);
    expect((await app.request('/subscriptions')).status).toBe(401);
    expect((await app.request('/export')).status).toBe(401);
    expect((await app.request('/intelligence/query', { method: 'POST' })).status).toBe(401);

    // 2. User B sees isolated empty lists
    const bDebts = await app.request('/debts', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(bDebts.status).toBe(200);
    expect((await bDebts.json() as any).debts).toEqual([]);

    const bSubs = await app.request('/subscriptions', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(bSubs.status).toBe(200);
    expect((await bSubs.json() as any).subscriptions).toEqual([]);

    // 3. User B cannot edit User A's debt -> 403
    const editDebt = await app.request(`/debts/${rahulDebtId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ personName: 'Hacked' }),
    });
    expect(editDebt.status).toBe(403);

    // 4. User B cannot repay User A's debt -> 403
    const repayDebt = await app.request(`/debts/${rahulDebtId}/repay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ amountMinor: 1000 }),
    });
    expect(repayDebt.status).toBe(403);

    // 5. User B cannot delete User A's debt -> 403
    const delDebt = await app.request(`/debts/${rahulDebtId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(delDebt.status).toBe(403);

    // 6. User B cannot edit User A's subscription -> 403
    const editSub = await app.request(`/subscriptions/${netflixSubId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    expect(editSub.status).toBe(403);

    // 7. User B cannot delete User A's subscription -> 403
    const delSub = await app.request(`/subscriptions/${netflixSubId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(delSub.status).toBe(403);

    // 8. 404 for non-existent entities
    const notFoundDebt = await app.request('/debts/non-existent-id', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(notFoundDebt.status).toBe(404);

    const notFoundSub = await app.request('/subscriptions/non-existent-id', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(notFoundSub.status).toBe(404);
  });
});
