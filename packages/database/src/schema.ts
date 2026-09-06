import { pgTable, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  deviceId: text('device_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sharedGroups = pgTable('shared_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  currency: text('currency').default('INR').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sharedGroupMembers = pgTable('shared_group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => sharedGroups.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  role: text('role').default('member').notNull(), // 'owner' | 'member'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sharedExpenses = pgTable('shared_expenses', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => sharedGroups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').default('INR').notNull(),
  date: text('date').notNull(),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
  payersJson: jsonb('payers_json').notNull(),
  splitMethod: text('split_method').notNull(),
  allocationsJson: jsonb('allocations_json').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sharedSettlements = pgTable('shared_settlements', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => sharedGroups.id, { onDelete: 'cascade' }),
  fromUserId: text('from_user_id').notNull().references(() => users.id),
  toUserId: text('to_user_id').notNull().references(() => users.id),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').default('INR').notNull(),
  settledAt: timestamp('settled_at').defaultNow().notNull(),
  notes: text('notes'),
});

export const serverSyncOperations = pgTable('server_sync_operations', {
  id: text('id').primaryKey(), // Operation UUID
  userId: text('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  operationType: text('operation_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').default('synced').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
