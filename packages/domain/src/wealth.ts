import type { Investment, Liability } from '@biyong/schemas';

export interface WealthSummary {
  cashBankAssetsMinor: number;
  investmentsMinor: number;
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  netWorthMinor: number;
  assetAllocation: {
    category: string;
    amountMinor: number;
    percentage: number;
  }[];
}

export function calculateNetWorth(
  cashBankBalancesMinor: number[],
  investments: Investment[],
  liabilities: Liability[]
): WealthSummary {
  const cashBankAssetsMinor = cashBankBalancesMinor.reduce((acc, val) => acc + val, 0);
  const investmentsMinor = investments.reduce((acc, inv) => acc + inv.currentValueMinor, 0);
  const totalAssetsMinor = cashBankAssetsMinor + investmentsMinor;

  const totalLiabilitiesMinor = liabilities.reduce(
    (acc, liab) => acc + liab.remainingAmountMinor,
    0
  );

  const netWorthMinor = totalAssetsMinor - totalLiabilitiesMinor;

  // Group investments by category
  const allocationMap = new Map<string, number>();
  if (cashBankAssetsMinor > 0) {
    allocationMap.set('Cash & Bank', cashBankAssetsMinor);
  }

  for (const inv of investments) {
    const key = inv.type.toUpperCase();
    const curr = allocationMap.get(key) ?? 0;
    allocationMap.set(key, curr + inv.currentValueMinor);
  }

  const assetAllocation = Array.from(allocationMap.entries()).map(([category, amountMinor]) => ({
    category,
    amountMinor,
    percentage: totalAssetsMinor > 0 ? Math.round((amountMinor / totalAssetsMinor) * 100) : 0,
  }));

  return {
    cashBankAssetsMinor,
    investmentsMinor,
    totalAssetsMinor,
    totalLiabilitiesMinor,
    netWorthMinor,
    assetAllocation,
  };
}
