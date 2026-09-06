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

  async getGroup(id: string): Promise<Group | null> {
    return this.groupRepo.findById(id);
  }

  async listGroups(): Promise<Group[]> {
    return this.groupRepo.findAll();
  }

  async addMember(member: GroupMember): Promise<void> {
    await this.groupRepo.addMember(member);
  }

  async getMembers(groupId: string): Promise<GroupMember[]> {
    return this.groupRepo.getMembers(groupId);
  }

  async getExpenses(groupId: string): Promise<GroupExpense[]> {
    return this.groupRepo.getExpenses(groupId);
  }

  async getSettlements(groupId: string): Promise<Settlement[]> {
    return this.groupRepo.getSettlements(groupId);
  }

  async deleteExpense(id: string): Promise<void> {
    if (this.groupRepo.deleteExpense) {
      await this.groupRepo.deleteExpense(id);
    }
  }

  async deleteGroup(id: string): Promise<void> {
    if (this.groupRepo.delete) {
      await this.groupRepo.delete(id);
    }
  }

  async getGroupSummary(groupId: string): Promise<{
    group: Group | null;
    members: GroupMember[];
    expenses: GroupExpense[];
    settlements: Settlement[];
    totalSpentMinor: number;
    balances: Map<string, number>;
    simplifiedTransfers: SimplifiedTransfer[];
  }> {
    const group = await this.groupRepo.findById(groupId);
    const members = await this.groupRepo.getMembers(groupId);
    const expenses = await this.groupRepo.getExpenses(groupId);
    const settlements = await this.groupRepo.getSettlements(groupId);

    const totalSpentMinor = expenses.reduce((sum, e) => sum + e.amountMinor, 0);
    const memberIds = members.map((m) => m.id);
    const balances = calculateNetBalances(memberIds, expenses, settlements);
    const simplifiedTransfers = simplifyDebts(balances);

    return {
      group,
      members,
      expenses,
      settlements,
      totalSpentMinor,
      balances,
      simplifiedTransfers,
    };
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
