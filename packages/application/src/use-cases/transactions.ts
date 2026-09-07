import type { Transaction } from '@biyong/schemas';
import {
  filterTransactions,
  generateMonthlyReport,
  type TransactionFilter,
  type MonthlyReport,
} from '@biyong/domain';
import type {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
} from '../repositories.js';

export class TransactionUseCases {
  constructor(
    private accountRepo: AccountRepository,
    private txRepo: TransactionRepository,
    private categoryRepo?: CategoryRepository
  ) {}

  async createTransaction(tx: Transaction): Promise<void> {
    const account = await this.accountRepo.findById(tx.accountId);
    if (!account) {
      throw new Error(`Account not found: ${tx.accountId}`);
    }

    if (tx.type === 'transfer') {
      if (!tx.toAccountId) {
        throw new Error('Transfer transaction requires a destination toAccountId');
      }
      if (tx.accountId === tx.toAccountId) {
        throw new Error('Transfer destination cannot be the same as the source account');
      }
      const toAccount = await this.accountRepo.findById(tx.toAccountId);
      if (!toAccount) {
        throw new Error(`Destination account not found: ${tx.toAccountId}`);
      }
    }

    await this.txRepo.create(tx);
  }

  async updateTransaction(tx: Transaction): Promise<void> {
    const existing = await this.txRepo.findById(tx.id);
    if (!existing) {
      throw new Error(`Transaction not found: ${tx.id}`);
    }

    const account = await this.accountRepo.findById(tx.accountId);
    if (!account) {
      throw new Error(`Account not found: ${tx.accountId}`);
    }

    if (tx.type === 'transfer') {
      if (!tx.toAccountId) {
        throw new Error('Transfer transaction requires a destination toAccountId');
      }
      if (tx.accountId === tx.toAccountId) {
        throw new Error('Transfer destination cannot be the same as the source account');
      }
      const toAccount = await this.accountRepo.findById(tx.toAccountId);
      if (!toAccount) {
        throw new Error(`Destination account not found: ${tx.toAccountId}`);
      }
    }

    await this.txRepo.update(tx);
  }

  async deleteTransaction(id: string): Promise<void> {
    const existing = await this.txRepo.findById(id);
    if (!existing) {
      throw new Error(`Transaction not found: ${id}`);
    }
    await this.txRepo.delete(id);
  }

  /**
   * Search and filter transactions using pure domain filtering rules.
   */
  async searchAndFilter(filter: TransactionFilter): Promise<Transaction[]> {
    const allTxs = await this.txRepo.findAll();
    return filterTransactions(allTxs, filter);
  }

  /**
   * Generate monthly financial report for given year and month.
   */
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const allTxs = await this.txRepo.findAll();
    const categories = this.categoryRepo ? await this.categoryRepo.findAll() : undefined;
    return generateMonthlyReport(allTxs, year, month, categories);
  }

  /**
   * Derive account balance strictly from transactions and initial balance.
   * Prevents arbitrary mutable balance corruption.
   */
  async getDerivedAccountBalance(accountId: string): Promise<number> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    let balanceMinor = account.initialBalanceMinor;
    const allTxs = await this.txRepo.findAll();

    for (const tx of allTxs) {
      if (tx.accountId === accountId) {
        if (tx.type === 'income') {
          balanceMinor += tx.amountMinor;
        } else if (tx.type === 'expense') {
          balanceMinor -= tx.amountMinor;
        } else if (tx.type === 'transfer') {
          balanceMinor -= tx.amountMinor;
        }
      } else if (tx.type === 'transfer' && tx.toAccountId === accountId) {
        balanceMinor += tx.amountMinor;
      }
    }

    return balanceMinor;
  }
}
