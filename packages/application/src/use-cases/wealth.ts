import { calculateNetWorth, type WealthSummary } from '@biyong/domain';
import type { AccountRepository, WealthRepository, TransactionRepository } from '../repositories.js';
import { TransactionUseCases } from './transactions.js';

export class WealthUseCases {
  private txUseCases: TransactionUseCases;

  constructor(
    private accountRepo: AccountRepository,
    private txRepo: TransactionRepository,
    private wealthRepo: WealthRepository
  ) {
    this.txUseCases = new TransactionUseCases(accountRepo, txRepo);
  }

  async getNetWorthSummary(): Promise<WealthSummary> {
    const accounts = await this.accountRepo.findAll();
    const cashBankBalances: number[] = [];

    for (const acc of accounts) {
      const balance = await this.txUseCases.getDerivedAccountBalance(acc.id);
      cashBankBalances.push(balance);
    }

    const investments = await this.wealthRepo.getInvestments();
    const liabilities = await this.wealthRepo.getLiabilities();

    return calculateNetWorth(cashBankBalances, investments, liabilities);
  }
}
