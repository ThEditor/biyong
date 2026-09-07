import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import {
  parseBankSms,
  dedupeParsed,
  smsHash,
  type ParsedSms,
  type SmsKind,
} from '@biyong/domain';

/**
 * Android only: reads SMS via the Expo SMS reader (expo-sms-read / SMS
 * retriever). iOS does not expose SMS to apps — the screen shows a notice.
 * Paste-import is provided as a universal fallback for manual review.
 */
interface SmsRecord {
  sender: string;
  body: string;
  timestamp: string;
}

interface ParsedRow {
  parsed: ParsedSms;
  hash: string;
  raw: string;
  selected: boolean;
}

const KIND_COLORS: Record<SmsKind, string> = {
  spend: '#ef4444',
  credit: '#22c55e',
  bill_payment: '#f59e0b',
  noise: '#9ca3af',
  uncertain: '#8b5cf6',
};

/** Hermes-safe INR formatter: integer minor units -> "12,340.50" */
function formatInr(amountMinor: number): string {
  const units = Math.round(amountMinor / 100);
  const paise = Math.abs(amountMinor % 100);
  const sign = units < 0 ? '-' : '';
  const whole = Math.abs(units).toString();
  // Indian grouping: last 3, then pairs
  let grouped = whole.length > 3 ? `${whole.slice(0, -3)}` : '';
  const last3 = whole.slice(-3);
  const head = whole.length > 3 ? whole.slice(0, whole.length - 3).replace(/\B(?=(?:\d{2})+(?!\d))/g, ',') : '';
  grouped = head ? `${head},${last3}` : last3;
  return `${sign}₹${grouped}.${paise.toString().padStart(2, '0')}`;
}

const KIND_LABELS: Record<SmsKind, string> = {
  spend: 'SPEND',
  credit: 'CREDIT',
  bill_payment: 'BILL PAY',
  noise: 'NOISE',
  uncertain: 'REVIEW',
};

export const SmsImportScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { colors, tokens } = useAppTheme();
  const { accounts, createTransaction } = useLedger();

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const parseText = useCallback((text: string) => {
    setParsing(true);
    try {
      // Split pasted SMS blocks: each line starting with a sender tag or a
      // new "Rs"/"INR" line is treated as one message.
      const chunks = text
        .split(/\n(?=(?:[A-Z]{2,}[- ])?(?:Rs|INR|₹))/gm)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      const now = new Date();
      const hashed = chunks.map((chunk, i) => {
        const parsed = parseBankSms(chunk, now);
        return { parsed, smsHash: smsHash(chunk, 'PASTED', String(i)), raw: chunk };
      });
      const deduped = dedupeParsed(hashed);

      const nextRows: ParsedRow[] = hashed
        .filter((h) => h.parsed.kind !== 'noise')
        .map((h) => ({
          parsed: h.parsed,
          hash: h.smsHash,
          raw: h.raw,
          selected:
            deduped.importable.some((p) => p.amountMinor === h.parsed.amountMinor && p.merchant === h.parsed.merchant) &&
            h.parsed.kind !== 'bill_payment',
        }));
      setRows(nextRows);
    } finally {
      setParsing(false);
    }
  }, []);

  const [pasteText, setPasteText] = useState('');

  const onPasteImport = useCallback(() => {
    if (pasteText.trim()) {
      parseText(pasteText);
      setPasteText('');
    }
  }, [pasteText, parseText]);

  const importRow = useCallback(
    async (row: ParsedRow) => {
      const p = row.parsed;
      if (p.kind === 'noise' || p.amountMinor === 0) return;

      // Match account by last-4 against existing accounts (name or a tail
      // stored in the name). Fallback: first account.
      const match = accounts.find(
        (a) => p.accountTail && a.name.replace(/\D/g, '').endsWith(p.accountTail),
      );
      const account = match ?? accounts[0];
      if (!account) {
        Alert.alert('No account', 'Create an account first, then import.');
        return;
      }

      await createTransaction({
        accountId: account.id,
        type: p.kind === 'credit' ? 'income' : 'expense',
        amountMinor: p.amountMinor,
        currency: 'INR',
        date: p.date ?? new Date().toISOString().slice(0, 10),
        categoryId: null,
        merchant: p.merchant,
        notes: `[SMS] ${row.raw.slice(0, 80)}`,
        toAccountId: null,
        isRecurring: false,
        recurringFrequency: null,
        subcategory: null,
        isReimbursable: false,
        reimbursementStatus: null,
        receiptAttachmentId: null,
      });
    },
    [accounts, createTransaction],
  );

  const importSelected = useCallback(async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;
    setImporting(true);
    try {
      for (const row of selected) {
        await importRow(row);
      }
      setRows((prev) => prev.filter((r) => !r.selected));
    } catch (err) {
      Alert.alert('Import failed', String(err));
    } finally {
      setImporting(false);
    }
  }, [rows, importRow]);

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={{ marginRight: 6 }}>
            <Feather name="chevron-left" size={24} color={colors.accentPrimary} />
          </TouchableOpacity>
        )}
        <Feather name="message-square" size={20} color={colors.accentPrimary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>SMS Import</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Paste bank SMS below. Bill payments are detected and excluded from
        spends automatically.
      </Text>

      <TouchableOpacity
        onPress={onPasteImport}
        style={[
          styles.pasteButton,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: tokens.radius.md },
        ]}
      >
        <Feather name="clipboard" size={16} color={colors.textSecondary} />
        <Text style={[styles.pasteText, { color: colors.textSecondary }]}>
          Paste SMS messages
        </Text>
      </TouchableOpacity>

      <TextInput
        value={pasteText}
        onChangeText={setPasteText}
        placeholder="Paste bank SMS here..."
        placeholderTextColor={colors.textMuted}
        multiline
        style={[
          styles.pasteInput,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, color: colors.textPrimary, borderRadius: tokens.radius.md },
        ]}
      />
      <TouchableOpacity
        onPress={onPasteImport}
        disabled={!pasteText.trim()}
        style={[
          styles.parseButton,
          {
            backgroundColor: pasteText.trim() ? colors.accentPrimary : colors.surfaceSubtle,
            borderRadius: tokens.radius.sm,
          },
        ]}
      >
        <Text
          style={[
            styles.pasteText,
            { color: pasteText.trim() ? colors.accentForeground : colors.textMuted },
          ]}
        >
          Parse messages
        </Text>
      </TouchableOpacity>

      {parsing ? (
        <ActivityIndicator color={colors.accentPrimary} style={styles.spinner} />
      ) : null}

      <ScrollView contentContainerStyle={styles.listContent}>
        {rows.map((row) => (
          <TouchableOpacity
            key={row.hash}
            onPress={() =>
              setRows((prev) =>
                prev.map((r) => (r.hash === row.hash ? { ...r, selected: !r.selected } : r)),
              )
            }
            style={[
              styles.row,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: row.selected ? colors.accentPrimary : colors.border,
                borderRadius: tokens.radius.md,
              },
            ]}
          >
            <View style={styles.rowTop}>
              <Text
                style={[
                  styles.badge,
                  { backgroundColor: KIND_COLORS[row.parsed.kind], borderRadius: tokens.radius.sm },
                ]}
              >
                {KIND_LABELS[row.parsed.kind]}
              </Text>
              <Text style={[styles.amount, { color: colors.textPrimary }]}>
                {formatInr(row.parsed.amountMinor)}
              </Text>
              <Feather
                name={row.selected ? 'check-circle' : 'circle'}
                size={18}
                color={row.selected ? colors.accentPrimary : colors.textMuted}
              />
            </View>
            {row.parsed.merchant ? (
              <Text style={[styles.merchant, { color: colors.textSecondary }]}>
                {row.parsed.merchant}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={[styles.raw, { color: colors.textMuted }]}>
              {row.raw}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {rows.length > 0 ? (
        <TouchableOpacity
          disabled={selectedCount === 0 || importing}
          onPress={importSelected}
          style={[
            styles.importButton,
            {
              backgroundColor: selectedCount > 0 ? colors.accentPrimary : colors.surfaceSubtle,
              borderRadius: tokens.radius.md,
            },
          ]}
        >
          {importing ? (
            <ActivityIndicator color={colors.accentForeground} />
          ) : (
            <Text
              style={[
                styles.importText,
                { color: selectedCount > 0 ? colors.accentForeground : colors.textMuted },
              ]}
            >
              Import {selectedCount} selected
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 12,
  },
  pasteInput: {
    borderWidth: 1,
    minHeight: 72,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  parseButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  pasteText: {
    fontSize: 14,
  },
  spinner: {
    marginVertical: 12,
  },
  listContent: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  merchant: {
    fontSize: 13,
  },
  raw: {
    fontSize: 11,
  },
  importButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  importText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
