import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Text, VStack, HStack } from '@gluestack-ui/themed';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddPeerDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddPeerDebtModal: React.FC<AddPeerDebtModalProps> = ({ isOpen, onClose }) => {
  const { colors, tokens } = useAppTheme();
  const { createPeerDebt } = useLedger();

  const [personName, setPersonName] = useState('');
  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPersonName('');
    setType('lent');
    setAmountStr('');
    setDueDate('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!personName.trim()) {
      setError('Please enter a contact or person name.');
      return;
    }
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const amountMinor = Math.round(parsedAmount * 100);
      const today = new Date().toISOString().slice(0, 10);

      await createPeerDebt({
        personName: personName.trim(),
        type,
        originalAmountMinor: amountMinor,
        remainingAmountMinor: amountMinor,
        currency: 'INR',
        date: today,
        dueDate: dueDate.trim() || null,
        notes: notes.trim() || null,
        status: 'active',
      });
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record peer debt.');
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
            <Text fontSize={18} fontWeight="bold" color={colors.textPrimary}>
              Add Lending or Borrowing
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </HStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack space="md">
              {/* Type Switch */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  RELATIONSHIP TYPE
                </Text>
                <HStack space="sm">
                  <TouchableOpacity
                    onPress={() => setType('lent')}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: type === 'lent' ? colors.success : colors.surfaceSubtle,
                        borderColor: type === 'lent' ? colors.success : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={16}
                      color={type === 'lent' ? colors.accentForeground : colors.success}
                    />
                    <Text
                      fontSize={13}
                      fontWeight="bold"
                      color={type === 'lent' ? colors.accentForeground : colors.textPrimary}
                      ml={6}
                    >
                      I Lent Money
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setType('borrowed')}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: type === 'borrowed' ? colors.danger : colors.surfaceSubtle,
                        borderColor: type === 'borrowed' ? colors.danger : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={16}
                      color={type === 'borrowed' ? colors.accentForeground : colors.danger}
                    />
                    <Text
                      fontSize={13}
                      fontWeight="bold"
                      color={type === 'borrowed' ? colors.accentForeground : colors.textPrimary}
                      ml={6}
                    >
                      I Borrowed Money
                    </Text>
                  </TouchableOpacity>
                </HStack>
              </VStack>

              {/* Person Name */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  PERSON / COUNTERPARTY
                </Text>
                <TextInput
                  value={personName}
                  onChangeText={setPersonName}
                  placeholder="e.g. John Doe, Sarah"
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

              {/* Amount */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  AMOUNT (₹)
                </Text>
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
                      fontSize: 16,
                      fontWeight: 'bold',
                    },
                  ]}
                />
              </VStack>

              {/* Due Date */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  DUE DATE (OPTIONAL, YYYY-MM-DD)
                </Text>
                <TextInput
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="e.g. 2026-12-31"
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
                  placeholder="Reason or context"
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
                  {isSubmitting ? 'Saving...' : 'Save Record'}
                </Text>
              </TouchableOpacity>
            </VStack>
          </ScrollView>
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
    maxHeight: '85%',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
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
