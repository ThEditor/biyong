import type { RecurringCadence, SubscriptionItem, Transaction } from '@biyong/schemas';

export interface SubscriptionBurnRate {
  monthlyBurnRateMinor: number;
  yearlyBurnRateMinor: number;
  activeCount: number;
  categoryBreakdown: { category: string; monthlyMinor: number }[];
}

/**
 * Normalizes a subscription's amount to its monthly equivalent in integer minor units.
 * Rule: 'weekly' * 4.333, 'monthly' * 1, 'quarterly' / 3, 'yearly' / 12.
 */
export function normalizeCadenceToMonthlyMinor(
  amountMinor: number,
  cadence: RecurringCadence
): number {
  switch (cadence) {
    case 'weekly':
      return Math.round(amountMinor * 4.333);
    case 'monthly':
      return amountMinor;
    case 'quarterly':
      return Math.round(amountMinor / 3);
    case 'yearly':
      return Math.round(amountMinor / 12);
    default:
      return amountMinor;
  }
}

/**
 * Calculates current burn rate from active subscriptions.
 */
export function calculateSubscriptionBurnRate(
  subscriptions: SubscriptionItem[]
): SubscriptionBurnRate {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const categoryMap = new Map<string, number>();
  let monthlyBurnRateMinor = 0;

  for (const sub of activeSubs) {
    const monthlyMinor = normalizeCadenceToMonthlyMinor(sub.amountMinor, sub.cadence);
    monthlyBurnRateMinor += monthlyMinor;

    const cat = sub.category || 'Subscriptions';
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + monthlyMinor);
  }

  const yearlyBurnRateMinor = monthlyBurnRateMinor * 12;
  const categoryBreakdown = Array.from(categoryMap.entries()).map(
    ([category, monthlyMinor]) => ({
      category,
      monthlyMinor,
    })
  );

  return {
    monthlyBurnRateMinor,
    yearlyBurnRateMinor,
    activeCount: activeSubs.length,
    categoryBreakdown,
  };
}

/**
 * Heuristic subscription pattern detection from transaction history.
 * Detects recurring charges with near-identical amounts (within 5%)
 * spaced ~25-35 days apart (monthly) or ~7 days apart (weekly).
 */
export function detectSubscriptionsFromTransactions(
  transactions: Transaction[]
): Omit<SubscriptionItem, 'id' | 'createdAt' | 'updatedAt'>[] {
  const expenseTxs = transactions.filter((tx) => tx.type === 'expense');

  // Group by merchant or notes or categoryId
  const groups = new Map<string, Transaction[]>();

  for (const tx of expenseTxs) {
    const key = (
      tx.merchant?.trim().toLowerCase() ||
      tx.notes?.trim().toLowerCase() ||
      tx.categoryId ||
      ''
    ).trim();

    if (!key) {
      continue;
    }

    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const detected: Omit<SubscriptionItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (const [, txs] of groups.entries()) {
    if (txs.length < 2) {
      continue;
    }

    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Look for recurring interval patterns across consecutive transactions
    for (let i = 0; i < sorted.length - 1; i++) {
      const txA = sorted[i];
      const txB = sorted[i + 1];
      if (!txA || !txB) {
        continue;
      }

      const maxAmount = Math.max(txA.amountMinor, txB.amountMinor);
      if (maxAmount === 0) continue;

      const diffAmount = Math.abs(txA.amountMinor - txB.amountMinor);
      const isSimilarAmount = diffAmount / maxAmount <= 0.05;

      if (!isSimilarAmount) {
        continue;
      }

      const timeA = new Date(txA.date).getTime();
      const timeB = new Date(txB.date).getTime();
      const diffDays = Math.round(Math.abs(timeB - timeA) / (1000 * 60 * 60 * 24));

      let cadence: RecurringCadence | null = null;
      let intervalDays = 30;

      if (diffDays >= 6 && diffDays <= 8) {
        cadence = 'weekly';
        intervalDays = 7;
      } else if (diffDays >= 25 && diffDays <= 35) {
        cadence = 'monthly';
        intervalDays = 30;
      }

      if (cadence) {
        const latestTx = sorted[sorted.length - 1];
        if (!latestTx) {
          continue;
        }
        const nextDate = new Date(new Date(latestTx.date).getTime() + intervalDays * 24 * 60 * 60 * 1000);
        const nextBillingDate = nextDate.toISOString().slice(0, 10);

        const name =
          latestTx.merchant?.trim() ||
          latestTx.notes?.trim() ||
          'Subscription';

        detected.push({
          name,
          category: 'Subscriptions',
          amountMinor: latestTx.amountMinor,
          cadence,
          nextBillingDate,
          isAutoDetected: true,
          status: 'active',
        });

        // Only detect once per group
        break;
      }
    }
  }

  return detected;
}
