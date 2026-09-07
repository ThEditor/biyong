import type {
  Account,
  Category,
  Transaction,
  Group,
  GroupMember,
  GroupExpense,
  Settlement,
  Budget,
  Goal,
  Investment,
  Liability,
  PeerDebt,
  PeerDebtRepayment,
  ReimbursementClaim,
  SubscriptionItem,
  ReceiptAttachment,
} from '@biyong/schemas';

import type { TransactionFilter } from '@biyong/domain';

export interface CategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(cat: Category): Promise<void>;
}

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findAll(): Promise<Account[]>;
  update(account: Account): Promise<void>;
  delete(id: string): Promise<void>;
  archive?(id: string): Promise<void>;
}

export interface TransactionRepository {
  create(tx: Transaction): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByDateRange(startDate: string, endDate: string): Promise<Transaction[]>;
  findAll(): Promise<Transaction[]>;
  update(tx: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
  findByFilter?(filter: TransactionFilter): Promise<Transaction[]>;
}

export interface GroupRepository {
  create(group: Group): Promise<void>;
  findById(id: string): Promise<Group | null>;
  findAll(): Promise<Group[]>;
  addMember(member: GroupMember): Promise<void>;
  getMembers(groupId: string): Promise<GroupMember[]>;
  addExpense(expense: GroupExpense): Promise<void>;
  getExpenses(groupId: string): Promise<GroupExpense[]>;
  addSettlement(settlement: Settlement): Promise<void>;
  getSettlements(groupId: string): Promise<Settlement[]>;
  delete?(id: string): Promise<void>;
  deleteExpense?(id: string): Promise<void>;
}

export interface BudgetRepository {
  create(budget: Budget): Promise<void>;
  findById(id: string): Promise<Budget | null>;
  findByCategoryId(categoryId: string): Promise<Budget | null>;
  findAll(): Promise<Budget[]>;
  update(budget: Budget): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface GoalRepository {
  create(goal: Goal): Promise<void>;
  findById(id: string): Promise<Goal | null>;
  findAll(): Promise<Goal[]>;
  update(goal: Goal): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WealthRepository {
  getInvestments(): Promise<Investment[]>;
  findInvestmentById(id: string): Promise<Investment | null>;
  saveInvestment(inv: Investment): Promise<void>;
  deleteInvestment(id: string): Promise<void>;
  getLiabilities(): Promise<Liability[]>;
  findLiabilityById(id: string): Promise<Liability | null>;
  saveLiability(liab: Liability): Promise<void>;
  deleteLiability(id: string): Promise<void>;
}

export interface PeerDebtRepository {
  create?(debt: PeerDebt): Promise<void>;
  findById(id: string): Promise<PeerDebt | null>;
  findAll(): Promise<PeerDebt[]>;
  findByStatus?(status: PeerDebt['status']): Promise<PeerDebt[]>;
  update?(debt: PeerDebt): Promise<void>;
  save(debt: PeerDebt): Promise<void>;
  delete(id: string): Promise<void>;
  addRepayment(repayment: PeerDebtRepayment): Promise<void>;
  getRepayments(debtId: string): Promise<PeerDebtRepayment[]>;
  getAllRepayments?(): Promise<PeerDebtRepayment[]>;
  deleteRepayment?(id: string): Promise<void>;
}

export interface ReimbursementRepository {
  create?(claim: ReimbursementClaim): Promise<void>;
  findById(id: string): Promise<ReimbursementClaim | null>;
  findAll(): Promise<ReimbursementClaim[]>;
  findByStatus?(status: ReimbursementClaim['status']): Promise<ReimbursementClaim[]>;
  update?(claim: ReimbursementClaim): Promise<void>;
  save(claim: ReimbursementClaim): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SubscriptionRepository {
  create?(subscription: SubscriptionItem): Promise<void>;
  findById(id: string): Promise<SubscriptionItem | null>;
  findAll(): Promise<SubscriptionItem[]>;
  findByStatus?(status: SubscriptionItem['status']): Promise<SubscriptionItem[]>;
  update?(subscription: SubscriptionItem): Promise<void>;
  save(subscription: SubscriptionItem): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ReceiptRepository {
  save(receipt: ReceiptAttachment): Promise<void>;
  create?(receipt: ReceiptAttachment): Promise<void>;
  findById(id: string): Promise<ReceiptAttachment | null>;
  findByTransactionId(transactionId: string): Promise<ReceiptAttachment[]>;
  findAll?(): Promise<ReceiptAttachment[]>;
  delete(id: string): Promise<void>;
}
