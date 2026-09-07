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
import type { RecurringCadence } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CADENCES: RecurringCadence[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export const AddSubscriptionModal: React.FC<AddSubscriptionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { colors, tokens } = useAppTheme();
  const { createSubscription } = useLedger();

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [cadence, setCadence] = useState<RecurringCadence>('monthly');
  const [category, setCategory] = useState('Entertainment');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setAmountStr('');
    setCadence('monthly');
    setCategory('Entertainment');
    setNextBillingDate('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a service name (e.g. Netflix).');
      return;
    }
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid subscription cost.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const amountMinor = Math.round(parsedAmount * 100);
      const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      await createSubscription({
        name: name.trim(),
        amountMinor,
        cadence,
        category: category.trim() || 'Entertainment',
        nextBillingDate: nextBillingDate.trim() || defaultDate,
        isAutoDetected: false,
        status: 'active',
      });
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add subscription.');
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
              Add Subscription
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </HStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack space="md">
              {/* Cadence Pills */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  BILLING CYCLE
                </Text>
                <HStack space="xs">
                  {CADENCES.map((cad) => {
                    const isSelected = cadence === cad;
                    return (
                      <TouchableOpacity
                        key={cad}
                        onPress={() => setCadence(cad)}
                        style={[
                          styles.cadencePill,
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
                          {cad}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </HStack>
              </VStack>

              {/* Name */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  SERVICE / SUBSCRIPTION NAME
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Spotify Premium, iCloud 2TB"
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

              {/* Category */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  CATEGORY
                </Text>
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g. Entertainment, Software, Gym"
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

              {/* Next Billing Date */}
              <VStack space="xs">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  NEXT BILLING DATE (YYYY-MM-DD, OPTIONAL)
                </Text>
                <TextInput
                  value={nextBillingDate}
                  onChangeText={setNextBillingDate}
                  placeholder="YYYY-MM-DD"
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
                  {isSubmitting ? 'Saving...' : 'Add Subscription'}
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
  cadencePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
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
