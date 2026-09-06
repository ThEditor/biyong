import type { Goal } from '@biyong/schemas';
import { calculateGoalProgress, type GoalProgress } from '@biyong/domain';
import type { GoalRepository } from '../repositories.js';

export class GoalUseCases {
  constructor(private goalRepo: GoalRepository) {}

  async createGoal(goal: Goal): Promise<void> {
    await this.goalRepo.create(goal);
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

  async getGoalProgress(goalId: string, currentDate = new Date()): Promise<GoalProgress> {
    const goal = await this.goalRepo.findById(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    return calculateGoalProgress(goal, currentDate);
  }
}
