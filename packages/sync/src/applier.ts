import type { SyncOperation, Account, Transaction, Budget, Goal, Group, GroupMember, GroupExpense, Settlement } from '@biyong/schemas';
import type {
  SqliteAccountRepository,
  SqliteTransactionRepository,
  SqliteBudgetRepository,
  SqliteGoalRepository,
  SqliteGroupRepository,
} from '@biyong/local-db';

export interface SyncLocalRepositories {
  accountRepo?: SqliteAccountRepository;
  txRepo?: SqliteTransactionRepository;
  budgetRepo?: SqliteBudgetRepository;
  goalRepo?: SqliteGoalRepository;
  groupRepo?: SqliteGroupRepository;
}

/**
 * Applies a remote sync operation idempotently to the local SQLite database.
 */
export async function applyRemoteOperation(
  op: SyncOperation,
  repos: SyncLocalRepositories
): Promise<void> {
  const { entityType, entityId, operationType, payload } = op;

  switch (entityType) {
    case 'account': {
      if (!repos.accountRepo) break;
      const account = payload as unknown as Account;
      if (operationType === 'delete') {
        await repos.accountRepo.delete(entityId);
      } else {
        const existing = await repos.accountRepo.findById(entityId);
        if (existing) {
          await repos.accountRepo.update(account);
        } else {
          await repos.accountRepo.create(account);
        }
      }
      break;
    }

    case 'transaction': {
      if (!repos.txRepo) break;
      const tx = payload as unknown as Transaction;
      if (operationType === 'delete') {
        await repos.txRepo.delete(entityId);
      } else {
        const existing = await repos.txRepo.findById(entityId);
        if (existing) {
          await repos.txRepo.update(tx);
        } else {
          await repos.txRepo.create(tx);
        }
      }
      break;
    }

    case 'budget': {
      if (!repos.budgetRepo) break;
      const budget = payload as unknown as Budget;
      if (operationType === 'delete') {
        await repos.budgetRepo.delete(entityId);
      } else {
        const existing = await repos.budgetRepo.findById(entityId);
        if (existing) {
          await repos.budgetRepo.update(budget);
        } else {
          await repos.budgetRepo.create(budget);
        }
      }
      break;
    }

    case 'goal': {
      if (!repos.goalRepo) break;
      const goal = payload as unknown as Goal;
      if (operationType === 'delete') {
        await repos.goalRepo.delete(entityId);
      } else {
        const existing = await repos.goalRepo.findById(entityId);
        if (existing) {
          await repos.goalRepo.update(goal);
        } else {
          await repos.goalRepo.create(goal);
        }
      }
      break;
    }

    case 'group': {
      if (!repos.groupRepo) break;
      const group = payload as unknown as Group;
      if (operationType === 'delete') {
        await repos.groupRepo.delete(entityId);
      } else {
        const existing = await repos.groupRepo.findById(entityId);
        if (!existing) {
          await repos.groupRepo.create(group);
        }
      }
      break;
    }

    case 'group_member': {
      if (!repos.groupRepo) break;
      const member = payload as unknown as GroupMember;
      const members = await repos.groupRepo.getMembers(member.groupId);
      if (!members.some((m) => m.id === member.id)) {
        await repos.groupRepo.addMember(member);
      }
      break;
    }

    case 'group_expense': {
      if (!repos.groupRepo) break;
      const expense = payload as unknown as GroupExpense;
      if (operationType === 'delete') {
        await repos.groupRepo.deleteExpense(entityId);
      } else {
        const expenses = await repos.groupRepo.getExpenses(expense.groupId);
        if (!expenses.some((e) => e.id === expense.id)) {
          await repos.groupRepo.addExpense(expense);
        }
      }
      break;
    }

    case 'settlement': {
      if (!repos.groupRepo) break;
      const settlement = payload as unknown as Settlement;
      const settlements = await repos.groupRepo.getSettlements(settlement.groupId);
      if (!settlements.some((s) => s.id === settlement.id)) {
        await repos.groupRepo.addSettlement(settlement);
      }
      break;
    }

    default:
      // Unknown entity type, ignore gracefully
      break;
  }
}
