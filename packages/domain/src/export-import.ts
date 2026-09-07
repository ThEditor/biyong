import {
  type Account,
  type Category,
  type Transaction,
  type LedgerExportData,
  LedgerExportDataSchema,
} from '@biyong/schemas';

/**
 * Format integer minor units into decimal string (e.g. 12345 -> "123.45") without float imprecision.
 */
function formatMinorToDecimal(amountMinor: number): string {
  const isNegative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${isNegative ? '-' : ''}${major}.${minor.toString().padStart(2, '0')}`;
}

/**
 * Escapes a field according to RFC 4180 rules, and protects against CSV formula injection (CWE-1236).
 */
function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val);
  // Neutralize CSV formula injection: fields starting with =, +, -, @, \t, or \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports complete ledger data to formatted JSON string.
 */
export function exportLedgerToJson(data: LedgerExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Exports transactions to valid RFC 4180 CSV format.
 * Headers: id,date,account,type,amount,currency,category,subcategory,merchant,notes,isRecurring,isReimbursable
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
): string {
  const accountMap = new Map<string, string>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc.name);
  }

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name);
  }

  const headers = [
    'id',
    'date',
    'account',
    'type',
    'amount',
    'currency',
    'category',
    'subcategory',
    'merchant',
    'notes',
    'isRecurring',
    'isReimbursable',
  ];

  const rows: string[] = [headers.join(',')];

  for (const tx of transactions) {
    const accountName = accountMap.get(tx.accountId) || tx.accountId;
    const categoryName = tx.categoryId ? categoryMap.get(tx.categoryId) || '' : '';

    const row = [
      escapeCsvField(tx.id),
      escapeCsvField(tx.date),
      escapeCsvField(accountName),
      escapeCsvField(tx.type),
      escapeCsvField(formatMinorToDecimal(tx.amountMinor)),
      escapeCsvField(tx.currency),
      escapeCsvField(categoryName),
      escapeCsvField(tx.subcategory ?? ''),
      escapeCsvField(tx.merchant ?? ''),
      escapeCsvField(tx.notes ?? ''),
      escapeCsvField(tx.isRecurring ? 'true' : 'false'),
      escapeCsvField(tx.isReimbursable ? 'true' : 'false'),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Exports accounts and current derived balances to RFC 4180 CSV format.
 * Headers: id,name,type,currency,balance
 */
export function exportAccountsToCsv(
  accounts: Account[],
  balances: Map<string, number>
): string {
  const headers = ['id', 'name', 'type', 'currency', 'balance'];
  const rows: string[] = [headers.join(',')];

  for (const acc of accounts) {
    const balanceMinor = balances.get(acc.id) ?? acc.initialBalanceMinor;
    const row = [
      escapeCsvField(acc.id),
      escapeCsvField(acc.name),
      escapeCsvField(acc.type),
      escapeCsvField(acc.currency),
      escapeCsvField(formatMinorToDecimal(balanceMinor)),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Validates JSON ledger import against the LedgerExportDataSchema.
 */
export function validateLedgerImport(
  jsonString: string
): { valid: boolean; data?: LedgerExportData; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    const result = LedgerExportDataSchema.safeParse(parsed);
    if (result.success) {
      return { valid: true, data: result.data };
    }
    return { valid: false, error: result.error.message };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid JSON format',
    };
  }
}

/**
 * Helper to deterministically merge two arrays of entities by ID,
 * keeping the newer record based on updatedAt / createdAt.
 */
function mergeEntities<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  existingList: T[] = [],
  incomingList: T[] = []
): T[] {
  const map = new Map<string, T>();

  for (const item of existingList) {
    map.set(item.id, item);
  }

  for (const item of incomingList) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const incomingTime = item.updatedAt ?? item.createdAt ?? '';
      const existingTime = existing.updatedAt ?? existing.createdAt ?? '';
      if (incomingTime >= existingTime) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Reconciles incoming ledger export with existing ledger data.
 * Merges entities deterministically, avoiding duplicates and keeping the latest timestamp.
 */
export function reconcileLedgerImport(
  existing: LedgerExportData,
  incoming: LedgerExportData
): LedgerExportData {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    accounts: mergeEntities(existing.accounts, incoming.accounts),
    categories: mergeEntities(existing.categories, incoming.categories),
    transactions: mergeEntities(existing.transactions, incoming.transactions),
    budgets: mergeEntities(existing.budgets, incoming.budgets),
    goals: mergeEntities(existing.goals, incoming.goals),
    investments: mergeEntities(existing.investments, incoming.investments),
    liabilities: mergeEntities(existing.liabilities, incoming.liabilities),
    peerDebts: mergeEntities(existing.peerDebts ?? [], incoming.peerDebts ?? []),
    peerRepayments: mergeEntities(existing.peerRepayments ?? [], incoming.peerRepayments ?? []),
    reimbursements: mergeEntities(existing.reimbursements ?? [], incoming.reimbursements ?? []),
    subscriptions: mergeEntities(existing.subscriptions ?? [], incoming.subscriptions ?? []),
  };
}
