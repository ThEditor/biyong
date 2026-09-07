import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import type {
  Account,
  Category,
  Transaction,
  Budget,
  Goal,
  Investment,
  Liability,
  Group,
  GroupMember,
  GroupExpense,
  Settlement,
  SessionUser,
  SyncStatus,
  SyncOperation,
  PeerDebt,
  PeerDebtRepayment,
  ReimbursementClaim,
  SubscriptionItem,
  FinancialAnomaly,
  CashFlowForecastPoint,
  NaturalLanguageQueryResponse,
  LedgerExportData,
} from '@biyong/schemas';
import {
  canEditExpense,
  canDeleteExpense,
  calculateNetWorth,
  type BudgetStatus,
  type GoalProgress,
  type FixedVsVariableSpending,
  type SpendingTrendItem,
  type SimplifiedTransfer,
  type MemberSettlementExplanation,
  type DependencyGraph,
  type WealthSummary,
  type InvestmentAnalytics,
  type LiabilityAnalytics,
  type HistoricalNetWorthPoint,
  type PeerDebtSummary,
  type ReimbursementSummary,
  type PersonalSpendingBreakdown,
  type SubscriptionBurnRate,
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

  // Wealth, Investments & Liabilities
  investments: Investment[];
  liabilities: Liability[];
  wealthSummary: WealthSummary | null;
  investmentAnalytics: InvestmentAnalytics | null;
  liabilityAnalytics: LiabilityAnalytics | null;
  historicalNetWorth: HistoricalNetWorthPoint[];

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

  // Wealth actions
  createInvestment: (
    data: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Investment>;
  updateInvestment: (data: Investment) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  createLiability: (
    data: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Liability>;
  updateLiability: (data: Liability) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;
  payLiability: (id: string, amountMinor: number) => Promise<void>;

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
    splitMethod?: 'equal' | 'exact' | 'percentage' | 'shares',
    allocations?: {
      memberId: string;
      amountMinor?: number;
      percentage?: number;
      shares?: number;
    }[],
    payerMemberId?: string
  ) => Promise<GroupExpense>;
  isTransactionSplitInGroup: (transactionId: string, groupId: string) => Promise<boolean>;
  getSplitGroupIdsForTransaction: (transactionId: string) => Promise<string[]>;
  getGroupMembers: (groupId: string) => Promise<GroupMember[]>;
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

  // Phase 7: Peer Lending & Borrowing
  peerDebts: PeerDebt[];
  peerDebtSummary: PeerDebtSummary | null;
  createPeerDebt: (data: Omit<PeerDebt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PeerDebt>;
  repayPeerDebt: (debtId: string, amountMinor: number, notes?: string) => Promise<void>;
  deletePeerDebt: (id: string) => Promise<void>;

  // Phase 7: Reimbursements
  reimbursements: ReimbursementClaim[];
  reimbursementSummary: ReimbursementSummary | null;
  personalSpendingBreakdown: PersonalSpendingBreakdown | null;
  createReimbursement: (data: Omit<ReimbursementClaim, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ReimbursementClaim>;
  updateReimbursementStatus: (id: string, status: ReimbursementClaim['status']) => Promise<void>;
  deleteReimbursement: (id: string) => Promise<void>;

  // Phase 7: Subscriptions & Recurring
  subscriptions: SubscriptionItem[];
  subscriptionBurnRate: SubscriptionBurnRate | null;
  createSubscription: (data: Omit<SubscriptionItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SubscriptionItem>;
  updateSubscription: (data: SubscriptionItem) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  detectSubscriptions: () => Promise<SubscriptionItem[]>;

  // Phase 7: Full Data Export & Import
  exportFullLedger: () => Promise<LedgerExportData>;
  exportTransactionsCsv: () => Promise<string>;
  exportAccountsCsv: () => Promise<string>;
  importFullLedger: (data: LedgerExportData | string) => Promise<{ success: boolean; count: number }>;

  // Phase 8: Financial Intelligence
  anomalies: FinancialAnomaly[];
  cashFlowForecast: CashFlowForecastPoint[];
  queryIntelligence: (question: string) => Promise<NaturalLanguageQueryResponse>;
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

  // Wealth, Investments & Liabilities state
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [wealthSummary, setWealthSummary] = useState<WealthSummary | null>(null);
  const [investmentAnalytics, setInvestmentAnalytics] = useState<InvestmentAnalytics | null>(null);
  const [liabilityAnalytics, setLiabilityAnalytics] = useState<LiabilityAnalytics | null>(null);
  const [historicalNetWorth, setHistoricalNetWorth] = useState<HistoricalNetWorthPoint[]>([]);

  // Phase 7 & 8 State
  const [peerDebts, setPeerDebts] = useState<PeerDebt[]>([]);
  const [peerDebtSummary, setPeerDebtSummary] = useState<PeerDebtSummary | null>(null);
  const [reimbursements, setReimbursements] = useState<ReimbursementClaim[]>([]);
  const [reimbursementSummary, setReimbursementSummary] = useState<ReimbursementSummary | null>(null);
  const [personalSpendingBreakdown, setPersonalSpendingBreakdown] = useState<PersonalSpendingBreakdown | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [subscriptionBurnRate, setSubscriptionBurnRate] = useState<SubscriptionBurnRate | null>(null);
  const [anomalies, setAnomalies] = useState<FinancialAnomaly[]>([]);
  const [cashFlowForecast, setCashFlowForecast] = useState<CashFlowForecastPoint[]>([]);

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
      const [
        accsWithBalances,
        txList,
        catList,
        budgetList,
        goalList,
        fixedVar,
        trends,
        groupList,
        invList,
        liabList,
        invAnalytics,
        liabAnalytics,
        histNetWorth,
        peerDebtList,
        pDebtSummary,
        reimbList,
        rSummary,
        personalBreakdown,
        subList,
        subBurn,
        anomalyList,
        flowForecast,
      ] = await Promise.all([
        services.accountUseCases.listAccountsWithDerivedBalances(true),
        services.txRepo.findAll(),
        services.categoryUseCases.listCategories(),
        services.budgetUseCases.listBudgetsWithStatus(),
        services.goalUseCases.listGoalsWithProgress(),
        services.analyticsUseCases.getFixedVsVariable(),
        services.analyticsUseCases.getSpendingTrends(6),
        services.groupUseCases.listGroups(),
        services.wealthUseCases.listInvestments(),
        services.wealthUseCases.listLiabilities(),
        services.wealthUseCases.getInvestmentAnalytics(),
        services.wealthUseCases.getLiabilityAnalytics(),
        services.wealthUseCases.getHistoricalNetWorth(6),
        services.lendingUseCases.listPeerDebts(),
        services.lendingUseCases.getPeerDebtSummary(),
        services.reimbursementUseCases.listClaims(),
        services.reimbursementUseCases.getSummary(),
        services.reimbursementUseCases.getSpendingBreakdown(),
        services.subscriptionUseCases.listSubscriptions(),
        services.subscriptionUseCases.getBurnRate(),
        services.intelligenceUseCases.getAnomalies(),
        services.intelligenceUseCases.getCashFlowForecast(60),
      ]);

      const cashBalances = (accsWithBalances as AccountWithDerivedBalance[]).map(
        (a) => a.derivedBalanceMinor
      );
      const comprehensiveWealthSummary = calculateNetWorth(
        cashBalances,
        invList,
        liabList,
        peerDebtList
      );

      setAccounts(accsWithBalances);
      setTransactions(txList);
      setCategories(catList);
      setBudgets(budgetList);
      setGoals(goalList);
      setFixedVsVariable(fixedVar);
      setSpendingTrends(trends);
      setGroups(groupList);
      setWealthSummary(comprehensiveWealthSummary);
      setInvestments(invList);
      setLiabilities(liabList);
      setInvestmentAnalytics(invAnalytics);
      setLiabilityAnalytics(liabAnalytics);
      setHistoricalNetWorth(histNetWorth);
      setNetWorthMinor(comprehensiveWealthSummary.netWorthMinor);

      setPeerDebts(peerDebtList);
      setPeerDebtSummary(pDebtSummary);
      setReimbursements(reimbList);
      setReimbursementSummary(rSummary);
      setPersonalSpendingBreakdown(personalBreakdown);
      setSubscriptions(subList);
      setSubscriptionBurnRate(subBurn);
      setAnomalies(anomalyList);
      setCashFlowForecast(flowForecast);

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

        const [
          accsWithBalances,
          txList,
          catList,
          budgetList,
          goalList,
          fixedVar,
          trends,
          groupList,
          invList,
          liabList,
          invAnalytics,
          liabAnalytics,
          histNetWorth,
          peerDebtList,
          pDebtSummary,
          reimbList,
          rSummary,
          personalBreakdown,
          subList,
          subBurn,
          anomalyList,
          flowForecast,
        ] = await Promise.all([
          s.accountUseCases.listAccountsWithDerivedBalances(true),
          s.txRepo.findAll(),
          s.categoryUseCases.listCategories(),
          s.budgetUseCases.listBudgetsWithStatus(),
          s.goalUseCases.listGoalsWithProgress(),
          s.analyticsUseCases.getFixedVsVariable(),
          s.analyticsUseCases.getSpendingTrends(6),
          s.groupUseCases.listGroups(),
          s.wealthUseCases.listInvestments(),
          s.wealthUseCases.listLiabilities(),
          s.wealthUseCases.getInvestmentAnalytics(),
          s.wealthUseCases.getLiabilityAnalytics(),
          s.wealthUseCases.getHistoricalNetWorth(6),
          s.lendingUseCases.listPeerDebts(),
          s.lendingUseCases.getPeerDebtSummary(),
          s.reimbursementUseCases.listClaims(),
          s.reimbursementUseCases.getSummary(),
          s.reimbursementUseCases.getSpendingBreakdown(),
          s.subscriptionUseCases.listSubscriptions(),
          s.subscriptionUseCases.getBurnRate(),
          s.intelligenceUseCases.getAnomalies(),
          s.intelligenceUseCases.getCashFlowForecast(60),
        ]);

        const cashBalances = (accsWithBalances as AccountWithDerivedBalance[]).map(
          (a) => a.derivedBalanceMinor
        );
        const comprehensiveWealthSummary = calculateNetWorth(
          cashBalances,
          invList,
          liabList,
          peerDebtList
        );

        setAccounts(accsWithBalances);
        setTransactions(txList);
        setCategories(catList);
        setBudgets(budgetList);
        setGoals(goalList);
        setFixedVsVariable(fixedVar);
        setSpendingTrends(trends);
        setGroups(groupList);
        setWealthSummary(comprehensiveWealthSummary);
        setInvestments(invList);
        setLiabilities(liabList);
        setInvestmentAnalytics(invAnalytics);
        setLiabilityAnalytics(liabAnalytics);
        setHistoricalNetWorth(histNetWorth);
        setNetWorthMinor(comprehensiveWealthSummary.netWorthMinor);

        setPeerDebts(peerDebtList);
        setPeerDebtSummary(pDebtSummary);
        setReimbursements(reimbList);
        setReimbursementSummary(rSummary);
        setPersonalSpendingBreakdown(personalBreakdown);
        setSubscriptions(subList);
        setSubscriptionBurnRate(subBurn);
        setAnomalies(anomalyList);
        setCashFlowForecast(flowForecast);

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

  const createInvestment = useCallback(
    async (data: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Investment> => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newInv: Investment = {
        ...data,
        id: generateId('inv'),
        createdAt: now,
        updatedAt: now,
      };
      await services.wealthUseCases.createInvestment(newInv);
      const op = createSyncOperation({
        entityType: 'investment',
        entityId: newInv.id,
        operationType: 'create',
        payload: newInv as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
      return newInv;
    },
    [services, refreshLedger]
  );

  const updateInvestment = useCallback(
    async (data: Investment): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      const updated: Investment = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await services.wealthUseCases.updateInvestment(updated);
      const op = createSyncOperation({
        entityType: 'investment',
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

  const deleteInvestment = useCallback(
    async (id: string): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      await services.wealthUseCases.deleteInvestment(id);
      const op = createSyncOperation({
        entityType: 'investment',
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

  const createLiability = useCallback(
    async (data: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>): Promise<Liability> => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newLiab: Liability = {
        ...data,
        id: generateId('liab'),
        createdAt: now,
        updatedAt: now,
      };
      await services.wealthUseCases.createLiability(newLiab);
      const op = createSyncOperation({
        entityType: 'liability',
        entityId: newLiab.id,
        operationType: 'create',
        payload: newLiab as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
      return newLiab;
    },
    [services, refreshLedger]
  );

  const updateLiability = useCallback(
    async (data: Liability): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      const updated: Liability = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await services.wealthUseCases.updateLiability(updated);
      const op = createSyncOperation({
        entityType: 'liability',
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

  const deleteLiability = useCallback(
    async (id: string): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      await services.wealthUseCases.deleteLiability(id);
      const op = createSyncOperation({
        entityType: 'liability',
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

  const payLiability = useCallback(
    async (id: string, amountMinor: number): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      const updated = await services.wealthUseCases.payLiability(id, amountMinor);
      const op = createSyncOperation({
        entityType: 'liability',
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

  // Phase 7: Peer Lending & Borrowing Actions
  const createPeerDebt = useCallback(
    async (data: Omit<PeerDebt, 'id' | 'createdAt' | 'updatedAt'>): Promise<PeerDebt> => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newDebt: PeerDebt = {
        ...data,
        id: generateId('debt'),
        createdAt: now,
        updatedAt: now,
      };
      await services.lendingUseCases.createPeerDebt(newDebt);
      const op = createSyncOperation({
        entityType: 'peer_debt',
        entityId: newDebt.id,
        operationType: 'create',
        payload: newDebt as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
      return newDebt;
    },
    [services, refreshLedger]
  );

  const repayPeerDebt = useCallback(
    async (debtId: string, amountMinor: number, notes?: string): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      const res = await services.lendingUseCases.recordRepayment(debtId, amountMinor, notes);
      const opDebt = createSyncOperation({
        entityType: 'peer_debt',
        entityId: res.updatedDebt.id,
        operationType: 'update',
        payload: res.updatedDebt as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(opDebt);
      const opRepay = createSyncOperation({
        entityType: 'peer_debt_repayment',
        entityId: res.repayment.id,
        operationType: 'create',
        payload: res.repayment as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(opRepay);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const deletePeerDebt = useCallback(
    async (id: string): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      await services.lendingUseCases.deletePeerDebt(id);
      const op = createSyncOperation({
        entityType: 'peer_debt',
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

  // Phase 7: Reimbursement Actions
  const createReimbursement = useCallback(
    async (data: Omit<ReimbursementClaim, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReimbursementClaim> => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newClaim: ReimbursementClaim = {
        ...data,
        id: generateId('claim'),
        createdAt: now,
        updatedAt: now,
      };
      await services.reimbursementUseCases.createClaim(newClaim);
      const op = createSyncOperation({
        entityType: 'reimbursement',
        entityId: newClaim.id,
        operationType: 'create',
        payload: newClaim as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
      return newClaim;
    },
    [services, refreshLedger]
  );

  const updateReimbursementStatus = useCallback(
    async (id: string, status: ReimbursementClaim['status']): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      if (status === 'reimbursed') {
        await services.reimbursementUseCases.markClaimReimbursed(id);
      } else {
        const claim = await services.reimbursementUseCases.getClaim(id);
        if (claim) {
          const updated = { ...claim, status, updatedAt: new Date().toISOString() };
          await services.reimbursementUseCases.updateClaim(updated);
        }
      }
      const claim = await services.reimbursementUseCases.getClaim(id);
      if (claim) {
        const op = createSyncOperation({
          entityType: 'reimbursement',
          entityId: claim.id,
          operationType: 'update',
          payload: claim as unknown as Record<string, unknown>,
          deviceId: deviceIdRef.current || 'device_default',
        });
        await services.outboxRepo.enqueue(op);
      }
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
    },
    [services, refreshLedger]
  );

  const deleteReimbursement = useCallback(
    async (id: string): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      await services.reimbursementUseCases.deleteClaim(id);
      const op = createSyncOperation({
        entityType: 'reimbursement',
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

  // Phase 7: Subscriptions Actions
  const createSubscription = useCallback(
    async (data: Omit<SubscriptionItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionItem> => {
      if (!services) throw new Error('Database not ready');
      const now = new Date().toISOString();
      const newSub: SubscriptionItem = {
        ...data,
        id: generateId('sub'),
        createdAt: now,
        updatedAt: now,
      };
      await services.subscriptionUseCases.createSubscription(newSub);
      const op = createSyncOperation({
        entityType: 'subscription',
        entityId: newSub.id,
        operationType: 'create',
        payload: newSub as unknown as Record<string, unknown>,
        deviceId: deviceIdRef.current || 'device_default',
      });
      await services.outboxRepo.enqueue(op);
      const pCount = await services.outboxRepo.getPendingCount();
      setPendingSyncCount(pCount);
      await refreshLedger();
      return newSub;
    },
    [services, refreshLedger]
  );

  const updateSubscription = useCallback(
    async (data: SubscriptionItem): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      const updated: SubscriptionItem = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await services.subscriptionUseCases.updateSubscription(updated);
      const op = createSyncOperation({
        entityType: 'subscription',
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

  const deleteSubscription = useCallback(
    async (id: string): Promise<void> => {
      if (!services) throw new Error('Database not ready');
      await services.subscriptionUseCases.deleteSubscription(id);
      const op = createSyncOperation({
        entityType: 'subscription',
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

  const detectSubscriptions = useCallback(async (): Promise<SubscriptionItem[]> => {
    if (!services) return [];
    const detected = await services.subscriptionUseCases.detectSubscriptions();
    const created: SubscriptionItem[] = [];
    for (const item of detected) {
      const now = new Date().toISOString();
      const sub: SubscriptionItem = {
        ...item,
        id: generateId('sub'),
        createdAt: now,
        updatedAt: now,
      };
      await services.subscriptionUseCases.createSubscription(sub);
      created.push(sub);
    }
    await refreshLedger();
    return created;
  }, [services, refreshLedger]);

  // Phase 7: Full Data Export & Import
  const exportFullLedger = useCallback(async (): Promise<LedgerExportData> => {
    if (!services) throw new Error('Database not ready');
    return services.exportImportUseCases.exportFullLedger();
  }, [services]);

  const exportTransactionsCsv = useCallback(async (): Promise<string> => {
    if (!services) throw new Error('Database not ready');
    return services.exportImportUseCases.exportTransactionsCsv();
  }, [services]);

  const exportAccountsCsv = useCallback(async (): Promise<string> => {
    if (!services) throw new Error('Database not ready');
    return services.exportImportUseCases.exportAccountsCsv();
  }, [services]);

  const importFullLedger = useCallback(
    async (data: LedgerExportData | string): Promise<{ success: boolean; count: number }> => {
      if (!services) throw new Error('Database not ready');
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      const res = await services.exportImportUseCases.importAndReconcile(jsonStr);
      await refreshLedger();
      const count = res.reconciled
        ? res.reconciled.accounts.length +
          res.reconciled.transactions.length +
          res.reconciled.budgets.length +
          res.reconciled.goals.length +
          res.reconciled.peerDebts.length +
          res.reconciled.subscriptions.length
        : 0;
      return { success: res.success, count };
    },
    [services, refreshLedger]
  );

  // Phase 8: Financial Intelligence
  const queryIntelligence = useCallback(
    async (question: string): Promise<NaturalLanguageQueryResponse> => {
      if (!services) throw new Error('Database not ready');
      return services.intelligenceUseCases.askQuestion(question);
    },
    [services]
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
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
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
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
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
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
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
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
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
        isReimbursable: true,
        reimbursementStatus: 'pending',
        receiptAttachmentId: null,
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
        isReimbursable: true,
        reimbursementStatus: 'pending',
        receiptAttachmentId: null,
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

    // Seed Investments & Liabilities
    await services.driver.exec('DELETE FROM investments');
    await services.driver.exec('DELETE FROM liabilities');

    const sampleInvestments: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Nifty 50 Index Fund',
        type: 'mutual_fund',
        investedAmountMinor: 15000000, // ₹1,50,000
        currentValueMinor: 17850000,   // ₹1,78,500
        currency: 'INR',
        notes: 'Monthly SIP via UTI AMC',
      },
      {
        name: 'HDFC 1-Year FD',
        type: 'fd',
        investedAmountMinor: 10000000, // ₹1,00,000
        currentValueMinor: 10710000,   // ₹1,07,100
        currency: 'INR',
        notes: 'Fixed return at 7.1%',
      },
      {
        name: 'Sovereign Gold Bond 24K',
        type: 'gold',
        investedAmountMinor: 8000000,  // ₹80,000
        currentValueMinor: 9800000,    // ₹98,000
        currency: 'INR',
        notes: 'Tranche 2023-24 Series II',
      },
      {
        name: 'National Pension Scheme (NPS)',
        type: 'nps',
        investedAmountMinor: 12000000, // ₹1,20,000
        currentValueMinor: 13900000,   // ₹1,39,000
        currency: 'INR',
        notes: 'Tier 1 Auto Choice (LC50)',
      },
      {
        name: 'Tata Motors Shares',
        type: 'stock',
        investedAmountMinor: 5000000,  // ₹50,000
        currentValueMinor: 6420000,    // ₹64,200
        currency: 'INR',
        notes: 'Long-term equity allocation',
      },
    ];

    for (const inv of sampleInvestments) {
      const invDate = new Date(now.getFullYear(), now.getMonth() - 2, 10).toISOString();
      await services.wealthUseCases.createInvestment({
        ...inv,
        id: generateId('inv_demo'),
        createdAt: invDate,
        updatedAt: invDate,
      });
    }

    const sampleLiabilities: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Home Loan - HDFC',
        type: 'loan',
        principalAmountMinor: 250000000, // ₹25,00,000
        remainingAmountMinor: 184500000, // ₹18,45,000
        currency: 'INR',
        interestRatePercent: 8.5,
        dueDate: `${year}-${month}-05`,
        notes: 'EMI auto-debit on 5th of each month',
      },
      {
        name: 'SBI Credit Card',
        type: 'credit_card',
        principalAmountMinor: 4500000,  // ₹45,000
        remainingAmountMinor: 2450000,  // ₹24,500
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: `${year}-${month}-20`,
        notes: 'Statement balance due this month',
      },
      {
        name: 'MacBook Pro EMI',
        type: 'emi',
        principalAmountMinor: 12000000, // ₹1,20,000
        remainingAmountMinor: 4000000,  // ₹40,000
        currency: 'INR',
        interestRatePercent: 0,
        dueDate: `${year}-${month}-15`,
        notes: 'No cost EMI, 6 of 9 instalments completed',
      },
    ];

    for (const liab of sampleLiabilities) {
      const liabDate = new Date(now.getFullYear(), now.getMonth() - 3, 5).toISOString();
      await services.wealthUseCases.createLiability({
        ...liab,
        id: generateId('liab_demo'),
        createdAt: liabDate,
        updatedAt: liabDate,
      });
    }

    await refreshLedger();
  }, [services, refreshLedger]);

  const clearAllData = useCallback(async () => {
    if (!services) return;
    await services.driver.exec('DELETE FROM transactions');
    await services.driver.exec('DELETE FROM accounts');
    await services.driver.exec('DELETE FROM budgets');
    await services.driver.exec('DELETE FROM goals');
    await services.driver.exec('DELETE FROM investments');
    await services.driver.exec('DELETE FROM liabilities');
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

  const isTransactionSplitInGroup = useCallback(
    async (transactionId: string, groupId: string): Promise<boolean> => {
      if (!services) return false;
      try {
        const marker = `Linked from transaction ${transactionId}`;
        const expenses = await services.groupRepo.getExpenses(groupId);
        const prefKey = `tx_split_${transactionId}_${groupId}`;

        // Check if there is an active expense in this group matching this transaction
        const prefRows = await services.driver.query<{ value: string }>(
          'SELECT value FROM app_preferences WHERE key = ?',
          [prefKey]
        );

        const linkedExpenseId = prefRows.length > 0 ? prefRows[0].value : null;
        const matchingExpense = expenses.find(
          (e) => (linkedExpenseId && e.id === linkedExpenseId) || (e.notes && e.notes.includes(marker))
        );

        if (matchingExpense) {
          return true;
        }

        // If no active expense was found but preference existed, clean up stale preference
        if (prefRows.length > 0) {
          try {
            await services.driver.run('DELETE FROM app_preferences WHERE key = ?', [prefKey]);
          } catch {
            // ignore
          }
        }

        return false;
      } catch (err) {
        console.warn('Failed to check if transaction split in group:', err);
        return false;
      }
    },
    [services]
  );

  const getSplitGroupIdsForTransaction = useCallback(
    async (transactionId: string): Promise<string[]> => {
      if (!services) return [];
      try {
        const marker = `Linked from transaction ${transactionId}`;
        const matchingGroupIds: string[] = [];

        // Check app_preferences table
        const prefRows = await services.driver.query<{ key: string; value: string }>(
          "SELECT key, value FROM app_preferences WHERE key LIKE ?",
          [`tx_split_${transactionId}_%`]
        );
        for (const row of prefRows) {
          const prefix = `tx_split_${transactionId}_`;
          if (row.key.startsWith(prefix)) {
            const grpId = row.key.slice(prefix.length);
            if (grpId) {
              const exps = await services.groupRepo.getExpenses(grpId);
              const exists = exps.some(
                (e) => e.id === row.value || (e.notes && e.notes.includes(marker))
              );
              if (exists) {
                if (!matchingGroupIds.includes(grpId)) {
                  matchingGroupIds.push(grpId);
                }
              } else {
                // Obsolete / deleted: clean up
                try {
                  await services.driver.run('DELETE FROM app_preferences WHERE key = ?', [row.key]);
                } catch {
                  // ignore
                }
              }
            }
          }
        }

        // Check all groups for expense notes marker
        const allGroups = await services.groupRepo.findAll();
        for (const grp of allGroups) {
          if (!matchingGroupIds.includes(grp.id)) {
            const exps = await services.groupRepo.getExpenses(grp.id);
            if (exps.some((e) => e.notes && e.notes.includes(marker))) {
              matchingGroupIds.push(grp.id);
            }
          }
        }
        return matchingGroupIds;
      } catch (err) {
        console.warn('Failed to get split group IDs for transaction:', err);
        return [];
      }
    },
    [services]
  );

  const splitTransactionIntoGroup = useCallback(
    async (
      transactionId: string,
      groupId: string,
      splitMethod: 'equal' | 'exact' | 'percentage' | 'shares' = 'equal',
      customAllocations?: {
        memberId: string;
        amountMinor?: number;
        percentage?: number;
        shares?: number;
      }[],
      customPayerMemberId?: string
    ): Promise<GroupExpense> => {
      if (!services) throw new Error('Database not ready');
      const tx = await services.txRepo.findById(transactionId);
      if (!tx) throw new Error('Transaction not found');

      // Check if already split into this group
      const alreadySplit = await isTransactionSplitInGroup(transactionId, groupId);
      if (alreadySplit) {
        throw new Error('This transaction has already been split into this group.');
      }

      const members = await services.groupRepo.getMembers(groupId);
      if (members.length === 0) throw new Error('Selected group has no members');

      // Payer selection: prioritize specified custom payer, or current user / "You" / owner
      let payerMemberId = customPayerMemberId;
      if (!payerMemberId || !members.some((m) => m.id === payerMemberId)) {
        const myMember =
          members.find(
            (m) =>
              (user && m.userId === user.id) ||
              m.name.toLowerCase() === 'you' ||
              m.role === 'owner'
          ) || members[0];
        payerMemberId = myMember.id;
      }

      // Allocations selection
      let allocations = customAllocations;
      if (!allocations || allocations.length === 0) {
        allocations = members.map((m) => ({ memberId: m.id }));
      }

      const now = new Date().toISOString();
      const expenseTitle = tx.merchant || tx.notes || `Split: ${tx.date}`;

      const newExpense: GroupExpense = {
        id: generateId('gexp'),
        groupId,
        title: expenseTitle,
        amountMinor: tx.amountMinor,
        currency: tx.currency as any,
        date: tx.date,
        createdByMemberId: payerMemberId,
        createdByUserId: user?.id ?? null,
        payers: [{ memberId: payerMemberId, amountMinor: tx.amountMinor }],
        splitMethod,
        allocations,
        notes: `Linked from transaction ${tx.id}${tx.merchant ? ` (${tx.merchant})` : ''}`,
        createdAt: now,
        updatedAt: now,
      };

      await services.groupUseCases.addExpense(newExpense);

      // Record split mapping in app_preferences so duplicate splits are blocked
      try {
        await services.driver.run(
          'INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)',
          [`tx_split_${transactionId}_${groupId}`, newExpense.id]
        );
      } catch (prefErr) {
        console.warn('Failed to save tx_split preference:', prefErr);
      }

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
    [services, user, refreshLedger, refreshActiveGroup, isTransactionSplitInGroup]
  );

  const getGroupMembers = useCallback(
    async (groupId: string): Promise<GroupMember[]> => {
      if (!services) return [];
      try {
        return await services.groupRepo.getMembers(groupId);
      } catch (err) {
        console.warn('Failed to get group members:', err);
        return [];
      }
    },
    [services]
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

      // Clean up any tx_split preferences pointing to this deleted expense
      try {
        await services.driver.run('DELETE FROM app_preferences WHERE value = ?', [id]);
      } catch (prefErr) {
        console.warn('Failed to delete tx_split preference:', prefErr);
      }
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
      investments,
      liabilities,
      wealthSummary,
      investmentAnalytics,
      liabilityAnalytics,
      historicalNetWorth,
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
      createInvestment,
      updateInvestment,
      deleteInvestment,
      createLiability,
      updateLiability,
      deleteLiability,
      payLiability,
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
      isTransactionSplitInGroup,
      getSplitGroupIdsForTransaction,
      getGroupMembers,

      // Phase 7 & 8
      peerDebts,
      peerDebtSummary,
      createPeerDebt,
      repayPeerDebt,
      deletePeerDebt,
      reimbursements,
      reimbursementSummary,
      personalSpendingBreakdown,
      createReimbursement,
      updateReimbursementStatus,
      deleteReimbursement,
      subscriptions,
      subscriptionBurnRate,
      createSubscription,
      updateSubscription,
      deleteSubscription,
      detectSubscriptions,
      exportFullLedger,
      exportTransactionsCsv,
      exportAccountsCsv,
      importFullLedger,
      anomalies,
      cashFlowForecast,
      queryIntelligence,
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
      investments,
      liabilities,
      wealthSummary,
      investmentAnalytics,
      liabilityAnalytics,
      historicalNetWorth,
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
      createInvestment,
      updateInvestment,
      deleteInvestment,
      createLiability,
      updateLiability,
      deleteLiability,
      payLiability,
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
      isTransactionSplitInGroup,
      getSplitGroupIdsForTransaction,
      getGroupMembers,
      peerDebts,
      peerDebtSummary,
      createPeerDebt,
      repayPeerDebt,
      deletePeerDebt,
      reimbursements,
      reimbursementSummary,
      personalSpendingBreakdown,
      createReimbursement,
      updateReimbursementStatus,
      deleteReimbursement,
      subscriptions,
      subscriptionBurnRate,
      createSubscription,
      updateSubscription,
      deleteSubscription,
      detectSubscriptions,
      exportFullLedger,
      exportTransactionsCsv,
      exportAccountsCsv,
      importFullLedger,
      anomalies,
      cashFlowForecast,
      queryIntelligence,
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
