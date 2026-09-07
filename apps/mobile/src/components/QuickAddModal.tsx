import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Box,
  Text,
  Button,
  ButtonText,
  HStack,
  VStack,
} from '@gluestack-ui/themed';
import { formatMoney } from '@biyong/domain';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

export const QuickAddModal: React.FC = () => {
  const { colors, tokens } = useAppTheme();
  const {
    isAddModalOpen,
    modalInitialType,
    editingTransaction,
    closeAddModal,
    accounts,
    categories,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useLedger();

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    'daily' | 'weekly' | 'monthly' | 'yearly' | null
  >(null);
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active accounts only
  const activeAccounts = accounts.filter((a) => !a.isArchived);

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!isAddModalOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr((editingTransaction.amountMinor / 100).toString());
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId ?? '');
      setCategoryId(editingTransaction.categoryId);
      setMerchant(editingTransaction.merchant ?? '');
      setNotes(editingTransaction.notes ?? '');
      setDate(editingTransaction.date.slice(0, 10));
      setIsRecurring(editingTransaction.isRecurring);
      setRecurringFrequency(editingTransaction.recurringFrequency);
      setIsReimbursable(editingTransaction.isReimbursable ?? false);
    } else {
      setType(modalInitialType);
      setAmountStr('');
      const defaultAcc = activeAccounts[0]?.id ?? '';
      setAccountId(defaultAcc);
      const defaultToAcc = activeAccounts.length > 1 ? activeAccounts[1].id : '';
      setToAccountId(defaultToAcc);
      setCategoryId(modalInitialType === 'transfer' ? null : categories[0]?.id ?? null);
      setMerchant('');
      setNotes('');
      setDate(getTodayStr());
      setIsRecurring(false);
      setRecurringFrequency(null);
      setIsReimbursable(false);
    }
    setError(null);
  }, [isAddModalOpen, editingTransaction, modalInitialType, activeAccounts.length]);

  const parsedVal = parseFloat(amountStr);
  const previewMinor = !isNaN(parsedVal) && parsedVal > 0 ? Math.round(parsedVal * 100) : 0;

  const handleSubmit = async () => {
    setError(null);
    const parsed = parseFloat(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!accountId) {
      setError('Please select an account.');
      return;
    }

    if (type === 'transfer') {
      if (!toAccountId) {
        setError('Please select a destination account for transfer.');
        return;
      }
      if (accountId === toAccountId) {
        setError('Source and destination accounts must be different.');
        return;
      }
    }

    const amountMinor = Math.round(parsed * 100);
    const effectiveDate = date.trim() || getTodayStr();

    setIsSubmitting(true);
    try {
      if (editingTransaction) {
        await updateTransaction({
          ...editingTransaction,
          type,
          amountMinor,
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type === 'transfer' ? null : categoryId,
          merchant: merchant.trim() || null,
          notes: notes.trim() || null,
          date: effectiveDate,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency ?? 'monthly' : null,
          isReimbursable,
          reimbursementStatus: isReimbursable
            ? editingTransaction.reimbursementStatus ?? 'pending'
            : null,
          receiptAttachmentId: editingTransaction.receiptAttachmentId ?? null,
        });
      } else {
        await createTransaction({
          type,
          amountMinor,
          currency: 'INR',
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type === 'transfer' ? null : categoryId,
          merchant: merchant.trim() || null,
          notes: notes.trim() || null,
          date: effectiveDate,
          subcategory: null,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency ?? 'monthly' : null,
          isReimbursable,
          reimbursementStatus: isReimbursable ? 'pending' : null,
          receiptAttachmentId: null,
        });
      }
      closeAddModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!editingTransaction) return;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction? Account balances will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(editingTransaction.id);
              closeAddModal();
            } catch (err: any) {
              setError(err?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={isAddModalOpen}
      animationType="slide"
      transparent
      onRequestClose={closeAddModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Box
          maxHeight="90%"
          borderTopWidth={1}
          borderColor={colors.borderStrong}
          backgroundColor={colors.surface}
          borderTopLeftRadius={tokens.radius.lg}
          borderTopRightRadius={tokens.radius.lg}
        >
          {/* Header */}
          <HStack
            justifyContent="space-between"
            alignItems="center"
            px={20}
            py={16}
            borderBottomWidth={1}
            borderBottomColor={colors.border}
          >
            <Text color={colors.textPrimary} fontSize={18} fontWeight="bold">
              {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </Text>
            <TouchableOpacity onPress={closeAddModal} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </HStack>

          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {error && (
              <Box
                p={10}
                mb={4}
                backgroundColor={colors.danger}
                borderRadius={tokens.radius.sm}
              >
                <Text color={colors.accentForeground} fontSize={13} fontWeight="600">
                  {error}
                </Text>
              </Box>
            )}

            {/* Type Selector */}
            <Box
              flexDirection="row"
              p={4}
              backgroundColor={colors.surfaceSubtle}
              borderRadius={tokens.radius.sm}
            >
              {(['expense', 'income', 'transfer'] as const).map((t) => {
                const isSelected = type === t;
                let activeColor = colors.danger;
                if (t === 'income') activeColor = colors.success;
                if (t === 'transfer') activeColor = colors.accentPrimary;

                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.typeButton,
                      isSelected && {
                        backgroundColor: activeColor,
                        borderRadius: tokens.radius.sm,
                      },
                    ]}
                  >
                    <Text
                      color={isSelected ? colors.accentForeground : colors.textSecondary}
                      fontSize={12}
                      fontWeight="bold"
                      letterSpacing={0.5}
                    >
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Box>

            {/* Amount Input */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                AMOUNT (INR)
              </Text>
              <Box
                flexDirection="row"
                alignItems="center"
                borderWidth={1}
                borderColor={colors.borderStrong}
                backgroundColor={colors.surfaceSubtle}
                borderRadius={tokens.radius.md}
                px={14}
                height={52}
              >
                <Text color={colors.accentPrimary} fontSize={22} fontWeight="bold" mr={8}>
                  ₹
                </Text>
                <TextInput
                  value={amountStr}
                  onChangeText={setAmountStr}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                  autoFocus={!editingTransaction}
                />
              </Box>
              <Text color={colors.textMuted} fontSize={11} mt={2}>
                Amount: {formatMoney(previewMinor, 'INR')}
              </Text>
            </VStack>

            {/* Account Selector */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                {type === 'transfer' ? 'FROM ACCOUNT' : 'ACCOUNT'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {activeAccounts.map((acc) => {
                  const isSelected = accountId === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setAccountId(acc.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        color={isSelected ? colors.accentForeground : colors.textPrimary}
                        fontSize={13}
                        fontWeight="600"
                      >
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </VStack>

            {/* Destination Account for Transfers */}
            {type === 'transfer' && (
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  TO ACCOUNT
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {activeAccounts.map((acc) => {
                    const isSelected = toAccountId === acc.id;
                    const isSource = accountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setToAccountId(acc.id)}
                        disabled={isSource}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? colors.accentPrimary
                              : isSource
                              ? colors.border
                              : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.sm,
                            opacity: isSource ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text
                          color={isSelected ? colors.accentForeground : colors.textPrimary}
                          fontSize={13}
                          fontWeight="600"
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </VStack>
            )}

            {/* Category Selector */}
            {type !== 'transfer' && (
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  CATEGORY
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {categories.map((cat) => {
                    const isSelected = categoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCategoryId(cat.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <Text
                          color={isSelected ? colors.accentForeground : colors.textPrimary}
                          fontSize={13}
                          fontWeight="600"
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </VStack>
            )}

            {/* Merchant / Payee */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                {type === 'income' ? 'PAYER / SOURCE' : 'MERCHANT / PAYEE'}
              </Text>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder={type === 'income' ? 'e.g. Employer, Client' : 'e.g. Swiggy, Amazon, Metro'}
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
            </VStack>

            {/* Notes */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                NOTES
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional memo or description"
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
            </VStack>

            {/* Date Input */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                DATE (YYYY-MM-DD)
              </Text>
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
                  },
                ]}
              />
            </VStack>

            {/* Recurring Options */}
            <VStack space="xs">
              <TouchableOpacity
                onPress={() => setIsRecurring(!isRecurring)}
                style={styles.recurringToggleRow}
              >
                <Box
                  width={20}
                  height={20}
                  borderWidth={1.5}
                  borderRadius={4}
                  borderColor={colors.accentPrimary}
                  backgroundColor={isRecurring ? colors.accentPrimary : 'transparent'}
                  alignItems="center"
                  justifyContent="center"
                  mr={10}
                >
                  {isRecurring && (
                    <Text color={colors.accentForeground} fontSize={12} fontWeight="bold">
                      ✓
                    </Text>
                  )}
                </Box>
                <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                  Mark as Recurring Transaction
                </Text>
              </TouchableOpacity>

              {isRecurring && (
                <HStack space="xs" mt={8}>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
                    const isSelected = recurringFrequency === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        onPress={() => setRecurringFrequency(freq)}
                        style={[
                          styles.freqButton,
                          {
                            backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <Text
                          color={isSelected ? colors.accentForeground : colors.textPrimary}
                          fontSize={11}
                          fontWeight="600"
                        >
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </HStack>
              )}
            </VStack>

            {/* Reimbursable Option */}
            {type === 'expense' && (
              <VStack space="xs">
                <TouchableOpacity
                  onPress={() => setIsReimbursable(!isReimbursable)}
                  style={styles.recurringToggleRow}
                >
                  <Box
                    width={20}
                    height={20}
                    borderWidth={1.5}
                    borderRadius={4}
                    borderColor={colors.accentPrimary}
                    backgroundColor={isReimbursable ? colors.accentPrimary : 'transparent'}
                    alignItems="center"
                    justifyContent="center"
                    mr={10}
                  >
                    {isReimbursable && (
                      <Text color={colors.accentForeground} fontSize={12} fontWeight="bold">
                        ✓
                      </Text>
                    )}
                  </Box>
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                    Reimbursable (Work / Travel Claim)
                  </Text>
                </TouchableOpacity>
              </VStack>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.md,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 12,
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
                {editingTransaction ? 'Save Changes' : 'Record Transaction'}
              </Text>
            </TouchableOpacity>

            {editingTransaction && (
              <TouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.8}
                style={{
                  borderWidth: 1,
                  borderColor: colors.danger,
                  borderRadius: tokens.radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: 14,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}
                >
                  Delete Transaction
                </Text>
              </TouchableOpacity>
            )}
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
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
  },
  recurringToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  freqButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderWidth: 1,
  },
});
