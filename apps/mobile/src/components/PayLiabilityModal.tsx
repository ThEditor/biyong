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

export interface PayLiabilityModalProps {
  visible: boolean;
  onClose: () => void;
  liability: Liability | null;
}

export const PayLiabilityModal: React.FC<PayLiabilityModalProps> = ({
  visible,
  onClose,
  liability,
}) => {
  const { colors, tokens } = useAppTheme();
  const { payLiability } = useLedger();

  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPaymentAmountStr('');
    setError(null);
  }, [liability, visible]);

  if (!liability) return null;

  const parsedPayment = parseFloat(paymentAmountStr);
  const paymentMinor =
    !isNaN(parsedPayment) && parsedPayment > 0 ? Math.round(parsedPayment * 100) : 0;

  const newRemainingMinor = Math.max(0, liability.remainingAmountMinor - paymentMinor);

  const handleQuickPercent = (ratio: number) => {
    const calculatedMinor = Math.round(liability.remainingAmountMinor * ratio);
    setPaymentAmountStr((calculatedMinor / 100).toString());
    setError(null);
  };

  const handleConfirm = async () => {
    setError(null);
    if (isNaN(parsedPayment) || parsedPayment <= 0) {
      setError('Please enter a valid repayment amount greater than 0.');
      return;
    }

    if (paymentMinor > liability.remainingAmountMinor) {
      setError('Payment amount cannot exceed the remaining balance.');
      return;
    }

    setIsSubmitting(true);
    try {
      await payLiability(liability.id, paymentMinor);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record repayment.');
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
                Record Debt Repayment
              </Text>
              <Text color={colors.textSecondary} fontSize={12} mt={2}>
                {liability.name} ({liability.type.toUpperCase()})
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

            {/* Current Balance & Rate Overview Card */}
            <Box
              backgroundColor={colors.background}
              p={16}
              borderRadius={tokens.radius.md}
              borderWidth={1}
              borderColor={colors.border}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                    Current Outstanding
                  </Text>
                  <Text color={colors.textPrimary} fontSize={22} fontWeight="800" mt={4}>
                    {formatMoney(liability.remainingAmountMinor, liability.currency)}
                  </Text>
                </VStack>
                <VStack alignItems="flex-end">
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                    Interest Rate
                  </Text>
                  <Text color={colors.accentPrimary} fontSize={16} fontWeight="700" mt={4}>
                    {liability.interestRatePercent > 0 ? `${liability.interestRatePercent}% p.a.` : '0%'}
                  </Text>
                </VStack>
              </HStack>

              {liability.dueDate && (
                <HStack space="xs" alignItems="center" mt={12} pt={10} borderTopWidth={1} borderTopColor={colors.border}>
                  <Feather name="calendar" size={13} color={colors.textSecondary} />
                  <Text color={colors.textSecondary} fontSize={12}>
                    Next Due: {liability.dueDate}
                  </Text>
                </HStack>
              )}
            </Box>

            {/* Payment Amount Input */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Repayment Amount (INR)
              </Text>
              <TextInput
                value={paymentAmountStr}
                onChangeText={setPaymentAmountStr}
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

            {/* Quick Preset Buttons */}
            <HStack space="sm">
              <TouchableOpacity
                onPress={() => handleQuickPercent(1.0)}
                activeOpacity={0.7}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Text color={colors.textPrimary} fontSize={12} fontWeight="600">
                  Pay Full Balance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleQuickPercent(0.5)}
                activeOpacity={0.7}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Text color={colors.textPrimary} fontSize={12} fontWeight="600">
                  Pay 50%
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleQuickPercent(0.25)}
                activeOpacity={0.7}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Text color={colors.textPrimary} fontSize={12} fontWeight="600">
                  Pay 25%
                </Text>
              </TouchableOpacity>
            </HStack>

            {/* Live New Balance Projection */}
            {paymentMinor > 0 && (
              <Box
                backgroundColor="rgba(16, 185, 129, 0.1)"
                p={12}
                borderRadius={tokens.radius.md}
                borderWidth={1}
                borderColor={colors.success}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack space="xs" alignItems="center">
                    <Feather name="check-circle" size={15} color={colors.success} />
                    <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                      Balance After Payment
                    </Text>
                  </HStack>
                  <Text color={colors.success} fontSize={15} fontWeight="700">
                    {formatMoney(newRemainingMinor, liability.currency)}
                  </Text>
                </HStack>
              </Box>
            )}

            {/* Confirm Payment Button (minHeight: 48) */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.md,
                paddingVertical: 14,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 12,
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
                  ? 'Recording Payment...'
                  : `Confirm Repayment (${formatMoney(paymentMinor, liability.currency)})`}
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
    height: 48,
    fontSize: 16,
    fontWeight: '600',
  },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
