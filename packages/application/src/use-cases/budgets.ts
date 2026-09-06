import type { Budget } from '@biyong/schemas';
import { calculateBudgetStatus, calculateBudgetPeriod, type BudgetStatus } from '@biyong/domain';
import type { BudgetRepository, TransactionRepository } from '../repositories.js';

export class BudgetUseCases {
  constructor(
    private budgetRepo: BudgetRepository,
    private txRepo: TransactionRepository
  ) {}

  async createBudget(budget: Budget): Promise<void> {
    await this.budgetRepo.create(budget);
  }

  async getBudget(id: string): Promise<Budget | null> {
    return this.budgetRepo.findById(id);
  }

  async getBudgetByCategory(categoryId: string): Promise<Budget | null> {
    return this.budgetRepo.findByCategoryId(categoryId);
  }

  async listBudgets(): Promise<Budget[]> {
    return this.budgetRepo.findAll();
  }

  async updateBudget(budget: Budget): Promise<void> {
    await this.budgetRepo.update(budget);
  }

  async deleteBudget(id: string): Promise<void> {
    await this.budgetRepo.delete(id);
  }

  async getBudgetStatus(
    budgetId: string,
    referenceDate = new Date(),
    rolloverMinor = 0
  ): Promise<BudgetStatus> {
    const budget = await this.budgetRepo.findById(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    const period = calculateBudgetPeriod(budget, referenceDate);
    const txs = await this.txRepo.findAll();
    const spentMinor = txs
      .filter((t) => {
        if (t.type !== 'expense' || t.categoryId !== budget.categoryId) {
          return false;
        }
        const txDate = t.date.substring(0, 10);
        return txDate >= period.startDate && txDate <= period.endDate;
      })
      .reduce((acc, t) => acc + t.amountMinor, 0);

    return calculateBudgetStatus(budget, spentMinor, rolloverMinor, referenceDate);
  }

  async listBudgetsWithStatus(
    referenceDate = new Date()
  ): Promise<Array<BudgetStatus & { budget: Budget }>> {
    const budgets = await this.budgetRepo.findAll();
    const txs = await this.txRepo.findAll();

    return budgets.map((budget) => {
      const period = calculateBudgetPeriod(budget, referenceDate);
      const spentMinor = txs
        .filter((t) => {
          if (t.type !== 'expense' || t.categoryId !== budget.categoryId) {
            return false;
          }
          const txDate = t.date.substring(0, 10);
          return txDate >= period.startDate && txDate <= period.endDate;
        })
        .reduce((acc, t) => acc + t.amountMinor, 0);

      const status = calculateBudgetStatus(budget, spentMinor, 0, referenceDate);
      return {
        ...status,
        budget,
      };
    });
  }
}
