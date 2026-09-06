import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Box, Text, HStack, VStack, Button, ButtonText } from '@gluestack-ui/themed';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import type { Account } from '@biyong/schemas';

interface OnboardingModalProps {
  visible: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible }) => {
  const { colors, tokens } = useAppTheme();
  const { completeOnboarding } = useLedger();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinishWithAccount = async () => {
    setIsSubmitting(true);
    try {
      const parsedBalance = parseFloat(initialBalance.replace(/,/g, ''));
      const minor = isNaN(parsedBalance) ? 0 : Math.round(parsedBalance * 100);

      await completeOnboarding(
        accountName.trim().length > 0
          ? {
              name: accountName.trim(),
              type: accountType,
              initialBalanceMinor: minor,
            }
          : undefined
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding();
    } finally {
      setIsSubmitting(false);
    }
  };

  const ACCOUNT_TYPES: Array<{ id: Account['type']; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: 'bank', label: 'Bank', icon: 'business-outline' },
    { id: 'cash', label: 'Cash', icon: 'cash-outline' },
    { id: 'credit', label: 'Credit Card', icon: 'card-outline' },
    { id: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <Box flex={1} backgroundColor={colors.background}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Step Indicators */}
            <HStack justifyContent="center" space="sm" mt={40} mb={24}>
              {[1, 2, 3].map((s) => (
                <Box
                  key={s}
                  height={4}
                  width={step === s ? 32 : 12}
                  backgroundColor={step === s ? colors.accentPrimary : colors.border}
                  borderRadius={tokens.radius.full}
                />
              ))}
            </HStack>

            {step === 1 && (
              <VStack space="xl" alignItems="center">
                <Box
                  width={80}
                  height={80}
                  borderRadius={tokens.radius.full}
                  backgroundColor={colors.accentSubtle}
                  alignItems="center"
                  justifyContent="center"
                  mt={16}
                >
                  <Ionicons name="wallet-outline" size={42} color={colors.accentPrimary} />
                </Box>

                <VStack space="xs" alignItems="center">
                  <Text color={colors.textPrimary} fontSize={28} fontWeight="800" letterSpacing={-0.5} textAlign="center">
                    Welcome to Biyong
                  </Text>
                  <Text color={colors.textSecondary} fontSize={15} textAlign="center" mt={6} px={16} lineHeight={22}>
                    A private personal money ledger built for complete clarity over your finances.
                  </Text>
                </VStack>

                {/* Value Props */}
                <VStack space="md" width="100%" mt={16}>
                  <HStack space="md" alignItems="center" backgroundColor={colors.surface} p={14} borderRadius={tokens.radius.md} borderWidth={1} borderColor={colors.border}>
                    <Box width={36} height={36} borderRadius={tokens.radius.sm} backgroundColor={colors.surfaceSubtle} alignItems="center" justifyContent="center">
                      <Feather name="shield" size={18} color={colors.accentPrimary} />
                    </Box>
                    <VStack flex={1}>
                      <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                        100% Private & Offline
                      </Text>
                      <Text color={colors.textSecondary} fontSize={12} mt={2}>
                        Your money data never leaves your device. No cloud sync required.
                      </Text>
                    </VStack>
                  </HStack>

                  <HStack space="md" alignItems="center" backgroundColor={colors.surface} p={14} borderRadius={tokens.radius.md} borderWidth={1} borderColor={colors.border}>
                    <Box width={36} height={36} borderRadius={tokens.radius.sm} backgroundColor={colors.surfaceSubtle} alignItems="center" justifyContent="center">
                      <Feather name="check-circle" size={18} color={colors.success} />
                    </Box>
                    <VStack flex={1}>
                      <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                        Accurate Minor Units
                      </Text>
                      <Text color={colors.textSecondary} fontSize={12} mt={2}>
                        Every rupee and paise is accounted for with zero floating point drift.
                      </Text>
                    </VStack>
                  </HStack>

                  <HStack space="md" alignItems="center" backgroundColor={colors.surface} p={14} borderRadius={tokens.radius.md} borderWidth={1} borderColor={colors.border}>
                    <Box width={36} height={36} borderRadius={tokens.radius.sm} backgroundColor={colors.surfaceSubtle} alignItems="center" justifyContent="center">
                      <Feather name="repeat" size={18} color={colors.accentPrimary} />
                    </Box>
                    <VStack flex={1}>
                      <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                        Intelligent Cash Flow
                      </Text>
                      <Text color={colors.textSecondary} fontSize={12} mt={2}>
                        Transfers between accounts are cleanly isolated from your expenses.
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>

                <Button
                  onPress={() => setStep(2)}
                  backgroundColor={colors.accentPrimary}
                  borderRadius={tokens.radius.md}
                  width="100%"
                  mt={16}
                >
                  <ButtonText color={colors.accentForeground} fontSize={15} fontWeight="bold">
                    Continue
                  </ButtonText>
                </Button>
              </VStack>
            )}

            {step === 2 && (
              <VStack space="xl" alignItems="center">
                <Box
                  width={80}
                  height={80}
                  borderRadius={tokens.radius.full}
                  backgroundColor={colors.accentSubtle}
                  alignItems="center"
                  justifyContent="center"
                  mt={16}
                >
                  <Ionicons name="pie-chart-outline" size={42} color={colors.accentPrimary} />
                </Box>

                <VStack space="xs" alignItems="center">
                  <Text color={colors.textPrimary} fontSize={26} fontWeight="800" textAlign="center">
                    Simple Financial Habits
                  </Text>
                  <Text color={colors.textSecondary} fontSize={15} textAlign="center" mt={6} px={16} lineHeight={22}>
                    Understand where your money goes without tedious setup.
                  </Text>
                </VStack>

                <VStack space="md" width="100%" mt={16}>
                  <HStack space="md" alignItems="center" backgroundColor={colors.surface} p={14} borderRadius={tokens.radius.md} borderWidth={1} borderColor={colors.border}>
                    <Box width={36} height={36} borderRadius={tokens.radius.sm} backgroundColor={colors.surfaceSubtle} alignItems="center" justifyContent="center">
                      <Feather name="plus-circle" size={18} color={colors.accentPrimary} />
                    </Box>
                    <VStack flex={1}>
                      <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                        Quick Add
                      </Text>
                      <Text color={colors.textSecondary} fontSize={12} mt={2}>
                        Record transactions in 3 seconds from the floating action button.
                      </Text>
                    </VStack>
                  </HStack>

                  <HStack space="md" alignItems="center" backgroundColor={colors.surface} p={14} borderRadius={tokens.radius.md} borderWidth={1} borderColor={colors.border}>
                    <Box width={36} height={36} borderRadius={tokens.radius.sm} backgroundColor={colors.surfaceSubtle} alignItems="center" justifyContent="center">
                      <Feather name="bar-chart-2" size={18} color={colors.success} />
                    </Box>
                    <VStack flex={1}>
                      <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                        Monthly Cash Flow
                      </Text>
                      <Text color={colors.textSecondary} fontSize={12} mt={2}>
                        View your real savings rate, income vs expenses, and category trends.
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>

                <HStack space="sm" width="100%" mt={16}>
                  <Button
                    onPress={() => setStep(1)}
                    variant="outline"
                    borderColor={colors.border}
                    borderRadius={tokens.radius.md}
                    flex={1}
                  >
                    <ButtonText color={colors.textSecondary} fontSize={14} fontWeight="600">
                      Back
                    </ButtonText>
                  </Button>
                  <Button
                    onPress={() => setStep(3)}
                    backgroundColor={colors.accentPrimary}
                    borderRadius={tokens.radius.md}
                    flex={2}
                  >
                    <ButtonText color={colors.accentForeground} fontSize={15} fontWeight="bold">
                      Set Up Account
                    </ButtonText>
                  </Button>
                </HStack>
              </VStack>
            )}

            {step === 3 && (
              <VStack space="lg">
                <VStack space="xs" alignItems="center" mt={12}>
                  <Text color={colors.textPrimary} fontSize={24} fontWeight="800" textAlign="center">
                    Add Your First Account
                  </Text>
                  <Text color={colors.textSecondary} fontSize={14} textAlign="center" mt={4} px={8}>
                    Enter your primary account to start tracking, or start with a blank slate.
                  </Text>
                </VStack>

                {/* Account Type Selector */}
                <VStack space="xs" mt={8}>
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="bold">
                    ACCOUNT TYPE
                  </Text>
                  <HStack space="xs">
                    {ACCOUNT_TYPES.map((t) => {
                      const isSelected = accountType === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          onPress={() => setAccountType(t.id)}
                          style={[
                            styles.typeButton,
                            {
                              backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                              borderColor: isSelected ? colors.accentPrimary : colors.border,
                              borderRadius: tokens.radius.sm,
                            },
                          ]}
                        >
                          <Ionicons
                            name={t.icon}
                            size={16}
                            color={isSelected ? colors.accentForeground : colors.textSecondary}
                          />
                          <Text
                            color={isSelected ? colors.accentForeground : colors.textSecondary}
                            fontSize={11}
                            fontWeight="bold"
                            mt={4}
                          >
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </HStack>
                </VStack>

                {/* Account Name */}
                <VStack space="xs">
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="bold">
                    ACCOUNT NAME
                  </Text>
                  <TextInput
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="e.g. HDFC Salary, Cash in Hand, SBI"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        borderRadius: tokens.radius.md,
                      },
                    ]}
                  />
                </VStack>

                {/* Starting Balance */}
                <VStack space="xs">
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="bold">
                    STARTING BALANCE (₹)
                  </Text>
                  <TextInput
                    value={initialBalance}
                    onChangeText={setInitialBalance}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        borderRadius: tokens.radius.md,
                      },
                    ]}
                  />
                </VStack>

                {/* Actions */}
                <VStack space="sm" mt={16}>
                  <Button
                    onPress={handleFinishWithAccount}
                    backgroundColor={colors.accentPrimary}
                    borderRadius={tokens.radius.md}
                    isDisabled={isSubmitting}
                  >
                    <ButtonText color={colors.accentForeground} fontSize={15} fontWeight="bold">
                      {accountName.trim().length > 0 ? 'Create Account & Start' : 'Start with Blank Ledger'}
                    </ButtonText>
                  </Button>

                  <TouchableOpacity onPress={handleSkip} disabled={isSubmitting} style={styles.skipBtn}>
                    <Text color={colors.textSecondary} fontSize={13} fontWeight="500">
                      Skip for now
                    </Text>
                  </TouchableOpacity>
                </VStack>
              </VStack>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Box>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
