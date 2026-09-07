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

interface AddReimbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = ['work', 'travel', 'medical', 'insurance', 'other'] as const;

export const AddReimbursementModal: React.FC<AddReimbursementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { colors, tokens } = useAppTheme();
  const { createReimbursement } = useLedger();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('work');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setCategory('work');
    setAmountStr('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a claim title / description.');
      return;
    }
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive claim amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const amountMinor = Math.round(parsedAmount * 100);
      const today = new Date().toISOString().slice(0, 10);

      await createReimbursement({
        title: title.trim(),
        category,
        amountMinor,
        currency: 'INR',
        submittedDate: today,
        status: 'pending',
        notes: notes.trim() || null,
        transactionId: null,
        receiptUri: null,
        settledDate: null,
      });
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit reimbursement claim.');
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
              New Reimbursement Claim
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </HStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack space="md">
              {/* Category Pills */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  CLAIM CATEGORY
                </Text>
                <HStack space="xs" flexWrap="wrap">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategory(cat)}
                        style={[
                          styles.categoryPill,
                          {
                            backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          fontSize={12}
                          fontWeight="600"
                          color={isSelected ? colors.accentForeground : colors.textPrimary}
                          textTransform="capitalize"
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </HStack>
              </VStack>

              {/* Title */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  CLAIM TITLE
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Flight to Mumbai, Client Dinner"
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
                  AMOUNT (INR)
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
                  placeholder="e.g. Bill reference #10492"
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
                  {isSubmitting ? 'Submitting...' : 'Record Claim'}
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
    maxHeight: '80%',
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
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
