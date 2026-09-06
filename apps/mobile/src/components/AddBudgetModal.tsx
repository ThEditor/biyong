import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddBudgetModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddBudgetModal: React.FC<AddBudgetModalProps> = ({ visible, onClose }) => {
  const { colors, tokens } = useAppTheme();
  const { categories, budgets, createBudget } = useLedger();

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.id !== 'cat-salary');
  }, [categories]);

  const [categoryId, setCategoryId] = useState<string>(
    expenseCategories[0]?.id ?? ''
  );
  const [amountStr, setAmountStr] = useState<string>('');
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [rollover, setRollover] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Set default category when modal opens
  React.useEffect(() => {
    if (visible && expenseCategories.length > 0 && !categoryId) {
      setCategoryId(expenseCategories[0].id);
    }
  }, [visible, expenseCategories, categoryId]);

  const parsedVal = parseFloat(amountStr);
  const previewMinor = !isNaN(parsedVal) && parsedVal > 0 ? Math.round(parsedVal * 100) : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!categoryId) {
      setError('Please select a category for this budget.');
      return;
    }

    const val = parseFloat(amountStr);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid budget amount greater than 0.');
      return;
    }

    // Check if a budget already exists for this category
    const existing = budgets.find((b) => b.categoryId === categoryId);
    if (existing) {
      setError('A budget already exists for this category.');
      return;
    }

    const amountMinor = Math.round(val * 100);

    setIsSubmitting(true);
    try {
      await createBudget({
        categoryId,
        amountMinor,
        period,
        rollover,
      });
      setAmountStr('');
      setRollover(false);
      setPeriod('monthly');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create budget.');
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
              Set Category Budget
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
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

            {/* Category Selector */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                EXPENSE CATEGORY
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {expenseCategories.map((cat) => {
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

            {/* Budget Amount */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                BUDGET AMOUNT (INR)
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
                  autoFocus
                />
              </Box>
              <Text color={colors.textMuted} fontSize={11} mt={2}>
                Budget limit: {formatMoney(previewMinor, 'INR')}
              </Text>
            </VStack>

            {/* Period Selector */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                BUDGET PERIOD
              </Text>
              <Box
                flexDirection="row"
                p={4}
                backgroundColor={colors.surfaceSubtle}
                borderRadius={tokens.radius.sm}
              >
                {(['monthly', 'weekly'] as const).map((p) => {
                  const isSelected = period === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPeriod(p)}
                      style={[
                        styles.periodButton,
                        isSelected && {
                          backgroundColor: colors.accentPrimary,
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
                        {p === 'monthly' ? 'MONTHLY' : 'WEEKLY'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </Box>
            </VStack>

            {/* Rollover Toggle */}
            <TouchableOpacity
              onPress={() => setRollover(!rollover)}
              activeOpacity={0.8}
              style={[
                styles.rolloverRow,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <HStack space="md" alignItems="center" flex={1}>
                <Box
                  width={22}
                  height={22}
                  borderWidth={1.5}
                  borderRadius={4}
                  borderColor={colors.accentPrimary}
                  backgroundColor={rollover ? colors.accentPrimary : 'transparent'}
                  alignItems="center"
                  justifyContent="center"
                >
                  {rollover && (
                    <Ionicons name="checkmark" size={14} color={colors.accentForeground} />
                  )}
                </Box>
                <VStack flex={1}>
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                    Rollover Unspent Balance
                  </Text>
                  <Text color={colors.textSecondary} fontSize={11} mt={1}>
                    Surplus balance from previous period carries forward to increase this period's budget.
                  </Text>
                </VStack>
              </HStack>
            </TouchableOpacity>

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
                Set Budget
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
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolloverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
  },
});
