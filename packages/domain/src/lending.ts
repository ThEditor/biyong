import type { PeerDebt } from '@biyong/schemas';

export interface PeerDebtSummary {
  totalLentMinor: number;
  totalBorrowedMinor: number;
  netPeerBalanceMinor: number;
  activeLentCount: number;
  activeBorrowedCount: number;
}

/**
 * Calculates a summary of active peer lending and borrowing debts.
 * All arithmetic uses pure integer minor units.
 */
export function calculatePeerDebtSummary(debts: PeerDebt[]): PeerDebtSummary {
  let totalLentMinor = 0;
  let totalBorrowedMinor = 0;
  let activeLentCount = 0;
  let activeBorrowedCount = 0;

  for (const debt of debts) {
    if (debt.status !== 'active') {
      continue;
    }

    if (debt.type === 'lent') {
      totalLentMinor += debt.remainingAmountMinor;
      activeLentCount += 1;
    } else if (debt.type === 'borrowed') {
      totalBorrowedMinor += debt.remainingAmountMinor;
      activeBorrowedCount += 1;
    }
  }

  const netPeerBalanceMinor = totalLentMinor - totalBorrowedMinor;

  return {
    totalLentMinor,
    totalBorrowedMinor,
    netPeerBalanceMinor,
    activeLentCount,
    activeBorrowedCount,
  };
}

/**
 * Applies a repayment amount against a peer debt.
 * Deducts paymentAmountMinor from remainingAmountMinor (clamped to 0).
 * If remainingAmountMinor reaches 0, updates status to 'settled'.
 */
export function applyRepayment(
  debt: PeerDebt,
  paymentAmountMinor: number
): { updatedDebt: PeerDebt; actualPaymentMinor: number; isSettled: boolean } {
  if (paymentAmountMinor <= 0) {
    throw new Error('Payment amount must be positive');
  }

  const actualPaymentMinor = Math.min(debt.remainingAmountMinor, paymentAmountMinor);
  const remainingAmountMinor = Math.max(0, debt.remainingAmountMinor - paymentAmountMinor);
  const isSettled = remainingAmountMinor === 0;

  const updatedDebt: PeerDebt = {
    ...debt,
    remainingAmountMinor,
    status: isSettled ? 'settled' : 'active',
    updatedAt: new Date().toISOString(),
  };

  return {
    updatedDebt,
    actualPaymentMinor,
    isSettled,
  };
}
