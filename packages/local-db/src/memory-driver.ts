import type { SqliteDriver } from './driver.js';

export class MemorySqliteDriver implements SqliteDriver {
  private db: any;

  constructor(dbInstance?: any) {
    if (dbInstance) {
      this.db = dbInstance;
    }
  }

  async init(customModule?: any) {
    if (!this.db) {
      if (customModule) {
        this.db = new customModule(':memory:');
      } else {
        // Try node:sqlite first (Node 22 built-in)
        try {
          const modName = 'node:' + 'sqlite';
          // @ts-ignore
          const sqlite = await import(modName);
          if (sqlite?.DatabaseSync) {
            this.db = new sqlite.DatabaseSync(':memory:');
            return;
          }
        } catch {
          // Fallback to better-sqlite3
        }

        try {
          const betterSqlite = (await import('better-sqlite3')).default;
          this.db = new betterSqlite(':memory:');
          this.db.pragma('journal_mode = WAL');
        } catch (err) {
          throw new Error(`Failed to initialize in-memory SQLite driver: ${err}`);
        }
      }
    }
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowId?: number | bigint }> {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return { changes: info.changes, lastInsertRowId: info.lastInsertRowid ?? info.lastInsertRowId };
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) ?? null;
  }
}
