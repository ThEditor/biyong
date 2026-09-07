import { distributeEqually } from './money.js';

export interface Payer {
  memberId: string;
  amountMinor: number;
}

export interface SplitRequest {
  totalAmountMinor: number;
  method: 'equal' | 'exact' | 'percentage' | 'shares' | 'itemized';
  allocations: {
    memberId: string;
    amountMinor?: number;
    percentage?: number;
    shares?: number;
    items?: { description: string; amountMinor: number }[];
  }[];
}

export interface CalculatedSplit {
  memberId: string;
  owedMinor: number;
}

/**
 * Calculates deterministic member allocations based on split method.
 * Guarantees sum(owedMinor) === totalAmountMinor.
 */
export function calculateSplit(request: SplitRequest): CalculatedSplit[] {
  const { totalAmountMinor, method, allocations } = request;

  if (allocations.length === 0) {
    throw new Error('At least one member is required to split');
  }

  if (totalAmountMinor <= 0) {
    throw new Error('Total amount must be positive');
  }

  switch (method) {
    case 'equal': {
      const parts = distributeEqually(totalAmountMinor, allocations.length);
      return allocations.map((alloc, idx) => ({
        memberId: alloc.memberId,
        owedMinor: parts[idx]!,
      }));
    }

    case 'exact': {
      let sum = 0;
      const result = allocations.map((alloc) => {
        const owed = alloc.amountMinor ?? 0;
        if (owed < 0) {
          throw new Error(`Exact split amount cannot be negative, got ${owed}`);
        }
        sum += owed;
        return { memberId: alloc.memberId, owedMinor: owed };
      });
      if (sum !== totalAmountMinor) {
        throw new Error(
          `Exact split mismatch: sum of amounts (${sum}) must equal total (${totalAmountMinor})`
        );
      }
      return result;
    }

    case 'percentage': {
      let percentSum = 0;
      allocations.forEach((a) => {
        const p = a.percentage ?? 0;
        if (p < 0) {
          throw new Error(`Split percentage cannot be negative, got ${p}%`);
        }
        percentSum += p;
      });
      if (Math.round(percentSum) !== 100) {
        throw new Error(`Percentages must sum to 100%, got ${percentSum}%`);
      }

      let distributedMinor = 0;
      const result: CalculatedSplit[] = [];

      allocations.forEach((alloc, idx) => {
        if (idx === allocations.length - 1) {
          // Last participant absorbs any rounding difference to ensure exact match
          result.push({
            memberId: alloc.memberId,
            owedMinor: totalAmountMinor - distributedMinor,
          });
        } else {
          const owed = Math.round((totalAmountMinor * (alloc.percentage ?? 0)) / 100);
          distributedMinor += owed;
          result.push({
            memberId: alloc.memberId,
            owedMinor: owed,
          });
        }
      });
      return result;
    }

    case 'shares': {
      let totalShares = 0;
      allocations.forEach((a) => {
        const sh = a.shares ?? 1;
        if (sh < 0) {
          throw new Error(`Split shares cannot be negative, got ${sh}`);
        }
        totalShares += sh;
      });
      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than 0');
      }

      let distributedMinor = 0;
      const result: CalculatedSplit[] = [];

      allocations.forEach((alloc, idx) => {
        if (idx === allocations.length - 1) {
          result.push({
            memberId: alloc.memberId,
            owedMinor: totalAmountMinor - distributedMinor,
          });
        } else {
          const shares = alloc.shares ?? 1;
          const owed = Math.floor((totalAmountMinor * shares) / totalShares);
          distributedMinor += owed;
          result.push({
            memberId: alloc.memberId,
            owedMinor: owed,
          });
        }
      });
      return result;
    }

    case 'itemized': {
      let totalItemized = 0;
      const result = allocations.map((alloc) => {
        const itemSum = (alloc.items ?? []).reduce((acc, it) => {
          if (it.amountMinor < 0) {
            throw new Error(`Itemized amount cannot be negative, got ${it.amountMinor}`);
          }
          return acc + it.amountMinor;
        }, 0);
        totalItemized += itemSum;
        return {
          memberId: alloc.memberId,
          owedMinor: itemSum,
        };
      });

      if (totalItemized !== totalAmountMinor) {
        throw new Error(
          `Itemized split mismatch: sum of items (${totalItemized}) must equal total (${totalAmountMinor})`
        );
      }
      return result;
    }

    default:
      throw new Error(`Unsupported split method: ${method}`);
  }
}

/**
 * Validates that multiple payers sum to the exact total amount.
 */
export function validatePayers(totalAmountMinor: number, payers: Payer[]): void {
  if (payers.length === 0) {
    throw new Error('At least one payer is required');
  }
  for (const p of payers) {
    if (p.amountMinor <= 0) {
      throw new Error(`Payer amount must be strictly positive, got ${p.amountMinor}`);
    }
  }
  const sumPaid = payers.reduce((acc, p) => acc + p.amountMinor, 0);
  if (sumPaid !== totalAmountMinor) {
    throw new Error(
      `Payers mismatch: sum of payments (${sumPaid}) must equal total amount (${totalAmountMinor})`
    );
  }
}
