import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { GroupExpense, SplitAllocationSchema } from '@biyong/schemas';
import { formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddGroupExpenseModalProps {
  visible: boolean;
  onClose: () => void;
}

type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

export const AddGroupExpenseModal: React.FC<AddGroupExpenseModalProps> = ({ visible, onClose }) => {
  const { colors, tokens } = useAppTheme();
  const { activeGroup, activeGroupMembers, addGroupExpense } = useLedger();

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState('');

  // Payer state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState('');
  const [multiPayerAmounts, setMultiPayerAmounts] = useState<Record<string, string>>({});

  // Split method state
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [equalInvolved, setEqualInvolved] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize defaults when modal becomes visible or members change
  useEffect(() => {
    if (visible && activeGroupMembers.length > 0) {
      if (!singlePayerId || !activeGroupMembers.some((m) => m.id === singlePayerId)) {
        setSinglePayerId(activeGroupMembers[0].id);
      }
      const initialEqual: Record<string, boolean> = {};
      const initialShares: Record<string, string> = {};
      activeGroupMembers.forEach((m) => {
        initialEqual[m.id] = true;
        initialShares[m.id] = '1';
      });
      setEqualInvolved(initialEqual);
      setShares(initialShares);
    }
  }, [visible, activeGroupMembers]);

  const currency = activeGroup?.currency ?? 'INR';
  const totalVal = parseFloat(amountStr);
  const totalAmountMinor = !isNaN(totalVal) && totalVal > 0 ? Math.round(totalVal * 100) : 0;

  // Real-time calculation helpers
  const multiPayerSumMinor = activeGroupMembers.reduce((sum, m) => {
    const val = parseFloat(multiPayerAmounts[m.id] || '0');
    return sum + (!isNaN(val) && val > 0 ? Math.round(val * 100) : 0);
  }, 0);

  const exactSumMinor = activeGroupMembers.reduce((sum, m) => {
    const val = parseFloat(exactAmounts[m.id] || '0');
    return sum + (!isNaN(val) && val > 0 ? Math.round(val * 100) : 0);
  }, 0);

  const percentageSum = activeGroupMembers.reduce((sum, m) => {
    const val = parseFloat(percentages[m.id] || '0');
    return sum + (!isNaN(val) ? val : 0);
  }, 0);

  const totalSharesCount = activeGroupMembers.reduce((sum, m) => {
    const val = parseInt(shares[m.id] || '0', 10);
    return sum + (!isNaN(val) && val > 0 ? val : 0);
  }, 0);

  const handleToggleEqual = (memberId: string) => {
    setEqualInvolved((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!activeGroup) {
      setError('No active group selected.');
      return;
    }

    if (!title.trim()) {
      setError('Please provide an expense title.');
      return;
    }

    if (isNaN(totalVal) || totalVal <= 0) {
      setError('Please provide a valid total amount.');
      return;
    }

    // Validate Payers
    let payers: { memberId: string; amountMinor: number }[] = [];
    if (!isMultiPayer) {
      if (!singlePayerId) {
        setError('Please select who paid.');
        return;
      }
      payers = [{ memberId: singlePayerId, amountMinor: totalAmountMinor }];
    } else {
      payers = activeGroupMembers
        .map((m) => {
          const val = parseFloat(multiPayerAmounts[m.id] || '0');
          return {
            memberId: m.id,
            amountMinor: !isNaN(val) && val > 0 ? Math.round(val * 100) : 0,
          };
        })
        .filter((p) => p.amountMinor > 0);

      const sum = payers.reduce((acc, p) => acc + p.amountMinor, 0);
      if (sum !== totalAmountMinor) {
        setError(
          `Payer sum (${formatMoney(sum, currency)}) does not equal total expense (${formatMoney(totalAmountMinor, currency)}).`
        );
        return;
      }
    }

    // Validate Splits & build allocations
    let allocations: Array<{
      memberId: string;
      amountMinor?: number;
      percentage?: number;
      shares?: number;
    }> = [];

    if (splitMethod === 'equal') {
      const involved = activeGroupMembers.filter((m) => equalInvolved[m.id]);
      if (involved.length === 0) {
        setError('At least one member must be selected for equal split.');
        return;
      }
      allocations = involved.map((m) => ({ memberId: m.id }));
    } else if (splitMethod === 'exact') {
      allocations = activeGroupMembers
        .map((m) => {
          const val = parseFloat(exactAmounts[m.id] || '0');
          return {
            memberId: m.id,
            amountMinor: !isNaN(val) && val > 0 ? Math.round(val * 100) : 0,
          };
        })
        .filter((a) => (a.amountMinor ?? 0) > 0);

      const sum = allocations.reduce((acc, a) => acc + (a.amountMinor ?? 0), 0);
      if (sum !== totalAmountMinor) {
        setError(
          `Exact split sum (${formatMoney(sum, currency)}) does not match total (${formatMoney(totalAmountMinor, currency)}).`
        );
        return;
      }
    } else if (splitMethod === 'percentage') {
      allocations = activeGroupMembers
        .map((m) => {
          const val = parseFloat(percentages[m.id] || '0');
          return {
            memberId: m.id,
            percentage: !isNaN(val) && val > 0 ? val : 0,
          };
        })
        .filter((a) => (a.percentage ?? 0) > 0);

      if (Math.round(percentageSum) !== 100) {
        setError(`Split percentages must sum to 100% (currently ${percentageSum.toFixed(1)}%).`);
        return;
      }
    } else if (splitMethod === 'shares') {
      allocations = activeGroupMembers
        .map((m) => {
          const val = parseInt(shares[m.id] || '0', 10);
          return {
            memberId: m.id,
            shares: !isNaN(val) && val > 0 ? val : 0,
          };
        })
        .filter((a) => (a.shares ?? 0) > 0);

      if (totalSharesCount <= 0) {
        setError('Total shares must be at least 1.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await addGroupExpense({
        groupId: activeGroup.id,
        title: title.trim(),
        amountMinor: totalAmountMinor,
        currency,
        date: date || new Date().toISOString().substring(0, 10),
        createdByMemberId: payers[0]?.memberId ?? activeGroupMembers[0].id,
        payers,
        splitMethod,
        allocations,
        notes: notes.trim() || null,
      });

      // Reset form
      setTitle('');
      setAmountStr('');
      setNotes('');
      setIsMultiPayer(false);
      setMultiPayerAmounts({});
      setExactAmounts({});
      setPercentages({});
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add expense.');
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
              <Ionicons name="receipt-outline" size={20} color={colors.accentPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Group Expense</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.danger, borderRadius: tokens.radius.sm },
                ]}
              >
                <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: '600' }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Dinner, Villa Booking, Fuel"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
                autoFocus
              />
            </View>

            {/* Amount and Date row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1.2 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  AMOUNT ({currency})
                </Text>
                <TextInput
                  value={amountStr}
                  onChangeText={setAmountStr}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: tokens.radius.md,
                      fontWeight: '700',
                      fontSize: 16,
                    },
                  ]}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DATE</Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: tokens.radius.md,
                      fontSize: 14,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Paid By Section */}
            <View style={styles.inputGroup}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PAID BY</Text>
                <TouchableOpacity
                  onPress={() => setIsMultiPayer(!isMultiPayer)}
                  style={styles.toggleTextBtn}
                >
                  <Text style={[styles.toggleText, { color: colors.accentPrimary }]}>
                    {isMultiPayer ? 'Single Payer' : 'Multiple Payers'}
                  </Text>
                </TouchableOpacity>
              </View>

              {!isMultiPayer ? (
                /* Single Payer Pills */
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {activeGroupMembers.map((member) => {
                    const isSelected = singlePayerId === member.id;
                    return (
                      <TouchableOpacity
                        key={member.id}
                        onPress={() => setSinglePayerId(member.id)}
                        style={[
                          styles.memberPill,
                          {
                            backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.memberPillText,
                            { color: isSelected ? colors.accentForeground : colors.textPrimary },
                          ]}
                        >
                          {member.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                /* Multiple Payers breakdown */
                <View
                  style={[
                    styles.multiPayerBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: tokens.radius.md },
                  ]}
                >
                  {activeGroupMembers.map((member) => (
                    <View key={member.id} style={styles.memberInputLine}>
                      <Text style={[styles.memberLineName, { color: colors.textPrimary }]}>
                        {member.name}
                      </Text>
                      <TextInput
                        value={multiPayerAmounts[member.id] ?? ''}
                        onChangeText={(t) =>
                          setMultiPayerAmounts((prev) => ({ ...prev, [member.id]: t }))
                        }
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        style={[
                          styles.memberNumberInput,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.textPrimary,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      />
                    </View>
                  ))}
                  <View style={[styles.sumFeedbackRow, { borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Total paid: {formatMoney(multiPayerSumMinor, currency)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color:
                          multiPayerSumMinor === totalAmountMinor ? colors.success : colors.danger,
                      }}
                    >
                      {multiPayerSumMinor === totalAmountMinor
                        ? 'Matches Total'
                        : `Diff: ${formatMoney(Math.abs(totalAmountMinor - multiPayerSumMinor), currency)}`}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Split Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>SPLIT METHOD</Text>
              <View style={styles.methodSelectorWrap}>
                {(['equal', 'exact', 'percentage', 'shares'] as SplitMethod[]).map((m) => {
                  const isSelected = splitMethod === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSplitMethod(m)}
                      style={[
                        styles.methodChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          { color: isSelected ? colors.accentForeground : colors.textSecondary },
                        ]}
                      >
                        {m.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Split Method Content */}
              {splitMethod === 'equal' && (
                <View
                  style={[
                    styles.methodContainer,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: tokens.radius.md },
                  ]}
                >
                  <Text style={[styles.splitHint, { color: colors.textSecondary }]}>
                    Select members sharing this cost equally:
                  </Text>
                  <View style={styles.equalChipsWrap}>
                    {activeGroupMembers.map((member) => {
                      const isInv = !!equalInvolved[member.id];
                      return (
                        <TouchableOpacity
                          key={member.id}
                          onPress={() => handleToggleEqual(member.id)}
                          style={[
                            styles.equalChip,
                            {
                              backgroundColor: isInv ? colors.accentPrimary : colors.surface,
                              borderColor: isInv ? colors.accentPrimary : colors.border,
                              borderRadius: tokens.radius.sm,
                            },
                          ]}
                        >
                          <Ionicons
                            name={isInv ? 'checkbox' : 'square-outline'}
                            size={16}
                            color={isInv ? colors.accentForeground : colors.textSecondary}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '600',
                              color: isInv ? colors.accentForeground : colors.textPrimary,
                            }}
                          >
                            {member.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {splitMethod === 'exact' && (
                <View
                  style={[
                    styles.methodContainer,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: tokens.radius.md },
                  ]}
                >
                  {activeGroupMembers.map((member) => (
                    <View key={member.id} style={styles.memberInputLine}>
                      <Text style={[styles.memberLineName, { color: colors.textPrimary }]}>
                        {member.name}
                      </Text>
                      <TextInput
                        value={exactAmounts[member.id] ?? ''}
                        onChangeText={(t) =>
                          setExactAmounts((prev) => ({ ...prev, [member.id]: t }))
                        }
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        style={[
                          styles.memberNumberInput,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.textPrimary,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      />
                    </View>
                  ))}
                  <View style={[styles.sumFeedbackRow, { borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Allocated: {formatMoney(exactSumMinor, currency)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: exactSumMinor === totalAmountMinor ? colors.success : colors.danger,
                      }}
                    >
                      {exactSumMinor === totalAmountMinor
                        ? 'Exact Match'
                        : `Remaining: ${formatMoney(totalAmountMinor - exactSumMinor, currency)}`}
                    </Text>
                  </View>
                </View>
              )}

              {splitMethod === 'percentage' && (
                <View
                  style={[
                    styles.methodContainer,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: tokens.radius.md },
                  ]}
                >
                  {activeGroupMembers.map((member) => (
                    <View key={member.id} style={styles.memberInputLine}>
                      <Text style={[styles.memberLineName, { color: colors.textPrimary }]}>
                        {member.name}
                      </Text>
                      <View style={styles.inputWithUnitRow}>
                        <TextInput
                          value={percentages[member.id] ?? ''}
                          onChangeText={(t) =>
                            setPercentages((prev) => ({ ...prev, [member.id]: t }))
                          }
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          style={[
                            styles.memberNumberInput,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              color: colors.textPrimary,
                              borderRadius: tokens.radius.sm,
                            },
                          ]}
                        />
                        <Text style={{ color: colors.textSecondary, marginLeft: 6, fontWeight: 'bold' }}>
                          %
                        </Text>
                      </View>
                    </View>
                  ))}
                  <View style={[styles.sumFeedbackRow, { borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Total Percentage: {percentageSum.toFixed(1)}%
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color:
                          Math.round(percentageSum) === 100 ? colors.success : colors.danger,
                      }}
                    >
                      {Math.round(percentageSum) === 100
                        ? '100% Allocated'
                        : `Diff: ${(100 - percentageSum).toFixed(1)}%`}
                    </Text>
                  </View>
                </View>
              )}

              {splitMethod === 'shares' && (
                <View
                  style={[
                    styles.methodContainer,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: tokens.radius.md },
                  ]}
                >
                  <Text style={[styles.splitHint, { color: colors.textSecondary }]}>
                    Assign relative weight/shares (e.g. 1 share, 2 shares):
                  </Text>
                  {activeGroupMembers.map((member) => (
                    <View key={member.id} style={styles.memberInputLine}>
                      <Text style={[styles.memberLineName, { color: colors.textPrimary }]}>
                        {member.name}
                      </Text>
                      <TextInput
                        value={shares[member.id] ?? ''}
                        onChangeText={(t) =>
                          setShares((prev) => ({ ...prev, [member.id]: t }))
                        }
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        style={[
                          styles.memberNumberInput,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.textPrimary,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      />
                    </View>
                  ))}
                  <View style={[styles.sumFeedbackRow, { borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Total Shares: {totalSharesCount}
                    </Text>
                    <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>
                      {totalSharesCount > 0 ? 'Calculated automatically' : 'Enter shares'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional details..."
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={[
                styles.submitButton,
                {
                  backgroundColor: colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.submitButtonText, { color: colors.accentForeground }]}>
                Add Expense
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '92%',
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
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  errorBanner: {
    padding: 10,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleTextBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  memberPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  memberPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  multiPayerBox: {
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  memberInputLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberLineName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberNumberInput: {
    width: 100,
    height: 38,
    borderWidth: 1,
    paddingHorizontal: 10,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  inputWithUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sumFeedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  methodSelectorWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  methodChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
  },
  methodChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  methodContainer: {
    padding: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
  },
  splitHint: {
    fontSize: 12,
    marginBottom: 4,
  },
  equalChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
