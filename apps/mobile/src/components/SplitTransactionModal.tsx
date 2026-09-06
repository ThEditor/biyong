import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type { Transaction } from '@biyong/schemas';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import { formatMoney } from '@biyong/domain';

export interface SplitTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSplitSuccess?: () => void;
}

export const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({
  visible,
  onClose,
  transaction,
  onSplitSuccess,
}) => {
  const { colors, tokens } = useAppTheme();
  const { groups, splitTransactionIntoGroup, selectGroup } = useLedger();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(() =>
    groups.length > 0 ? groups[0].id : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transaction) return null;

  const handleSplit = async () => {
    if (!selectedGroupId) {
      setError('Please select a group to split this transaction with.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await splitTransactionIntoGroup(transaction.id, selectedGroupId, 'equal');
      await selectGroup(selectedGroupId);
      if (onSplitSuccess) {
        onSplitSuccess();
      }
      onClose();
      Alert.alert(
        'Transaction Split',
        `Successfully added ${formatMoney(transaction.amountMinor, transaction.currency)} to the group!`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to split transaction into group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="git-branch-outline" size={20} color={colors.accentPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Split into Group</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody}>
            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.danger }]}>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{error}</Text>
              </View>
            )}

            {/* Transaction Preview Card */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <View style={styles.previewTop}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                  TRANSACTION TO SPLIT
                </Text>
                <Text style={[styles.previewDate, { color: colors.textMuted }]}>
                  {transaction.date}
                </Text>
              </View>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
                {transaction.merchant || transaction.notes || 'Expense'}
              </Text>
              <Text style={[styles.previewAmount, { color: colors.accentPrimary }]}>
                {formatMoney(transaction.amountMinor, transaction.currency)}
              </Text>
            </View>

            {/* Group Selection */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                SELECT SPLIT GROUP
              </Text>

              {groups.length === 0 ? (
                <View
                  style={[
                    styles.noGroupsBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.noGroupsText, { color: colors.textSecondary }]}>
                    No groups available. Please create or join a group first.
                  </Text>
                </View>
              ) : (
                <View style={styles.groupsList}>
                  {groups.map((grp) => {
                    const isSelected = selectedGroupId === grp.id;
                    return (
                      <TouchableOpacity
                        key={grp.id}
                        onPress={() => setSelectedGroupId(grp.id)}
                        style={[
                          styles.groupOption,
                          {
                            backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.md,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View
                            style={[
                              styles.groupIconBox,
                              {
                                backgroundColor: isSelected ? colors.accentPrimary : colors.surface,
                              },
                            ]}
                          >
                            <Ionicons
                              name={grp.isPrivate ? 'shield-outline' : 'globe-outline'}
                              size={16}
                              color={isSelected ? colors.accentForeground : colors.accentPrimary}
                            />
                          </View>
                          <View>
                            <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                              {grp.name}
                            </Text>
                            <Text style={[styles.groupMeta, { color: colors.textMuted }]}>
                              {grp.isPrivate ? 'Private offline' : 'Shared synced'} • {grp.currency}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? colors.accentPrimary : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Split Method Explanation */}
            <View
              style={[
                styles.noteBox,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.sm,
                },
              ]}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.accentPrimary} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                This expense will be added to the group with you as the payer, and divided equally among all group members.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Submit Button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleSplit}
              disabled={isSubmitting || groups.length === 0}
              style={[
                styles.splitSubmitBtn,
                {
                  backgroundColor: groups.length === 0 ? colors.border : colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.splitSubmitBtnText, { color: colors.accentForeground }]}>
                {isSubmitting ? 'Adding to Group...' : 'Confirm Group Split'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
  },
  previewCard: {
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewDate: {
    fontSize: 11,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  previewAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  inputSection: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noGroupsBox: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  noGroupsText: {
    fontSize: 13,
    textAlign: 'center',
  },
  groupsList: {
    gap: 8,
  },
  groupOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1.5,
  },
  groupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  noteText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  splitSubmitBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitSubmitBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
