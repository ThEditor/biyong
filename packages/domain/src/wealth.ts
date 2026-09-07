import type { Investment, Liability, Transaction, PeerDebt } from '@biyong/schemas';

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

export type AssetClass = 'equity' | 'debt' | 'gold' | 'retirement' | 'other';

export interface AssetClassBreakdownItem {
  assetClass: AssetClass;
  label: string;
  amountMinor: number;
  percentage: number;
}

export interface InvestmentAnalytics {
  investedAmountMinor: number;
  currentValueMinor: number;
  totalGainMinor: number;
  absoluteReturnPercent: number;
  assetClassBreakdown: AssetClassBreakdownItem[];
}

export interface LiabilityTypeBreakdownItem {
  type: Liability['type'];
  label: string;
  amountMinor: number;
  count: number;
}

export interface LiabilityAnalytics {
  totalPrincipalMinor: number;
  totalRemainingMinor: number;
  totalPaidMinor: number;
  payoffProgressPercent: number;
  typeBreakdown: LiabilityTypeBreakdownItem[];
}

export interface HistoricalNetWorthPoint {
  date: string;
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
}

export function calculateNetWorth(
  cashBankBalancesMinor: number[],
  investments: Investment[],
  liabilities: Liability[],
  peerDebts?: PeerDebt[]
): WealthSummary {
  const cashBankAssetsMinor = cashBankBalancesMinor.reduce((acc, val) => acc + val, 0);
  const investmentsMinor = investments.reduce((acc, inv) => acc + inv.currentValueMinor, 0);

  let peerReceivablesMinor = 0;
  let peerPayablesMinor = 0;
  if (peerDebts && peerDebts.length > 0) {
    for (const debt of peerDebts) {
      if (debt.status === 'active') {
        if (debt.type === 'lent') {
          peerReceivablesMinor += debt.remainingAmountMinor;
        } else if (debt.type === 'borrowed') {
          peerPayablesMinor += debt.remainingAmountMinor;
        }
      }
    }
  }

  const totalAssetsMinor = cashBankAssetsMinor + investmentsMinor + peerReceivablesMinor;

  const totalLiabilitiesMinor =
    liabilities.reduce(
      (acc, liab) => acc + liab.remainingAmountMinor,
      0
    ) + peerPayablesMinor;

  const netWorthMinor = totalAssetsMinor - totalLiabilitiesMinor;

  // Group investments by category
  const allocationMap = new Map<string, number>();
  if (cashBankAssetsMinor > 0) {
    allocationMap.set('Cash & Bank', cashBankAssetsMinor);
  }

  if (peerReceivablesMinor > 0) {
    allocationMap.set('Peer Receivables', peerReceivablesMinor);
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

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'Equity',
  debt: 'Debt',
  gold: 'Gold',
  retirement: 'Retirement',
  other: 'Other',
};

const TYPE_TO_ASSET_CLASS: Record<Investment['type'], AssetClass> = {
  stock: 'equity',
  mutual_fund: 'equity',
  etf: 'equity',
  fd: 'debt',
  rd: 'debt',
  bond: 'debt',
  gold: 'gold',
  ppf: 'retirement',
  epf: 'retirement',
  nps: 'retirement',
  esop: 'other',
  other: 'other',
};

export function calculateInvestmentAnalytics(investments: Investment[]): InvestmentAnalytics {
  const investedAmountMinor = investments.reduce((acc, inv) => acc + inv.investedAmountMinor, 0);
  const currentValueMinor = investments.reduce((acc, inv) => acc + inv.currentValueMinor, 0);
  const totalGainMinor = currentValueMinor - investedAmountMinor;
  const absoluteReturnPercent =
    investedAmountMinor > 0
      ? Math.round((totalGainMinor / investedAmountMinor) * 100)
      : 0;

  const classAmounts = new Map<AssetClass, number>();
  for (const inv of investments) {
    const assetClass = TYPE_TO_ASSET_CLASS[inv.type] ?? 'other';
    classAmounts.set(assetClass, (classAmounts.get(assetClass) ?? 0) + inv.currentValueMinor);
  }

  const assetClasses: AssetClass[] = ['equity', 'debt', 'gold', 'retirement', 'other'];
  const assetClassBreakdown = assetClasses
    .filter((ac) => classAmounts.has(ac))
    .map((assetClass) => {
      const amountMinor = classAmounts.get(assetClass) ?? 0;
      const percentage =
        currentValueMinor > 0
          ? Math.round((amountMinor / currentValueMinor) * 100)
          : 0;
      return {
        assetClass,
        label: ASSET_CLASS_LABELS[assetClass],
        amountMinor,
        percentage,
      };
    });

  return {
    investedAmountMinor,
    currentValueMinor,
    totalGainMinor,
    absoluteReturnPercent,
    assetClassBreakdown,
  };
}

const LIABILITY_TYPE_LABELS: Record<Liability['type'], string> = {
  credit_card: 'Credit Card',
  loan: 'Loan',
  emi: 'EMI',
  bnpl: 'BNPL',
  other: 'Other',
};

export function calculateLiabilityAnalytics(liabilities: Liability[]): LiabilityAnalytics {
  const totalPrincipalMinor = liabilities.reduce((acc, l) => acc + l.principalAmountMinor, 0);
  const totalRemainingMinor = liabilities.reduce((acc, l) => acc + l.remainingAmountMinor, 0);
  const totalPaidMinor = Math.max(0, totalPrincipalMinor - totalRemainingMinor);
  const payoffProgressPercent =
    totalPrincipalMinor > 0
      ? Math.min(100, Math.max(0, Math.round((totalPaidMinor / totalPrincipalMinor) * 100)))
      : 0;

  const typeMap = new Map<Liability['type'], { amountMinor: number; count: number }>();
  for (const liab of liabilities) {
    const entry = typeMap.get(liab.type) ?? { amountMinor: 0, count: 0 };
    entry.amountMinor += liab.remainingAmountMinor;
    entry.count += 1;
    typeMap.set(liab.type, entry);
  }

  const liabilityTypes: Liability['type'][] = ['credit_card', 'loan', 'emi', 'bnpl', 'other'];
  const typeBreakdown = liabilityTypes
    .filter((t) => typeMap.has(t))
    .map((type) => {
      const data = typeMap.get(type)!;
      return {
        type,
        label: LIABILITY_TYPE_LABELS[type] ?? type,
        amountMinor: data.amountMinor,
        count: data.count,
      };
    });

  return {
    totalPrincipalMinor,
    totalRemainingMinor,
    totalPaidMinor,
    payoffProgressPercent,
    typeBreakdown,
  };
}

export function calculateHistoricalNetWorth(
  transactions: Transaction[],
  investments: Investment[],
  liabilities: Liability[],
  monthsCount = 6,
  referenceDate = new Date(),
  initialCashBalanceMinor = 0
): HistoricalNetWorthPoint[] {
  if (monthsCount <= 0) {
    return [];
  }

  const periods: string[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    periods.push(ym);
  }

  const points: HistoricalNetWorthPoint[] = [];

  for (const ym of periods) {
    // 1. Calculate cumulative cash from transactions up to end of month `ym`
    // Architectural rule: Transfers between owned accounts are never income or expense
    let cumulativeCashMinor = initialCashBalanceMinor;
    for (const tx of transactions) {
      if (tx.type === 'transfer') {
        continue;
      }
      const txYm = tx.date.slice(0, 7);
      if (txYm <= ym) {
        if (tx.type === 'income') {
          cumulativeCashMinor += tx.amountMinor;
        } else if (tx.type === 'expense') {
          cumulativeCashMinor -= tx.amountMinor;
        }
      }
    }

    // 2. Calculate investments value up to month `ym`
    let investmentsMinor = 0;
    for (const inv of investments) {
      const invYm = inv.createdAt ? inv.createdAt.slice(0, 7) : null;
      if (!invYm || invYm <= ym) {
        investmentsMinor += inv.currentValueMinor;
      }
    }

    // 3. Calculate liabilities value up to month `ym`
    let liabilitiesMinor = 0;
    for (const liab of liabilities) {
      const liabYm = liab.createdAt ? liab.createdAt.slice(0, 7) : null;
      if (!liabYm || liabYm <= ym) {
        liabilitiesMinor += liab.remainingAmountMinor;
      }
    }

    const assetsMinor = cumulativeCashMinor + investmentsMinor;
    const netWorthMinor = assetsMinor - liabilitiesMinor;

    points.push({
      date: ym,
      netWorthMinor,
      assetsMinor,
      liabilitiesMinor,
    });
  }

  return points;
}
