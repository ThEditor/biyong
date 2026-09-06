import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import {
  INITIAL_MIGRATION_V1,
  BUILTIN_CATEGORIES,
  type SqliteDriver,
} from '@biyong/local-db';
import { formatMoney, calculateSplit } from '@biyong/domain';
import { PALETTES, type AccentTheme, type ThemeMode } from '@biyong/ui';

// Adapter connecting Expo SQLite to Biyong's SqliteDriver interface
class ExpoSqliteDriver implements SqliteDriver {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowId?: number | bigint }> {
    const res = await this.db.runAsync(sql, params as any[]);
    return { changes: res.changes, lastInsertRowId: res.lastInsertRowId };
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.db.getAllAsync<T>(sql, params as any[])) as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = await this.db.getFirstAsync<T>(sql, params as any[]);
    return row ?? null;
  }
}

const ACCENT_OPTIONS: AccentTheme[] = ['default', 'ocean', 'forest', 'violet', 'amber', 'rose'];

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [accent, setAccent] = useState<AccentTheme>('default');
  const [categoriesCount, setCategoriesCount] = useState<number>(0);
  const [accountBalanceMinor, setAccountBalanceMinor] = useState<number>(5000000); // ₹50,000

  const colors = PALETTES[accent][themeMode];

  useEffect(() => {
    async function setupDatabase() {
      try {
        const db = await SQLite.openDatabaseAsync('biyong.db');
        const driver = new ExpoSqliteDriver(db);

        // Run migrations
        await driver.exec(INITIAL_MIGRATION_V1);

        // Seed builtin categories
        for (const cat of BUILTIN_CATEGORIES) {
          const existing = await driver.queryOne<{ id: string }>(
            'SELECT id FROM categories WHERE id = ?',
            [cat.id]
          );
          if (!existing) {
            await driver.run(
              'INSERT INTO categories (id, name, icon, is_builtin) VALUES (?, ?, ?, ?)',
              [cat.id, cat.name, cat.icon, cat.is_builtin]
            );
          }
        }

        const countRow = await driver.queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM categories'
        );
        setCategoriesCount(countRow?.count ?? 0);
        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize local SQLite database:', err);
        setIsReady(true);
      }
    }

    setupDatabase();
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
          Initializing offline financial ledger...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>biyong</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Local-First Financial Ledger
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.accentSubtle }]}>
            <Text style={[styles.badgeText, { color: colors.accentPrimary }]}>
              OFFLINE READY
            </Text>
          </View>
        </View>

        {/* Theme Selectors */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Theme Preset</Text>
          <View style={styles.buttonRow}>
            {ACCENT_OPTIONS.map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => setAccent(a)}
                style={[
                  styles.themeButton,
                  {
                    backgroundColor: accent === a ? colors.accentPrimary : colors.surfaceSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    { color: accent === a ? colors.accentForeground : colors.textSecondary },
                  ]}
                >
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.buttonRow, { marginTop: 10 }]}>
            {(['dark', 'light'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setThemeMode(m)}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: themeMode === m ? colors.accentPrimary : colors.surfaceSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    { color: themeMode === m ? colors.accentForeground : colors.textSecondary },
                  ]}
                >
                  {m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Wealth Summary */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>NET WORTH</Text>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
            {formatMoney(accountBalanceMinor, 'INR')}
          </Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>
            100% Offline • Stored as integer minor units
          </Text>
        </View>

        {/* SQLite Status */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Local Database</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
            SQLite engine initialized: <Text style={{ color: colors.accentPrimary, fontWeight: 'bold' }}>Active</Text>
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
            Categories seeded: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{categoriesCount}</Text>
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
            Zero server requirement for personal financial tracking.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  cardSub: {
    fontSize: 12,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  themeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
