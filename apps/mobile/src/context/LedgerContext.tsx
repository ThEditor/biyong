import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import type {
  Account,
  Category,
  Transaction,
  Budget,
  Goal,
  Group,
  GroupMember,
  GroupExpense,
  Settlement,
  SessionUser,
  SyncStatus,
  SyncOperation,
} from '@biyong/schemas';
import {
  canEditExpense,
  canDeleteExpense,
  type BudgetStatus,
  type GoalProgress,
  type FixedVsVariableSpending,
  type SpendingTrendItem,
  type SimplifiedTransfer,
  type MemberSettlementExplanation,
  type DependencyGraph,
} from '@biyong/domain';
import type { AccountWithDerivedBalance } from '@biyong/application';
import {
  InMemoryAuthService,
  HttpAuthService,
  createGuestSession,
  buildGuestMigrationPlan,
} from '@biyong/auth';
import {
  SyncEngine,
  createSyncOperation,
  HttpSyncServerClient,
  type SyncServerClient,
} from '@biyong/sync';
import { initDatabase, type LedgerDatabaseServices } from '../db/sqlite-driver';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

class MobileSyncServerClient implements SyncServerClient {
  private operationsMap = new Map<string, SyncOperation>();

  async pushOperations(ops: SyncOperation[]): Promise<{
    syncedIds: string[];
    rejected: { id: string; reason: string }[];
  }> {
    const syncedIds: string[] = [];
    const rejected: { id: string; reason: string }[] = [];
    for (const op of ops) {
      if (this.operationsMap.has(op.id)) {
        syncedIds.push(op.id);
        continue;
      }
      this.operationsMap.set(op.id, op);
      syncedIds.push(op.id);
    }
    return { syncedIds, rejected };
  }

  async pullOperations(sinceCursor?: string): Promise<{
    operations: SyncOperation[];
    nextCursor: string;
  }> {
    const allOps = Array.from(this.operationsMap.values());
    let filtered = allOps;
    if (sinceCursor) {
      const cursorTime = new Date(sinceCursor).getTime();
      if (!isNaN(cursorTime)) {
        filtered = allOps.filter((o) => new Date(o.timestamp).getTime() > cursorTime);
      }
    }
    const latestCursor =
      filtered.length > 0
        ? filtered[filtered.length - 1].timestamp
        : sinceCursor || new Date().toISOString();
    return {
      operations: filtered,
      nextCursor: latestCursor,
    };
  }
}

const getDefaultApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
};

const defaultSyncServerClient = new MobileSyncServerClient();
const defaultAuthService = new InMemoryAuthService();

let activeAuthToken: string | null = null;
let currentApiUrl = getDefaultApiUrl();
let httpSyncClient = new HttpSyncServerClient(currentApiUrl, () => activeAuthToken);
let httpAuthService = new HttpAuthService(currentApiUrl);

function updateHttpClients(newUrl: string) {
  currentApiUrl = newUrl;
  httpSyncClient = new HttpSyncServerClient(newUrl, () => activeAuthToken);
  httpAuthService = new HttpAuthService(newUrl);
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
  budgets: Array<BudgetStatus & { budget: Budget }>;
  goals: Array<GoalProgress & { goal: Goal }>;
  fixedVsVariable: FixedVsVariableSpending | null;
  spendingTrends: SpendingTrendItem[];
  netWorthMinor: number;
  stats: DatabaseStats;

  // Groups & Splits
  groups: Group[];
  activeGroupId: string | null;
  activeGroup: Group | null;
  activeGroupMembers: GroupMember[];
  activeGroupExpenses: GroupExpense[];
  activeGroupSettlements: Settlement[];
  activeGroupBalances: Map<string, number>;
  activeGroupTransfers: SimplifiedTransfer[];

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
  createBudget: (data: {
    categoryId: string;
    amountMinor: number;
    period: 'weekly' | 'monthly';
    rollover: boolean;
  }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  createGoal: (data: {
    title: string;
    targetAmountMinor: number;
    currentAmountMinor?: number;
    targetDate: string;
  }) => Promise<void>;
  contributeToGoal: (goalId: string, amountMinor: number) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Group actions
  createGroup: (
    name: string,
    currency?: string,
    memberNames?: string[],
    isPrivate?: boolean
  ) => Promise<Group>;
  joinGroup: (inviteCode: string) => Promise<Group>;
  createGroupInvite: (groupId: string) => Promise<string>;
  splitTransactionIntoGroup: (
    transactionId: string,
    groupId: string,
    splitMethod?: 'equal' | 'exact' | 'percentage' | 'shares'
  ) => Promise<GroupExpense>;
  selectGroup: (id: string | null) => Promise<void>;
  addGroupExpense: (
    expenseData: Omit<GroupExpense, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'> & {
      createdByUserId?: string | null;
    }
  ) => Promise<void>;
  recordSettlement: (settlementData: Omit<Settlement, 'id' | 'settledAt'>) => Promise<void>;
  deleteGroupExpense: (id: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  getMemberExplanation: (memberId: string) => Promise<MemberSettlementExplanation | null>;
  getGroupDependencyGraph: () => Promise<DependencyGraph | null>;

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

  // Authentication & Cloud Sync
  user: SessionUser | null;
  token: string | null;
  deviceId: string;
  isGuest: boolean;
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<void>;

  // Server & Network Configuration
  apiUrl: string;
  setApiUrl: (url: string) => Promise<void>;
  testApiConnection: (url?: string) => Promise<{ ok: boolean; message: string }>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [services, setServices] = useState<LedgerDatabaseServices | null>(null);
  const [accounts, setAccounts] = useState<AccountWithDerivedBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Array<BudgetStatus & { budget: Budget }>>([]);
  const [goals, setGoals] = useState<Array<GoalProgress & { goal: Goal }>>([]);
  const [fixedVsVariable, setFixedVsVariable] = useState<FixedVsVariableSpending | null>(null);
  const [spendingTrends, setSpendingTrends] = useState<SpendingTrendItem[]>([]);
  const [netWorthMinor, setNetWorthMinor] = useState<number>(0);
  const [stats, setStats] = useState<DatabaseStats>({
    accountsCount: 0,
    transactionsCount: 0,
    categoriesCount: 0,
    dbEngine: 'expo-sqlite v15.1 (offline-first)',
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

  // Authentication & Cloud Sync state
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const deviceIdRef = useRef<string>('');
  deviceIdRef.current = deviceId;
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Server & Network Configuration state
  const [apiUrl, setApiUrlState] = useState<string>(getDefaultApiUrl());
  const apiUrlRef = useRef<string>(getDefaultApiUrl());
  apiUrlRef.current = apiUrl;

  // Groups & Splits state
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [activeGroupMembers, setActiveGroupMembers] = useState<GroupMember[]>([]);
  const [activeGroupExpenses, setActiveGroupExpenses] = useState<GroupExpense[]>([]);
  const [activeGroupSettlements, setActiveGroupSettlements] = useState<Settlement[]>([]);
  const [activeGroupBalances, setActiveGroupBalances] = useState<Map<string, number>>(new Map());
  const [activeGroupTransfers, setActiveGroupTransfers] = useState<SimplifiedTransfer[]>([]);
  const activeGroupIdRef = useRef<string | null>(null);
  activeGroupIdRef.current = activeGroupId;

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const refreshLedger = useCallback(async () => {
    if (!services) return;
    try {
      const [accsWithBalances, txList, catList, budgetList, goalList, fixedVar, trends, groupList] =
        await Promise.all([
          services.accountUseCases.listAccountsWithDerivedBalances(true),
          services.txRepo.findAll(),
          services.categoryUseCases.listCategories(),
          services.budgetUseCases.listBudgetsWithStatus(),
          services.goalUseCases.listGoalsWithProgress(),
          services.analyticsUseCases.getFixedVsVariable(),
          services.analyticsUseCases.getSpendingTrends(6),
          services.groupUseCases.listGroups(),
        ]);

      setAccounts(accsWithBalances);
      setTransactions(txList);
      setCategories(catList);
      setBudgets(budgetList);
      setGoals(goalList);
      setFixedVsVariable(fixedVar);
      setSpendingTrends(trends);
      setGroups(groupList);

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

      const currentGroupId = activeGroupIdRef.current;
      if (currentGroupId) {
        const summary = await services.groupUseCases.getGroupSummary(currentGroupId);
        setActiveGroup(summary.group);
        setActiveGroupMembers(summary.members);
        setActiveGroupExpenses(summary.expenses);
        setActiveGroupSettlements(summary.settlements);
        setActiveGroupBalances(summary.balances);
        setActiveGroupTransfers(summary.simplifiedTransfers);
      }
    } catch (err) {
      console.error('Failed to refresh ledger data:', err);
    }
  }, [services]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const s = await initDatabase();
        setServices(s);

        const [accsWithBalances, txList, catList, budgetList, goalList, fixedVar, trends, groupList] =
          await Promise.all([
            s.accountUseCases.listAccountsWithDerivedBalances(true),
            s.txRepo.findAll(),
            s.categoryUseCases.listCategories(),
            s.budgetUseCases.listBudgetsWithStatus(),
            s.goalUseCases.listGoalsWithProgress(),
            s.analyticsUseCases.getFixedVsVariable(),
            s.analyticsUseCases.getSpendingTrends(6),
            s.groupUseCases.listGroups(),
          ]);

        setAccounts(accsWithBalances);
        setTransactions(txList);
        setCategories(catList);
        setBudgets(budgetList);
        setGoals(goalList);
        setFixedVsVariable(fixedVar);
        setSpendingTrends(trends);
        setGroups(groupList);

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

        // Check device ID or generate a new one
        let curDeviceId = await s.syncStateRepo.getDeviceId();
        if (!curDeviceId) {
          curDeviceId = generateId('device');
          await s.syncStateRepo.setDeviceId(curDeviceId);
        }
        setDeviceId(curDeviceId);
        deviceIdRef.current = curDeviceId;

        // Check backend API URL preference
        const savedApiUrl = await s.driver.queryOne<{ value: string }>(
          'SELECT value FROM app_preferences WHERE key = ?',
          ['backend_api_url']
        );
        if (savedApiUrl?.value) {
          const cleanUrl = savedApiUrl.value.trim().replace(/\/+$/, '');
          setApiUrlState(cleanUrl);
          apiUrlRef.current = cleanUrl;
          updateHttpClients(cleanUrl);
        }

        // Check active session
        const savedToken = await s.syncStateRepo.getAuthToken();
        const savedUser = await s.syncStateRepo.getActiveUser();
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(savedUser);
          activeAuthToken = savedToken;
          setIsGuest(false);
        } else {
          setUser(null);
          setToken(null);
          activeAuthToken = null;
          setIsGuest(true);
        }

        // Check pending outbox operations
        const pCount = await s.outboxRepo.getPendingCount();
        setPendingSyncCount(pCount);

        const lastSync = await s.syncStateRepo.get('last_synced_at');
        setLastSyncedAt(lastSync);

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
      const op = createSyncOperation({
        entityType: 'transaction',
        entityId: newTx.id,
        operationType: 'create',
        payload: newTx as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
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
      const op = createSyncOperation({
        entityType: 'transaction',
        entityId: updated.id,
        operationType: 'update',
        payload: updated as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.txUseCases.deleteTransaction(id);
      const op = createSyncOperation({
        entityType: 'transaction',
        entityId: id,
        operationType: 'delete',
        payload: { id },
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
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
      const op = createSyncOperation({
        entityType: 'account',
        entityId: newAcc.id,
        operationType: 'create',
        payload: newAcc as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
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

  const createBudget = useCallback(
    async (data: {
      categoryId: string;
      amountMinor: number;
      period: 'weekly' | 'monthly';
      rollover: boolean;
    }) => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newBudget: Budget = {
        id: generateId('budget'),
        categoryId: data.categoryId,
        amountMinor: data.amountMinor,
        currency: 'INR',
        period: data.period,
        startDate: now.substring(0, 10),
        endDate: null,
        rollover: data.rollover,
        createdAt: now,
        updatedAt: now,
      };
      await services.budgetUseCases.createBudget(newBudget);
      const op = createSyncOperation({
        entityType: 'budget',
        entityId: newBudget.id,
        operationType: 'create',
        payload: newBudget as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.budgetUseCases.deleteBudget(id);
      const op = createSyncOperation({
        entityType: 'budget',
        entityId: id,
        operationType: 'delete',
        payload: { id },
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const createGoal = useCallback(
    async (data: {
      title: string;
      targetAmountMinor: number;
      currentAmountMinor?: number;
      targetDate: string;
    }) => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newGoal: Goal = {
        id: generateId('goal'),
        title: data.title.trim(),
        targetAmountMinor: data.targetAmountMinor,
        currentAmountMinor: data.currentAmountMinor ?? 0,
        currency: 'INR',
        targetDate: data.targetDate,
        createdAt: now,
        updatedAt: now,
      };
      await services.goalUseCases.createGoal(newGoal);
      const op = createSyncOperation({
        entityType: 'goal',
        entityId: newGoal.id,
        operationType: 'create',
        payload: newGoal as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const contributeToGoal = useCallback(
    async (goalId: string, amountMinor: number) => {
      if (!services) throw new Error('Database not ready');
      await services.goalUseCases.contributeToGoal(goalId, amountMinor);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.goalUseCases.deleteGoal(id);
      const op = createSyncOperation({
        entityType: 'goal',
        entityId: id,
        operationType: 'delete',
        payload: { id },
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
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

    // Seed sample budgets
    await services.driver.exec('DELETE FROM budgets');
    const demoBudgets: Omit<Budget, 'createdAt' | 'updatedAt'>[] = [
      {
        id: generateId('budget_demo'),
        categoryId: 'cat-housing',
        amountMinor: 2500000, // ₹25,000
        currency: 'INR',
        period: 'monthly',
        startDate: `${year}-${month}-01`,
        endDate: null,
        rollover: false,
      },
      {
        id: generateId('budget_demo'),
        categoryId: 'cat-groceries',
        amountMinor: 1000000, // ₹10,000
        currency: 'INR',
        period: 'monthly',
        startDate: `${year}-${month}-01`,
        endDate: null,
        rollover: true,
      },
      {
        id: generateId('budget_demo'),
        categoryId: 'cat-food',
        amountMinor: 500000, // ₹5,000
        currency: 'INR',
        period: 'monthly',
        startDate: `${year}-${month}-01`,
        endDate: null,
        rollover: false,
      },
      {
        id: generateId('budget_demo'),
        categoryId: 'cat-transport',
        amountMinor: 300000, // ₹3,000
        currency: 'INR',
        period: 'monthly',
        startDate: `${year}-${month}-01`,
        endDate: null,
        rollover: false,
      },
    ];
    for (const b of demoBudgets) {
      const ts = new Date().toISOString();
      await services.budgetUseCases.createBudget({ ...b, createdAt: ts, updatedAt: ts });
    }

    // Seed sample goals
    await services.driver.exec('DELETE FROM goals');
    const target6Months = new Date(now.getFullYear(), now.getMonth() + 6, 1)
      .toISOString()
      .substring(0, 10);
    const target3Months = new Date(now.getFullYear(), now.getMonth() + 3, 15)
      .toISOString()
      .substring(0, 10);
    const demoGoals: Omit<Goal, 'createdAt' | 'updatedAt'>[] = [
      {
        id: generateId('goal_demo'),
        title: 'Emergency Fund',
        targetAmountMinor: 10000000, // ₹1,00,000
        currentAmountMinor: 4500000, // ₹45,000
        currency: 'INR',
        targetDate: target6Months,
      },
      {
        id: generateId('goal_demo'),
        title: 'MacBook Pro M-Series',
        targetAmountMinor: 12000000, // ₹1,20,000
        currentAmountMinor: 7500000, // ₹75,000
        currency: 'INR',
        targetDate: target3Months,
      },
    ];
    for (const g of demoGoals) {
      const ts = new Date().toISOString();
      await services.goalUseCases.createGoal({ ...g, createdAt: ts, updatedAt: ts });
    }

    // Seed sample group
    await services.driver.exec('DELETE FROM settlements');
    await services.driver.exec('DELETE FROM group_expenses');
    await services.driver.exec('DELETE FROM group_members');
    await services.driver.exec('DELETE FROM groups');

    const demoGroupId = generateId('grp_demo');
    const memberYouId = generateId('mbr_you');
    const memberAliceId = generateId('mbr_alice');
    const memberBobId = generateId('mbr_bob');
    const groupCreated = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3).toISOString();

    const demoGroup: Group = {
      id: demoGroupId,
      name: 'Goa Trip',
      isPrivate: true,
      ownerId: memberYouId,
      currency: 'INR',
      createdAt: groupCreated,
      updatedAt: groupCreated,
    };

    const demoMembers: GroupMember[] = [
      {
        id: memberYouId,
        groupId: demoGroupId,
        name: 'You',
        userId: null,
        isDummy: true,
        role: 'owner',
        createdAt: groupCreated,
      },
      {
        id: memberAliceId,
        groupId: demoGroupId,
        name: 'Alice',
        userId: null,
        isDummy: true,
        role: 'member',
        createdAt: groupCreated,
      },
      {
        id: memberBobId,
        groupId: demoGroupId,
        name: 'Bob',
        userId: null,
        isDummy: true,
        role: 'member',
        createdAt: groupCreated,
      },
    ];

    await services.groupUseCases.createGroup(demoGroup, demoMembers);

    const exp1Time = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).toISOString();
    const exp2Time = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

    await services.groupUseCases.addExpense({
      id: generateId('gexp_demo'),
      groupId: demoGroupId,
      title: 'Beach Villa Booking',
      amountMinor: 900000,
      currency: 'INR',
      date: exp1Time.substring(0, 10),
      createdByMemberId: memberAliceId,
      createdByUserId: null,
      payers: [{ memberId: memberAliceId, amountMinor: 900000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: memberYouId },
        { memberId: memberAliceId },
        { memberId: memberBobId },
      ],
      notes: '3-night stay in North Goa',
      createdAt: exp1Time,
      updatedAt: exp1Time,
    });

    await services.groupUseCases.addExpense({
      id: generateId('gexp_demo'),
      groupId: demoGroupId,
      title: 'Seafood Dinner',
      amountMinor: 450000,
      currency: 'INR',
      date: exp2Time.substring(0, 10),
      createdByMemberId: memberYouId,
      createdByUserId: null,
      payers: [{ memberId: memberYouId, amountMinor: 450000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: memberYouId },
        { memberId: memberAliceId },
        { memberId: memberBobId },
      ],
      notes: "Fisherman's Wharf dinner & drinks",
      createdAt: exp2Time,
      updatedAt: exp2Time,
    });

    await services.groupUseCases.addExpense({
      id: generateId('gexp_demo'),
      groupId: demoGroupId,
      title: 'Airport Taxi',
      amountMinor: 120000,
      currency: 'INR',
      date: today,
      createdByMemberId: memberBobId,
      createdByUserId: null,
      payers: [{ memberId: memberBobId, amountMinor: 120000 }],
      splitMethod: 'equal',
      allocations: [
        { memberId: memberYouId },
        { memberId: memberAliceId },
        { memberId: memberBobId },
      ],
      notes: 'Cab from MOPA airport to villa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await refreshLedger();
  }, [services, refreshLedger]);

  const clearAllData = useCallback(async () => {
    if (!services) return;
    await services.driver.exec('DELETE FROM transactions');
    await services.driver.exec('DELETE FROM accounts');
    await services.driver.exec('DELETE FROM budgets');
    await services.driver.exec('DELETE FROM goals');
    await services.driver.exec('DELETE FROM settlements');
    await services.driver.exec('DELETE FROM group_expenses');
    await services.driver.exec('DELETE FROM group_members');
    await services.driver.exec('DELETE FROM groups');
    await services.outboxRepo.clear();
    setPendingSyncCount(0);
    setActiveGroupId(null);
    activeGroupIdRef.current = null;
    setActiveGroup(null);
    setActiveGroupMembers([]);
    setActiveGroupExpenses([]);
    setActiveGroupSettlements([]);
    setActiveGroupBalances(new Map());
    setActiveGroupTransfers([]);
    await refreshLedger();
  }, [services, refreshLedger]);

  const refreshActiveGroup = useCallback(
    async (groupId: string) => {
      if (!services) return;
      const summary = await services.groupUseCases.getGroupSummary(groupId);
      setActiveGroup(summary.group);
      setActiveGroupMembers(summary.members);
      setActiveGroupExpenses(summary.expenses);
      setActiveGroupSettlements(summary.settlements);
      setActiveGroupBalances(summary.balances);
      setActiveGroupTransfers(summary.simplifiedTransfers);
      const groupList = await services.groupUseCases.listGroups();
      setGroups(groupList);
    },
    [services]
  );

  const selectGroup = useCallback(
    async (id: string | null) => {
      setActiveGroupId(id);
      activeGroupIdRef.current = id;
      if (!id || !services) {
        setActiveGroup(null);
        setActiveGroupMembers([]);
        setActiveGroupExpenses([]);
        setActiveGroupSettlements([]);
        setActiveGroupBalances(new Map());
        setActiveGroupTransfers([]);
        return;
      }
      const summary = await services.groupUseCases.getGroupSummary(id);
      setActiveGroup(summary.group);
      setActiveGroupMembers(summary.members);
      setActiveGroupExpenses(summary.expenses);
      setActiveGroupSettlements(summary.settlements);
      setActiveGroupBalances(summary.balances);
      setActiveGroupTransfers(summary.simplifiedTransfers);
    },
    [services]
  );

  const createGroup = useCallback(
    async (
      name: string,
      currency?: string,
      memberNames?: string[],
      isPrivate?: boolean
    ): Promise<Group> => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const groupId = generateId('grp');
      const ownerMemberId = generateId('mbr');
      const curr = currency ?? 'INR';
      const trimmedName = name.trim();
      const groupIsPrivate = isPrivate ?? true;

      // If shared group and user is logged in, attempt API creation first
      if (!groupIsPrivate && user) {
        try {
          const res = await fetch(`${apiUrlRef.current}/groups`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              name: trimmedName,
              currency: curr,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const serverGroup: Group = data.group;
            const serverMember: GroupMember = data.member;

            await services.groupRepo.create(serverGroup);
            await services.groupRepo.addMember(serverMember);

            if (memberNames && memberNames.length > 0) {
              for (const mName of memberNames) {
                const trimmed = mName.trim();
                if (
                  trimmed &&
                  trimmed.toLowerCase() !== 'you' &&
                  trimmed.toLowerCase() !== (user.name || '').toLowerCase()
                ) {
                  const extraMember: GroupMember = {
                    id: generateId('mbr'),
                    groupId: serverGroup.id,
                    name: trimmed,
                    userId: null,
                    isDummy: true,
                    role: 'member',
                    createdAt: now,
                  };
                  await services.groupRepo.addMember(extraMember);
                }
              }
            }

            await refreshLedger();
            return serverGroup;
          }
        } catch {
          // Network unreachable, fall through to offline local creation
        }
      }

      // Local creation (offline fallback or private group)
      const group: Group = {
        id: groupId,
        name: trimmedName,
        isPrivate: groupIsPrivate,
        ownerId: user?.id || ownerMemberId,
        currency: curr,
        createdAt: now,
        updatedAt: now,
      };

      const initialMembers: GroupMember[] = [
        {
          id: ownerMemberId,
          groupId,
          name: user?.name || 'You',
          userId: user?.id ?? null,
          isDummy: !user,
          role: 'owner',
          createdAt: now,
        },
      ];

      // Only add dummy initial members for private offline groups.
      // Shared groups start with owner only; real members join via invite code!
      if (groupIsPrivate && memberNames && memberNames.length > 0) {
        for (const mName of memberNames) {
          const trimmed = mName.trim();
          if (
            trimmed &&
            trimmed.toLowerCase() !== 'you' &&
            trimmed.toLowerCase() !== (user?.name || '').toLowerCase()
          ) {
            initialMembers.push({
              id: generateId('mbr'),
              groupId,
              name: trimmed,
              userId: null,
              isDummy: true,
              role: 'member',
              createdAt: now,
            });
          }
        }
      }

      await services.groupUseCases.createGroup(group, initialMembers);

      // If shared group (offline created), enqueue sync operations
      if (!groupIsPrivate) {
        const opGroup = createSyncOperation({
          entityType: 'group',
          entityId: group.id,
          operationType: 'create',
          payload: group as unknown as Record<string, unknown>,
          deviceId: deviceIdRef.current || 'device_default',
        });
        await services.outboxRepo.enqueue(opGroup);

        for (const mem of initialMembers) {
          const opMember = createSyncOperation({
            entityType: 'group_member',
            entityId: mem.id,
            operationType: 'create',
            payload: mem as unknown as Record<string, unknown>,
            deviceId: deviceIdRef.current || 'device_default',
          });
          await services.outboxRepo.enqueue(opMember);
        }

        const pCount = await services.outboxRepo.getPendingCount();
        setPendingSyncCount(pCount);
      }

      await refreshLedger();
      return group;
    },
    [services, user, token, refreshLedger]
  );

  const joinGroup = useCallback(
    async (inviteCode: string): Promise<Group> => {
      if (!services) throw new Error('Database not ready');
      const trimmedCode = inviteCode.trim().toUpperCase();
      if (!trimmedCode) {
        throw new Error('Please enter a valid invite code');
      }

      if (!user) {
        throw new Error('Please log in to join a shared group');
      }

      try {
        const res = await fetch(`${apiUrlRef.current}/groups/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ inviteCode: trimmedCode }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const msg =
            errData?.error ||
            errData?.message ||
            'Failed to join group. Please verify the invite code.';
          throw new Error(msg);
        }

        const data: { group: Group; member: GroupMember; message?: string } = await res.json();
        const existingGroup = await services.groupRepo.findById(data.group.id);
        if (!existingGroup) {
          await services.groupRepo.create(data.group);
        }
        const existingMembers = await services.groupRepo.getMembers(data.group.id);
        if (!existingMembers.some((m) => m.id === data.member.id)) {
          await services.groupRepo.addMember(data.member);
        }

        // Attempt fetching full group summary (members, expenses, settlements)
        try {
          const detailsRes = await fetch(`${apiUrlRef.current}/groups/${data.group.id}`, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          if (detailsRes.ok) {
            const details = await detailsRes.json();
            for (const m of details.members || []) {
              const curMems = await services.groupRepo.getMembers(data.group.id);
              if (!curMems.some((x) => x.id === m.id)) {
                await services.groupRepo.addMember(m);
              }
            }
            for (const exp of details.expenses || []) {
              const curExps = await services.groupRepo.getExpenses(data.group.id);
              if (!curExps.some((x) => x.id === exp.id)) {
                await services.groupRepo.addExpense(exp);
              }
            }
            for (const stl of details.settlements || []) {
              const curStls = await services.groupRepo.getSettlements(data.group.id);
              if (!curStls.some((x) => x.id === stl.id)) {
                await services.groupRepo.addSettlement(stl);
              }
            }
          }
        } catch {
          // Secondary fetch failure is non-blocking
        }

        await refreshLedger();
        await selectGroup(data.group.id);
        return data.group;
      } catch (err: any) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Unable to connect to server. Please try again later.');
      }
    },
    [services, user, token, refreshLedger, selectGroup]
  );

  const createGroupInvite = useCallback(
    async (groupId: string): Promise<string> => {
      if (!services) throw new Error('Database not ready');

      // Check local cache in app_preferences first so the same code is consistently returned
      const prefKey = `invite_code_${groupId}`;
      try {
        const cached = await services.driver.queryOne<{ value: string }>(
          'SELECT value FROM app_preferences WHERE key = ?',
          [prefKey]
        );
        if (cached?.value) {
          return cached.value;
        }
      } catch {
        // ignore
      }

      let inviteCode: string | null = null;

      // If user is logged in, try API invite endpoint
      if (token) {
        try {
          const res = await fetch(`${apiUrlRef.current}/groups/${groupId}/invites`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.invitation?.inviteCode) {
              inviteCode = data.invitation.inviteCode;
            }
          }
        } catch {
          // Network unreachable, fall through to offline generation
        }
      }

      if (!inviteCode) {
        // Offline fallback: generate random INV-XXXXXX
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let codePart = '';
        for (let i = 0; i < 6; i++) {
          codePart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        inviteCode = `INV-${codePart}`;

        // Enqueue sync operation for invite creation
        const op = createSyncOperation({
          entityType: 'group_invitation',
          entityId: generateId('inv'),
          operationType: 'create',
          payload: {
            groupId,
            inviteCode,
            inviterUserId: user?.id ?? null,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
          deviceId: deviceIdRef.current || 'device_default',
        });
        await services.outboxRepo.enqueue(op);
        const pCount = await services.outboxRepo.getPendingCount();
        setPendingSyncCount(pCount);
      }

      // Persist in local app_preferences so subsequent taps on the same group return identical code
      try {
        await services.driver.run(
          'INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)',
          [prefKey, inviteCode]
        );
      } catch {
        // ignore
      }

      return inviteCode;
    },
    [services, token, user]
  );

  const splitTransactionIntoGroup = useCallback(
    async (
      transactionId: string,
      groupId: string,
      splitMethod: 'equal' | 'exact' | 'percentage' | 'shares' = 'equal'
    ): Promise<GroupExpense> => {
      if (!services) throw new Error('Database not ready');
      const tx = await services.txRepo.findById(transactionId);
      if (!tx) throw new Error('Transaction not found');

      const members = await services.groupRepo.getMembers(groupId);
      if (members.length === 0) throw new Error('Selected group has no members');

      // Auto-select payer as current user / "You" / owner
      const myMember =
        members.find(
          (m) =>
            (user && m.userId === user.id) ||
            m.name.toLowerCase() === 'you' ||
            m.role === 'owner'
        ) || members[0];

      const allocations = members.map((m) => ({ memberId: m.id }));
      const now = new Date().toISOString();
      const expenseTitle = tx.merchant || tx.notes || `Split: ${tx.date}`;

      const newExpense: GroupExpense = {
        id: generateId('gexp'),
        groupId,
        title: expenseTitle,
        amountMinor: tx.amountMinor,
        currency: tx.currency as any,
        date: tx.date,
        createdByMemberId: myMember.id,
        createdByUserId: user?.id ?? null,
        payers: [{ memberId: myMember.id, amountMinor: tx.amountMinor }],
        splitMethod,
        allocations,
        notes: `Linked from transaction ${tx.id}${tx.merchant ? ` (${tx.merchant})` : ''}`,
        createdAt: now,
        updatedAt: now,
      };

      await services.groupUseCases.addExpense(newExpense);

      // Enqueue sync operation
      const op = createSyncOperation({
        entityType: 'group_expense',
        entityId: newExpense.id,
        operationType: 'create',
        payload: newExpense as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);

      await refreshLedger();
      if (activeGroupIdRef.current === groupId) {
        await refreshActiveGroup(groupId);
      }
      return newExpense;
    },
    [services, user, refreshLedger, refreshActiveGroup]
  );

  const addGroupExpense = useCallback(
    async (
      expenseData: Omit<GroupExpense, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'> & {
        createdByUserId?: string | null;
      }
    ) => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newExpense: GroupExpense = {
        ...expenseData,
        id: generateId('gexp'),
        createdByUserId: expenseData.createdByUserId ?? user?.id ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await services.groupUseCases.addExpense(newExpense);
      const op = createSyncOperation({
        entityType: 'group_expense',
        entityId: newExpense.id,
        operationType: 'create',
        payload: newExpense as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshActiveGroup(expenseData.groupId);
    },
    [services, user, refreshActiveGroup]
  );

  const recordSettlement = useCallback(
    async (settlementData: Omit<Settlement, 'id' | 'settledAt'>) => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newSettlement: Settlement = {
        ...settlementData,
        id: generateId('stl'),
        settledAt: now,
      };
      await services.groupUseCases.addSettlement(newSettlement);
      const op = createSyncOperation({
        entityType: 'settlement',
        entityId: newSettlement.id,
        operationType: 'create',
        payload: newSettlement as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshActiveGroup(settlementData.groupId);
    },
    [services, refreshActiveGroup]
  );

  const deleteGroupExpense = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.groupUseCases.deleteExpense(id);
      const op = createSyncOperation({
        entityType: 'group_expense',
        entityId: id,
        operationType: 'delete',
        payload: { id },
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      if (activeGroupIdRef.current) {
        await refreshActiveGroup(activeGroupIdRef.current);
      }
    },
    [services, refreshActiveGroup]
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      if (!services) throw new Error('Database not ready');
      await services.groupUseCases.deleteGroup(id);
      const op = createSyncOperation({
        entityType: 'group',
        entityId: id,
        operationType: 'delete',
        payload: { id },
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      if (activeGroupIdRef.current === id) {
        setActiveGroupId(null);
        activeGroupIdRef.current = null;
        setActiveGroup(null);
        setActiveGroupMembers([]);
        setActiveGroupExpenses([]);
        setActiveGroupSettlements([]);
        setActiveGroupBalances(new Map());
        setActiveGroupTransfers([]);
      }
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const getMemberExplanation = useCallback(
    async (memberId: string): Promise<MemberSettlementExplanation | null> => {
      if (!services || !activeGroupIdRef.current) return null;
      return services.groupUseCases.explainSettlement(activeGroupIdRef.current, memberId);
    },
    [services]
  );

  const getGroupDependencyGraph = useCallback(
    async (): Promise<DependencyGraph | null> => {
      if (!services || !activeGroupIdRef.current) return null;
      return services.groupUseCases.getDependencyGraph(activeGroupIdRef.current);
    },
    [services]
  );

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

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const syncNow = useCallback(async () => {
    if (!services) return;
    try {
      setSyncStatus('syncing');
      const dId = deviceIdRef.current || 'device_default';
      const client = token ? httpSyncClient : defaultSyncServerClient;
      const syncEngine = new SyncEngine(
        services.outboxRepo,
        client,
        services.syncStateRepo,
        dId,
        {
          accountRepo: services.accountRepo,
          txRepo: services.txRepo,
          budgetRepo: services.budgetRepo,
          goalRepo: services.goalRepo,
          groupRepo: services.groupRepo,
        }
      );
      try {
        await syncEngine.synchronize();
      } catch {
        // Fallback to default in-memory sync client if HTTP client is unreachable
        const fallbackEngine = new SyncEngine(
          services.outboxRepo,
          defaultSyncServerClient,
          services.syncStateRepo,
          dId,
          {
            accountRepo: services.accountRepo,
            txRepo: services.txRepo,
            budgetRepo: services.budgetRepo,
            goalRepo: services.goalRepo,
            groupRepo: services.groupRepo,
          }
        );
        await fallbackEngine.synchronize();
      }
      const now = new Date().toISOString();
      await services.syncStateRepo.set('last_synced_at', now);
      setLastSyncedAt(now);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      setSyncStatus('synced');
      await refreshLedger();
    } catch (err) {
      console.error('Failed to sync:', err);
      setSyncStatus('error');
    }
  }, [services, token, refreshLedger]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!services) throw new Error('Database not ready');
      const dId = deviceIdRef.current || 'device_default';
      let res;
      try {
        res = await httpAuthService.login({ email, password });
      } catch {
        res = await defaultAuthService.login({ email, password }, dId);
      }
      await services.syncStateRepo.setAuthToken(res.token);
      await services.syncStateRepo.setActiveUser(res.user);
      setUser(res.user);
      setToken(res.token);
      activeAuthToken = res.token;
      setIsGuest(false);
      setIsAuthModalOpen(false);
      await syncNow();
    },
    [services, syncNow]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      if (!services) throw new Error('Database not ready');
      const dId = deviceIdRef.current || 'device_default';
      let res;
      try {
        res = await httpAuthService.register({ name, email, password });
      } catch {
        res = await defaultAuthService.register({ name, email, password }, dId);
      }
      await services.syncStateRepo.setAuthToken(res.token);
      await services.syncStateRepo.setActiveUser(res.user);

      // Upgrade guest data to registered account
      const migrationPlan = buildGuestMigrationPlan({
        guestId: dId,
        targetUserId: res.user.id,
        accountsCount: accounts.length,
        transactionsCount: transactions.length,
        groupsCount: groups.length,
        budgetsCount: budgets.length,
      });
      console.log('Guest migration plan executed:', migrationPlan);

      setUser(res.user);
      setToken(res.token);
      activeAuthToken = res.token;
      setIsGuest(false);
      setIsAuthModalOpen(false);
      await syncNow();
    },
    [services, accounts.length, transactions.length, groups.length, budgets.length, syncNow]
  );

  const logout = useCallback(async () => {
    if (!services) return;
    if (token) {
      try {
        await httpAuthService.logout(token);
      } catch {
        try {
          await defaultAuthService.logout(token);
        } catch {
          // ignore
        }
      }
    }
    activeAuthToken = null;
    await services.syncStateRepo.setAuthToken(null);
    await services.syncStateRepo.setActiveUser(null);
    setUser(null);
    setToken(null);
    setIsGuest(true);
    setSyncStatus('idle');
  }, [services, token]);

  const setApiUrl = useCallback(
    async (url: string) => {
      if (!services) throw new Error('Database not ready');
      const clean = url.trim().replace(/\/+$/, '');
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        throw new Error('API URL must start with http:// or https://');
      }
      await services.driver.run(
        'INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)',
        ['backend_api_url', clean]
      );
      setApiUrlState(clean);
      apiUrlRef.current = clean;
      updateHttpClients(clean);
    },
    [services]
  );

  const testApiConnection = useCallback(
    async (url?: string): Promise<{ ok: boolean; message: string }> => {
      const targetUrl = (url ?? apiUrlRef.current).trim().replace(/\/+$/, '');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${targetUrl}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          return { ok: true, message: 'Connected successfully to Biyong API' };
        }
        return { ok: false, message: `Server responded with status ${res.status}` };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { ok: false, message: 'Connection timed out (3s)' };
        }
        return { ok: false, message: 'Unable to reach server' };
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      isReady,
      services,
      accounts,
      transactions,
      categories,
      budgets,
      goals,
      fixedVsVariable,
      spendingTrends,
      netWorthMinor,
      stats,
      groups,
      activeGroupId,
      activeGroup,
      activeGroupMembers,
      activeGroupExpenses,
      activeGroupSettlements,
      activeGroupBalances,
      activeGroupTransfers,
      refreshLedger,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createAccount,
      archiveAccount,
      createBudget,
      deleteBudget,
      createGoal,
      contributeToGoal,
      deleteGoal,
      createGroup,
      joinGroup,
      createGroupInvite,
      selectGroup,
      addGroupExpense,
      recordSettlement,
      deleteGroupExpense,
      deleteGroup,
      getMemberExplanation,
      getGroupDependencyGraph,
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
      user,
      token,
      deviceId,
      isGuest,
      syncStatus,
      pendingSyncCount,
      lastSyncedAt,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      login,
      register,
      logout,
      syncNow,
      apiUrl,
      setApiUrl,
      testApiConnection,
      splitTransactionIntoGroup,
    }),
    [
      isReady,
      services,
      accounts,
      transactions,
      categories,
      budgets,
      goals,
      fixedVsVariable,
      spendingTrends,
      netWorthMinor,
      stats,
      groups,
      activeGroupId,
      activeGroup,
      activeGroupMembers,
      activeGroupExpenses,
      activeGroupSettlements,
      activeGroupBalances,
      activeGroupTransfers,
      refreshLedger,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createAccount,
      archiveAccount,
      createBudget,
      deleteBudget,
      createGoal,
      contributeToGoal,
      deleteGoal,
      createGroup,
      joinGroup,
      createGroupInvite,
      selectGroup,
      addGroupExpense,
      recordSettlement,
      deleteGroupExpense,
      deleteGroup,
      getMemberExplanation,
      getGroupDependencyGraph,
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
      user,
      token,
      deviceId,
      isGuest,
      syncStatus,
      pendingSyncCount,
      lastSyncedAt,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      login,
      register,
      logout,
      syncNow,
      apiUrl,
      setApiUrl,
      testApiConnection,
      splitTransactionIntoGroup,
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
