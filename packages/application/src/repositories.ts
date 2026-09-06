import type {
  Account,
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

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findAll(): Promise<Account[]>;
  update(account: Account): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface TransactionRepository {
  create(tx: Transaction): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByDateRange(startDate: string, endDate: string): Promise<Transaction[]>;
  findAll(): Promise<Transaction[]>;
  update(tx: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
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
  saveInvestment(inv: Investment): Promise<void>;
  getLiabilities(): Promise<Liability[]>;
  saveLiability(liab: Liability): Promise<void>;
}
