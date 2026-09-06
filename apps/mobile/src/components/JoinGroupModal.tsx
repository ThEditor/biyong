import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { Group } from '@biyong/schemas';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

export interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined?: (group: Group) => void;
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  visible,
  onClose,
  onJoined,
}) => {
  const { colors, tokens } = useAppTheme();
  const { joinGroup, user, openAuthModal } = useLedger();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setCode('');
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter an invitation code.');
      return;
    }

    if (!user) {
      setError('Please log in first to join a shared group.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const group = await joinGroup(trimmed);
      setCode('');
      if (onJoined) {
        onJoined(group);
      }
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to join group. Please check the invite code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
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
              <Ionicons
                name="enter-outline"
                size={22}
                color={colors.accentPrimary}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Join Shared Group</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Guest warning banner if not authenticated */}
            {!user && (
              <View
                style={[
                  styles.authNotice,
                  {
                    backgroundColor: colors.accentSubtle,
                    borderColor: colors.accentPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <Ionicons name="information-circle" size={18} color={colors.accentPrimary} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.authNoticeText, { color: colors.textPrimary }]}>
                    You must be logged in to join shared multi-user groups.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      handleClose();
                      openAuthModal();
                    }}
                    style={styles.loginLinkBtn}
                  >
                    <Text style={[styles.loginLinkText, { color: colors.accentPrimary }]}>
                      Log In or Create Account
                    </Text>
                    <Feather name="arrow-right" size={12} color={colors.accentPrimary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Error Feedback */}
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.danger, borderRadius: tokens.radius.sm },
                ]}
              >
                <Feather name="alert-circle" size={16} color={colors.accentForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: colors.accentForeground }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Invite Code Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>INVITE CODE</Text>
              <TextInput
                value={code}
                onChangeText={(text) => {
                  setCode(text.toUpperCase());
                  setError(null);
                }}
                placeholder="INV-ABC123"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                style={[
                  styles.textInput,
                  styles.codeInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
                autoFocus
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Enter the code shared by the group owner (e.g. INV-ABC123).
              </Text>
            </View>

            {/* Info Card */}
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Ionicons name="sync-outline" size={18} color={colors.accentPrimary} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
                Joining will connect you to the shared ledger, syncing members, multi-payer expenses, and greedy settlements in real time.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleClose}
                style={[
                  styles.cancelButton,
                  {
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleJoin}
                disabled={isSubmitting || !code.trim()}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: colors.accentPrimary,
                    borderRadius: tokens.radius.md,
                    opacity: isSubmitting || !code.trim() ? 0.6 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.accentForeground} />
                ) : (
                  <>
                    <Ionicons
                      name="enter-outline"
                      size={18}
                      color={colors.accentForeground}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.submitButtonText, { color: colors.accentForeground }]}>
                      Join Group
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
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
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  authNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  authNoticeText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  loginLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  loginLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoCardText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
