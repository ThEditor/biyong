import type { Money } from '@biyong/schemas';

/**
 * Pure functions for monetary calculations in integer minor units.
 * Rule: NEVER use floating point numbers for currency arithmetic.
 */

export function createMoney(amountMinor: number, currency = 'INR'): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Amount must be an integer minor unit, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: cannot add ${a.currency} and ${b.currency}`);
  }
  return {
    amountMinor: a.amountMinor + b.amountMinor,
    currency: a.currency,
  };
}

export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: cannot subtract ${b.currency} from ${a.currency}`);
  }
  return {
    amountMinor: a.amountMinor - b.amountMinor,
    currency: a.currency,
  };
}

/**
 * Distribute an integer amount among N participants equally.
 * Remainder paise/cents are distributed to the first 'remainder' participants,
 * guaranteeing sum(allocations) === total.
 */
export function distributeEqually(totalMinor: number, count: number): number[] {
  if (count <= 0) {
    throw new Error('Participant count must be positive');
  }
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor % count;
  const result: number[] = [];

  for (let i = 0; i < count; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
}

/**
 * Format minor units into human readable currency string.
 * Example: 12345 INR -> "₹123.45"
 */
export function formatMoney(amountMinor: number, currency = 'INR'): string {
  const isNegative = amountMinor < 0;
  const absMinor = Math.abs(amountMinor);
  const major = Math.floor(absMinor / 100);
  const minor = absMinor % 100;
  const formattedMinor = minor.toString().padStart(2, '0');

  const symbolMap: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const symbol = symbolMap[currency] ?? `${currency} `;
  const sign = isNegative ? '-' : '';

  return `${sign}${symbol}${major.toLocaleString('en-IN')}.${formattedMinor}`;
}
