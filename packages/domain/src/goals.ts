import type { Goal } from '@biyong/schemas';

export interface GoalProgress {
  goalId: string;
  title: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  remainingAmountMinor: number;
  percentageComplete: number;
  monthsRemaining: number;
  requiredMonthlySavingsMinor: number;
  isCompleted: boolean;
  projectedCompletionDate: string | null;
}

function formatYearMonthDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculateRequiredMonthlySavings(
  targetAmountMinor: number,
  currentAmountMinor: number,
  targetDate: string,
  fromDate = new Date()
): number {
  const remainingAmountMinor = Math.max(0, targetAmountMinor - currentAmountMinor);
  if (remainingAmountMinor === 0) {
    return 0;
  }
  const target = new Date(targetDate);
  const diffTime = target.getTime() - fromDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30));
  return Math.ceil(remainingAmountMinor / monthsRemaining);
}

export function projectCompletionDate(
  goal: Goal,
  monthlyContributionRateMinor: number,
  fromDate = new Date()
): string | null {
  if (goal.currentAmountMinor >= goal.targetAmountMinor) {
    return formatYearMonthDay(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  }
  if (monthlyContributionRateMinor <= 0) {
    return null;
  }
  const remainingMinor = goal.targetAmountMinor - goal.currentAmountMinor;
  const monthsNeeded = Math.ceil(remainingMinor / monthlyContributionRateMinor);
  const projected = new Date(fromDate.getFullYear(), fromDate.getMonth() + monthsNeeded, fromDate.getDate());
  return formatYearMonthDay(projected.getFullYear(), projected.getMonth(), projected.getDate());
}

export function calculateGoalProgress(
  goal: Goal,
  currentDate: Date = new Date(),
  monthlyContributionRateMinor?: number
): GoalProgress {
  const remainingAmountMinor = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  const percentageComplete = goal.targetAmountMinor > 0
    ? Math.min(100, Math.round((goal.currentAmountMinor / goal.targetAmountMinor) * 100))
    : 100;

  const target = new Date(goal.targetDate);
  const diffTime = target.getTime() - currentDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30));

  const requiredMonthlySavingsMinor = calculateRequiredMonthlySavings(
    goal.targetAmountMinor,
    goal.currentAmountMinor,
    goal.targetDate,
    currentDate
  );

  const projectedCompletionDate =
    monthlyContributionRateMinor !== undefined
      ? projectCompletionDate(goal, monthlyContributionRateMinor, currentDate)
      : (remainingAmountMinor === 0
          ? projectCompletionDate(goal, 0, currentDate)
          : null);

  return {
    goalId: goal.id,
    title: goal.title,
    targetAmountMinor: goal.targetAmountMinor,
    currentAmountMinor: goal.currentAmountMinor,
    remainingAmountMinor,
    percentageComplete,
    monthsRemaining,
    requiredMonthlySavingsMinor,
    isCompleted: remainingAmountMinor === 0,
    projectedCompletionDate,
  };
}
