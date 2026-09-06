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
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

export const AuthModal: React.FC = () => {
  const { colors, tokens } = useAppTheme();
  const { isAuthModalOpen, closeAuthModal, login, register, isGuest } = useLedger();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    closeAuthModal();
  };

  const handleSubmit = async () => {
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (authMode === 'register') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Please enter your full name.');
        return;
      }

      setIsSubmitting(true);
      try {
        await register(trimmedName, trimmedEmail, password);
        resetForm();
      } catch (err: any) {
        setError(err?.message || 'Registration failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(true);
      try {
        await login(trimmedEmail, password);
        resetForm();
      } catch (err: any) {
        setError(err?.message || 'Invalid email or password.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Modal visible={isAuthModalOpen} animationType="slide" transparent onRequestClose={handleClose}>
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
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentPrimary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {/* Toggle Segment: Sign In vs Create Account */}
            <View
              style={[
                styles.segmentContainer,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  setAuthMode('login');
                  setError(null);
                }}
                style={[
                  styles.segmentBtn,
                  authMode === 'login' && {
                    backgroundColor: colors.accentPrimary,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    {
                      color:
                        authMode === 'login' ? colors.accentForeground : colors.textSecondary,
                    },
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setAuthMode('register');
                  setError(null);
                }}
                style={[
                  styles.segmentBtn,
                  authMode === 'register' && {
                    backgroundColor: colors.accentPrimary,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    {
                      color:
                        authMode === 'register' ? colors.accentForeground : colors.textSecondary,
                    },
                  ]}
                >
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* Guest Upgrade Informational Card */}
            {isGuest && (
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
                <View style={styles.infoIconCol}>
                  <Feather name="refresh-cw" size={16} color={colors.accentPrimary} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                    Guest Data Upgrade
                  </Text>
                  <Text style={[styles.infoDescription, { color: colors.textSecondary }]}>
                    Your existing offline accounts, transactions, and budgets will be safely linked to your account.
                  </Text>
                </View>
              </View>
            )}

            {/* Error Banner */}
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.danger, borderRadius: tokens.radius.sm },
                ]}
              >
                <Feather name="alert-circle" size={14} color={colors.accentForeground} />
                <Text style={[styles.errorText, { color: colors.accentForeground }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Inputs */}
            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  FULL NAME
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Alice Henderson"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
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
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                EMAIL ADDRESS
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
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

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                PASSWORD
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password (minimum 6 characters)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
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

            {/* Primary Action Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.accentForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.accentForeground }]}>
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Continue as Guest Button */}
            <TouchableOpacity
              onPress={handleClose}
              style={[
                styles.guestBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.guestBtnText, { color: colors.textSecondary }]}>
                Continue as Guest
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
    maxHeight: '88%',
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
    gap: 8,
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
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoIconCol: {
    marginTop: 2,
  },
  infoTextCol: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  guestBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  guestBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
