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
}

export function calculateGoalProgress(
  goal: Goal,
  currentDate: Date = new Date()
): GoalProgress {
  const remainingAmountMinor = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  const percentageComplete = goal.targetAmountMinor > 0
    ? Math.min(100, Math.round((goal.currentAmountMinor / goal.targetAmountMinor) * 100))
    : 100;

  const target = new Date(goal.targetDate);
  const diffTime = target.getTime() - currentDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30));

  const requiredMonthlySavingsMinor = remainingAmountMinor > 0
    ? Math.ceil(remainingAmountMinor / monthsRemaining)
    : 0;

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
  };
}
