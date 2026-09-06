import type { Goal } from '@biyong/schemas';
import { calculateGoalProgress, type GoalProgress } from '@biyong/domain';
import type { GoalRepository } from '../repositories.js';

export class GoalUseCases {
  constructor(private goalRepo: GoalRepository) {}

  async createGoal(goal: Goal): Promise<void> {
    await this.goalRepo.create(goal);
  }

  async getGoal(id: string): Promise<Goal | null> {
    return this.goalRepo.findById(id);
  }

  async listGoals(): Promise<Goal[]> {
    return this.goalRepo.findAll();
  }

  async updateGoal(goal: Goal): Promise<void> {
    await this.goalRepo.update(goal);
  }

  async deleteGoal(id: string): Promise<void> {
    await this.goalRepo.delete(id);
  }

  async contributeToGoal(goalId: string, amountMinor: number): Promise<Goal> {
    const goal = await this.goalRepo.findById(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const updated: Goal = {
      ...goal,
      currentAmountMinor: goal.currentAmountMinor + amountMinor,
      updatedAt: new Date().toISOString(),
    };

    await this.goalRepo.update(updated);
    return updated;
  }

  async getGoalProgress(
    goalId: string,
    currentDate = new Date(),
    monthlyContributionRateMinor?: number
  ): Promise<GoalProgress> {
    const goal = await this.goalRepo.findById(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    return calculateGoalProgress(goal, currentDate, monthlyContributionRateMinor);
  }

  async listGoalsWithProgress(
    currentDate = new Date()
  ): Promise<Array<GoalProgress & { goal: Goal }>> {
    const goals = await this.goalRepo.findAll();
    return goals.map((goal) => {
      const progress = calculateGoalProgress(goal, currentDate);
      return {
        ...progress,
        goal,
      };
    });
  }
}
