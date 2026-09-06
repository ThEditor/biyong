import type { Transaction } from '@biyong/schemas';

export interface FixedVsVariableSpending {
  fixedSpendingMinor: number;
  variableSpendingMinor: number;
  totalSpendingMinor: number;
  fixedPercentage: number;
  variablePercentage: number;
}

export function classifySpending(
  transactions: Transaction[],
  fixedCategoryIds: string[] = ['cat-housing', 'cat-utilities']
): FixedVsVariableSpending {
  let fixedSpendingMinor = 0;
  let variableSpendingMinor = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') {
      continue;
    }
    const isFixed =
      tx.isRecurring === true ||
      (tx.categoryId !== null && fixedCategoryIds.includes(tx.categoryId));

    if (isFixed) {
      fixedSpendingMinor += tx.amountMinor;
    } else {
      variableSpendingMinor += tx.amountMinor;
    }
  }

  const totalSpendingMinor = fixedSpendingMinor + variableSpendingMinor;
  const fixedPercentage =
    totalSpendingMinor > 0
      ? Math.round((fixedSpendingMinor / totalSpendingMinor) * 100)
      : 0;
  const variablePercentage =
    totalSpendingMinor > 0
      ? Math.round((variableSpendingMinor / totalSpendingMinor) * 100)
      : 0;

  return {
    fixedSpendingMinor,
    variableSpendingMinor,
    totalSpendingMinor,
    fixedPercentage,
    variablePercentage,
  };
}

export interface SpendingTrendItem {
  period: string;
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  savingsRate: number;
}

export function calculateSpendingTrends(
  transactions: Transaction[],
  monthsCount = 6,
  referenceDate = new Date()
): SpendingTrendItem[] {
  if (monthsCount <= 0) {
    return [];
  }

  const periods: string[] = [];
  const trendMap = new Map<string, SpendingTrendItem>();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    periods.push(ym);
    trendMap.set(ym, {
      period: ym,
      incomeMinor: 0,
      expenseMinor: 0,
      savingsMinor: 0,
      savingsRate: 0,
    });
  }

  for (const tx of transactions) {
    // Critical rule: Transfers are never income or expense
    if (tx.type === 'transfer') {
      continue;
    }
    const match = tx.date.match(/^(\d{4}-\d{2})/);
    if (!match) {
      continue;
    }
    const ym = match[1];
    if (!ym) {
      continue;
    }
    const item = trendMap.get(ym);
    if (!item) {
      continue;
    }

    if (tx.type === 'income') {
      item.incomeMinor += tx.amountMinor;
    } else if (tx.type === 'expense') {
      item.expenseMinor += tx.amountMinor;
    }
  }

  const result: SpendingTrendItem[] = [];
  for (const ym of periods) {
    const item = trendMap.get(ym)!;
    item.savingsMinor = item.incomeMinor - item.expenseMinor;
    item.savingsRate =
      item.incomeMinor > 0
        ? Math.max(0, Math.round((item.savingsMinor / item.incomeMinor) * 100))
        : 0;
    result.push(item);
  }

  return result;
}
