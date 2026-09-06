import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { Account, Category, Transaction } from '@biyong/schemas';
import type { AccountWithDerivedBalance } from '@biyong/application';
import { initDatabase, type LedgerDatabaseServices } from '../db/sqlite-driver';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface DatabaseStats {
  accountsCount: number;
  transactionsCount: number;
  categoriesCount: number;
  dbEngine: string;
}

export interface LedgerContextValue {
  isReady: boolean;
  services: LedgerDatabaseServices | null;
  accounts: AccountWithDerivedBalance[];
  transactions: Transaction[];
  categories: Category[];
  netWorthMinor: number;
  stats: DatabaseStats;
  refreshLedger: () => Promise<void>;
  createTransaction: (
    txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  createAccount: (data: {
    name: string;
    type: Account['type'];
    initialBalanceMinor: number;
    currency?: string;
  }) => Promise<void>;
  archiveAccount: (id: string) => Promise<void>;
  seedDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // Onboarding
  hasCompletedOnboarding: boolean;
  completeOnboarding: (firstAccount?: {
    name: string;
    type: Account['type'];
    initialBalanceMinor: number;
  }) => Promise<void>;
  resetOnboarding: () => Promise<void>;

  // QuickAddModal orchestration
  isAddModalOpen: boolean;
  modalInitialType: 'expense' | 'income' | 'transfer';
  editingTransaction: Transaction | null;
  openAddModal: (type?: 'expense' | 'income' | 'transfer') => void;
  openEditModal: (tx: Transaction) => void;
  closeAddModal: () => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [services, setServices] = useState<LedgerDatabaseServices | null>(null);
  const [accounts, setAccounts] = useState<AccountWithDerivedBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [netWorthMinor, setNetWorthMinor] = useState<number>(0);
  const [stats, setStats] = useState<DatabaseStats>({
    accountsCount: 0,
    transactionsCount: 0,
    categoriesCount: 0,
    dbEngine: 'expo-sqlite v15.1 (offline-first)',
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const refreshLedger = useCallback(async () => {
    if (!services) return;
    try {
      const [accsWithBalances, txList, catList] = await Promise.all([
        services.accountUseCases.listAccountsWithDerivedBalances(true),
        services.txRepo.findAll(),
        services.categoryUseCases.listCategories(),
      ]);

      setAccounts(accsWithBalances);
      setTransactions(txList);
      setCategories(catList);

      const net = accsWithBalances
        .filter((a) => !a.isArchived)
        .reduce((sum, a) => sum + a.derivedBalanceMinor, 0);
      setNetWorthMinor(net);

      setStats({
        accountsCount: accsWithBalances.length,
        transactionsCount: txList.length,
        categoriesCount: catList.length,
        dbEngine: 'expo-sqlite v15.1 (offline-first)',
      });
    } catch (err) {
      console.error('Failed to refresh ledger data:', err);
    }
  }, [services]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const s = await initDatabase();
        setServices(s);

        const [accsWithBalances, txList, catList] = await Promise.all([
          s.accountUseCases.listAccountsWithDerivedBalances(true),
          s.txRepo.findAll(),
          s.categoryUseCases.listCategories(),
        ]);

        setAccounts(accsWithBalances);
        setTransactions(txList);
        setCategories(catList);

        const net = accsWithBalances
          .filter((a) => !a.isArchived)
          .reduce((sum, a) => sum + a.derivedBalanceMinor, 0);
        setNetWorthMinor(net);

        setStats({
          accountsCount: accsWithBalances.length,
          transactionsCount: txList.length,
          categoriesCount: catList.length,
          dbEngine: 'expo-sqlite v15.1 (offline-first)',
        });

        // Check if onboarding is completed
        await s.driver.exec('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        const pref = await s.driver.queryOne<{ value: string }>('SELECT value FROM app_preferences WHERE key = ?', ['onboarding_completed']);
        setHasCompletedOnboarding(pref?.value === 'true');

        setIsReady(true);
      } catch (err) {
        console.error('Failed to bootstrap ledger:', err);
        setIsReady(true);
      }
    }
    bootstrap();
  }, []);

  const createTransaction = useCallback(
    async (txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newTx: Transaction = {
        ...txData,
        id: generateId('tx'),
        createdAt: now,
        updatedAt: now,
      };

      await services.txUseCases.createTransaction(newTx);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const updateTransaction = useCallback(
    async (tx: Transaction) => {
      if (!services) throw new Error('Database not ready');
      const updated: Transaction = {
        ...tx,
        updatedAt: new Date().toISOString(),
      };
      await services.txUseCases.updateTransaction(updated);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.txUseCases.deleteTransaction(id);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const createAccount = useCallback(
    async (data: {
      name: string;
      type: Account['type'];
      initialBalanceMinor: number;
      currency?: string;
    }) => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newAcc: Account = {
        id: generateId('acc'),
        name: data.name.trim(),
        type: data.type,
        initialBalanceMinor: data.initialBalanceMinor,
        currency: data.currency ?? 'INR',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };
      await services.accountUseCases.createAccount(newAcc);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const archiveAccount = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.accountUseCases.archiveAccount(id);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const seedDemoData = useCallback(async () => {
    if (!services) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    // Ensure we have accounts
    const accs = await services.accountRepo.findAll();
    const bankAcc = accs.find((a) => a.type === 'bank') ?? accs[0];
    const cashAcc = accs.find((a) => a.type === 'cash') ?? accs[1] ?? accs[0];

    if (!bankAcc) return;

    const sampleTxs: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        accountId: bankAcc.id,
        type: 'income',
        amountMinor: 8500000, // ₹85,000
        currency: 'INR',
        date: `${year}-${month}-01`,
        categoryId: 'cat-salary',
        subcategory: 'Direct Deposit',
        merchant: 'Tech Corp Payroll',
        notes: 'Monthly engineering salary',
        toAccountId: null,
        isRecurring: true,
        recurringFrequency: 'monthly',
      },
      {
        accountId: bankAcc.id,
        type: 'expense',
        amountMinor: 2200000, // ₹22,000
        currency: 'INR',
        date: `${year}-${month}-02`,
        categoryId: 'cat-housing',
        subcategory: 'Apartment Rent',
        merchant: 'Sobha Developers',
        notes: 'Monthly rent for September',
        toAccountId: null,
        isRecurring: true,
        recurringFrequency: 'monthly',
      },
      {
        accountId: bankAcc.id,
        type: 'expense',
        amountMinor: 485000, // ₹4,850
        currency: 'INR',
        date: `${year}-${month}-03`,
        categoryId: 'cat-groceries',
        subcategory: 'Organic Stores',
        merchant: 'Nature Basket',
        notes: 'Monthly staples and organic vegetables',
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
      },
      {
        accountId: bankAcc.id,
        type: 'transfer',
        amountMinor: 500000, // ₹5,000
        currency: 'INR',
        date: `${year}-${month}-04`,
        categoryId: null,
        subcategory: null,
        merchant: 'ATM Withdrawal',
        notes: 'Cash for petty expenses',
        toAccountId: cashAcc.id,
        isRecurring: false,
        recurringFrequency: null,
      },
      {
        accountId: cashAcc.id,
        type: 'expense',
        amountMinor: 75000, // ₹750
        currency: 'INR',
        date: `${year}-${month}-05`,
        categoryId: 'cat-food',
        subcategory: 'Cafe',
        merchant: 'Third Wave Coffee',
        notes: 'Cold brew and croissant with colleague',
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
      },
      {
        accountId: bankAcc.id,
        type: 'expense',
        amountMinor: 125000, // ₹1,250
        currency: 'INR',
        date: today,
        categoryId: 'cat-transport',
        subcategory: 'Ride Hailing',
        merchant: 'Uber India',
        notes: 'Commute to city office',
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
      },
    ];

    for (const txData of sampleTxs) {
      const ts = new Date().toISOString();
      await services.txUseCases.createTransaction({
        ...txData,
        id: generateId('tx_demo'),
        createdAt: ts,
        updatedAt: ts,
      });
    }

    await refreshLedger();
  }, [services, refreshLedger]);

  const clearAllData = useCallback(async () => {
    if (!services) return;
    await services.driver.exec('DELETE FROM transactions');
    await services.driver.exec('DELETE FROM accounts');
    await refreshLedger();
  }, [services, refreshLedger]);

  const completeOnboarding = useCallback(
    async (firstAccount?: {
      name: string;
      type: Account['type'];
      initialBalanceMinor: number;
    }) => {
      if (!services) return;
      if (firstAccount && firstAccount.name.trim().length > 0) {
        const now = new Date().toISOString();
        await services.accountUseCases.createAccount({
          id: generateId('acc'),
          name: firstAccount.name.trim(),
          type: firstAccount.type,
          initialBalanceMinor: firstAccount.initialBalanceMinor,
          currency: 'INR',
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      await services.driver.run(
        'INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)',
        ['onboarding_completed', 'true']
      );
      setHasCompletedOnboarding(true);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const resetOnboarding = useCallback(async () => {
    if (!services) return;
    await services.driver.run('DELETE FROM app_preferences WHERE key = ?', ['onboarding_completed']);
    setHasCompletedOnboarding(false);
  }, [services]);

  const openAddModal = useCallback((type: 'expense' | 'income' | 'transfer' = 'expense') => {
    setEditingTransaction(null);
    setModalInitialType(type);
    setIsAddModalOpen(true);
  }, []);

  const openEditModal = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    setModalInitialType(tx.type);
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      services,
      accounts,
      transactions,
      categories,
      netWorthMinor,
      stats,
      refreshLedger,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createAccount,
      archiveAccount,
      seedDemoData,
      clearAllData,
      hasCompletedOnboarding,
      completeOnboarding,
      resetOnboarding,
      isAddModalOpen,
      modalInitialType,
      editingTransaction,
      openAddModal,
      openEditModal,
      closeAddModal,
    }),
    [
      isReady,
      services,
      accounts,
      transactions,
      categories,
      netWorthMinor,
      stats,
      refreshLedger,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createAccount,
      archiveAccount,
      seedDemoData,
      clearAllData,
      hasCompletedOnboarding,
      completeOnboarding,
      resetOnboarding,
      isAddModalOpen,
      modalInitialType,
      editingTransaction,
      openAddModal,
      openEditModal,
      closeAddModal,
    ]
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};

export function useLedger(): LedgerContextValue {
  const context = useContext(LedgerContext);
  if (!context) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
}
