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
  Card,
} from '@gluestack-ui/themed';
import { formatMoney } from '@biyong/domain';
import type { Goal } from '@biyong/schemas';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface ContributeGoalModalProps {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
}

export const ContributeGoalModal: React.FC<ContributeGoalModalProps> = ({
  visible,
  goal,
  onClose,
}) => {
  const { colors, tokens } = useAppTheme();
  const { contributeToGoal } = useLedger();

  const [amountStr, setAmountStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!goal) return null;

  const remainingMinor = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  const percentage =
    goal.targetAmountMinor > 0
      ? Math.min(100, Math.round((goal.currentAmountMinor / goal.targetAmountMinor) * 100))
      : 100;

  const parsedAmount = parseFloat(amountStr);
  const previewContributionMinor =
    !isNaN(parsedAmount) && parsedAmount > 0 ? Math.round(parsedAmount * 100) : 0;
  const projectedTotalMinor = goal.currentAmountMinor + previewContributionMinor;

  const handleSubmit = async () => {
    setError(null);
    const val = parseFloat(amountStr);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid contribution amount greater than 0.');
      return;
    }

    const contributionMinor = Math.round(val * 100);

    setIsSubmitting(true);
    try {
      await contributeToGoal(goal.id, contributionMinor);
      setAmountStr('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to contribute to goal.');
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
          maxHeight="85%"
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
              Add Savings to Goal
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

            {/* Goal Overview Card */}
            <Card
              backgroundColor={colors.surfaceSubtle}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                TARGET GOAL
              </Text>
              <Text color={colors.textPrimary} fontSize={16} fontWeight="bold" mt={2}>
                {goal.title}
              </Text>

              <HStack justifyContent="space-between" alignItems="center" mt={12}>
                <VStack>
                  <Text color={colors.textMuted} fontSize={10}>
                    Saved
                  </Text>
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="700">
                    {formatMoney(goal.currentAmountMinor, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="center">
                  <Text color={colors.textMuted} fontSize={10}>
                    Target
                  </Text>
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="700">
                    {formatMoney(goal.targetAmountMinor, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textMuted} fontSize={10}>
                    Remaining
                  </Text>
                  <Text color={colors.accentPrimary} fontSize={14} fontWeight="700">
                    {formatMoney(remainingMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              {/* Progress Bar */}
              <Box
                height={6}
                width="100%"
                backgroundColor={colors.border}
                borderRadius={tokens.radius.full}
                overflow="hidden"
                mt={10}
              >
                <Box
                  height="100%"
                  width={`${percentage}%`}
                  backgroundColor={colors.accentPrimary}
                  borderRadius={tokens.radius.full}
                />
              </Box>
            </Card>

            {/* Contribution Amount */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                CONTRIBUTION AMOUNT (INR)
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
              {previewContributionMinor > 0 && (
                <Text color={colors.textMuted} fontSize={11} mt={2}>
                  New balance will be: {formatMoney(projectedTotalMinor, 'INR')} (
                  {Math.min(100, Math.round((projectedTotalMinor / goal.targetAmountMinor) * 100))}%)
                </Text>
              )}
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
                Confirm Contribution
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
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
});
