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
