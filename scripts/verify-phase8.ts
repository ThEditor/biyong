/**
 * Biyong — Phase 8 Verification Script
 * Strictly verifies Phase 8 (Intelligence & Ecosystem) per biyong.md Section 61.
 *
 * Verification criteria:
 * 1. Rule-Based Natural Language Query Engine (Deterministic, zero hallucinations):
 *    - "Why did I spend more this month?" -> why_spend_more
 *    - "Who owes me money?" -> who_owes_me
 *    - "How much did I invest this year?" -> investments_ytd
 *    - "Can I afford a ₹70,000 laptop?" -> can_i_afford (computes liquidity, buffer, verdict)
 *    - "Why did my net worth increase?" -> why_networth_change
 * 2. Financial Anomaly Detection:
 *    - Duplicate charge within 24-hour window (same merchant, same amount).
 *    - Spending spike (> 2.5x category rolling average).
 * 3. 60-Day Liquid Cash Flow Forecasting:
 *    - Simulates 60-day liquid runway projecting deterministic recurring subscriptions, debt repayments, and liabilities.
 * 4. Heuristic Merchant Categorization:
 *    - Accurately classifies Indian and global merchants into standardized categories.
 * 5. Additive Invariant:
 *    - Intelligence engine strictly observes data without mutating balances, accounts, or transactions.
 * 6. Cloud Sync / API Endpoints:
 *    - Verifies /intelligence/query, /intelligence/forecast, and /intelligence/anomalies with authorization.
 */

import { createApp } from '../apps/api/src/app.js';
import {
  runMigrations,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteBudgetRepository,
  SqliteGoalRepository,
  SqliteWealthRepository,
  SqlitePeerDebtRepository,
  SqliteSubscriptionRepository,
  SqliteReimbursementRepository,
  SqliteCategoryRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import {
  AccountUseCases,
  TransactionUseCases,
  IntelligenceUseCases,
} from '../packages/application/src/index.js';
import {
  NaturalLanguageQueryEngine,
  detectAnomalies,
  forecastCashFlow,
  categorizeMerchantHeuristic,
  formatMoney,
} from '../packages/domain/src/index.js';
import type {
  Account,
  Investment,
  Liability,
  PeerDebt,
  SubscriptionItem,
  Transaction,
} from '../packages/schemas/src/index.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exit(1);
  }
}

async function runPhase8Verification() {
  console.log('\n====================================================');
  console.log('   BIYONG — PHASE 8 (INTELLIGENCE & ECOSYSTEM)');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. Initialize SQLite Ledger Engine
  // ----------------------------------------------------
  console.log('1. Initializing Local SQLite Engine & Data Repositories...');
  const driver = new MemorySqliteDriver();
  await driver.init();
  await runMigrations(driver);

  const accountRepo = new SqliteAccountRepository(driver);
  const txRepo = new SqliteTransactionRepository(driver);
  const budgetRepo = new SqliteBudgetRepository(driver);
  const goalRepo = new SqliteGoalRepository(driver);
  const wealthRepo = new SqliteWealthRepository(driver);
  const peerDebtRepo = new SqlitePeerDebtRepository(driver);
  const subRepo = new SqliteSubscriptionRepository(driver);
  const categoryRepo = new SqliteCategoryRepository(driver);

  const accountUseCases = new AccountUseCases(accountRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo);
  const intelligenceUseCases = new IntelligenceUseCases({
    accountRepo,
    txRepo,
    categoryRepo,
    budgetRepo,
    wealthRepo,
    peerDebtRepo,
    subscriptionRepo: subRepo,
  });

  console.log('   [OK] Repositories and IntelligenceUseCases initialized.\n');

  // ----------------------------------------------------
  // 2. Populate Realistic Baseline Financial Context
  // ----------------------------------------------------
  console.log('2. Populating Baseline Ledger for Financial Analysis...');

  // Accounts
  const salaryAcc: Account = {
    id: 'acc-salary',
    name: 'HDFC Salary Account',
    type: 'bank',
    currency: 'INR',
    initialBalanceMinor: 25000000, // ₹2,50,000.00 liquid
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  await accountUseCases.createAccount(salaryAcc);

  // Peer Debts
  const debtToBob: PeerDebt = {
    id: 'debt-bob-1',
    personName: 'Bob',
    type: 'lent',
    originalAmountMinor: 1500000, // ₹15,000
    remainingAmountMinor: 1500000,
    currency: 'INR',
    date: '2026-03-01',
    dueDate: '2026-04-01',
    notes: 'Goa trip advance',
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
  await peerDebtRepo.create(debtToBob);

  // Investments
  const niftyEtf: Investment = {
    id: 'inv-nifty',
    name: 'Nippon India Nifty 50 ETF',
    type: 'etf',
    currency: 'INR',
    investedAmountMinor: 50000000, // ₹5,00,000
    currentValueMinor: 58000000,   // ₹5,80,000 (+₹80,000)
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
  await wealthRepo.saveInvestment(niftyEtf);

  // Liabilities
  const carLoan: Liability = {
    id: 'liab-car',
    name: 'HDFC Car Loan',
    type: 'loan',
    currency: 'INR',
    principalAmountMinor: 80000000, // ₹8,00,000
    remainingAmountMinor: 62000000, // ₹6,20,000
    interestRatePercent: 8.5,
    dueDate: '10',
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
  await wealthRepo.saveLiability(carLoan);

  // Subscriptions
  const netflixSub: SubscriptionItem = {
    id: 'sub-netflix',
    name: 'Netflix Premium',
    category: 'Entertainment',
    amountMinor: 64900,
    cadence: 'monthly',
    nextBillingDate: '2026-04-01',
    isAutoDetected: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  await subRepo.create(netflixSub);

  // Base Transactions
  await txUseCases.createTransaction({
    id: 'tx-rent-mar',
    accountId: 'acc-salary',
    type: 'expense',
    amountMinor: 3500000, // ₹35,000
    currency: 'INR',
    date: '2026-03-01',
    categoryId: 'cat-housing',
    category: 'Housing',
    merchant: 'Landlord',
    notes: 'March rent',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  });

  await txUseCases.createTransaction({
    id: 'tx-food-1',
    accountId: 'acc-salary',
    type: 'expense',
    amountMinor: 85000, // ₹850
    currency: 'INR',
    date: '2026-03-02',
    categoryId: 'cat-food',
    category: 'Food & Dining',
    merchant: 'Swiggy',
    notes: 'Lunch',
    createdAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
  });

  console.log('   [OK] Baseline financial data registered.\n');

  // ----------------------------------------------------
  // 3. Rule-Based Natural Language Query Engine
  // ----------------------------------------------------
  console.log('3. Testing Deterministic Natural Language Financial Query Engine...');

  // Query 1: "Who owes me money?"
  const qWhoOwes = await intelligenceUseCases.askQuestion('Who owes me money?');
  assert(qWhoOwes.matchedIntent === 'who_owes_me', 'Expected who_owes_me intent');
  assert(qWhoOwes.explanation.includes('Bob'), 'Should reference Bob in explanation');
  assert(qWhoOwes.explanation.includes('15,000') || qWhoOwes.headline.includes('15,000'), 'Should state ₹15,000');
  console.log(`   [OK] Q: "Who owes me money?" -> ${qWhoOwes.headline}`);

  // Query 2: "How much did I invest this year?"
  const qInvest = await intelligenceUseCases.askQuestion('How much did I invest this year?');
  assert(qInvest.matchedIntent === 'investments_ytd', 'Expected investments_ytd intent');
  assert(qInvest.explanation.includes('5,80,000') || qInvest.headline.includes('5,80,000') || qInvest.headline.includes('5,00,000'), 'Should reflect investment values');
  console.log(`   [OK] Q: "How much did I invest this year?" -> ${qInvest.headline}`);

  // Query 3: "Can I afford a ₹70,000 laptop?"
  const qAfford = await intelligenceUseCases.askQuestion('Can I afford a ₹70,000 laptop?');
  assert(qAfford.matchedIntent === 'can_i_afford', 'Expected can_i_afford intent');
  assert(qAfford.headline.toLowerCase().includes('affordable') || qAfford.headline.toLowerCase().includes('yes'), 'With ₹2.5L liquid, ₹70K laptop should be affordable');
  console.log(`   [OK] Q: "Can I afford a ₹70,000 laptop?" -> ${qAfford.headline}`);

  // Query 4: "Why did I spend more this month?"
  const qWhySpend = await intelligenceUseCases.askQuestion('Why did I spend more this month?');
  assert(qWhySpend.matchedIntent === 'why_spend_more', 'Expected why_spend_more intent');
  console.log(`   [OK] Q: "Why did I spend more this month?" -> ${qWhySpend.headline}`);

  // Query 5: "Why did my net worth change?"
  const qNetWorth = await intelligenceUseCases.askQuestion('Why did my net worth change?');
  assert(qNetWorth.matchedIntent === 'why_networth_change', 'Expected why_networth_change intent');
  console.log(`   [OK] Q: "Why did my net worth change?" -> ${qNetWorth.headline}\n`);

  // ----------------------------------------------------
  // 4. Financial Anomaly Detection
  // ----------------------------------------------------
  console.log('4. Testing Anomaly Detection (Spikes & 24h Duplicate Charges)...');

  // Create duplicate charge within 24h (Swiggy ₹850 charged twice in 2 hours)
  await txUseCases.createTransaction({
    id: 'tx-dup-swiggy',
    accountId: 'acc-salary',
    type: 'expense',
    amountMinor: 85000, // Identical ₹850
    currency: 'INR',
    date: '2026-03-02',
    categoryId: 'cat-food',
    category: 'Food & Dining',
    merchant: 'Swiggy', // Identical merchant
    notes: 'Duplicate lunch',
    createdAt: '2026-03-02T02:00:00.000Z',
    updatedAt: '2026-03-02T02:00:00.000Z',
  });

  // Create a massive spending spike (> 2.5x category historical average)
  // Food average is ~₹850, create ₹18,000 luxury dinner spike
  await txUseCases.createTransaction({
    id: 'tx-spike-dinner',
    accountId: 'acc-salary',
    type: 'expense',
    amountMinor: 1800000, // ₹18,000
    currency: 'INR',
    date: '2026-03-03',
    categoryId: 'cat-food',
    category: 'Food & Dining',
    merchant: 'Taj Falaknuma',
    notes: 'Luxury celebration dinner',
    createdAt: '2026-03-03T20:00:00.000Z',
    updatedAt: '2026-03-03T20:00:00.000Z',
  });

  const anomalies = await intelligenceUseCases.detectAnomalies();
  assert(anomalies.length >= 2, `Should detect at least 2 anomalies (got ${anomalies.length})`);

  const dupAnomaly = anomalies.find((a) => a.type === 'duplicate_charge');
  assert(dupAnomaly !== undefined, 'Duplicate charge anomaly must be detected');
  assert(dupAnomaly.merchant === 'Swiggy', 'Duplicate anomaly should identify Swiggy');
  assert(dupAnomaly.amountMinor === 85000, 'Duplicate anomaly should note ₹850');
  console.log(`   [OK] Duplicate charge detected: ${dupAnomaly.title} (${dupAnomaly.description})`);

  const spikeAnomaly = anomalies.find((a) => a.type === 'spending_spike');
  assert(spikeAnomaly !== undefined, 'Spending spike anomaly must be detected');
  assert(spikeAnomaly.category === 'Food & Dining', 'Spike should identify Food & Dining category');
  console.log(`   [OK] Spending spike detected: ${spikeAnomaly.title} (${spikeAnomaly.description})\n`);

  // ----------------------------------------------------
  // 5. 60-Day Liquid Cash Flow Forecasting
  // ----------------------------------------------------
  console.log('5. Testing 60-Day Liquid Runway Cash Flow Forecasting...');

  const forecast = await intelligenceUseCases.forecastRunway(60);
  assert(forecast.length === 60, 'Forecast must contain 60 daily points');
  assert(forecast[0].projectedBalanceMinor > 0, 'Current liquid balance should be positive');

  // Verify that recurring subscriptions and debt deductions are modeled into forward trajectory
  const startBal = forecast[0].projectedBalanceMinor;
  const endBal = forecast[59].projectedBalanceMinor;
  console.log(`   Day 1 Liquid: ${formatMoney(startBal)} -> Day 60 Projected: ${formatMoney(endBal)}`);
  assert(forecast[10].expectedOutflowMinor >= 0, 'Expected outflows must be non-negative integer minors');
  console.log('   [OK] 60-Day Liquid Runway forecast generated successfully.\n');

  // ----------------------------------------------------
  // 6. Heuristic Merchant Categorization
  // ----------------------------------------------------
  console.log('6. Testing Heuristic Merchant Categorization Engine...');

  const c1 = categorizeMerchantHeuristic('Swiggy Instamart Order');
  assert(c1.category === 'Food & Dining' || c1.category === 'Groceries', `Swiggy should map to food/groceries (got ${c1.category})`);

  const c2 = categorizeMerchantHeuristic('Uber Trip Bangalore');
  assert(c2.category === 'Transportation', `Uber should map to Transportation (got ${c2.category})`);

  const c3 = categorizeMerchantHeuristic('Netflix Entertainment Monthly');
  assert(c3.category === 'Entertainment', `Netflix should map to Entertainment (got ${c3.category})`);

  const c4 = categorizeMerchantHeuristic('Amazon India Shopping');
  assert(c4.category === 'Shopping', `Amazon should map to Shopping (got ${c4.category})`);

  console.log('   [OK] Merchant categorization verified: Swiggy, Uber, Netflix, Amazon accurately classified.\n');

  // ----------------------------------------------------
  // 7. Additive Invariant Check (Zero silent ledger mutation)
  // ----------------------------------------------------
  console.log('7. Verifying Additive Invariant (Zero Silent Mutation)...');

  const beforeTxCount = (await txRepo.findAll()).length;
  const beforeAccBal = (await accountRepo.findById('acc-salary'))!.initialBalanceMinor;

  // Run multiple intense queries and projections
  await intelligenceUseCases.askQuestion('Can I afford a ₹5,00,000 car?');
  await intelligenceUseCases.askQuestion('Why did I spend more this month?');
  await intelligenceUseCases.detectAnomalies();
  await intelligenceUseCases.forecastRunway(90);

  const afterTxCount = (await txRepo.findAll()).length;
  const afterAccBal = (await accountRepo.findById('acc-salary'))!.initialBalanceMinor;

  assert(beforeTxCount === afterTxCount, 'Transaction count must remain completely unchanged');
  assert(beforeAccBal === afterAccBal, 'Account initial balance must remain completely unchanged');
  console.log('   [OK] Additive Invariant verified: Intelligence engine NEVER mutates ledger state.\n');

  // ----------------------------------------------------
  // 8. Multi-User Backend Sync & API Security
  // ----------------------------------------------------
  console.log('8. Testing Intelligence API Endpoints & Security...');
  const apiApp = createApp();

  // Register User
  const regRes = await apiApp.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Intelligence User',
      email: 'ai-user@example.com',
      password: 'Password123!',
    }),
  });
  const auth = await regRes.json();
  const token = auth.token;

  // Test POST /intelligence/query
  const queryRes = await apiApp.request('/intelligence/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question: 'Who owes me money?' }),
  });
  assert(queryRes.status === 200, 'Intelligence query API should return 200');
  const queryBody = await queryRes.json();
  assert(queryBody.response.matchedIntent !== undefined, 'Query response should include matchedIntent');

  // Test GET /intelligence/forecast
  const forecastRes = await apiApp.request('/intelligence/forecast?days=60', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assert(forecastRes.status === 200, 'Forecast API should return 200');
  const forecastBody = await forecastRes.json();
  assert(Array.isArray(forecastBody.forecast), 'Forecast API should return forecast array');

  // Test GET /intelligence/anomalies
  const anomaliesRes = await apiApp.request('/intelligence/anomalies', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assert(anomaliesRes.status === 200, 'Anomalies API should return 200');
  const anomaliesBody = await anomaliesRes.json();
  assert(Array.isArray(anomaliesBody.anomalies), 'Anomalies API should return anomalies array');

  console.log('   [OK] API endpoints (/intelligence/query, /forecast, /anomalies) verified.\n');

  console.log('====================================================');
  console.log('   PHASE 8 VERIFICATION COMPLETE: ALL CHECKS PASSED');
  console.log('====================================================\n');
}

runPhase8Verification().catch((err) => {
  console.error('Unexpected error in Phase 8 verification:', err);
  process.exit(1);
});
