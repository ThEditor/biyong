import {
  calculateNetWorth,
  calculateInvestmentAnalytics,
  calculateLiabilityAnalytics,
  calculateHistoricalNetWorth,
  type WealthSummary,
  type InvestmentAnalytics,
  type LiabilityAnalytics,
  type HistoricalNetWorthPoint,
} from '@biyong/domain';
import type { Investment, Liability } from '@biyong/schemas';
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

  async getInvestmentAnalytics(): Promise<InvestmentAnalytics> {
    const investments = await this.wealthRepo.getInvestments();
    return calculateInvestmentAnalytics(investments);
  }

  async getLiabilityAnalytics(): Promise<LiabilityAnalytics> {
    const liabilities = await this.wealthRepo.getLiabilities();
    return calculateLiabilityAnalytics(liabilities);
  }

  async getHistoricalNetWorth(
    monthsCount = 6,
    referenceDate = new Date()
  ): Promise<HistoricalNetWorthPoint[]> {
    const accounts = await this.accountRepo.findAll();
    const initialCash = accounts.reduce((sum, a) => sum + a.initialBalanceMinor, 0);
    const txs = await this.txRepo.findAll();
    const investments = await this.wealthRepo.getInvestments();
    const liabilities = await this.wealthRepo.getLiabilities();

    return calculateHistoricalNetWorth(
      txs,
      investments,
      liabilities,
      monthsCount,
      referenceDate,
      initialCash
    );
  }

  async listInvestments(): Promise<Investment[]> {
    return this.wealthRepo.getInvestments();
  }

  async createInvestment(inv: Investment): Promise<void> {
    await this.wealthRepo.saveInvestment(inv);
  }

  async updateInvestment(inv: Investment): Promise<void> {
    await this.wealthRepo.saveInvestment(inv);
  }

  async deleteInvestment(id: string): Promise<void> {
    await this.wealthRepo.deleteInvestment(id);
  }

  async listLiabilities(): Promise<Liability[]> {
    return this.wealthRepo.getLiabilities();
  }

  async createLiability(liab: Liability): Promise<void> {
    await this.wealthRepo.saveLiability(liab);
  }

  async updateLiability(liab: Liability): Promise<void> {
    await this.wealthRepo.saveLiability(liab);
  }

  async deleteLiability(id: string): Promise<void> {
    await this.wealthRepo.deleteLiability(id);
  }

  async payLiability(id: string, paymentAmountMinor: number): Promise<Liability> {
    const liab = await this.wealthRepo.findLiabilityById(id);
    if (!liab) {
      throw new Error(`Liability not found: ${id}`);
    }
    if (paymentAmountMinor < 0) {
      throw new Error('Payment amount must be non-negative');
    }

    const updated: Liability = {
      ...liab,
      remainingAmountMinor: Math.max(0, liab.remainingAmountMinor - paymentAmountMinor),
      updatedAt: new Date().toISOString(),
    };

    await this.wealthRepo.saveLiability(updated);
    return updated;
  }
}
