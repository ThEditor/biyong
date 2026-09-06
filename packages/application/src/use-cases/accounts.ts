import type { Account } from '@biyong/schemas';
import type { AccountRepository, TransactionRepository } from '../repositories.js';
import { TransactionUseCases } from './transactions.js';

export interface AccountWithDerivedBalance extends Account {
  derivedBalanceMinor: number;
  account: Account;
}

export class AccountUseCases {
  private txUseCases: TransactionUseCases;

  constructor(
    private accountRepo: AccountRepository,
    private txRepo: TransactionRepository
  ) {
    this.txUseCases = new TransactionUseCases(accountRepo, txRepo);
  }

  async createAccount(account: Account): Promise<void> {
    await this.accountRepo.create(account);
  }

  async getAccount(id: string): Promise<Account | null> {
    return this.accountRepo.findById(id);
  }

  async getDerivedAccountBalance(id: string): Promise<number> {
    return this.txUseCases.getDerivedAccountBalance(id);
  }

  async archiveAccount(id: string): Promise<void> {
    const account = await this.accountRepo.findById(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }
    await this.accountRepo.update({
      ...account,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * List all accounts together with their current derived balances.
   * Derived balances are computed strictly from transactions and initial balance.
   */
  async listAccountsWithDerivedBalances(includeArchived = true): Promise<AccountWithDerivedBalance[]> {
    const accounts = await this.accountRepo.findAll();
    const filtered = includeArchived ? accounts : accounts.filter((a) => !a.isArchived);
    const result: AccountWithDerivedBalance[] = [];

    for (const account of filtered) {
      const derivedBalanceMinor = await this.txUseCases.getDerivedAccountBalance(account.id);
      result.push({
        ...account,
        derivedBalanceMinor,
        account,
      });
    }

    return result;
  }
}
