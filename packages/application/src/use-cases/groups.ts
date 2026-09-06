import type { Group, GroupMember, GroupExpense, Settlement } from '@biyong/schemas';
import {
  calculateNetBalances,
  simplifyDebts,
  explainMemberSettlement,
  buildDependencyGraph,
  validatePayers,
  calculateSplit,
  type SimplifiedTransfer,
  type MemberSettlementExplanation,
  type DependencyGraph,
} from '@biyong/domain';
import type { GroupRepository } from '../repositories.js';

export class GroupUseCases {
  constructor(private groupRepo: GroupRepository) {}

  async createGroup(group: Group, initialMembers: GroupMember[]): Promise<void> {
    await this.groupRepo.create(group);
    for (const member of initialMembers) {
      await this.groupRepo.addMember(member);
    }
  }

  async addExpense(expense: GroupExpense): Promise<void> {
    // Validate payers sum
    validatePayers(expense.amountMinor, expense.payers);

    // Validate splits sum
    calculateSplit({
      totalAmountMinor: expense.amountMinor,
      method: expense.splitMethod,
      allocations: expense.allocations,
    });

    await this.groupRepo.addExpense(expense);
  }

  async addSettlement(settlement: Settlement): Promise<void> {
    await this.groupRepo.addSettlement(settlement);
  }

  async getGroupSettlementPlan(groupId: string): Promise<{
    balances: Map<string, number>;
    simplifiedTransfers: SimplifiedTransfer[];
  }> {
    const members = await this.groupRepo.getMembers(groupId);
    const expenses = await this.groupRepo.getExpenses(groupId);
    const settlements = await this.groupRepo.getSettlements(groupId);

    const memberIds = members.map((m) => m.id);
    const balances = calculateNetBalances(memberIds, expenses, settlements);
    const simplifiedTransfers = simplifyDebts(balances);

    return { balances, simplifiedTransfers };
  }

  async explainSettlement(groupId: string, memberId: string): Promise<MemberSettlementExplanation> {
    const members = await this.groupRepo.getMembers(groupId);
    const expenses = await this.groupRepo.getExpenses(groupId);
    const settlements = await this.groupRepo.getSettlements(groupId);

    const memberIds = members.map((m) => m.id);
    return explainMemberSettlement(memberId, memberIds, expenses, settlements);
  }

  async getDependencyGraph(groupId: string): Promise<DependencyGraph> {
    const members = await this.groupRepo.getMembers(groupId);
    const expenses = await this.groupRepo.getExpenses(groupId);
    const settlements = await this.groupRepo.getSettlements(groupId);

    const memberNames = new Map(members.map((m) => [m.id, m.name]));
    return buildDependencyGraph(memberNames, expenses, settlements);
  }
}
