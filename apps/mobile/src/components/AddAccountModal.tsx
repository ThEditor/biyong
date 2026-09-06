import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Account } from '@biyong/schemas';
import { formatMoney } from '@biyong/domain';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

const ACCOUNT_TYPES: Array<{ type: Account['type']; label: string }> = [
  { type: 'bank', label: 'Bank' },
  { type: 'cash', label: 'Cash' },
  { type: 'wallet', label: 'Digital Wallet' },
  { type: 'debit', label: 'Debit Card' },
  { type: 'credit', label: 'Credit Card' },
  { type: 'investment', label: 'Investment' },
  { type: 'other', label: 'Other' },
];

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ visible, onClose }) => {
  const { colors, tokens } = useAppTheme();
  const { createAccount } = useLedger();

  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('bank');
  const [balanceStr, setBalanceStr] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numVal = parseFloat(balanceStr);
  const previewMinor = !isNaN(numVal) && numVal >= 0 ? Math.round(numVal * 100) : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please provide an account name.');
      return;
    }

    const val = parseFloat(balanceStr);
    if (isNaN(val) || val < 0) {
      setError('Please provide a valid initial balance (>= 0).');
      return;
    }

    const initialBalanceMinor = Math.round(val * 100);

    setIsSubmitting(true);
    try {
      await createAccount({
        name: name.trim(),
        type,
        initialBalanceMinor,
        currency: 'INR',
      });
      setName('');
      setBalanceStr('0');
      setType('bank');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create account.');
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
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add New Account</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.danger, borderRadius: tokens.radius.sm },
                ]}
              >
                <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: '600' }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Account Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ACCOUNT NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. HDFC Salary, Emergency Cash, ICICI Credit"
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
            </View>

            {/* Account Type */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ACCOUNT TYPE</Text>
              <View style={styles.typeWrap}>
                {ACCOUNT_TYPES.map((t) => {
                  const isSelected = type === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => setType(t.type)}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: isSelected ? colors.accentForeground : colors.textPrimary },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Initial Balance */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                INITIAL BALANCE (INR)
              </Text>
              <TextInput
                value={balanceStr}
                onChangeText={setBalanceStr}
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
              <Text style={[styles.minorPreview, { color: colors.textMuted }]}>
                Starting balance: {formatMoney(previewMinor, 'INR')}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitButton,
                {
                  backgroundColor: colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.submitButtonText, { color: colors.accentForeground }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
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
  modalContent: {
    maxHeight: '85%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  errorBanner: {
    padding: 10,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
  },
  typeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  minorPreview: {
    fontSize: 11,
    marginTop: 2,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
