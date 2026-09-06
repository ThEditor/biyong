import type { Transaction } from '@biyong/schemas';

export interface TransactionFilter {
  accountId?: string;
  categoryId?: string;
  type?: 'expense' | 'income' | 'transfer';
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

/**
 * Filter transactions based on account, category, type, date range, and free-text search.
 * Search query is matched case-insensitively against merchant, notes, and subcategory.
 */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  return transactions.filter((tx) => {
    // Filter by accountId (matches primary account or transfer destination)
    if (filter.accountId !== undefined) {
      const matchesAccount =
        tx.accountId === filter.accountId ||
        (tx.type === 'transfer' && tx.toAccountId === filter.accountId);
      if (!matchesAccount) {
        return false;
      }
    }

    // Filter by categoryId
    if (filter.categoryId !== undefined) {
      if (tx.categoryId !== filter.categoryId) {
        return false;
      }
    }

    // Filter by transaction type
    if (filter.type !== undefined) {
      if (tx.type !== filter.type) {
        return false;
      }
    }

    // Filter by startDate
    if (filter.startDate !== undefined) {
      if (filter.startDate.includes('T')) {
        if (new Date(tx.date).getTime() < new Date(filter.startDate).getTime()) {
          return false;
        }
      } else {
        const txDatePart = tx.date.length >= 10 ? tx.date.slice(0, 10) : tx.date;
        const startPart = filter.startDate.slice(0, 10);
        if (txDatePart < startPart) {
          return false;
        }
      }
    }

    // Filter by endDate
    if (filter.endDate !== undefined) {
      if (filter.endDate.includes('T')) {
        if (new Date(tx.date).getTime() > new Date(filter.endDate).getTime()) {
          return false;
        }
      } else {
        const txDatePart = tx.date.length >= 10 ? tx.date.slice(0, 10) : tx.date;
        const endPart = filter.endDate.slice(0, 10);
        if (txDatePart > endPart) {
          return false;
        }
      }
    }

    // Filter by searchQuery (searches merchant, notes, subcategory case-insensitively)
    if (filter.searchQuery !== undefined && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.trim().toLowerCase();
      const merchantMatch = tx.merchant ? tx.merchant.toLowerCase().includes(q) : false;
      const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(q) : false;
      const subcategoryMatch = tx.subcategory ? tx.subcategory.toLowerCase().includes(q) : false;

      if (!merchantMatch && !notesMatch && !subcategoryMatch) {
        return false;
      }
    }

    return true;
  });
}
