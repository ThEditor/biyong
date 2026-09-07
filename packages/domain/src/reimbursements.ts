import type { ReimbursementClaim, Transaction } from '@biyong/schemas';

export interface ReimbursementSummary {
  totalClaimedMinor: number;
  pendingMinor: number;
  reimbursedMinor: number;
  personalExpenseReductionMinor: number;
}

export interface PersonalSpendingBreakdown {
  grossExpenseMinor: number;
  reimbursableExpenseMinor: number;
  netPersonalExpenseMinor: number;
}

/**
 * Calculates a summary of reimbursement claims.
 * Tracks total claimed, pending approvals/payouts, and settled reimbursements.
 */
export function calculateReimbursementSummary(
  claims: ReimbursementClaim[]
): ReimbursementSummary {
  let totalClaimedMinor = 0;
  let pendingMinor = 0;
  let reimbursedMinor = 0;

  for (const claim of claims) {
    totalClaimedMinor += claim.amountMinor;

    if (claim.status === 'reimbursed') {
      reimbursedMinor += claim.amountMinor;
    } else if (
      claim.status === 'pending' ||
      claim.status === 'submitted' ||
      claim.status === 'approved'
    ) {
      pendingMinor += claim.amountMinor;
    }
  }

  // Personal expenses are directly reduced by the reimbursed amount received back
  const personalExpenseReductionMinor = reimbursedMinor;

  return {
    totalClaimedMinor,
    pendingMinor,
    reimbursedMinor,
    personalExpenseReductionMinor,
  };
}

/**
 * Ensures reimbursable spending is transparently subtracted from personal cost calculation.
 * Rule: Transfers between owned accounts are never income or expense.
 */
export function calculatePersonalSpendingBreakdown(
  transactions: Transaction[],
  claims: ReimbursementClaim[] = []
): PersonalSpendingBreakdown {
  const grossExpenseMinor = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((acc, tx) => acc + tx.amountMinor, 0);

  let reimbursableExpenseMinor = 0;

  if (claims.length > 0) {
    reimbursableExpenseMinor = claims
      .filter((c) => c.status !== 'rejected')
      .reduce((acc, c) => acc + c.amountMinor, 0);
  } else {
    reimbursableExpenseMinor = transactions
      .filter((tx) => tx.type === 'expense' && tx.isReimbursable)
      .reduce((acc, tx) => acc + tx.amountMinor, 0);
  }

  const boundedReimbursableMinor = Math.min(grossExpenseMinor, reimbursableExpenseMinor);
  const netPersonalExpenseMinor = Math.max(0, grossExpenseMinor - boundedReimbursableMinor);

  return {
    grossExpenseMinor,
    reimbursableExpenseMinor: boundedReimbursableMinor,
    netPersonalExpenseMinor,
  };
}
