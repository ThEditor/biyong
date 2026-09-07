import type {
  Account,
  Budget,
  CashFlowForecastPoint,
  Category,
  FinancialAnomaly,
  Investment,
  Liability,
  NaturalLanguageQueryResponse,
  PeerDebt,
  SubscriptionItem,
  Transaction,
} from '@biyong/schemas';
import { formatMoney } from './money.js';

export interface FinancialContext {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  investments: Investment[];
  liabilities: Liability[];
  peerDebts: PeerDebt[];
  subscriptions: SubscriptionItem[];
}

/**
 * Calculates derived balance for an account strictly from transactions and initial balance.
 */
function deriveBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.initialBalanceMinor;
  for (const tx of transactions) {
    if (tx.accountId === account.id) {
      if (tx.type === 'income') {
        balance += tx.amountMinor;
      } else if (tx.type === 'expense') {
        balance -= tx.amountMinor;
      } else if (tx.type === 'transfer') {
        balance -= tx.amountMinor;
      }
    } else if (tx.type === 'transfer' && tx.toAccountId === account.id) {
      balance += tx.amountMinor;
    }
  }
  return balance;
}

/**
 * Natural Language Query Engine for financial ledger questions.
 */
export class NaturalLanguageQueryEngine {
  public static processFinancialQuery(
    queryOrOptions: string | ({ query: string } & Partial<FinancialContext>),
    maybeContext?: FinancialContext
  ): NaturalLanguageQueryResponse {
    let query = '';
    let context: FinancialContext = {
      transactions: [],
      accounts: [],
      categories: [],
      budgets: [],
      investments: [],
      liabilities: [],
      peerDebts: [],
      subscriptions: [],
    };

    if (typeof queryOrOptions === 'string') {
      query = queryOrOptions;
      if (maybeContext) {
        context = {
          transactions: maybeContext.transactions ?? [],
          accounts: maybeContext.accounts ?? [],
          categories: maybeContext.categories ?? [],
          budgets: maybeContext.budgets ?? [],
          investments: maybeContext.investments ?? [],
          liabilities: maybeContext.liabilities ?? [],
          peerDebts: maybeContext.peerDebts ?? [],
          subscriptions: maybeContext.subscriptions ?? [],
        };
      }
    } else {
      query = queryOrOptions.query;
      context = {
        transactions: queryOrOptions.transactions ?? [],
        accounts: queryOrOptions.accounts ?? [],
        categories: queryOrOptions.categories ?? [],
        budgets: queryOrOptions.budgets ?? [],
        investments: queryOrOptions.investments ?? [],
        liabilities: queryOrOptions.liabilities ?? [],
        peerDebts: queryOrOptions.peerDebts ?? [],
        subscriptions: queryOrOptions.subscriptions ?? [],
      };
    }

    const q = query.toLowerCase();

    // 1. Affordability question ("Can I afford a ₹X [item]?")
    if (q.includes('afford') || q.includes('can i buy')) {
      return this.handleAffordabilityQuery(query, context);
    }

    // 2. Spending increase ("Why did I spend more this month?" / "spending increase")
    if (
      q.includes('spend more') ||
      q.includes('spending increase') ||
      q.includes('why did i spend') ||
      q.includes('spent more') ||
      q.includes('higher spending')
    ) {
      return this.handleSpendingIncreaseQuery(query, context);
    }

    // 3. Peer lending / Debt ("Who owes me money?" / "owes me" / "lending")
    if (
      q.includes('owes me') ||
      q.includes('who owes') ||
      q.includes('lending') ||
      q.includes('borrowed from me') ||
      q.includes('peer debt')
    ) {
      return this.handlePeerDebtQuery(query, context);
    }

    // 4. Investments ("How much did I invest this year?" / "investments")
    if (
      q.includes('invest') ||
      q.includes('portfolio') ||
      q.includes('stocks') ||
      q.includes('mutual fund')
    ) {
      return this.handleInvestmentQuery(query, context);
    }

    // 5. Net worth change ("Why did my net worth increase / decrease?" / "net worth change")
    if (
      q.includes('net worth') ||
      q.includes('networth') ||
      q.includes('wealth change')
    ) {
      return this.handleNetWorthQuery(query, context);
    }

    // 6. Fallback General Summary
    return this.handleGeneralSummaryQuery(query, context);
  }

  private static handleAffordabilityQuery(
    query: string,
    context: FinancialContext
  ): NaturalLanguageQueryResponse {
    // Extract numerical amount from query (e.g. ₹50,000 or 50000 or Rs. 50,000)
    const amountRegex = /(?:₹|rs\.?|inr|\$)?\s*([\d,]+(?:\.\d+)?)\s*(?:rs|rupees|inr)?/i;
    const match = query.match(amountRegex);

    let itemCostMinor = 0;
    if (match && match[1]) {
      const rawNum = match[1].replace(/,/g, '');
      const parsed = parseFloat(rawNum);
      if (!isNaN(parsed) && parsed > 0) {
        itemCostMinor = Math.round(parsed * 100);
      }
    }

    // Try to extract item name
    let itemName = 'item';
    const itemMatch = query.match(/(?:afford|buy)(?:\s+an?|\s+the)?\s+(?:₹|rs\.?|[\d,]+)?\s*([a-zA-Z\s]+)\??/i);
    if (itemMatch && itemMatch[1]) {
      const candidate = itemMatch[1].trim();
      if (candidate.length > 1 && !candidate.toLowerCase().startsWith('rs')) {
        itemName = candidate;
      }
    }

    // Calculate liquid cash reserves (accounts of type 'bank', 'cash', 'wallet')
    const liquidAccounts = context.accounts.filter((a) =>
      ['bank', 'cash', 'wallet'].includes(a.type)
    );

    let liquidCashMinor = 0;
    for (const acc of liquidAccounts) {
      liquidCashMinor += deriveBalance(acc, context.transactions);
    }

    // Threshold: itemCost should leave at least 30% of liquid reserves or be within safe spending limit (70%)
    const safeSpendingLimitMinor = Math.max(0, Math.floor(liquidCashMinor * 0.7));
    const postPurchaseBufferMinor = liquidCashMinor - itemCostMinor;
    const requiredBufferMinor = Math.floor(liquidCashMinor * 0.3);

    const canAfford =
      itemCostMinor > 0 &&
      postPurchaseBufferMinor >= requiredBufferMinor &&
      postPurchaseBufferMinor >= 0;

    const verdict = canAfford
      ? `Affordable: purchase leaves a healthy buffer above 30% of liquid reserves.`
      : `Caution: purchase exceeds safe spending limit or would leave buffer below 30%.`;

    const recommendation = canAfford
      ? `You can comfortably afford this ${itemName}. Your post-purchase buffer will be ${formatMoney(postPurchaseBufferMinor)}.`
      : `We recommend saving up or postponing this ${itemName}. Safe spending limit is currently ${formatMoney(safeSpendingLimitMinor)}.`;

    const headline = canAfford
      ? `Yes, you can afford this ${itemName}!`
      : `Purchasing this ${itemName} is not recommended right now.`;

    const explanation = `Your current liquid reserves are ${formatMoney(liquidCashMinor)}. Buying this costs ${formatMoney(itemCostMinor)}, leaving a post-purchase buffer of ${formatMoney(postPurchaseBufferMinor)} (minimum recommended 30% reserve is ${formatMoney(requiredBufferMinor)}).`;

    return {
      query,
      matchedIntent: 'can_i_afford',
      headline,
      explanation,
      supportingData: {
        itemCostMinor,
        itemName,
        canAfford,
        currentLiquidBalanceMinor: liquidCashMinor,
        safeSpendingLimitMinor,
        postPurchaseBufferMinor,
        verdict,
        recommendation,
      },
    };
  }

  private static handleSpendingIncreaseQuery(
    query: string,
    context: FinancialContext
  ): NaturalLanguageQueryResponse {
    const expenseTxs = context.transactions.filter((tx) => tx.type === 'expense');

    if (expenseTxs.length === 0) {
      return {
        query,
        matchedIntent: 'why_spend_more',
        headline: 'No expense transactions found.',
        explanation: 'There is no recorded spending history to analyze variance.',
      };
    }

    // Find sorted unique months from transaction dates
    const months = Array.from(
      new Set(expenseTxs.map((t) => t.date.slice(0, 7)))
    ).sort();

    const currentMonth = months[months.length - 1] ?? '';
    const previousMonth = months.length > 1 ? months[months.length - 2] ?? null : null;

    const currentTxs = currentMonth
      ? expenseTxs.filter((t) => t.date.startsWith(currentMonth))
      : [];
    const prevTxs = previousMonth
      ? expenseTxs.filter((t) => t.date.startsWith(previousMonth))
      : [];

    const categoryMap = new Map<string, string>();
    for (const c of context.categories) {
      categoryMap.set(c.id, c.name);
    }

    const currentCatTotals = new Map<string, number>();
    for (const tx of currentTxs) {
      const catName = tx.categoryId ? categoryMap.get(tx.categoryId) || 'Other' : 'Uncategorized';
      currentCatTotals.set(catName, (currentCatTotals.get(catName) ?? 0) + tx.amountMinor);
    }

    const prevCatTotals = new Map<string, number>();
    for (const tx of prevTxs) {
      const catName = tx.categoryId ? categoryMap.get(tx.categoryId) || 'Other' : 'Uncategorized';
      prevCatTotals.set(catName, (prevCatTotals.get(catName) ?? 0) + tx.amountMinor);
    }

    const currentTotalMinor = currentTxs.reduce((sum, t) => sum + t.amountMinor, 0);
    const prevTotalMinor = prevTxs.reduce((sum, t) => sum + t.amountMinor, 0);
    const totalDiffMinor = currentTotalMinor - prevTotalMinor;

    // Identify top variance categories
    const variances: { category: string; currentMinor: number; prevMinor: number; diffMinor: number }[] = [];
    const allCategories = new Set([...currentCatTotals.keys(), ...prevCatTotals.keys()]);

    for (const cat of allCategories) {
      const curr = currentCatTotals.get(cat) ?? 0;
      const prev = prevCatTotals.get(cat) ?? 0;
      variances.push({
        category: cat,
        currentMinor: curr,
        prevMinor: prev,
        diffMinor: curr - prev,
      });
    }

    variances.sort((a, b) => b.diffMinor - a.diffMinor);
    const topIncreases = variances.filter((v) => v.diffMinor > 0);

    let headline = '';
    let explanation = '';

    if (totalDiffMinor > 0) {
      headline = `Spending increased by ${formatMoney(totalDiffMinor)} in ${currentMonth}.`;
      const topCatStr = topIncreases
        .slice(0, 3)
        .map((v) => `${v.category} (+${formatMoney(v.diffMinor)})`)
        .join(', ');
      explanation = `Total spending rose from ${formatMoney(prevTotalMinor)} to ${formatMoney(currentTotalMinor)}. Primary drivers of the increase were: ${topCatStr || 'across multiple categories'}.`;
    } else {
      headline = `Spending decreased by ${formatMoney(Math.abs(totalDiffMinor))} in ${currentMonth}.`;
      explanation = `Total spending was ${formatMoney(currentTotalMinor)}, down from ${formatMoney(prevTotalMinor)} in the previous period.`;
    }

    return {
      query,
      matchedIntent: 'why_spend_more',
      headline,
      explanation,
      supportingData: {
        currentMonth,
        previousMonth,
        currentTotalMinor,
        prevTotalMinor,
        totalDiffMinor,
        topVariances: variances.slice(0, 5),
      },
    };
  }

  private static handlePeerDebtQuery(
    query: string,
    context: FinancialContext
  ): NaturalLanguageQueryResponse {
    const activeLentDebts = context.peerDebts.filter(
      (d) => d.status === 'active' && d.type === 'lent' && d.remainingAmountMinor > 0
    );

    const totalReceivableMinor = activeLentDebts.reduce(
      (sum, d) => sum + d.remainingAmountMinor,
      0
    );

    if (activeLentDebts.length === 0) {
      return {
        query,
        matchedIntent: 'who_owes_me',
        headline: 'No one currently owes you money.',
        explanation: 'All peer loans are either settled or you have not recorded any active lent amounts.',
        supportingData: { totalReceivableMinor: 0, activeDebts: [] },
      };
    }

    const debtorSummary = activeLentDebts
      .map((d) => `${d.personName}: ${formatMoney(d.remainingAmountMinor)}${d.dueDate ? ` (due ${d.dueDate})` : ''}`)
      .join(', ');

    return {
      query,
      matchedIntent: 'who_owes_me',
      headline: `You are owed a total of ${formatMoney(totalReceivableMinor)} across ${activeLentDebts.length} active loans.`,
      explanation: `Breakdown: ${debtorSummary}.`,
      supportingData: {
        totalReceivableMinor,
        activeDebts: activeLentDebts,
      },
    };
  }

  private static handleInvestmentQuery(
    query: string,
    context: FinancialContext
  ): NaturalLanguageQueryResponse {
    const totalInvestedMinor = context.investments.reduce(
      (sum, inv) => sum + inv.investedAmountMinor,
      0
    );
    const totalCurrentValueMinor = context.investments.reduce(
      (sum, inv) => sum + inv.currentValueMinor,
      0
    );
    const totalGainMinor = totalCurrentValueMinor - totalInvestedMinor;
    const absoluteReturnPercent =
      totalInvestedMinor > 0
        ? Math.round((totalGainMinor / totalInvestedMinor) * 100)
        : 0;

    const headline = `Total portfolio value is ${formatMoney(totalCurrentValueMinor)} with ${formatMoney(totalInvestedMinor)} invested.`;
    const sign = totalGainMinor >= 0 ? '+' : '';
    const explanation = `Net gain/loss stands at ${sign}${formatMoney(totalGainMinor)} (${sign}${absoluteReturnPercent}% absolute return) across ${context.investments.length} holdings.`;

    return {
      query,
      matchedIntent: 'investments_ytd',
      headline,
      explanation,
      supportingData: {
        totalInvestedMinor,
        totalCurrentValueMinor,
        totalGainMinor,
        absoluteReturnPercent,
      },
    };
  }

  private static handleNetWorthQuery(
    query: string,
    context: FinancialContext
  ): NaturalLanguageQueryResponse {
    let liquidCashMinor = 0;
    for (const acc of context.accounts) {
      liquidCashMinor += deriveBalance(acc, context.transactions);
    }

    const investmentsMinor = context.investments.reduce(
      (sum, inv) => sum + inv.currentValueMinor,
      0
    );

    const liabilitiesMinor = context.liabilities.reduce(
      (sum, l) => sum + l.remainingAmountMinor,
      0
    );

    const netPeerMinor = context.peerDebts
      .filter((d) => d.status === 'active')
      .reduce((sum, d) => sum + (d.type === 'lent' ? d.remainingAmountMinor : -d.remainingAmountMinor), 0);

    const totalAssetsMinor = liquidCashMinor + investmentsMinor + Math.max(0, netPeerMinor);
    const totalLiabilitiesMinor = liabilitiesMinor + Math.abs(Math.min(0, netPeerMinor));
    const netWorthMinor = totalAssetsMinor - totalLiabilitiesMinor;

    const headline = `Your current net worth is ${formatMoney(netWorthMinor)}.`;
    const explanation = `Total assets: ${formatMoney(totalAssetsMinor)} (Liquid: ${formatMoney(liquidCashMinor)}, Investments: ${formatMoney(investmentsMinor)}). Total liabilities: ${formatMoney(totalLiabilitiesMinor)}.`;

    return {
      query,
      matchedIntent: 'why_networth_change',
      headline,
      explanation,
      supportingData: {
        netWorthMinor,
        liquidCashMinor,
        investmentsMinor,
        liabilitiesMinor,
        netPeerMinor,
      },
    };
  }

  private static handleGeneralSummaryQuery(
    query: string,
    context: FinancialContext
  ): NaturalLanguageQueryResponse {
    let liquidCashMinor = 0;
    for (const acc of context.accounts) {
      liquidCashMinor += deriveBalance(acc, context.transactions);
    }

    const totalInvestmentsMinor = context.investments.reduce(
      (sum, inv) => sum + inv.currentValueMinor,
      0
    );

    return {
      query,
      matchedIntent: 'general_summary',
      headline: 'Financial Overview',
      explanation: `Liquid cash reserves: ${formatMoney(liquidCashMinor)}. Total investments: ${formatMoney(totalInvestmentsMinor)}. ${context.accounts.length} active accounts and ${context.transactions.length} recorded transactions.`,
    };
  }
}

export const processFinancialQuery = NaturalLanguageQueryEngine.processFinancialQuery.bind(
  NaturalLanguageQueryEngine
);

/**
 * Detects duplicate charges and spending spikes in transaction history.
 */
export function detectAnomalies(
  transactionsOrOptions: Transaction[] | { transactions?: Transaction[] } = []
): FinancialAnomaly[] {
  const transactions = Array.isArray(transactionsOrOptions)
    ? transactionsOrOptions
    : transactionsOrOptions.transactions ?? [];

  const anomalies: FinancialAnomaly[] = [];

  // 1. Check for duplicate charges: same amountMinor, same accountId, within 24 hours
  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const txA = transactions[i];
      const txB = transactions[j];
      if (!txA || !txB) {
        continue;
      }

      if (
        txA.accountId === txB.accountId &&
        txA.amountMinor === txB.amountMinor &&
        txA.type === txB.type
      ) {
        const timeA = new Date(txA.date).getTime();
        const timeB = new Date(txB.date).getTime();
        const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);

        if (diffHours <= 24) {
          anomalies.push({
            id: `dup-${txA.id}-${txB.id}`,
            type: 'duplicate_charge',
            severity: 'warning',
            title: 'Possible Duplicate Charge',
            description: `Identical charge of ${formatMoney(txA.amountMinor)} detected within 24 hours on account ${txA.accountId}.`,
            amountMinor: txA.amountMinor,
            merchant: txA.merchant ?? undefined,
            transactionId: txB.id,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // 2. Check for spending spikes: transaction amount > 2.5x the average transaction in that category
  const CATEGORY_NAMES: Record<string, string> = {
    'cat-food': 'Food & Dining',
    'cat-groceries': 'Groceries',
    'cat-transport': 'Transportation',
    'cat-housing': 'Housing & Rent',
    'cat-utilities': 'Utilities & Bills',
    'cat-shopping': 'Shopping',
    'cat-entertainment': 'Entertainment',
    'cat-health': 'Health & Medical',
    'cat-salary': 'Salary',
    'cat-investment': 'Investments',
  };

  const categoryExpenses = new Map<string, number[]>();
  for (const tx of transactions) {
    const rawCat = tx.categoryId || (tx as any).category;
    const cat = rawCat ? (CATEGORY_NAMES[rawCat] ?? rawCat) : null;
    if (tx.type === 'expense' && cat) {
      const list = categoryExpenses.get(cat) ?? [];
      list.push(tx.amountMinor);
      categoryExpenses.set(cat, list);
    }
  }

  for (const tx of transactions) {
    const rawCat = tx.categoryId || (tx as any).category;
    const cat = rawCat ? (CATEGORY_NAMES[rawCat] ?? rawCat) : null;
    if (tx.type === 'expense' && cat) {
      const list = categoryExpenses.get(cat)!;
      if (list.length >= 2) {
        const totalSum = list.reduce((sum, v) => sum + v, 0);
        const overallAvg = totalSum / list.length;
        const otherCount = list.length - 1;
        const baselineAvg = otherCount > 0 ? (totalSum - tx.amountMinor) / otherCount : overallAvg;

        if (tx.amountMinor >= 2.5 * overallAvg || (otherCount > 0 && tx.amountMinor > 2.5 * baselineAvg)) {
          anomalies.push({
            id: `spike-${tx.id}`,
            type: 'spending_spike',
            severity: 'alert',
            title: 'Unusual Spending Spike',
            description: `Transaction of ${formatMoney(tx.amountMinor)} is over 2.5x the category average of ${formatMoney(Math.round(baselineAvg))}.`,
            amountMinor: tx.amountMinor,
            category: cat,
            transactionId: tx.id,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return anomalies;
}

export interface CashFlowForecastOptions {
  accounts?: Account[];
  transactions?: Transaction[];
  subscriptions?: SubscriptionItem[];
  liabilities?: Liability[];
  peerDebts?: PeerDebt[];
  daysAhead?: number;
  referenceDate?: Date;
  currentBalanceMinor?: number;
  startDate?: string | Date;
}

/**
 * Daily projected liquid cash position over daysAhead incorporating expected salary,
 * subscriptions, EMIs/liabilities, and debt repayments.
 */
export function forecastCashFlow(
  accountsOrOptions?: Account[] | CashFlowForecastOptions,
  transactionsArg?: Transaction[],
  subscriptionsArg?: SubscriptionItem[],
  liabilitiesArg?: Liability[],
  peerDebtsArg?: PeerDebt[],
  daysAheadArg = 60,
  referenceDateArg = new Date()
): CashFlowForecastPoint[] {
  let accounts: Account[] = [];
  let transactions: Transaction[] = [];
  let subscriptions: SubscriptionItem[] = [];
  let liabilities: Liability[] = [];
  let peerDebts: PeerDebt[] = [];
  let daysAhead = daysAheadArg;
  let referenceDate = referenceDateArg;

  if (Array.isArray(accountsOrOptions)) {
    accounts = accountsOrOptions;
    transactions = transactionsArg ?? [];
    subscriptions = subscriptionsArg ?? [];
    liabilities = liabilitiesArg ?? [];
    peerDebts = peerDebtsArg ?? [];
    daysAhead = daysAheadArg;
    referenceDate = referenceDateArg;
  } else if (accountsOrOptions && typeof accountsOrOptions === 'object') {
    accounts = accountsOrOptions.accounts ?? [];
    transactions = accountsOrOptions.transactions ?? [];
    subscriptions = accountsOrOptions.subscriptions ?? [];
    liabilities = accountsOrOptions.liabilities ?? [];
    peerDebts = accountsOrOptions.peerDebts ?? [];
    daysAhead = accountsOrOptions.daysAhead ?? 30;
    referenceDate = accountsOrOptions.referenceDate ?? (accountsOrOptions.startDate ? new Date(accountsOrOptions.startDate) : new Date());
  }

  // Compute initial liquid balance
  const liquidAccounts = accounts.filter((a) =>
    ['bank', 'cash', 'wallet'].includes(a.type)
  );

  let runningBalanceMinor = 0;
  for (const acc of liquidAccounts) {
    runningBalanceMinor += deriveBalance(acc, transactions);
  }

  const points: CashFlowForecastPoint[] = [];

  // Identify recurring income pattern (e.g. monthly salary)
  const incomeTxs = transactions.filter(
    (tx) => tx.type === 'income' && tx.amountMinor > 0
  );
  let typicalIncomeAmountMinor = 0;
  let incomeDayOfMonth = 1;

  if (incomeTxs.length > 0) {
    const sum = incomeTxs.reduce((acc, t) => acc + t.amountMinor, 0);
    typicalIncomeAmountMinor = Math.round(sum / incomeTxs.length);
    const latestIncome = incomeTxs[incomeTxs.length - 1];
    if (latestIncome) {
      incomeDayOfMonth = new Date(latestIncome.date).getDate();
    }
  }

  for (let day = 1; day <= daysAhead; day++) {
    const targetDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + day
    );
    const dateStr = targetDate.toISOString().slice(0, 10);
    const dayOfMonth = targetDate.getDate();

    let expectedIncomeMinor = 0;
    let expectedOutflowMinor = 0;
    const descriptions: string[] = [];

    // Monthly recurring income (salary)
    if (typicalIncomeAmountMinor > 0 && dayOfMonth === incomeDayOfMonth) {
      expectedIncomeMinor += typicalIncomeAmountMinor;
      descriptions.push(`Expected Income: ${formatMoney(typicalIncomeAmountMinor)}`);
    }

    // Active subscriptions
    for (const sub of subscriptions) {
      if (sub.status !== 'active') continue;
      if (sub.nextBillingDate === dateStr) {
        expectedOutflowMinor += sub.amountMinor;
        descriptions.push(`${sub.name}: ${formatMoney(sub.amountMinor)}`);
      }
    }

    // Active liabilities due
    for (const liab of liabilities) {
      if (liab.remainingAmountMinor > 0 && liab.dueDate === dateStr) {
        expectedOutflowMinor += liab.remainingAmountMinor;
        descriptions.push(`Liability ${liab.name}: ${formatMoney(liab.remainingAmountMinor)}`);
      }
    }

    // Peer debts due
    for (const debt of peerDebts) {
      if (debt.status === 'active' && debt.dueDate === dateStr) {
        if (debt.type === 'lent') {
          expectedIncomeMinor += debt.remainingAmountMinor;
          descriptions.push(`Peer repayment from ${debt.personName}: ${formatMoney(debt.remainingAmountMinor)}`);
        } else if (debt.type === 'borrowed') {
          expectedOutflowMinor += debt.remainingAmountMinor;
          descriptions.push(`Peer repayment to ${debt.personName}: ${formatMoney(debt.remainingAmountMinor)}`);
        }
      }
    }

    runningBalanceMinor += expectedIncomeMinor - expectedOutflowMinor;

    points.push({
      date: dateStr,
      projectedBalanceMinor: runningBalanceMinor,
      expectedIncomeMinor,
      expectedOutflowMinor,
      description: descriptions.length > 0 ? descriptions.join('; ') : undefined,
    });
  }

  return points;
}

/**
 * Heuristic pattern matching to suggest category for a merchant name.
 */
export function suggestCategoryForMerchant(
  merchant: string,
  categories: Category[]
): string | null {
  if (!merchant) return null;
  const m = merchant.toLowerCase().trim();

  const rules: { keywords: string[]; categoryTerms: string[] }[] = [
    {
      keywords: [
        'swiggy',
        'zomato',
        'starbucks',
        'mcdonald',
        'domino',
        'pizza',
        'kfc',
        'burger king',
        'subway',
        'blinkit',
        'zepto',
        'instamart',
        'bigbasket',
      ],
      categoryTerms: ['food', 'dining', 'restaurant', 'groceries'],
    },
    {
      keywords: [
        'uber',
        'ola',
        'rapido',
        'metro',
        'irctc',
        'makemytrip',
        'indigo',
        'air india',
        'fuel',
        'petrol',
      ],
      categoryTerms: ['transport', 'travel', 'commute', 'fuel'],
    },
    {
      keywords: [
        'netflix',
        'spotify',
        'prime video',
        'disney',
        'hotstar',
        'youtube',
        'apple',
        'sonyliv',
        'pvr',
        'inox',
      ],
      categoryTerms: ['entertainment', 'subscriptions', 'movies'],
    },
    {
      keywords: [
        'amazon',
        'flipkart',
        'myntra',
        'zara',
        'h&m',
        'ajio',
        'nykaa',
        'ikea',
      ],
      categoryTerms: ['shopping', 'retail', 'clothing'],
    },
    {
      keywords: [
        'airtel',
        'jio',
        'vodafone',
        'vi',
        'bescom',
        'electricity',
        'water',
        'gas',
        'wifi',
        'broadband',
      ],
      categoryTerms: ['utilities', 'bills'],
    },
    {
      keywords: [
        'apollo',
        'pharmeasy',
        'netmeds',
        '1mg',
        'practo',
        'hospital',
        'pharmacy',
      ],
      categoryTerms: ['medical', 'health', 'healthcare'],
    },
  ];

  for (const rule of rules) {
    const matchedMerchant = rule.keywords.some((kw) => m.includes(kw));
    if (matchedMerchant) {
      for (const cat of categories) {
        const catName = cat.name.toLowerCase();
        if (rule.categoryTerms.some((term) => catName.includes(term))) {
          return cat.id;
        }
      }
    }
  }

  return null;
}

export function categorizeMerchantHeuristic(merchant: string): {
  category: string;
  confidence: number;
} {
  const m = merchant.toLowerCase();

  const rules: { keywords: string[]; category: string; confidence: number }[] = [
    {
      keywords: ['swiggy', 'zomato', 'mcdonald', 'domino', 'pizza', 'kfc', 'burger king', 'subway'],
      category: 'Food & Dining',
      confidence: 0.95,
    },
    {
      keywords: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'grofers', 'dunzo', 'grocery'],
      category: 'Groceries',
      confidence: 0.9,
    },
    {
      keywords: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'makemytrip', 'indigo', 'air india', 'fuel', 'petrol'],
      category: 'Transportation',
      confidence: 0.9,
    },
    {
      keywords: ['netflix', 'spotify', 'prime video', 'disney', 'hotstar', 'youtube', 'apple', 'sonyliv', 'pvr', 'inox'],
      category: 'Entertainment',
      confidence: 0.95,
    },
    {
      keywords: ['amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'ajio', 'nykaa', 'ikea'],
      category: 'Shopping',
      confidence: 0.9,
    },
    {
      keywords: ['airtel', 'jio', 'vodafone', 'vi', 'bescom', 'electricity', 'water', 'gas', 'wifi', 'broadband'],
      category: 'Utilities & Bills',
      confidence: 0.9,
    },
    {
      keywords: ['apollo', 'pharmeasy', 'netmeds', '1mg', 'practo', 'hospital', 'pharmacy'],
      category: 'Health & Medical',
      confidence: 0.9,
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => m.includes(kw))) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }

  return { category: 'Other', confidence: 0.3 };
}

