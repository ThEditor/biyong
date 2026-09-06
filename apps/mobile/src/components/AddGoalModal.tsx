import React, { useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({ visible, onClose }) => {
  const { colors, tokens } = useAppTheme();
  const { createGoal } = useLedger();

  const [title, setTitle] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [initialAmountStr, setInitialAmountStr] = useState('0');
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return formatDate(d);
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets = [
    {
      label: '3 Months',
      getDate: () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return formatDate(d);
      },
    },
    {
      label: '6 Months',
      getDate: () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        return formatDate(d);
      },
    },
    {
      label: '1 Year',
      getDate: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return formatDate(d);
      },
    },
    {
      label: '2 Years',
      getDate: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 2);
        return formatDate(d);
      },
    },
  ];

  const parsedTarget = parseFloat(targetAmountStr);
  const previewTargetMinor =
    !isNaN(parsedTarget) && parsedTarget > 0 ? Math.round(parsedTarget * 100) : 0;

  const parsedInitial = parseFloat(initialAmountStr);
  const previewInitialMinor =
    !isNaN(parsedInitial) && parsedInitial >= 0 ? Math.round(parsedInitial * 100) : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Please provide a goal title.');
      return;
    }

    const targetVal = parseFloat(targetAmountStr);
    if (isNaN(targetVal) || targetVal <= 0) {
      setError('Please enter a valid target amount greater than 0.');
      return;
    }

    const initialVal = parseFloat(initialAmountStr);
    if (isNaN(initialVal) || initialVal < 0) {
      setError('Initial saved amount cannot be negative.');
      return;
    }

    if (!targetDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())) {
      setError('Please provide a valid target date in YYYY-MM-DD format.');
      return;
    }

    const targetAmountMinor = Math.round(targetVal * 100);
    const currentAmountMinor = Math.round(initialVal * 100);

    setIsSubmitting(true);
    try {
      await createGoal({
        title: title.trim(),
        targetAmountMinor,
        currentAmountMinor,
        targetDate: targetDate.trim(),
      });
      setTitle('');
      setTargetAmountStr('');
      setInitialAmountStr('0');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create goal.');
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
              Create Financial Goal
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

            {/* Goal Title */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                GOAL TITLE
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Emergency Fund, New Laptop, Home Down Payment"
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
            </VStack>

            {/* Target Amount */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                TARGET AMOUNT (INR)
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
                  value={targetAmountStr}
                  onChangeText={setTargetAmountStr}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                />
              </Box>
              <Text color={colors.textMuted} fontSize={11} mt={2}>
                Target: {formatMoney(previewTargetMinor, 'INR')}
              </Text>
            </VStack>

            {/* Initial Amount Saved */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                ALREADY SAVED (INR, OPTIONAL)
              </Text>
              <TextInput
                value={initialAmountStr}
                onChangeText={setInitialAmountStr}
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
                  },
                ]}
              />
              <Text color={colors.textMuted} fontSize={11} mt={2}>
                Starting balance: {formatMoney(previewInitialMinor, 'INR')}
              </Text>
            </VStack>

            {/* Target Date */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                TARGET COMPLETION DATE
              </Text>
              <TextInput
                value={targetDate}
                onChangeText={setTargetDate}
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

              {/* Date Presets */}
              <HStack space="xs" mt={6}>
                {presets.map((p) => {
                  const pDate = p.getDate();
                  const isSelected = targetDate === pDate;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      onPress={() => setTargetDate(pDate)}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        color={isSelected ? colors.accentForeground : colors.textSecondary}
                        fontSize={11}
                        fontWeight="600"
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </HStack>
            </VStack>

            {/* Submit Button */}
            <Button
              onPress={handleSubmit}
              disabled={isSubmitting}
              backgroundColor={colors.accentPrimary}
              borderRadius={tokens.radius.md}
              py={14}
              mt={8}
              opacity={isSubmitting ? 0.6 : 1}
            >
              <ButtonText color={colors.accentForeground} fontSize={15} fontWeight="bold" letterSpacing={0.5}>
                Create Goal
              </ButtonText>
            </Button>
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
    fontSize: 15,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderWidth: 1,
  },
});
