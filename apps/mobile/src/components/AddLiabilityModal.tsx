import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import {
  Box,
  Text,
  HStack,
  VStack,
} from '@gluestack-ui/themed';
import { formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { Liability } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

export interface AddLiabilityModalProps {
  visible: boolean;
  onClose: () => void;
  editingLiability?: Liability | null;
}

const LIABILITY_TYPES: { type: Liability['type']; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { type: 'loan', label: 'Loan', icon: 'home' },
  { type: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
  { type: 'emi', label: 'EMI', icon: 'calendar' },
  { type: 'bnpl', label: 'BNPL', icon: 'shopping-bag' },
  { type: 'other', label: 'Other Debt', icon: 'more-horizontal' },
];

export const AddLiabilityModal: React.FC<AddLiabilityModalProps> = ({
  visible,
  onClose,
  editingLiability,
}) => {
  const { colors, tokens } = useAppTheme();
  const { createLiability, updateLiability } = useLedger();

  const [name, setName] = useState('');
  const [type, setType] = useState<Liability['type']>('loan');
  const [principalStr, setPrincipalStr] = useState('');
  const [remainingStr, setRemainingStr] = useState('');
  const [interestRateStr, setInterestRateStr] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingLiability) {
      setName(editingLiability.name);
      setType(editingLiability.type);
      setPrincipalStr((editingLiability.principalAmountMinor / 100).toString());
      setRemainingStr((editingLiability.remainingAmountMinor / 100).toString());
      setInterestRateStr(editingLiability.interestRatePercent.toString());
      setDueDate(editingLiability.dueDate || '');
      setNotes(editingLiability.notes || '');
    } else {
      setName('');
      setType('loan');
      setPrincipalStr('');
      setRemainingStr('');
      setInterestRateStr('0');
      setDueDate('');
      setNotes('');
    }
    setError(null);
  }, [editingLiability, visible]);

  const parsedPrincipal = parseFloat(principalStr);
  const principalMinor =
    !isNaN(parsedPrincipal) && parsedPrincipal > 0 ? Math.round(parsedPrincipal * 100) : 0;

  const parsedRemaining = parseFloat(remainingStr);
  const remainingMinor =
    !isNaN(parsedRemaining) && parsedRemaining >= 0 ? Math.round(parsedRemaining * 100) : 0;

  const paidMinor = Math.max(0, principalMinor - remainingMinor);
  const paidPercent =
    principalMinor > 0 ? Math.min(100, Math.round((paidMinor / principalMinor) * 100)) : 0;

  const handleSubmit = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a liability name (e.g. Home Loan, Credit Card).');
      return;
    }

    if (isNaN(parsedPrincipal) || parsedPrincipal <= 0) {
      setError('Please enter a valid principal amount greater than 0.');
      return;
    }

    const finalRemainingMinor =
      remainingStr.trim() === '' ? principalMinor : remainingMinor;

    const interestRate = parseFloat(interestRateStr);
    if (isNaN(interestRate) || interestRate < 0) {
      setError('Interest rate must be a non-negative number.');
      return;
    }

    const trimmedDueDate = dueDate.trim();
    if (trimmedDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDueDate)) {
      setError('Due date must be in YYYY-MM-DD format.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingLiability) {
        await updateLiability({
          ...editingLiability,
          name: trimmedName,
          type,
          principalAmountMinor: principalMinor,
          remainingAmountMinor: finalRemainingMinor,
          interestRatePercent: interestRate,
          dueDate: trimmedDueDate || null,
          notes: notes.trim() || null,
        });
      } else {
        await createLiability({
          name: trimmedName,
          type,
          principalAmountMinor: principalMinor,
          remainingAmountMinor: finalRemainingMinor,
          currency: 'INR',
          interestRatePercent: interestRate,
          dueDate: trimmedDueDate || null,
          notes: notes.trim() || null,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save liability.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Box
          backgroundColor={colors.surface}
          borderTopLeftRadius={tokens.radius.lg}
          borderTopRightRadius={tokens.radius.lg}
          borderWidth={1}
          borderColor={colors.border}
          maxHeight="90%"
        >
          {/* Header */}
          <HStack
            justifyContent="space-between"
            alignItems="center"
            px={20}
            pt={18}
            pb={14}
            borderBottomWidth={1}
            borderBottomColor={colors.border}
          >
            <VStack>
              <Text color={colors.textPrimary} fontSize={17} fontWeight="700">
                {editingLiability ? 'Edit Liability' : 'Add Debt / Liability'}
              </Text>
              <Text color={colors.textSecondary} fontSize={12} mt={2}>
                Track loans, credit card balances, EMIs & BNPL
              </Text>
            </VStack>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </HStack>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {error && (
              <Box
                backgroundColor="rgba(239, 68, 68, 0.12)"
                p={12}
                borderRadius={tokens.radius.md}
                borderWidth={1}
                borderColor={colors.danger}
              >
                <HStack space="xs" alignItems="center">
                  <Feather name="alert-circle" size={16} color={colors.danger} />
                  <Text color={colors.danger} fontSize={13} fontWeight="600" flex={1}>
                    {error}
                  </Text>
                </HStack>
              </Box>
            )}

            {/* Name */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Liability Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Home Loan, SBI Credit Card, Laptop EMI"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              />
            </VStack>

            {/* Type Selector */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Type of Debt
              </Text>
              <View style={styles.typeGrid}>
                {LIABILITY_TYPES.map((t) => {
                  const isSelected = type === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => setType(t.type)}
                      activeOpacity={0.7}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.background,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Feather
                        name={t.icon}
                        size={13}
                        color={isSelected ? colors.accentForeground : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        color={isSelected ? colors.accentForeground : colors.textPrimary}
                        fontSize={12}
                        fontWeight={isSelected ? '700' : '500'}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </VStack>

            {/* Amounts Row */}
            <HStack space="md">
              {/* Principal Amount */}
              <VStack flex={1} space="xs">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Principal (INR)
                </Text>
                <TextInput
                  value={principalStr}
                  onChangeText={setPrincipalStr}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                />
              </VStack>

              {/* Outstanding Amount */}
              <VStack flex={1} space="xs">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Remaining (INR)
                </Text>
                <TextInput
                  value={remainingStr}
                  onChangeText={setRemainingStr}
                  placeholder={principalStr || '0.00'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                />
              </VStack>
            </HStack>

            {/* Payoff Progress Preview */}
            {principalMinor > 0 && (
              <Box
                backgroundColor={colors.surfaceSubtle}
                p={12}
                borderRadius={tokens.radius.md}
                borderWidth={1}
                borderColor={colors.border}
              >
                <HStack justifyContent="space-between" alignItems="center" mb={6}>
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                    Payoff Progress
                  </Text>
                  <Text color={colors.accentPrimary} fontSize={12} fontWeight="700">
                    {paidPercent}% Paid ({formatMoney(paidMinor, 'INR')})
                  </Text>
                </HStack>
                <View
                  style={{
                    height: 6,
                    backgroundColor: colors.border,
                    borderRadius: tokens.radius.full,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${paidPercent}%`,
                      backgroundColor: colors.accentPrimary,
                      borderRadius: tokens.radius.full,
                    }}
                  />
                </View>
              </Box>
            )}

            {/* Interest Rate & Due Date Row */}
            <HStack space="md">
              {/* Interest Rate */}
              <VStack flex={1} space="xs">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Interest Rate (%)
                </Text>
                <TextInput
                  value={interestRateStr}
                  onChangeText={setInterestRateStr}
                  placeholder="e.g. 8.5"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                />
              </VStack>

              {/* Due Date */}
              <VStack flex={1} space="xs">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Due Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="2026-10-05"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                />
              </VStack>
            </HStack>

            {/* Notes */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Notes (Optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Loan account number, EMI auto-debit bank, tenure"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              />
            </VStack>

            {/* Save Button (minHeight: 48 per Phase 5 learnings) */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.md,
                paddingVertical: 14,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                marginBottom: 16,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.accentForeground,
                  fontSize: 15,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                  textAlign: 'center',
                }}
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingLiability
                  ? 'Update Liability'
                  : 'Save Liability'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Box>
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
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
});
