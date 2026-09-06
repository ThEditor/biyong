import type { FixedVsVariableSpending, SpendingTrendItem } from '@biyong/domain';
import { classifySpending, calculateSpendingTrends } from '@biyong/domain';
import type { TransactionRepository } from '../repositories.js';

export class AnalyticsUseCases {
  constructor(private txRepo: TransactionRepository) {}

  async getFixedVsVariable(fixedCategoryIds?: string[]): Promise<FixedVsVariableSpending> {
    const txs = await this.txRepo.findAll();
    return classifySpending(txs, fixedCategoryIds);
  }

  async getSpendingTrends(
    monthsCount = 6,
    referenceDate = new Date()
  ): Promise<SpendingTrendItem[]> {
    const txs = await this.txRepo.findAll();
    return calculateSpendingTrends(txs, monthsCount, referenceDate);
  }
}
