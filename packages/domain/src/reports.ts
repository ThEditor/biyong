import type { Transaction, Category } from '@biyong/schemas';

export interface CategorySpendingBreakdown {
  categoryId: string;
  categoryName?: string;
  spentMinor: number;
  percentage: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  netSavingsMinor: number;
  savingsRatePercent: number;
  categoryBreakdown: CategorySpendingBreakdown[];
  topMerchants: { merchant: string; spentMinor: number }[];
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match && match[1] && match[2]) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
    };
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return null;
  }
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  };
}

/**
 * Generates a monthly financial report from a list of transactions.
 * Rule: Transfers (type === 'transfer') are NEVER counted towards income or expense.
 */
export function generateMonthlyReport(
  transactions: Transaction[],
  year: number,
  month: number,
  categories?: Category[]
): MonthlyReport {
  const monthTxs = transactions.filter((tx) => {
    const ym = parseYearMonth(tx.date);
    return ym !== null && ym.year === year && ym.month === month;
  });

  let totalIncomeMinor = 0;
  let totalExpenseMinor = 0;

  const categorySpending = new Map<string, number>();
  const merchantSpending = new Map<string, number>();

  for (const tx of monthTxs) {
    if (tx.type === 'income') {
      totalIncomeMinor += tx.amountMinor;
    } else if (tx.type === 'expense') {
      totalExpenseMinor += tx.amountMinor;

      // Track spending by category
      const catId = tx.categoryId ?? 'uncategorized';
      categorySpending.set(catId, (categorySpending.get(catId) ?? 0) + tx.amountMinor);

      // Track spending by merchant
      if (tx.merchant && tx.merchant.trim().length > 0) {
        const merchantName = tx.merchant.trim();
        merchantSpending.set(merchantName, (merchantSpending.get(merchantName) ?? 0) + tx.amountMinor);
      }
    }
    // CRITICAL: Transfers (tx.type === 'transfer') are intentionally excluded from income/expense
  }

  const netSavingsMinor = totalIncomeMinor - totalExpenseMinor;
  const savingsRatePercent =
    totalIncomeMinor > 0
      ? Math.max(0, Math.round((netSavingsMinor / totalIncomeMinor) * 100))
      : 0;

  const categoryNameMap = new Map<string, string>();
  if (categories) {
    for (const c of categories) {
      categoryNameMap.set(c.id, c.name);
    }
  }

  const categoryBreakdown: CategorySpendingBreakdown[] = [];
  for (const [categoryId, spentMinor] of categorySpending.entries()) {
    const percentage =
      totalExpenseMinor > 0
        ? Math.round((spentMinor / totalExpenseMinor) * 100)
        : 0;
    const categoryName = categoryNameMap.get(categoryId) ?? (categoryId === 'uncategorized' ? 'Uncategorized' : undefined);
    categoryBreakdown.push({
      categoryId,
      ...(categoryName !== undefined ? { categoryName } : {}),
      spentMinor,
      percentage,
    });
  }
  categoryBreakdown.sort((a, b) => b.spentMinor - a.spentMinor);

  const topMerchants: { merchant: string; spentMinor: number }[] = [];
  for (const [merchant, spentMinor] of merchantSpending.entries()) {
    topMerchants.push({ merchant, spentMinor });
  }
  topMerchants.sort((a, b) => b.spentMinor - a.spentMinor);

  return {
    year,
    month,
    totalIncomeMinor,
    totalExpenseMinor,
    netSavingsMinor,
    savingsRatePercent,
    categoryBreakdown,
    topMerchants,
  };
}
