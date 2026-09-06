import type { Budget } from '@biyong/schemas';

export type BudgetHealth = 'healthy' | 'warning' | 'exceeded';

export interface BudgetStatus {
  budgetId: string;
  categoryId: string;
  budgetAmountMinor: number;
  spentMinor: number;
  effectiveBudgetMinor: number;
  remainingMinor: number;
  percentageUsed: number;
  isOverBudget: boolean;
  health: BudgetHealth;
  dailyAllowanceMinor: number;
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
}

function formatYearMonthDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculateBudgetPeriod(
  budget: Budget,
  referenceDate = new Date()
): { startDate: string; endDate: string; daysRemaining: number } {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  if (budget.period === 'weekly') {
    const dayOfWeek = referenceDate.getDay();
    // Monday as day 1, Sunday as day 7. If Sunday (0), diff is -6
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(refYear, refMonth, refDay + diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

    const startDate = formatYearMonthDay(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const endDate = formatYearMonthDay(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

    const refUtc = Date.UTC(refYear, refMonth, refDay);
    const endUtc = Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
    const diffDays = Math.round((endUtc - refUtc) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(1, diffDays);

    return { startDate, endDate, daysRemaining };
  }

  // Monthly
  const startDate = formatYearMonthDay(refYear, refMonth, 1);
  const lastDay = new Date(refYear, refMonth + 1, 0).getDate();
  const endDate = formatYearMonthDay(refYear, refMonth, lastDay);

  const refUtc = Date.UTC(refYear, refMonth, refDay);
  const endUtc = Date.UTC(refYear, refMonth, lastDay);
  const diffDays = Math.round((endUtc - refUtc) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(1, diffDays);

  return { startDate, endDate, daysRemaining };
}

export function calculateRollover(previousBudget: Budget, previousSpentMinor: number): number {
  if (!previousBudget.rollover) {
    return 0;
  }
  return previousBudget.amountMinor - previousSpentMinor;
}

export function calculateBudgetStatus(
  budget: Budget,
  spentMinor: number,
  rolloverMinor = 0,
  referenceDate = new Date()
): BudgetStatus {
  const effectiveBudgetMinor = budget.rollover
    ? budget.amountMinor + rolloverMinor
    : budget.amountMinor;

  const remainingMinor = effectiveBudgetMinor - spentMinor;
  const percentageUsed = effectiveBudgetMinor > 0
    ? Math.round((spentMinor / effectiveBudgetMinor) * 100)
    : 100;

  let health: BudgetHealth;
  if (percentageUsed < 80) {
    health = 'healthy';
  } else if (percentageUsed < 100) {
    health = 'warning';
  } else {
    health = 'exceeded';
  }

  const period = calculateBudgetPeriod(budget, referenceDate);
  const dailyAllowanceMinor = Math.max(0, Math.floor(remainingMinor / Math.max(1, period.daysRemaining)));

  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    budgetAmountMinor: budget.amountMinor,
    spentMinor,
    effectiveBudgetMinor,
    remainingMinor,
    percentageUsed,
    isOverBudget: remainingMinor < 0,
    health,
    dailyAllowanceMinor,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    daysRemaining: period.daysRemaining,
  };
}
