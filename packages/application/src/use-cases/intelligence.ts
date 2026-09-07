import {
  detectAnomalies,
  forecastCashFlow,
  NaturalLanguageQueryEngine,
  suggestCategoryForMerchant,
  type FinancialContext,
} from '@biyong/domain';
import type {
  CashFlowForecastPoint,
  FinancialAnomaly,
  NaturalLanguageQueryResponse,
} from '@biyong/schemas';
import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  PeerDebtRepository,
  SubscriptionRepository,
  TransactionRepository,
  WealthRepository,
} from '../repositories.js';

export interface IntelligenceRepositories {
  accountRepo: AccountRepository;
  txRepo: TransactionRepository;
  categoryRepo?: CategoryRepository;
  budgetRepo?: BudgetRepository;
  wealthRepo?: WealthRepository;
  peerDebtRepo?: PeerDebtRepository;
  subscriptionRepo?: SubscriptionRepository;
}

export class IntelligenceUseCases {
  constructor(private repos: IntelligenceRepositories) {}

  async askQuestion(query: string): Promise<NaturalLanguageQueryResponse> {
    const accounts = await this.repos.accountRepo.findAll();
    const transactions = await this.repos.txRepo.findAll();
    const categories = this.repos.categoryRepo ? await this.repos.categoryRepo.findAll() : [];
    const budgets = this.repos.budgetRepo ? await this.repos.budgetRepo.findAll() : [];
    const investments = this.repos.wealthRepo ? await this.repos.wealthRepo.getInvestments() : [];
    const liabilities = this.repos.wealthRepo ? await this.repos.wealthRepo.getLiabilities() : [];
    const peerDebts = this.repos.peerDebtRepo ? await this.repos.peerDebtRepo.findAll() : [];
    const subscriptions = this.repos.subscriptionRepo ? await this.repos.subscriptionRepo.findAll() : [];

    const context: FinancialContext = {
      accounts,
      transactions,
      categories,
      budgets,
      investments,
      liabilities,
      peerDebts,
      subscriptions,
    };

    return NaturalLanguageQueryEngine.processFinancialQuery(query, context);
  }

  async getAnomalies(): Promise<FinancialAnomaly[]> {
    const transactions = await this.repos.txRepo.findAll();
    return detectAnomalies(transactions);
  }

  async detectAnomalies(): Promise<FinancialAnomaly[]> {
    return this.getAnomalies();
  }

  async getCashFlowForecast(
    daysAhead = 60,
    referenceDate = new Date()
  ): Promise<CashFlowForecastPoint[]> {
    const accounts = await this.repos.accountRepo.findAll();
    const transactions = await this.repos.txRepo.findAll();
    const subscriptions = this.repos.subscriptionRepo ? await this.repos.subscriptionRepo.findAll() : [];
    const liabilities = this.repos.wealthRepo ? await this.repos.wealthRepo.getLiabilities() : [];
    const peerDebts = this.repos.peerDebtRepo ? await this.repos.peerDebtRepo.findAll() : [];

    return forecastCashFlow(
      accounts,
      transactions,
      subscriptions,
      liabilities,
      peerDebts,
      daysAhead,
      referenceDate
    );
  }

  async forecastRunway(daysAhead = 60, referenceDate = new Date()): Promise<CashFlowForecastPoint[]> {
    return this.getCashFlowForecast(daysAhead, referenceDate);
  }

  async suggestCategory(merchant: string): Promise<string | null> {
    const categories = this.repos.categoryRepo ? await this.repos.categoryRepo.findAll() : [];
    return suggestCategoryForMerchant(merchant, categories);
  }
}
