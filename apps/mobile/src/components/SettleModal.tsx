import React, { useState, useEffect } from 'react';
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
import { formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface SettleModalProps {
  visible: boolean;
  onClose: () => void;
  initialFromMemberId?: string;
  initialToMemberId?: string;
  initialAmountMinor?: number;
}

export const SettleModal: React.FC<SettleModalProps> = ({
  visible,
  onClose,
  initialFromMemberId,
  initialToMemberId,
  initialAmountMinor,
}) => {
  const { colors, tokens } = useAppTheme();
  const { activeGroup, activeGroupMembers, recordSettlement } = useLedger();

  const [fromMemberId, setFromMemberId] = useState('');
  const [toMemberId, setToMemberId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && activeGroupMembers.length >= 2) {
      setFromMemberId(initialFromMemberId || activeGroupMembers[0].id);
      setToMemberId(
        initialToMemberId ||
          (activeGroupMembers.find((m) => m.id !== (initialFromMemberId || activeGroupMembers[0].id))?.id ?? activeGroupMembers[1].id)
      );
      if (initialAmountMinor && initialAmountMinor > 0) {
        setAmountStr((initialAmountMinor / 100).toFixed(2));
      } else {
        setAmountStr('');
      }
      setNotes('');
      setError(null);
    }
  }, [visible, initialFromMemberId, initialToMemberId, initialAmountMinor, activeGroupMembers]);

  const currency = activeGroup?.currency ?? 'INR';
  const val = parseFloat(amountStr);
  const previewMinor = !isNaN(val) && val > 0 ? Math.round(val * 100) : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!activeGroup) {
      setError('No active group selected.');
      return;
    }

    if (!fromMemberId || !toMemberId) {
      setError('Please select both payer and receiver.');
      return;
    }

    if (fromMemberId === toMemberId) {
      setError('Payer and receiver cannot be the same person.');
      return;
    }

    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid settlement amount greater than 0.');
      return;
    }

    const amountMinor = Math.round(val * 100);

    setIsSubmitting(true);
    try {
      await recordSettlement({
        groupId: activeGroup.id,
        fromMemberId,
        toMemberId,
        amountMinor,
        currency,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fromMember = activeGroupMembers.find((m) => m.id === fromMemberId);
  const toMember = activeGroupMembers.find((m) => m.id === toMemberId);

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
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Record Settlement</Text>
            </View>
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

            {/* Payer (Who Paid) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PAYER (WHO SENT MONEY)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {activeGroupMembers.map((member) => {
                  const isSelected = fromMemberId === member.id;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => setFromMemberId(member.id)}
                      style={[
                        styles.memberChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.memberChipText,
                          { color: isSelected ? colors.accentForeground : colors.textPrimary },
                        ]}
                      >
                        {member.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Receiver (Who Received) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>RECEIVER (WHO RECEIVED MONEY)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {activeGroupMembers.map((member) => {
                  const isSelected = toMemberId === member.id;
                  const isSame = fromMemberId === member.id;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      disabled={isSame}
                      onPress={() => setToMemberId(member.id)}
                      style={[
                        styles.memberChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                          opacity: isSame ? 0.35 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.memberChipText,
                          { color: isSelected ? colors.accentForeground : colors.textPrimary },
                        ]}
                      >
                        {member.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Settlement Amount */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                SETTLEMENT AMOUNT ({currency})
              </Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
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
                    fontWeight: '700',
                    fontSize: 18,
                  },
                ]}
                autoFocus={!initialAmountMinor}
              />
              {fromMember && toMember && previewMinor > 0 && (
                <Text style={[styles.settleSummaryText, { color: colors.textMuted }]}>
                  {fromMember.name} pays {toMember.name}: {formatMoney(previewMinor, currency)}
                </Text>
              )}
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PAYMENT NOTE (OPTIONAL)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. UPI transfer, Cash, Bank NEFT"
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
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
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
                Confirm Settlement
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
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
  chipsScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  memberChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  memberChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  settleSummaryText: {
    fontSize: 12,
    marginTop: 2,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 48,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
