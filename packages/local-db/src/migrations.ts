import type { SqliteDriver } from './driver.js';

export const INITIAL_MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  initial_balance_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  parent_category_id TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  date TEXT NOT NULL,
  category_id TEXT,
  subcategory TEXT,
  merchant TEXT,
  notes TEXT,
  to_account_id TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_frequency TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts (id),
  FOREIGN KEY (category_id) REFERENCES categories (id)
);

CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category_id);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 1,
  owner_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  user_id TEXT,
  is_dummy INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  date TEXT NOT NULL,
  created_by_member_id TEXT NOT NULL,
  created_by_user_id TEXT,
  payers_json TEXT NOT NULL,
  split_method TEXT NOT NULL,
  allocations_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  from_member_id TEXT NOT NULL,
  to_member_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  settled_at TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  period TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  rollover INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_amount_minor INTEGER NOT NULL,
  current_amount_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  target_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  principal_amount_minor INTEGER NOT NULL,
  remaining_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  interest_rate_percent REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  invested_amount_minor INTEGER NOT NULL,
  current_value_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_operations (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_operations (status);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const BUILTIN_CATEGORIES = [
  { id: 'cat-food', name: 'Food & Dining', icon: 'utensils', is_builtin: 1 },
  { id: 'cat-groceries', name: 'Groceries', icon: 'shopping-cart', is_builtin: 1 },
  { id: 'cat-transport', name: 'Transportation', icon: 'car', is_builtin: 1 },
  { id: 'cat-housing', name: 'Housing & Rent', icon: 'home', is_builtin: 1 },
  { id: 'cat-utilities', name: 'Utilities & Bills', icon: 'zap', is_builtin: 1 },
  { id: 'cat-shopping', name: 'Shopping', icon: 'shopping-bag', is_builtin: 1 },
  { id: 'cat-entertainment', name: 'Entertainment', icon: 'film', is_builtin: 1 },
  { id: 'cat-health', name: 'Health & Medical', icon: 'heart-pulse', is_builtin: 1 },
  { id: 'cat-salary', name: 'Salary', icon: 'briefcase', is_builtin: 1 },
  { id: 'cat-investment', name: 'Investments', icon: 'trending-up', is_builtin: 1 },
];

export async function runMigrations(driver: SqliteDriver): Promise<void> {
  await driver.exec(INITIAL_MIGRATION_V1);

  // Migration: Add created_by_user_id to group_expenses if missing
  try {
    await driver.run('ALTER TABLE group_expenses ADD COLUMN created_by_user_id TEXT');
  } catch {
    // Column already exists, ignore
  }

  // Seed default categories if not already present
  for (const cat of BUILTIN_CATEGORIES) {
    const existing = await driver.queryOne<{ id: string }>('SELECT id FROM categories WHERE id = ?', [cat.id]);
    if (!existing) {
      await driver.run(
        'INSERT INTO categories (id, name, icon, is_builtin) VALUES (?, ?, ?, ?)',
        [cat.id, cat.name, cat.icon, cat.is_builtin]
      );
    }
  }
}
