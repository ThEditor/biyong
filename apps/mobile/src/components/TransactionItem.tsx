import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import type { Transaction } from '@biyong/schemas';
import { formatMoney } from '@biyong/domain';
import { useAppTheme } from '../theme/ThemeContext';

export interface TransactionItemProps {
  transaction: Transaction;
  accountName: string;
  toAccountName?: string;
  categoryName?: string;
  onPress?: (tx: Transaction) => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  accountName,
  toAccountName,
  categoryName,
  onPress,
}) => {
  const { colors, tokens } = useAppTheme();

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const isTransfer = transaction.type === 'transfer';

  // Glyph and color
  let typeGlyph = '↗';
  let typeColor = colors.danger;
  let typeBg = colors.surfaceSubtle;
  let sign = '-';

  if (isIncome) {
    typeGlyph = '↙';
    typeColor = colors.success;
    typeBg = colors.accentSubtle;
    sign = '+';
  } else if (isTransfer) {
    typeGlyph = '⇄';
    typeColor = colors.accentPrimary;
    typeBg = colors.surfaceSubtle;
    sign = '';
  }

  // Primary label
  const primaryTitle =
    transaction.merchant?.trim() ||
    categoryName ||
    (isTransfer ? 'Account Transfer' : isIncome ? 'Income' : 'Expense');

  // Secondary description
  let secondarySubtitle = accountName;
  if (isTransfer && toAccountName) {
    secondarySubtitle = `${accountName} → ${toAccountName}`;
  } else if (categoryName && transaction.merchant) {
    secondarySubtitle = `${categoryName} • ${accountName}`;
  }

  // Date formatting (YYYY-MM-DD -> DD MMM)
  let dateFormatted = transaction.date;
  try {
    const parts = transaction.date.split('-');
    if (parts.length >= 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
  } catch {
    dateFormatted = transaction.date.slice(0, 10);
  }

  const formattedAmount = `${sign}${formatMoney(transaction.amountMinor, 'INR')}`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress?.(transaction)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: tokens.radius.md,
          padding: tokens.spacing.md,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: typeBg, borderRadius: tokens.radius.sm }]}>
        <Text style={[styles.iconText, { color: typeColor }]}>{typeGlyph}</Text>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.topRow}>
          <Text
            style={[styles.primaryTitle, { color: colors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {primaryTitle}
          </Text>
          <Text
            style={[
              styles.amountText,
              {
                color: isIncome ? colors.success : colors.textPrimary,
              },
            ]}
          >
            {formattedAmount}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text
            style={[styles.secondarySubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {secondarySubtitle}
            {transaction.notes ? ` • ${transaction.notes}` : ''}
          </Text>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{dateFormatted}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginVertical: 4,
  },
  iconContainer: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondarySubtitle: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
