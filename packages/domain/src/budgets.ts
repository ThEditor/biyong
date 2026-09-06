import type { Budget } from '@biyong/schemas';

export interface BudgetStatus {
  budgetId: string;
  categoryId: string;
  budgetAmountMinor: number;
  spentMinor: number;
  effectiveBudgetMinor: number;
  remainingMinor: number;
  percentageUsed: number;
  isOverBudget: boolean;
}

export function calculateBudgetStatus(
  budget: Budget,
  spentMinor: number,
  rolloverMinor = 0
): BudgetStatus {
  const effectiveBudgetMinor = budget.rollover
    ? budget.amountMinor + rolloverMinor
    : budget.amountMinor;

  const remainingMinor = effectiveBudgetMinor - spentMinor;
  const percentageUsed = effectiveBudgetMinor > 0
    ? Math.round((spentMinor / effectiveBudgetMinor) * 100)
    : 100;

  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    budgetAmountMinor: budget.amountMinor,
    spentMinor,
    effectiveBudgetMinor,
    remainingMinor,
    percentageUsed,
    isOverBudget: remainingMinor < 0,
  };
}
