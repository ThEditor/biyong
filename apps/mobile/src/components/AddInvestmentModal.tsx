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
import type { Investment } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

export interface AddInvestmentModalProps {
  visible: boolean;
  onClose: () => void;
  editingInvestment?: Investment | null;
}

const INVESTMENT_TYPES: { type: Investment['type']; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { type: 'mutual_fund', label: 'Mutual Fund', icon: 'pie-chart' },
  { type: 'stock', label: 'Stock', icon: 'trending-up' },
  { type: 'etf', label: 'ETF', icon: 'bar-chart-2' },
  { type: 'fd', label: 'Fixed Deposit', icon: 'lock' },
  { type: 'rd', label: 'Recurring Dep.', icon: 'repeat' },
  { type: 'bond', label: 'Bond', icon: 'file-text' },
  { type: 'gold', label: 'Gold / SGB', icon: 'award' },
  { type: 'ppf', label: 'PPF', icon: 'shield' },
  { type: 'epf', label: 'EPF', icon: 'briefcase' },
  { type: 'nps', label: 'NPS', icon: 'umbrella' },
  { type: 'esop', label: 'ESOP', icon: 'gift' },
  { type: 'other', label: 'Other', icon: 'more-horizontal' },
];

export const AddInvestmentModal: React.FC<AddInvestmentModalProps> = ({
  visible,
  onClose,
  editingInvestment,
}) => {
  const { colors, tokens } = useAppTheme();
  const { createInvestment, updateInvestment } = useLedger();

  const [name, setName] = useState('');
  const [type, setType] = useState<Investment['type']>('mutual_fund');
  const [investedAmountStr, setInvestedAmountStr] = useState('');
  const [currentValueStr, setCurrentValueStr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingInvestment) {
      setName(editingInvestment.name);
      setType(editingInvestment.type);
      setInvestedAmountStr((editingInvestment.investedAmountMinor / 100).toString());
      setCurrentValueStr((editingInvestment.currentValueMinor / 100).toString());
      setNotes(editingInvestment.notes || '');
    } else {
      setName('');
      setType('mutual_fund');
      setInvestedAmountStr('');
      setCurrentValueStr('');
      setNotes('');
    }
    setError(null);
  }, [editingInvestment, visible]);

  const parsedInvested = parseFloat(investedAmountStr);
  const investedMinor =
    !isNaN(parsedInvested) && parsedInvested > 0 ? Math.round(parsedInvested * 100) : 0;

  const parsedCurrent = parseFloat(currentValueStr);
  const currentMinor =
    !isNaN(parsedCurrent) && parsedCurrent >= 0 ? Math.round(parsedCurrent * 100) : 0;

  const gainMinor = currentMinor - investedMinor;
  const returnPercent =
    investedMinor > 0 ? Math.round((gainMinor / investedMinor) * 100) : 0;

  const handleSubmit = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide an asset or fund name.');
      return;
    }

    if (isNaN(parsedInvested) || parsedInvested <= 0) {
      setError('Please enter a valid invested amount greater than 0.');
      return;
    }

    const finalCurrentMinor =
      currentValueStr.trim() === '' ? investedMinor : currentMinor;

    setIsSubmitting(true);
    try {
      if (editingInvestment) {
        await updateInvestment({
          ...editingInvestment,
          name: trimmedName,
          type,
          investedAmountMinor: investedMinor,
          currentValueMinor: finalCurrentMinor,
          notes: notes.trim() || null,
        });
      } else {
        await createInvestment({
          name: trimmedName,
          type,
          investedAmountMinor: investedMinor,
          currentValueMinor: finalCurrentMinor,
          currency: 'INR',
          notes: notes.trim() || null,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save investment.');
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
                {editingInvestment ? 'Edit Investment' : 'Add Investment'}
              </Text>
              <Text color={colors.textSecondary} fontSize={12} mt={2}>
                Track stocks, mutual funds, FDs, gold & retirement
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

            {/* Asset Name */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Asset / Fund Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Nifty 50 Index Fund, HDFC FD, Sovereign Gold"
                placeholderTextColor={colors.textSecondary}
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

            {/* Asset Type Selector */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Investment Type
              </Text>
              <View style={styles.typeGrid}>
                {INVESTMENT_TYPES.map((t) => {
                  const isSelected = type === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => setType(t.type)}
                      activeOpacity={0.7}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.background,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Feather
                        name={t.icon}
                        size={13}
                        color={isSelected ? colors.accentForeground : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        color={isSelected ? colors.accentForeground : colors.textPrimary}
                        fontSize={12}
                        fontWeight={isSelected ? '700' : '500'}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </VStack>

            {/* Amounts Row */}
            <HStack space="md">
              {/* Invested Amount */}
              <VStack flex={1} space="xs">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Invested (INR)
                </Text>
                <TextInput
                  value={investedAmountStr}
                  onChangeText={setInvestedAmountStr}
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

              {/* Current Value */}
              <VStack flex={1} space="xs">
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Current Value (INR)
                </Text>
                <TextInput
                  value={currentValueStr}
                  onChangeText={setCurrentValueStr}
                  placeholder={investedAmountStr || '0.00'}
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
            </HStack>

            {/* Return Preview Badge */}
            {investedMinor > 0 && currentMinor > 0 && (
              <Box
                backgroundColor={gainMinor >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
                p={12}
                borderRadius={tokens.radius.md}
                borderWidth={1}
                borderColor={gainMinor >= 0 ? colors.success : colors.danger}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack space="xs" alignItems="center">
                    <Feather
                      name={gainMinor >= 0 ? 'trending-up' : 'trending-down'}
                      size={15}
                      color={gainMinor >= 0 ? colors.success : colors.danger}
                    />
                    <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                      Unrealized {gainMinor >= 0 ? 'Gain' : 'Loss'}
                    </Text>
                  </HStack>
                  <Text
                    color={gainMinor >= 0 ? colors.success : colors.danger}
                    fontSize={14}
                    fontWeight="700"
                  >
                    {gainMinor >= 0 ? '+' : ''}
                    {formatMoney(gainMinor, 'INR')} ({gainMinor >= 0 ? '+' : ''}
                    {returnPercent}%)
                  </Text>
                </HStack>
              </Box>
            )}

            {/* Notes */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={12} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Notes (Optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="SIP folio number, maturation date, broker name"
                placeholderTextColor={colors.textSecondary}
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

            {/* Save Button (minHeight: 48 per Phase 5 learnings) */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.md,
                paddingVertical: 14,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
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
                  ? 'Saving...'
                  : editingInvestment
                  ? 'Update Investment'
                  : 'Save Investment'}
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
    height: 46,
    fontSize: 14,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
});
