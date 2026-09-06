import type { SqliteDriver } from '../driver.js';

interface SyncStateRow {
  key: string;
  value: string;
  updated_at: string;
}

export class SqliteSyncStateRepository {
  constructor(private driver: SqliteDriver) {}

  async get(key: string): Promise<string | null> {
    const row = await this.driver.queryOne<SyncStateRow>(
      'SELECT value FROM sync_state WHERE key = ?',
      [key]
    );
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.get(key);
    if (existing !== null) {
      await this.driver.run(
        'UPDATE sync_state SET value = ?, updated_at = ? WHERE key = ?',
        [value, now, key]
      );
    } else {
      await this.driver.run(
        'INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, now]
      );
    }
  }

  async delete(key: string): Promise<void> {
    await this.driver.run('DELETE FROM sync_state WHERE key = ?', [key]);
  }

  // Common sync helpers
  async getCursor(): Promise<string | null> {
    return this.get('sync_cursor');
  }

  async setCursor(cursor: string): Promise<void> {
    await this.set('sync_cursor', cursor);
  }

  async getDeviceId(): Promise<string | null> {
    return this.get('device_id');
  }

  async setDeviceId(deviceId: string): Promise<void> {
    await this.set('device_id', deviceId);
  }

  async getAuthToken(): Promise<string | null> {
    return this.get('auth_token');
  }

  async setAuthToken(token: string | null): Promise<void> {
    if (token === null) {
      await this.delete('auth_token');
    } else {
      await this.set('auth_token', token);
    }
  }

  async getActiveUser(): Promise<{ id: string; email: string; name: string } | null> {
    const json = await this.get('active_user');
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async setActiveUser(user: { id: string; email: string; name: string } | null): Promise<void> {
    if (user === null) {
      await this.delete('active_user');
    } else {
      await this.set('active_user', JSON.stringify(user));
    }
  }
}
