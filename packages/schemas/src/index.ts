import { z } from 'zod';

// Money Schema - MUST ALWAYS USE INTEGER MINOR UNITS (paise, cents, etc.)
export const CurrencyCodeSchema = z.string().length(3).default('INR');

export const MoneySchema = z.object({
  amountMinor: z.number().int({ message: 'Amount must be an integer in minor units (e.g. paise)' }),
  currency: CurrencyCodeSchema,
});

export type Money = z.infer<typeof MoneySchema>;

// Account Schema
export const AccountTypeSchema = z.enum([
  'cash',
  'bank',
  'wallet',
  'debit',
  'credit',
  'investment',
  'other',
]);

export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: AccountTypeSchema,
  initialBalanceMinor: z.number().int().default(0),
  currency: CurrencyCodeSchema,
  isArchived: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Account = z.infer<typeof AccountSchema>;

// Category Schema
export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().default('tag'),
  parentCategoryId: z.string().nullable().default(null),
  isBuiltin: z.boolean().default(false),
});

export type Category = z.infer<typeof CategorySchema>;

// Transaction Schema
export const TransactionTypeSchema = z.enum(['expense', 'income', 'transfer']);

export const TransactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  type: TransactionTypeSchema,
  amountMinor: z.number().int().positive({ message: 'Amount must be positive' }),
  currency: CurrencyCodeSchema,
  date: z.string(), // ISO date string YYYY-MM-DD or ISO timestamp
  categoryId: z.string().nullable().default(null),
  subcategory: z.string().nullable().default(null),
  merchant: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  toAccountId: z.string().nullable().default(null), // Required for transfer
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Group & Split Schemas
export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isPrivate: z.boolean().default(true), // Private means dummy users, fully offline
  ownerId: z.string().min(1),
  currency: CurrencyCodeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Group = z.infer<typeof GroupSchema>;

export const GroupMemberSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().min(1),
  userId: z.string().nullable().default(null), // Real user ID if authenticated
  isDummy: z.boolean().default(true),
  role: z.enum(['owner', 'member']).default('member'),
  createdAt: z.string().datetime(),
});

export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const SplitMethodSchema = z.enum([
  'equal',
  'exact',
  'percentage',
  'shares',
  'itemized',
]);

export const PayerEntrySchema = z.object({
  memberId: z.string().min(1),
  amountMinor: z.number().int().positive(),
});

export const SplitAllocationSchema = z.object({
  memberId: z.string().min(1),
  amountMinor: z.number().int().nonnegative().optional(),
  percentage: z.number().nonnegative().max(100).optional(),
  shares: z.number().int().positive().optional(),
  items: z.array(z.object({ description: z.string(), amountMinor: z.number().int().positive() })).optional(),
});

export const GroupExpenseSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  title: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: CurrencyCodeSchema,
  date: z.string(),
  createdByMemberId: z.string().min(1),
  payers: z.array(PayerEntrySchema).min(1),
  splitMethod: SplitMethodSchema,
  allocations: z.array(SplitAllocationSchema).min(1),
  notes: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GroupExpense = z.infer<typeof GroupExpenseSchema>;

export const SettlementSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: CurrencyCodeSchema,
  settledAt: z.string().datetime(),
  notes: z.string().nullable().default(null),
});

export type Settlement = z.infer<typeof SettlementSchema>;

// Budget Schema
export const BudgetSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: CurrencyCodeSchema,
  period: z.enum(['weekly', 'monthly']),
  startDate: z.string(),
  endDate: z.string().nullable().default(null),
  rollover: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Budget = z.infer<typeof BudgetSchema>;

// Goal Schema
export const GoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  targetAmountMinor: z.number().int().positive(),
  currentAmountMinor: z.number().int().default(0),
  currency: CurrencyCodeSchema,
  targetDate: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Goal = z.infer<typeof GoalSchema>;

// Liability Schema
export const LiabilityTypeSchema = z.enum([
  'credit_card',
  'loan',
  'emi',
  'bnpl',
  'other',
]);

export const LiabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: LiabilityTypeSchema,
  principalAmountMinor: z.number().int().positive(),
  remainingAmountMinor: z.number().int().nonnegative(),
  currency: CurrencyCodeSchema,
  interestRatePercent: z.number().nonnegative().default(0),
  dueDate: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Liability = z.infer<typeof LiabilitySchema>;

// Investment Schema
export const InvestmentTypeSchema = z.enum([
  'fd',
  'rd',
  'mutual_fund',
  'stock',
  'etf',
  'bond',
  'ppf',
  'epf',
  'nps',
  'gold',
  'esop',
  'other',
]);

export const InvestmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: InvestmentTypeSchema,
  investedAmountMinor: z.number().int().positive(),
  currentValueMinor: z.number().int().nonnegative(),
  currency: CurrencyCodeSchema,
  notes: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Investment = z.infer<typeof InvestmentSchema>;

// Sync Operation Schema
export const SyncOperationSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string(),
  operationType: z.enum(['create', 'update', 'delete']),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  deviceId: z.string(),
  status: z.enum(['pending', 'synced', 'rejected']).default('pending'),
  rejectionReason: z.string().nullable().default(null),
});

export type SyncOperation = z.infer<typeof SyncOperationSchema>;

// Authentication Schemas
export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const AuthResponseSchema = z.object({
  user: SessionUserSchema,
  token: z.string(),
  expiresAt: z.string().datetime(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
