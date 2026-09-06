import type { Transaction, Account } from '@biyong/schemas';
import type { AccountRepository, TransactionRepository } from '../repositories.js';

export class TransactionUseCases {
  constructor(
    private accountRepo: AccountRepository,
    private txRepo: TransactionRepository
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
      const toAccount = await this.accountRepo.findById(tx.toAccountId);
      if (!toAccount) {
        throw new Error(`Destination account not found: ${tx.toAccountId}`);
      }
    }

    await this.txRepo.create(tx);
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
