import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Text, VStack, HStack } from '@gluestack-ui/themed';
import { formatMoney } from '@biyong/domain';
import type { PeerDebt } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface RepayPeerDebtModalProps {
  debt: PeerDebt | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RepayPeerDebtModal: React.FC<RepayPeerDebtModalProps> = ({ debt, isOpen, onClose }) => {
  const { colors, tokens } = useAppTheme();
  const { repayPeerDebt } = useLedger();

  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!debt) return null;

  const remainingFormatted = formatMoney(debt.remainingAmountMinor, debt.currency);

  const handleClose = () => {
    setAmountStr('');
    setNotes('');
    setError(null);
    onClose();
  };

  const handleQuickPayFull = () => {
    setAmountStr((debt.remainingAmountMinor / 100).toString());
  };

  const handleSubmit = async () => {
    const parsed = parseFloat(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }
    const paymentMinor = Math.round(parsed * 100);

    setIsSubmitting(true);
    setError(null);
    try {
      await repayPeerDebt(debt.id, paymentMinor, notes.trim() || undefined);
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record repayment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <HStack justifyContent="space-between" alignItems="center" mb={16}>
            <VStack>
              <Text fontSize={18} fontWeight="bold" color={colors.textPrimary}>
                Record Repayment
              </Text>
              <Text fontSize={13} color={colors.textSecondary}>
                {debt.type === 'lent' ? `Payment from ${debt.personName}` : `Payment to ${debt.personName}`}
              </Text>
            </VStack>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </HStack>

          <VStack space="md">
            {/* Outstanding Balance Banner */}
            <Box
              p={12}
              borderRadius={8}
              backgroundColor={colors.surfaceSubtle}
              borderWidth={1}
              borderColor={colors.border}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                  Current Balance:
                </Text>
                <Text color={colors.textPrimary} fontSize={16} fontWeight="bold">
                  {remainingFormatted}
                </Text>
              </HStack>
            </Box>

            {/* Amount input & Full Pay chip */}
            <VStack space="xs">
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  REPAYMENT AMOUNT (INR)
                </Text>
                <TouchableOpacity onPress={handleQuickPayFull}>
                  <Text color={colors.accentPrimary} fontSize={12} fontWeight="bold">
                    Pay Full Balance
                  </Text>
                </TouchableOpacity>
              </HStack>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
            </VStack>

            {/* Notes */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                NOTES (OPTIONAL)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. UPI transfer, cash received"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
            </VStack>

            {error && (
              <Box p={10} bg={colors.danger + '15'} borderRadius={8}>
                <Text color={colors.danger} fontSize={13} fontWeight="600">
                  {error}
                </Text>
              </Box>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: colors.accentPrimary,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              <Text color={colors.accentForeground} fontSize={15} fontWeight="bold">
                {isSubmitting ? 'Recording...' : 'Confirm Repayment'}
              </Text>
            </TouchableOpacity>
          </VStack>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
});
