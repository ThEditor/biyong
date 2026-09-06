import type { GroupExpense, Settlement } from '@biyong/schemas';
import { calculateSplit } from './splits.js';

export interface MemberNetBalance {
  memberId: string;
  netMinor: number; // Positive = owed money (creditor), Negative = owes money (debtor)
}

export interface SimplifiedTransfer {
  fromMemberId: string; // Debtor
  toMemberId: string;   // Creditor
  amountMinor: number;
}

export interface SettlementExplanationOrigin {
  expenseId: string;
  expenseTitle: string;
  totalAmountMinor: number;
  paidMinor: number;
  allocatedMinor: number;
  netContributionMinor: number;
}

export interface MemberSettlementExplanation {
  memberId: string;
  origins: SettlementExplanationOrigin[];
  settlementsMadeMinor: number;
  settlementsReceivedMinor: number;
  netBalanceMinor: number;
  transfers: SimplifiedTransfer[];
}

export interface DependencyGraphNode {
  id: string;
  label: string;
  type: 'expense' | 'member' | 'settlement';
  data: Record<string, unknown>;
}

export interface DependencyGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  amountMinor: number;
}

export interface DependencyGraph {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

/**
 * Calculates net balances for each group member across all expenses and settlements.
 */
export function calculateNetBalances(
  memberIds: string[],
  expenses: GroupExpense[],
  settlements: Settlement[]
): Map<string, number> {
  const balances = new Map<string, number>();
  memberIds.forEach((id) => balances.set(id, 0));

  // 1. Process expenses
  for (const expense of expenses) {
    // Credit payers
    for (const payer of expense.payers) {
      const current = balances.get(payer.memberId) ?? 0;
      balances.set(payer.memberId, current + payer.amountMinor);
    }

    // Debit split members
    const splits = calculateSplit({
      totalAmountMinor: expense.amountMinor,
      method: expense.splitMethod,
      allocations: expense.allocations,
    });

    for (const split of splits) {
      const current = balances.get(split.memberId) ?? 0;
      balances.set(split.memberId, current - split.owedMinor);
    }
  }

  // 2. Process recorded settlements
  for (const settlement of settlements) {
    // Payer sent money -> their net balance increases (they owe less or are owed more)
    const fromBal = balances.get(settlement.fromMemberId) ?? 0;
    balances.set(settlement.fromMemberId, fromBal + settlement.amountMinor);

    // Receiver got money -> their net balance decreases (they are owed less)
    const toBal = balances.get(settlement.toMemberId) ?? 0;
    balances.set(settlement.toMemberId, toBal - settlement.amountMinor);
  }

  return balances;
}

/**
 * Deterministic Debt Simplification Algorithm (Greedy min-cash-flow algorithm).
 * Minimizes the number of transactions required to settle all debts.
 */
export function simplifyDebts(balances: Map<string, number>): SimplifiedTransfer[] {
  const debtors: { memberId: string; amountMinor: number }[] = [];
  const creditors: { memberId: string; amountMinor: number }[] = [];

  for (const [memberId, balance] of balances.entries()) {
    if (balance < 0) {
      debtors.push({ memberId, amountMinor: -balance });
    } else if (balance > 0) {
      creditors.push({ memberId, amountMinor: balance });
    }
  }

  // Sort descending to greedily settle largest debts first
  debtors.sort((a, b) => b.amountMinor - a.amountMinor);
  creditors.sort((a, b) => b.amountMinor - a.amountMinor);

  const transfers: SimplifiedTransfer[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx]!;
    const creditor = creditors[cIdx]!;

    const settleAmount = Math.min(debtor.amountMinor, creditor.amountMinor);
    if (settleAmount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountMinor: settleAmount,
      });

      debtor.amountMinor -= settleAmount;
      creditor.amountMinor -= settleAmount;
    }

    if (debtor.amountMinor === 0) dIdx++;
    if (creditor.amountMinor === 0) cIdx++;
  }

  return transfers;
}

/**
 * Builds a transparent settlement explanation for a member, showing exact origins and calculations.
 */
export function explainMemberSettlement(
  memberId: string,
  memberIds: string[],
  expenses: GroupExpense[],
  settlements: Settlement[]
): MemberSettlementExplanation {
  const origins: SettlementExplanationOrigin[] = [];

  for (const expense of expenses) {
    const paidMinor = expense.payers.find((p) => p.memberId === memberId)?.amountMinor ?? 0;
    const splits = calculateSplit({
      totalAmountMinor: expense.amountMinor,
      method: expense.splitMethod,
      allocations: expense.allocations,
    });
    const allocatedMinor = splits.find((s) => s.memberId === memberId)?.owedMinor ?? 0;

    if (paidMinor > 0 || allocatedMinor > 0) {
      origins.push({
        expenseId: expense.id,
        expenseTitle: expense.title,
        totalAmountMinor: expense.amountMinor,
        paidMinor,
        allocatedMinor,
        netContributionMinor: paidMinor - allocatedMinor,
      });
    }
  }

  let settlementsMadeMinor = 0;
  let settlementsReceivedMinor = 0;

  for (const s of settlements) {
    if (s.fromMemberId === memberId) {
      settlementsMadeMinor += s.amountMinor;
    }
    if (s.toMemberId === memberId) {
      settlementsReceivedMinor += s.amountMinor;
    }
  }

  const allBalances = calculateNetBalances(memberIds, expenses, settlements);
  const netBalanceMinor = allBalances.get(memberId) ?? 0;
  const allTransfers = simplifyDebts(allBalances);
  const memberTransfers = allTransfers.filter(
    (t) => t.fromMemberId === memberId || t.toMemberId === memberId
  );

  return {
    memberId,
    origins,
    settlementsMadeMinor,
    settlementsReceivedMinor,
    netBalanceMinor,
    transfers: memberTransfers,
  };
}

/**
 * Generates visual dependency graph nodes and edges for the group.
 */
export function buildDependencyGraph(
  memberNames: Map<string, string>,
  expenses: GroupExpense[],
  settlements: Settlement[]
): DependencyGraph {
  const nodes: DependencyGraphNode[] = [];
  const edges: DependencyGraphEdge[] = [];

  // Add Member Nodes
  for (const [memberId, name] of memberNames.entries()) {
    nodes.push({
      id: `member-${memberId}`,
      label: name,
      type: 'member',
      data: { memberId },
    });
  }

  // Add Expense Nodes and Edges
  for (const exp of expenses) {
    const expenseNodeId = `expense-${exp.id}`;
    nodes.push({
      id: expenseNodeId,
      label: exp.title,
      type: 'expense',
      data: { expenseId: exp.id, amountMinor: exp.amountMinor },
    });

    // Payer edge: Member -> Expense
    for (const payer of exp.payers) {
      edges.push({
        id: `pay-${payer.memberId}-${exp.id}`,
        source: `member-${payer.memberId}`,
        target: expenseNodeId,
        label: `Paid`,
        amountMinor: payer.amountMinor,
      });
    }

    // Split edge: Expense -> Member
    const splits = calculateSplit({
      totalAmountMinor: exp.amountMinor,
      method: exp.splitMethod,
      allocations: exp.allocations,
    });
    for (const split of splits) {
      edges.push({
        id: `split-${exp.id}-${split.memberId}`,
        source: expenseNodeId,
        target: `member-${split.memberId}`,
        label: `Share`,
        amountMinor: split.owedMinor,
      });
    }
  }

  // Add Settlement Edges: Member -> Member
  for (const s of settlements) {
    edges.push({
      id: `settle-${s.id}`,
      source: `member-${s.fromMemberId}`,
      target: `member-${s.toMemberId}`,
      label: `Settled`,
      amountMinor: s.amountMinor,
    });
  }

  return { nodes, edges };
}
