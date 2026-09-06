import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('API: Phase 6 Wealth Endpoints (Investments, Liabilities & Net Worth)', () => {
  const app = createApp();

  let tokenA: string;
  let userA: { id: string; email: string; name: string };
  let tokenB: string;
  let userB: { id: string; email: string; name: string };

  let fdInvestmentId: string;
  let stockInvestmentId: string;
  let homeLoanLiabilityId: string;

  it('registers and authenticates User A and User B', async () => {
    // User A
    const resA = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice.wealth@biyong.app',
        password: 'Password123!',
        name: 'Alice Wealth',
      }),
    });
    expect(resA.status).toBe(200);
    const dataA = (await resA.json()) as any;
    tokenA = dataA.token;
    userA = dataA.user;
    expect(tokenA).toBeDefined();
    expect(userA.email).toBe('alice.wealth@biyong.app');

    // Login check
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice.wealth@biyong.app',
        password: 'Password123!',
      }),
    });
    expect(loginRes.status).toBe(200);

    // User B
    const resB = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob.wealth@biyong.app',
        password: 'Password123!',
        name: 'Bob Wealth',
      }),
    });
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()) as any;
    tokenB = dataB.token;
    userB = dataB.user;
  });

  it('creates FD and Stock investments for User A', async () => {
    // 1. Create FD Investment
    const fdRes = await app.request('/wealth/investments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'HDFC Fixed Deposit',
        type: 'fd',
        investedAmountMinor: 10000000, // 100,000 INR
        currentValueMinor: 10500000, // 105,000 INR
        currency: 'INR',
      }),
    });
    expect(fdRes.status).toBe(201);
    const fdData = (await fdRes.json()) as any;
    expect(fdData.investment).toBeDefined();
    expect(fdData.investment.id).toBeDefined();
    expect(fdData.investment.name).toBe('HDFC Fixed Deposit');
    expect(fdData.investment.type).toBe('fd');
    expect(fdData.investment.investedAmountMinor).toBe(10000000);
    expect(fdData.investment.currentValueMinor).toBe(10500000);
    fdInvestmentId = fdData.investment.id;

    // 2. Create Stock Investment
    const stockRes = await app.request('/wealth/investments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Reliance Industries',
        type: 'stock',
        investedAmountMinor: 5000000, // 50,000 INR
        currentValueMinor: 6500000, // 65,000 INR
        currency: 'INR',
        notes: 'Bought for long term',
      }),
    });
    expect(stockRes.status).toBe(201);
    const stockData = (await stockRes.json()) as any;
    expect(stockData.investment).toBeDefined();
    expect(stockData.investment.type).toBe('stock');
    expect(stockData.investment.notes).toBe('Bought for long term');
    stockInvestmentId = stockData.investment.id;
  });

  it('lists investments for User A', async () => {
    const res = await app.request('/wealth/investments', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.investments).toHaveLength(2);
    expect(data.investments.map((i: any) => i.id)).toContain(fdInvestmentId);
    expect(data.investments.map((i: any) => i.id)).toContain(stockInvestmentId);
  });

  it('creates Home Loan liability for User A', async () => {
    const res = await app.request('/wealth/liabilities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'SBI Home Loan',
        type: 'loan',
        principalAmountMinor: 50000000, // 500,000 INR
        remainingAmountMinor: 45000000, // 450,000 INR
        currency: 'INR',
        interestRatePercent: 8.5,
      }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.liability).toBeDefined();
    expect(data.liability.id).toBeDefined();
    expect(data.liability.name).toBe('SBI Home Loan');
    expect(data.liability.remainingAmountMinor).toBe(45000000);
    expect(data.liability.interestRatePercent).toBe(8.5);
    homeLoanLiabilityId = data.liability.id;
  });

  it('lists liabilities for User A', async () => {
    const res = await app.request('/wealth/liabilities', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.liabilities).toHaveLength(1);
    expect(data.liabilities[0].id).toBe(homeLoanLiabilityId);
  });

  it('fetches /wealth/summary and verifies net worth calculation', async () => {
    const res = await app.request('/wealth/summary', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.summary).toBeDefined();

    // Total investments: 10500000 + 6500000 = 17000000
    // Total liabilities: 45000000
    // Total assets: 17000000
    // Net worth: 17000000 - 45000000 = -28000000
    expect(data.summary.investmentsMinor).toBe(17000000);
    expect(data.summary.totalAssetsMinor).toBe(17000000);
    expect(data.summary.totalLiabilitiesMinor).toBe(45000000);
    expect(data.summary.netWorthMinor).toBe(-28000000);

    // Verify asset allocation
    expect(data.summary.assetAllocation).toBeInstanceOf(Array);
    const fdAlloc = data.summary.assetAllocation.find((a: any) => a.category === 'FD');
    const stockAlloc = data.summary.assetAllocation.find((a: any) => a.category === 'STOCK');
    expect(fdAlloc).toBeDefined();
    expect(fdAlloc.amountMinor).toBe(10500000);
    expect(stockAlloc).toBeDefined();
    expect(stockAlloc.amountMinor).toBe(6500000);
  });

  it('records payment towards liability and clamps correctly', async () => {
    // 1. Pay 5,000,000 INR (50,000 INR)
    const payRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ amountMinor: 5000000 }),
    });
    expect(payRes.status).toBe(200);
    const payData = (await payRes.json()) as any;
    expect(payData.paymentMinor).toBe(5000000);
    expect(payData.liability.remainingAmountMinor).toBe(40000000);

    // 2. Verify summary reflects updated remaining amount
    const summaryRes = await app.request('/wealth/summary', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(summaryRes.status).toBe(200);
    const summaryData = (await summaryRes.json()) as any;
    expect(summaryData.summary.totalLiabilitiesMinor).toBe(40000000);
    expect(summaryData.summary.netWorthMinor).toBe(17000000 - 40000000);

    // 3. Test invalid payment amount
    const invalidPayRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ amountMinor: -500 }),
    });
    expect(invalidPayRes.status).toBe(400);

    // 4. Test payment clamping to 0 when exceeding remaining amount
    const createSmallLiabRes = await app.request('/wealth/liabilities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Small EMI',
        type: 'emi',
        principalAmountMinor: 50000,
        remainingAmountMinor: 50000,
        currency: 'INR',
      }),
    });
    const smallLiabId = (await createSmallLiabRes.json()).liability.id;

    const overpayRes = await app.request(`/wealth/liabilities/${smallLiabId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ amountMinor: 80000 }),
    });
    expect(overpayRes.status).toBe(200);
    const overpayData = (await overpayRes.json()) as any;
    expect(overpayData.liability.remainingAmountMinor).toBe(0);

    // Clean up small liability
    await app.request(`/wealth/liabilities/${smallLiabId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
  });

  it('updates an investment and a liability', async () => {
    // Update investment current value
    const invRes = await app.request(`/wealth/investments/${stockInvestmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        currentValueMinor: 7500000,
        notes: 'Price surged',
      }),
    });
    expect(invRes.status).toBe(200);
    const invData = (await invRes.json()) as any;
    expect(invData.investment.currentValueMinor).toBe(7500000);
    expect(invData.investment.notes).toBe('Price surged');

    // Update liability
    const liabRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        interestRatePercent: 9.0,
      }),
    });
    expect(liabRes.status).toBe(200);
    const liabData = (await liabRes.json()) as any;
    expect(liabData.liability.interestRatePercent).toBe(9.0);
  });

  it('enforces unauthorized (401) and cross-user (403) protections', async () => {
    // 1. Unauthenticated requests
    const unauthInv = await app.request('/wealth/investments');
    expect(unauthInv.status).toBe(401);

    const unauthLiab = await app.request('/wealth/liabilities');
    expect(unauthLiab.status).toBe(401);

    const unauthSummary = await app.request('/wealth/summary');
    expect(unauthSummary.status).toBe(401);

    // 2. User B sees empty lists (isolation)
    const bInvestments = await app.request('/wealth/investments', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(bInvestments.status).toBe(200);
    expect((await bInvestments.json()).investments).toEqual([]);

    const bLiabilities = await app.request('/wealth/liabilities', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(bLiabilities.status).toBe(200);
    expect((await bLiabilities.json()).liabilities).toEqual([]);

    // 3. User B cannot edit User A's investment -> 403
    const editInvRes = await app.request(`/wealth/investments/${stockInvestmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ currentValueMinor: 1000000 }),
    });
    expect(editInvRes.status).toBe(403);

    // 4. User B cannot delete User A's investment -> 403
    const delInvRes = await app.request(`/wealth/investments/${stockInvestmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(delInvRes.status).toBe(403);

    // 5. User B cannot edit User A's liability -> 403
    const editLiabRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ interestRatePercent: 12 }),
    });
    expect(editLiabRes.status).toBe(403);

    // 6. User B cannot pay User A's liability -> 403
    const payLiabRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ amountMinor: 1000 }),
    });
    expect(payLiabRes.status).toBe(403);

    // 7. User B cannot delete User A's liability -> 403
    const delLiabRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(delLiabRes.status).toBe(403);

    // 8. 404 for non-existent entities
    const notFoundInv = await app.request('/wealth/investments/non-existent-id', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Does not exist' }),
    });
    expect(notFoundInv.status).toBe(404);

    const notFoundLiab = await app.request('/wealth/liabilities/non-existent-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(notFoundLiab.status).toBe(404);
  });

  it('deletes an investment and a liability successfully', async () => {
    // Delete stock investment
    const delInvRes = await app.request(`/wealth/investments/${stockInvestmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(delInvRes.status).toBe(200);
    const delInvData = (await delInvRes.json()) as any;
    expect(delInvData.success).toBe(true);

    // Verify investment removed
    const listInvRes = await app.request('/wealth/investments', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listInvData = (await listInvRes.json()) as any;
    expect(listInvData.investments).toHaveLength(1);
    expect(listInvData.investments[0].id).toBe(fdInvestmentId);

    // Delete home loan liability
    const delLiabRes = await app.request(`/wealth/liabilities/${homeLoanLiabilityId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(delLiabRes.status).toBe(200);
    const delLiabData = (await delLiabRes.json()) as any;
    expect(delLiabData.success).toBe(true);

    // Verify liability removed
    const listLiabRes = await app.request('/wealth/liabilities', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listLiabData = (await listLiabRes.json()) as any;
    expect(listLiabData.liabilities).toHaveLength(0);

    // Summary reflects single remaining investment and 0 liabilities
    const summaryRes = await app.request('/wealth/summary', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const summaryData = (await summaryRes.json()) as any;
    expect(summaryData.summary.investmentsMinor).toBe(10500000);
    expect(summaryData.summary.totalLiabilitiesMinor).toBe(0);
    expect(summaryData.summary.netWorthMinor).toBe(10500000);
  });
});
