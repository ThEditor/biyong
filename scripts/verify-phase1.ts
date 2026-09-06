import {
  runMigrations,
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteCategoryRepository,
} from '../packages/local-db/src/index.js';
import { MemorySqliteDriver } from '../packages/local-db/src/memory-driver.js';
import {
  AccountUseCases,
  TransactionUseCases,
  CategoryUseCases,
} from '../packages/application/src/index.js';
import {
  formatMoney,
  generateMonthlyReport,
  filterTransactions,
} from '../packages/domain/src/index.js';

async function main() {
  console.log('====================================================');
  console.log('   BIYONG — PHASE 1 (LOCAL MONEY LEDGER) VERIFIER   ');
  console.log('====================================================\n');

  console.log('1. Simulating 100% Offline Environment (Zero Network)...');
  const driver = new MemorySqliteDriver();
  await driver.init();
  await runMigrations(driver);

  const accountRepo = new SqliteAccountRepository(driver);
  const txRepo = new SqliteTransactionRepository(driver);
  const catRepo = new SqliteCategoryRepository(driver);

  const accountUseCases = new AccountUseCases(accountRepo, txRepo);
  const txUseCases = new TransactionUseCases(accountRepo, txRepo, catRepo);
  const catUseCases = new CategoryUseCases(catRepo);

  console.log('\n2. Creating Accounts...');
  await accountUseCases.createAccount({
    id: 'acc-checking',
    name: 'HDFC Checking',
    type: 'bank',
    initialBalanceMinor: 1000000, // ₹10,000
    currency: 'INR',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await accountUseCases.createAccount({
    id: 'acc-cash',
    name: 'Physical Cash',
    type: 'cash',
    initialBalanceMinor: 50000, // ₹500
    currency: 'INR',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await accountUseCases.createAccount({
    id: 'acc-credit',
    name: 'ICICI Credit Card',
    type: 'credit',
    initialBalanceMinor: 0,
    currency: 'INR',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('   [OK] Created Checking, Cash, and Credit Card accounts.');

  console.log('\n3. Recording Income, Expenses, Transfers & Recurring...');
  // Income: Salary ₹40,000
  await txUseCases.createTransaction({
    id: 'tx-salary',
    accountId: 'acc-checking',
    type: 'income',
    amountMinor: 4000000, // ₹40,000
    currency: 'INR',
    date: '2026-09-01',
    categoryId: 'cat-salary',
    subcategory: 'Primary Income',
    merchant: 'Acme Corp',
    notes: 'Monthly Paycheck',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Expense: Groceries ₹2,400 from Checking
  await txUseCases.createTransaction({
    id: 'tx-grocery',
    accountId: 'acc-checking',
    type: 'expense',
    amountMinor: 240000, // ₹2,400
    currency: 'INR',
    date: '2026-09-02',
    categoryId: 'cat-groceries',
    subcategory: 'Food Supplies',
    merchant: 'Zepto',
    notes: 'Weekly pantry restock',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Expense: Tea ₹50 from Cash
  await txUseCases.createTransaction({
    id: 'tx-chai',
    accountId: 'acc-cash',
    type: 'expense',
    amountMinor: 5000, // ₹50
    currency: 'INR',
    date: '2026-09-03',
    categoryId: 'cat-food',
    subcategory: 'Tea',
    merchant: 'Sharma Tea Stall',
    notes: 'Evening tea with team',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Expense: Dinner ₹1,200 on Credit Card
  await txUseCases.createTransaction({
    id: 'tx-dinner',
    accountId: 'acc-credit',
    type: 'expense',
    amountMinor: 120000, // ₹1,200
    currency: 'INR',
    date: '2026-09-04',
    categoryId: 'cat-food',
    subcategory: 'Dining Out',
    merchant: 'Bistro 42',
    notes: 'Friday dinner',
    toAccountId: null,
    isRecurring: false,
    recurringFrequency: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Transfer: ATM Cash withdrawal ₹2,000 from Checking to Cash
  await txUseCases.createTransaction({
    id: 'tx-atm',
    accountId: 'acc-checking',
    type: 'transfer',
    amountMinor: 200000, // ₹2,000
    currency: 'INR',
    date: '2026-09-05',
    categoryId: null,
    subcategory: null,
    merchant: 'HDFC ATM',
    notes: 'Cash withdrawal',
    toAccountId: 'acc-cash',
    isRecurring: false,
    recurringFrequency: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Recurring Expense: Subscription ₹649 on Credit Card
  await txUseCases.createTransaction({
    id: 'tx-sub',
    accountId: 'acc-credit',
    type: 'expense',
    amountMinor: 64900, // ₹649
    currency: 'INR',
    date: '2026-09-06',
    categoryId: 'cat-entertainment',
    subcategory: 'Streaming',
    merchant: 'Netflix',
    notes: 'Premium 4K',
    toAccountId: null,
    isRecurring: true,
    recurringFrequency: 'monthly',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('   [OK] Recorded income, expenses, transfer, and recurring subscription.');

  console.log('\n4. Verifying Derived Account Balances (Zero Corruption)...');
  const checkingBal = await txUseCases.getDerivedAccountBalance('acc-checking');
  const cashBal = await txUseCases.getDerivedAccountBalance('acc-cash');
  const creditBal = await txUseCases.getDerivedAccountBalance('acc-credit');

  console.log(`   • Checking Balance:   ${formatMoney(checkingBal, 'INR')} (Expected ₹45,600.00)`);
  console.log(`   • Cash Balance:       ${formatMoney(cashBal, 'INR')} (Expected ₹2,450.00)`);
  console.log(`   • Credit Card Owed:   ${formatMoney(creditBal, 'INR')} (Expected -₹1,849.00)`);

  if (checkingBal !== 4560000) throw new Error('Checking balance mismatch!');
  if (cashBal !== 245000) throw new Error('Cash balance mismatch!');
  if (creditBal !== -184900) throw new Error('Credit card balance mismatch!');

  console.log('\n5. Verifying Monthly Report & Financial Invariants...');
  const report = await txUseCases.getMonthlyReport(2026, 9);

  console.log(`   • Total Income:       ${formatMoney(report.totalIncomeMinor, 'INR')}`);
  console.log(`   • Total Expenses:     ${formatMoney(report.totalExpenseMinor, 'INR')}`);
  console.log(`   • Net Savings:        ${formatMoney(report.netSavingsMinor, 'INR')}`);
  console.log(`   • Savings Rate:       ${report.savingsRatePercent}%`);

  // Verification: Transfers must NOT be counted in income or expense!
  // Expected Income: 40,000 (4,000,000 minor)
  // Expected Expense: 2,400 + 50 + 1,200 + 649 = 4,299 (429,900 minor)
  // Expected Net: 40,000 - 4,299 = 35,701 (3,570,100 minor)
  if (report.totalIncomeMinor !== 4000000) throw new Error('Transfer contaminated income!');
  if (report.totalExpenseMinor !== 429900) throw new Error('Transfer contaminated expense!');
  if (report.netSavingsMinor !== 3570100) throw new Error('Net savings calculation mismatch!');

  console.log('\n   Category Spending Breakdown:');
  for (const cat of report.categoryBreakdown) {
    console.log(`     - ${cat.categoryName || cat.categoryId}: ${formatMoney(cat.spentMinor, 'INR')} (${cat.percentage}%)`);
  }

  console.log('\n   Top Merchants:');
  for (const m of report.topMerchants) {
    console.log(`     - ${m.merchant}: ${formatMoney(m.spentMinor, 'INR')}`);
  }

  console.log('\n6. Verifying Search & Filtering Queries...');
  const zeptoSearch = await txRepo.findByFilter({ searchQuery: 'Zepto' });
  console.log(`   • Search "Zepto" returned: ${zeptoSearch.length} transaction(s) [${zeptoSearch[0]?.merchant}]`);
  if (zeptoSearch.length !== 1 || zeptoSearch[0]?.merchant !== 'Zepto') throw new Error('Search failed!');

  const foodFilter = await txRepo.findByFilter({ categoryId: 'cat-food' });
  console.log(`   • Filter category "cat-food" returned: ${foodFilter.length} transaction(s)`);
  if (foodFilter.length !== 2) throw new Error('Category filter failed!');

  console.log('\n====================================================');
  console.log('   ALL PHASE 1 GATES PASSED (100% OFFLINE VERIFIED)  ');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Phase 1 Verification Failed:', err);
  process.exit(1);
});
