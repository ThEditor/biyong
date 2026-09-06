import type { Budget } from '@biyong/schemas';
import { calculateBudgetStatus, type BudgetStatus } from '@biyong/domain';
import type { BudgetRepository, TransactionRepository } from '../repositories.js';

export class BudgetUseCases {
  constructor(
    private budgetRepo: BudgetRepository,
    private txRepo: TransactionRepository
  ) {}

  async createBudget(budget: Budget): Promise<void> {
    await this.budgetRepo.create(budget);
  }

  async getBudgetStatus(budgetId: string, rolloverMinor = 0): Promise<BudgetStatus> {
    const budget = await this.budgetRepo.findById(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    const txs = await this.txRepo.findAll();
    const spentMinor = txs
      .filter((t) => t.type === 'expense' && t.categoryId === budget.categoryId)
      .reduce((acc, t) => acc + t.amountMinor, 0);

    return calculateBudgetStatus(budget, spentMinor, rolloverMinor);
  }
}
