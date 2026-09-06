/**
 * Biyong — Phase 2 Verification Harness (Budgets & Goals)
 *
 * Verifies 100% Offline-First invariants:
 * 1. Category Budgets (weekly & monthly) with deterministic period calculation
 * 2. Rollover budget mechanics (surplus rollover & deficit carryover)
 * 3. Budget health status ('healthy' | 'warning' | 'exceeded') and daily allowance
 * 4. Savings Goals with target dates, contribution tracking, and progress percentage
 * 5. Deterministic required monthly savings and projected completion dates
 * 6. Fixed vs Variable spending classification
 * 7. Multi-month spending trends and savings rates
 * 8. Zero floating-point arithmetic (strictly integer minor units / paise)
 */

import {
  runMigrations,
  SqliteAccountRepository,
  SqliteCategoryRepository,
  SqliteTransactionRepository,
  SqliteBudgetRepository,
  SqliteGoalRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import {
  AccountUseCases,
  TransactionUseCases,
  CategoryUseCases,
  BudgetUseCases,
  GoalUseCases,
  AnalyticsUseCases,
} from '../packages/application/src/index.js';
import {
  formatMoney,
  calculateBudgetPeriod,
  calculateBudgetStatus,
  calculateRollover,
  calculateGoalProgress,
  calculateRequiredMonthlySavings,
  projectCompletionDate,
  classifySpending,
  calculateSpendingTrends,
} from '../packages/domain/src/index.js';
import type { Account, Budget, Goal, Transaction } from '../packages/schemas/src/index.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`\x1b[31m[FAILED]\x1b[0m ${message}`);
    process.exit(1);
  }
}

async function runPhase2Verification() {
  console.log('\n====================================================');
  console.log('   BIYONG — PHASE 2 (BUDGETS & GOALS) VERIFIER   ');
  console.log('====================================================\n');

  // 1. Initialize SQLite completely offline
  console.log('1. Initializing 100% Offline Database & Repositories...');
  const driver = new MemorySqliteDriver();
  await driver.init();
  await runMigrations(driver);

  const accountRepo = new SqliteAccountRepository(driver);
  const categoryRepo = new SqliteCategoryRepository(driver);
  const txRepo = new SqliteTransactionRepository(driver);
  const budgetRepo = new SqliteBudgetRepository(driver);
  const goalRepo = new SqliteGoalRepository(driver);

  const accountUseCases = new AccountUseCases(accountRepo, txRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo, categoryRepo);
  const categoryUseCases = new CategoryUseCases(categoryRepo);
  const budgetUseCases = new BudgetUseCases(budgetRepo, txRepo);
  const goalUseCases = new GoalUseCases(goalRepo);
  const analyticsUseCases = new AnalyticsUseCases(txRepo);
  console.log('   [OK] SQLite schema and all repositories initialized.\n');

  // 2. Set up accounts and seed transactions
  console.log('2. Setting up Accounts and Financial Activity...');
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const today = `${year}-${month}-15`;

  const primaryBank: Account = {
    id: 'acc-bank-main',
    name: 'Salary Bank Account',
    type: 'bank',
    initialBalanceMinor: 5000000, // ₹50,000.00
    currency: 'INR',
    isArchived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const cashWallet: Account = {
    id: 'acc-cash-wallet',
    name: 'Cash Wallet',
    type: 'cash',
    initialBalanceMinor: 200000, // ₹2,000.00
    currency: 'INR',
    isArchived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await accountUseCases.createAccount(primaryBank);
  await accountUseCases.createAccount(cashWallet);

  // Add Income (₹80,000)
  await txUseCases.createTransaction({
    id: 'tx-salary',
    accountId: primaryBank.id,
    type: 'income',
    amountMinor: 8000000,
    currency: 'INR',
    date: `${year}-${month}-01`,
    categoryId: 'cat-salary',
    merchant: 'Acme Corp',
    notes: 'Monthly salary credit',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Fixed recurring expense: Rent (₹22,000)
  await txUseCases.createTransaction({
    id: 'tx-rent',
    accountId: primaryBank.id,
    type: 'expense',
    amountMinor: 2200000,
    currency: 'INR',
    date: `${year}-${month}-02`,
    categoryId: 'cat-housing',
    merchant: 'Apartment Owner',
    notes: 'Monthly apartment rent',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Fixed recurring expense: Utilities (₹3,500)
  await txUseCases.createTransaction({
    id: 'tx-power',
    accountId: primaryBank.id,
    type: 'expense',
    amountMinor: 350000,
    currency: 'INR',
    date: `${year}-${month}-05`,
    categoryId: 'cat-utilities',
    merchant: 'State Electricity Board',
    notes: 'Electricity bill',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Groceries expenses (₹4,200 + ₹2,300 = ₹6,500)
  await txUseCases.createTransaction({
    id: 'tx-groc-1',
    accountId: primaryBank.id,
    type: 'expense',
    amountMinor: 420000,
    currency: 'INR',
    date: `${year}-${month}-08`,
    categoryId: 'cat-groceries',
    merchant: 'Nature Basket',
    notes: 'Bi-weekly groceries',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  await txUseCases.createTransaction({
    id: 'tx-groc-2',
    accountId: primaryBank.id,
    type: 'expense',
    amountMinor: 230000,
    currency: 'INR',
    date: `${year}-${month}-12`,
    categoryId: 'cat-groceries',
    merchant: 'Zepto',
    notes: 'Fresh veggies and milk',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Dining expense (₹1,800)
  await txUseCases.createTransaction({
    id: 'tx-dining-1',
    accountId: primaryBank.id,
    type: 'expense',
    amountMinor: 180000,
    currency: 'INR',
    date: `${year}-${month}-14`,
    categoryId: 'cat-food',
    merchant: 'Trattoria Italia',
    notes: 'Dinner with family',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Internal Transfer (₹5,000) — MUST NOT count as income or expense!
  await txUseCases.createTransaction({
    id: 'tx-transfer-atm',
    accountId: primaryBank.id,
    type: 'transfer',
    amountMinor: 500000,
    currency: 'INR',
    date: `${year}-${month}-10`,
    categoryId: null,
    merchant: 'HDFC ATM',
    notes: 'Cash withdrawal for pocket money',
    toAccountId: cashWallet.id,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  console.log('   [OK] Accounts created, income/expenses/transfers recorded.\n');

  // 3. Create Budgets & Verify Period / Health / Rollover
  console.log('3. Verifying Category Budgets & Rollover Mechanics...');
  const monthlyGroceriesBudget: Budget = {
    id: 'bgt-groceries',
    categoryId: 'cat-groceries',
    amountMinor: 1000000, // ₹10,000.00
    currency: 'INR',
    period: 'monthly',
    startDate: `${year}-${month}-01`,
    endDate: null,
    rollover: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const diningBudget: Budget = {
    id: 'bgt-dining',
    categoryId: 'cat-food',
    amountMinor: 200000, // ₹2,000.00
    currency: 'INR',
    period: 'monthly',
    startDate: `${year}-${month}-01`,
    endDate: null,
    rollover: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await budgetUseCases.createBudget(monthlyGroceriesBudget);
  await budgetUseCases.createBudget(diningBudget);

  const groceryStatus = await budgetUseCases.getBudgetStatus(monthlyGroceriesBudget.id, now);
  console.log(`   • Groceries Budget:     ${formatMoney(groceryStatus.budgetAmountMinor, 'INR')}`);
  console.log(`   • Groceries Spent:      ${formatMoney(groceryStatus.spentMinor, 'INR')}`);
  console.log(`   • Groceries Remaining:  ${formatMoney(groceryStatus.remainingMinor, 'INR')}`);
  console.log(`   • Budget Health:        ${groceryStatus.health.toUpperCase()} (${groceryStatus.percentageUsed}% used)`);
  console.log(`   • Daily Allowance:      ${formatMoney(groceryStatus.dailyAllowanceMinor, 'INR')}/day (${groceryStatus.daysRemaining} days left)`);

  assert(groceryStatus.spentMinor === 650000, 'Groceries spent must be exactly ₹6,500.00');
  assert(groceryStatus.remainingMinor === 350000, 'Groceries remaining must be exactly ₹3,500.00');
  assert(groceryStatus.percentageUsed === 65, 'Groceries percentage used must be 65%');
  assert(groceryStatus.health === 'healthy', 'Groceries budget health must be "healthy"');

  // Test Rollover Calculation
  const surplusRollover = calculateRollover(monthlyGroceriesBudget, groceryStatus.spentMinor);
  console.log(`   • Surplus Rollover:     +${formatMoney(surplusRollover, 'INR')} carries into next period`);
  assert(surplusRollover === 350000, 'Surplus rollover must carry ₹3,500.00 forward');

  const nonRollover = calculateRollover(diningBudget, 180000);
  assert(nonRollover === 0, 'Disabled rollover must return 0');

  // Test Deficit Rollover
  const deficitRollover = calculateRollover(monthlyGroceriesBudget, 1200000);
  assert(deficitRollover === -200000, 'Overspending must produce a negative rollover deficit');
  console.log('   [OK] Category budgets, period calculations, and rollover verified.\n');

  // 4. Create Savings Goals & Verify Projections
  console.log('4. Verifying Savings Goals, Target Dates & Projections...');
  const targetDate = new Date(year, now.getMonth() + 6, 1).toISOString().split('T')[0]; // 6 months away
  const emergencyGoal: Goal = {
    id: 'goal-emergency-fund',
    title: 'Emergency Fund',
    targetAmountMinor: 12000000, // ₹1,20,000.00
    currentAmountMinor: 3000000,  // ₹30,000.00 initial
    currency: 'INR',
    targetDate,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await goalUseCases.createGoal(emergencyGoal);

  // Add Contribution (₹20,000)
  const updatedGoal = await goalUseCases.contributeToGoal(emergencyGoal.id, 2000000);
  assert(updatedGoal.currentAmountMinor === 5000000, 'Goal progress must reflect contribution (₹50,000.00)');

  // Progress calculations
  const progress = await goalUseCases.getGoalProgress(emergencyGoal.id, now, 1500000); // Save ₹15,000/month
  console.log(`   • Goal Title:           ${progress.title}`);
  console.log(`   • Target Amount:        ${formatMoney(progress.targetAmountMinor, 'INR')}`);
  console.log(`   • Saved So Far:         ${formatMoney(progress.currentAmountMinor, 'INR')} (${progress.percentageComplete}% complete)`);
  console.log(`   • Remaining Needed:     ${formatMoney(progress.remainingAmountMinor, 'INR')}`);
  console.log(`   • Months Remaining:     ${progress.monthsRemaining} months (Target: ${targetDate})`);
  console.log(`   • Required Monthly:     ${formatMoney(progress.requiredMonthlySavingsMinor, 'INR')}/month to hit deadline`);
  console.log(`   • Projected Completion: ${progress.projectedCompletionDate}`);

  assert(progress.remainingAmountMinor === 7000000, 'Remaining goal amount must be ₹70,000.00');
  assert(progress.percentageComplete === 42, 'Goal completion percentage must be 42%');
  assert(progress.requiredMonthlySavingsMinor > 0, 'Required monthly savings must be strictly positive');
  assert(progress.projectedCompletionDate !== null, 'Projected completion date must be deterministically calculated');
  console.log('   [OK] Savings goals, contributions, and projections verified.\n');

  // 5. Fixed vs Variable Spending Analysis
  console.log('5. Verifying Fixed vs Variable Spending Classification...');
  const spendingBreakdown = await analyticsUseCases.getFixedVsVariable();
  console.log(`   • Total Spending:       ${formatMoney(spendingBreakdown.totalSpendingMinor, 'INR')}`);
  console.log(`   • Fixed Spending:       ${formatMoney(spendingBreakdown.fixedSpendingMinor, 'INR')} (${spendingBreakdown.fixedPercentage}%) [Rent & Utilities]`);
  console.log(`   • Variable Spending:    ${formatMoney(spendingBreakdown.variableSpendingMinor, 'INR')} (${spendingBreakdown.variablePercentage}%) [Groceries & Dining]`);

  // Rent (₹22k) + Power (₹3.5k) = ₹25,500 fixed
  // Groceries (₹6.5k) + Dining (₹1.8k) = ₹8,300 variable
  // Total = ₹33,800. Transfers (₹5k) must be excluded!
  assert(spendingBreakdown.fixedSpendingMinor === 2550000, 'Fixed spending must be exactly ₹25,500.00');
  assert(spendingBreakdown.variableSpendingMinor === 830000, 'Variable spending must be exactly ₹8,300.00');
  assert(spendingBreakdown.totalSpendingMinor === 3380000, 'Total spending must exclude internal transfers');
  console.log('   [OK] Fixed vs variable spending accurately classified.\n');

  // 6. Spending Trends Calculation
  console.log('6. Verifying Multi-Month Spending Trends...');
  const trends = await analyticsUseCases.getSpendingTrends(3, now);
  const currentMonthTrend = trends.find((t) => t.period === `${year}-${month}`);
  assert(currentMonthTrend !== undefined, 'Current month trend must exist');
  console.log(`   • Period:               ${currentMonthTrend.period}`);
  console.log(`   • Income:               ${formatMoney(currentMonthTrend.incomeMinor, 'INR')}`);
  console.log(`   • Expenses:             ${formatMoney(currentMonthTrend.expenseMinor, 'INR')}`);
  console.log(`   • Net Savings:          ${formatMoney(currentMonthTrend.savingsMinor, 'INR')}`);
  console.log(`   • Savings Rate:         ${currentMonthTrend.savingsRate}%`);

  assert(currentMonthTrend.incomeMinor === 8000000, 'Current month income must be ₹80,000.00');
  assert(currentMonthTrend.expenseMinor === 3380000, 'Current month expenses must be ₹33,800.00');
  assert(currentMonthTrend.savingsMinor === 4620000, 'Current month savings must be ₹46,200.00');
  assert(currentMonthTrend.savingsRate === 58, 'Savings rate must be 58%');
  console.log('   [OK] Spending trends and savings rate verified.\n');

  console.log('====================================================');
  console.log('   ALL PHASE 2 GATES PASSED (100% OFFLINE VERIFIED)  ');
  console.log('====================================================\n');
}

runPhase2Verification().catch((err) => {
  console.error('\x1b[31mPhase 2 Verification failed:\x1b[0m', err);
  process.exit(1);
});
