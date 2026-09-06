import type { Group, GroupMember, GroupExpense, Settlement } from '@biyong/schemas';
import type { GroupRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface GroupRow {
  id: string;
  name: string;
  is_private: number;
  owner_id: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  group_id: string;
  name: string;
  user_id: string | null;
  is_dummy: number;
  role: 'owner' | 'member';
  created_at: string;
}

interface ExpenseRow {
  id: string;
  group_id: string;
  title: string;
  amount_minor: number;
  currency: string;
  date: string;
  created_by_member_id: string;
  payers_json: string;
  split_method: GroupExpense['splitMethod'];
  allocations_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SettlementRow {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
  currency: string;
  settled_at: string;
  notes: string | null;
}

export class SqliteGroupRepository implements GroupRepository {
  constructor(private driver: SqliteDriver) {}

  async create(group: Group): Promise<void> {
    await this.driver.run(
      `INSERT INTO groups (id, name, is_private, owner_id, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        group.id,
        group.name,
        group.isPrivate ? 1 : 0,
        group.ownerId,
        group.currency,
        group.createdAt,
        group.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<Group | null> {
    const row = await this.driver.queryOne<GroupRow>('SELECT * FROM groups WHERE id = ?', [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      isPrivate: Boolean(row.is_private),
      ownerId: row.owner_id,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(): Promise<Group[]> {
    const rows = await this.driver.query<GroupRow>('SELECT * FROM groups ORDER BY created_at DESC');
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isPrivate: Boolean(r.is_private),
      ownerId: r.owner_id,
      currency: r.currency,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async addMember(m: GroupMember): Promise<void> {
    await this.driver.run(
      `INSERT INTO group_members (id, group_id, name, user_id, is_dummy, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.groupId, m.name, m.userId ?? null, m.isDummy ? 1 : 0, m.role, m.createdAt]
    );
  }

  async getMembers(groupId: string): Promise<GroupMember[]> {
    const rows = await this.driver.query<MemberRow>(
      'SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC',
      [groupId]
    );
    return rows.map((r) => ({
      id: r.id,
      groupId: r.group_id,
      name: r.name,
      userId: r.user_id,
      isDummy: Boolean(r.is_dummy),
      role: r.role,
      createdAt: r.created_at,
    }));
  }

  async addExpense(exp: GroupExpense): Promise<void> {
    await this.driver.run(
      `INSERT INTO group_expenses (
        id, group_id, title, amount_minor, currency, date, created_by_member_id,
        payers_json, split_method, allocations_json, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exp.id,
        exp.groupId,
        exp.title,
        exp.amountMinor,
        exp.currency,
        exp.date,
        exp.createdByMemberId,
        JSON.stringify(exp.payers),
        exp.splitMethod,
        JSON.stringify(exp.allocations),
        exp.notes ?? null,
        exp.createdAt,
        exp.updatedAt,
      ]
    );
  }

  async getExpenses(groupId: string): Promise<GroupExpense[]> {
    const rows = await this.driver.query<ExpenseRow>(
      'SELECT * FROM group_expenses WHERE group_id = ? ORDER BY date ASC, created_at ASC',
      [groupId]
    );
    return rows.map((r) => ({
      id: r.id,
      groupId: r.group_id,
      title: r.title,
      amountMinor: r.amount_minor,
      currency: r.currency,
      date: r.date,
      createdByMemberId: r.created_by_member_id,
      payers: JSON.parse(r.payers_json),
      splitMethod: r.split_method,
      allocations: JSON.parse(r.allocations_json),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async addSettlement(s: Settlement): Promise<void> {
    await this.driver.run(
      `INSERT INTO settlements (
        id, group_id, from_member_id, to_member_id, amount_minor, currency, settled_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.groupId, s.fromMemberId, s.toMemberId, s.amountMinor, s.currency, s.settledAt, s.notes ?? null]
    );
  }

  async getSettlements(groupId: string): Promise<Settlement[]> {
    const rows = await this.driver.query<SettlementRow>(
      'SELECT * FROM settlements WHERE group_id = ? ORDER BY settled_at ASC',
      [groupId]
    );
    return rows.map((r) => ({
      id: r.id,
      groupId: r.group_id,
      fromMemberId: r.from_member_id,
      toMemberId: r.to_member_id,
      amountMinor: r.amount_minor,
      currency: r.currency,
      settledAt: r.settled_at,
      notes: r.notes,
    }));
  }

  async delete(id: string): Promise<void> {
    await this.driver.run('DELETE FROM settlements WHERE group_id = ?', [id]);
    await this.driver.run('DELETE FROM group_expenses WHERE group_id = ?', [id]);
    await this.driver.run('DELETE FROM group_members WHERE group_id = ?', [id]);
    await this.driver.run('DELETE FROM groups WHERE id = ?', [id]);
  }

  async deleteExpense(id: string): Promise<void> {
    await this.driver.run('DELETE FROM group_expenses WHERE id = ?', [id]);
  }
}
