import {
  exportAccountsToCsv,
  exportLedgerToJson,
  exportTransactionsToCsv,
  reconcileLedgerImport,
  validateLedgerImport,
} from '@biyong/domain';
import type { LedgerExportData } from '@biyong/schemas';
import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  GoalRepository,
  PeerDebtRepository,
  ReimbursementRepository,
  SubscriptionRepository,
  TransactionRepository,
  WealthRepository,
} from '../repositories.js';
import { TransactionUseCases } from './transactions.js';

export interface ExportImportRepositories {
  accountRepo: AccountRepository;
  txRepo: TransactionRepository;
  categoryRepo?: CategoryRepository;
  budgetRepo?: BudgetRepository;
  goalRepo?: GoalRepository;
  wealthRepo?: WealthRepository;
  peerDebtRepo?: PeerDebtRepository;
  reimbursementRepo?: ReimbursementRepository;
  subscriptionRepo?: SubscriptionRepository;
}

export class ExportImportUseCases {
  private txUseCases: TransactionUseCases;

  constructor(private repos: ExportImportRepositories) {
    this.txUseCases = new TransactionUseCases(
      repos.accountRepo,
      repos.txRepo,
      repos.categoryRepo
    );
  }

  async exportFullLedger(): Promise<LedgerExportData> {
    const accounts = await this.repos.accountRepo.findAll();
    const categories = this.repos.categoryRepo ? await this.repos.categoryRepo.findAll() : [];
    const transactions = await this.repos.txRepo.findAll();
    const budgets = this.repos.budgetRepo ? await this.repos.budgetRepo.findAll() : [];
    const goals = this.repos.goalRepo ? await this.repos.goalRepo.findAll() : [];
    const investments = this.repos.wealthRepo ? await this.repos.wealthRepo.getInvestments() : [];
    const liabilities = this.repos.wealthRepo ? await this.repos.wealthRepo.getLiabilities() : [];
    const peerDebts = this.repos.peerDebtRepo ? await this.repos.peerDebtRepo.findAll() : [];

    let peerRepayments: LedgerExportData['peerRepayments'] = [];
    if (this.repos.peerDebtRepo) {
      if (this.repos.peerDebtRepo.getAllRepayments) {
        peerRepayments = await this.repos.peerDebtRepo.getAllRepayments();
      } else {
        for (const debt of peerDebts) {
          const reps = await this.repos.peerDebtRepo.getRepayments(debt.id);
          peerRepayments.push(...reps);
        }
      }
    }

    const reimbursements = this.repos.reimbursementRepo
      ? await this.repos.reimbursementRepo.findAll()
      : [];
    const subscriptions = this.repos.subscriptionRepo
      ? await this.repos.subscriptionRepo.findAll()
      : [];

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      investments,
      liabilities,
      peerDebts,
      peerRepayments,
      reimbursements,
      subscriptions,
    };
  }

  async exportToJson(): Promise<string> {
    const ledger = await this.exportFullLedger();
    return exportLedgerToJson(ledger);
  }

  async exportTransactionsCsv(): Promise<string> {
    const transactions = await this.repos.txRepo.findAll();
    const accounts = await this.repos.accountRepo.findAll();
    const categories = this.repos.categoryRepo ? await this.repos.categoryRepo.findAll() : [];
    return exportTransactionsToCsv(transactions, accounts, categories);
  }

  async exportAccountsCsv(): Promise<string> {
    const accounts = await this.repos.accountRepo.findAll();
    const balances = new Map<string, number>();

    for (const acc of accounts) {
      const bal = await this.txUseCases.getDerivedAccountBalance(acc.id);
      balances.set(acc.id, bal);
    }

    return exportAccountsToCsv(accounts, balances);
  }

  validateImport(jsonString: string): { valid: boolean; data?: LedgerExportData; error?: string } {
    return validateLedgerImport(jsonString);
  }

  async importAndReconcile(
    incomingJson: string
  ): Promise<{ success: boolean; error?: string; reconciled?: LedgerExportData }> {
    const validation = this.validateImport(incomingJson);
    if (!validation.valid || !validation.data) {
      return { success: false, error: validation.error ?? 'Invalid ledger export format' };
    }

    const existing = await this.exportFullLedger();
    const reconciled = reconcileLedgerImport(existing, validation.data);

    // Persist reconciled data into repositories
    for (const acc of reconciled.accounts) {
      const current = await this.repos.accountRepo.findById(acc.id);
      if (current) {
        await this.repos.accountRepo.update(acc);
      } else {
        await this.repos.accountRepo.create(acc);
      }
    }

    if (this.repos.categoryRepo) {
      for (const cat of reconciled.categories) {
        const current = await this.repos.categoryRepo.findById(cat.id);
        if (!current) {
          await this.repos.categoryRepo.create(cat);
        }
      }
    }

    for (const tx of reconciled.transactions) {
      const current = await this.repos.txRepo.findById(tx.id);
      if (current) {
        await this.repos.txRepo.update(tx);
      } else {
        await this.repos.txRepo.create(tx);
      }
    }

    if (this.repos.budgetRepo) {
      for (const b of reconciled.budgets) {
        const current = await this.repos.budgetRepo.findById(b.id);
        if (current) {
          await this.repos.budgetRepo.update(b);
        } else {
          await this.repos.budgetRepo.create(b);
        }
      }
    }

    if (this.repos.goalRepo) {
      for (const g of reconciled.goals) {
        const current = await this.repos.goalRepo.findById(g.id);
        if (current) {
          await this.repos.goalRepo.update(g);
        } else {
          await this.repos.goalRepo.create(g);
        }
      }
    }

    if (this.repos.wealthRepo) {
      for (const inv of reconciled.investments) {
        await this.repos.wealthRepo.saveInvestment(inv);
      }
      for (const liab of reconciled.liabilities) {
        await this.repos.wealthRepo.saveLiability(liab);
      }
    }

    if (this.repos.peerDebtRepo) {
      for (const debt of reconciled.peerDebts ?? []) {
        if (this.repos.peerDebtRepo.save) {
          await this.repos.peerDebtRepo.save(debt);
        } else if (this.repos.peerDebtRepo.update && (await this.repos.peerDebtRepo.findById(debt.id))) {
          await this.repos.peerDebtRepo.update(debt);
        } else if (this.repos.peerDebtRepo.create) {
          await this.repos.peerDebtRepo.create(debt);
        }
      }
      for (const rep of reconciled.peerRepayments ?? []) {
        await this.repos.peerDebtRepo.addRepayment(rep);
      }
    }

    if (this.repos.reimbursementRepo) {
      for (const claim of reconciled.reimbursements ?? []) {
        if (this.repos.reimbursementRepo.save) {
          await this.repos.reimbursementRepo.save(claim);
        } else if (this.repos.reimbursementRepo.update && (await this.repos.reimbursementRepo.findById(claim.id))) {
          await this.repos.reimbursementRepo.update(claim);
        } else if (this.repos.reimbursementRepo.create) {
          await this.repos.reimbursementRepo.create(claim);
        }
      }
    }

    if (this.repos.subscriptionRepo) {
      for (const sub of reconciled.subscriptions ?? []) {
        if (this.repos.subscriptionRepo.save) {
          await this.repos.subscriptionRepo.save(sub);
        } else if (this.repos.subscriptionRepo.update && (await this.repos.subscriptionRepo.findById(sub.id))) {
          await this.repos.subscriptionRepo.update(sub);
        } else if (this.repos.subscriptionRepo.create) {
          await this.repos.subscriptionRepo.create(sub);
        }
      }
    }

    return { success: true, reconciled };
  }
}
