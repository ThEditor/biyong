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
import type { Group } from '@biyong/schemas';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface AddGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (group: Group) => void;
}

const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export const AddGroupModal: React.FC<AddGroupModalProps> = ({ visible, onClose, onCreated }) => {
  const { colors, tokens } = useAppTheme();
  const { createGroup, selectGroup } = useLedger();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>(['You']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    if (members.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Member "${trimmed}" is already added.`);
      return;
    }
    setMembers((prev) => [...prev, trimmed]);
    setMemberInput('');
    setError(null);
  };

  const handleRemoveMember = (idx: number) => {
    if (idx === 0) return; // Keep "You"
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please provide a group name.');
      return;
    }

    if (isPrivate && members.length < 2) {
      setError('Please add at least one other member to split expenses with.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newGroup = await createGroup(name.trim(), currency, isPrivate ? members : [], isPrivate);
      await selectGroup(newGroup.id);
      setName('');
      setCurrency('INR');
      setIsPrivate(false);
      setMemberInput('');
      setMembers(['You']);
      if (onCreated) {
        onCreated(newGroup);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create group.');
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
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="people" size={20} color={colors.accentPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Group</Text>
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

            {/* Group Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GROUP NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Goa Trip, Flat 402, Office Lunch"
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

            {/* Group Type Pill Switch */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GROUP TYPE</Text>
              <View
                style={[
                  styles.typePillContainer,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setIsPrivate(false)}
                  activeOpacity={0.7}
                  style={[
                    styles.typePill,
                    !isPrivate && {
                      backgroundColor: colors.accentPrimary,
                      borderRadius: tokens.radius.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={15}
                    color={!isPrivate ? colors.accentForeground : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      {
                        color: !isPrivate ? colors.accentForeground : colors.textPrimary,
                        fontWeight: !isPrivate ? '700' : '500',
                      },
                    ]}
                  >
                    Shared (Multi-User Sync)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsPrivate(true)}
                  activeOpacity={0.7}
                  style={[
                    styles.typePill,
                    isPrivate && {
                      backgroundColor: colors.accentPrimary,
                      borderRadius: tokens.radius.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={14}
                    color={isPrivate ? colors.accentForeground : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      {
                        color: isPrivate ? colors.accentForeground : colors.textPrimary,
                        fontWeight: isPrivate ? '700' : '500',
                      },
                    ]}
                  >
                    Private (Offline Only)
                  </Text>
                </TouchableOpacity>
              </View>

              {!isPrivate ? (
                <View
                  style={[
                    styles.typeNoteBox,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={colors.accentPrimary}
                    style={{ marginRight: 6, marginTop: 1 }}
                  />
                  <Text style={[styles.typeNoteText, { color: colors.textSecondary }]}>
                    You can invite friends with an invite code once created.
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.typeNoteBox,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={colors.accentPrimary}
                    style={{ marginRight: 6, marginTop: 1 }}
                  />
                  <Text style={[styles.typeNoteText, { color: colors.textSecondary }]}>
                    Only stored on this device with offline dummy member names.
                  </Text>
                </View>
              )}
            </View>

            {/* Currency Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CURRENCY</Text>
              <View style={styles.chipRow}>
                {SUPPORTED_CURRENCIES.map((curr) => {
                  const isSelected = currency === curr;
                  return (
                    <TouchableOpacity
                      key={curr}
                      onPress={() => setCurrency(curr)}
                      style={[
                        styles.currencyChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyChipText,
                          { color: isSelected ? colors.accentForeground : colors.textPrimary },
                        ]}
                      >
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Members Section - Private groups only */}
            {isPrivate ? (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>OFFLINE MEMBERS</Text>
                <View style={styles.memberInputRow}>
                  <TextInput
                    value={memberInput}
                    onChangeText={setMemberInput}
                    placeholder="Friend name (e.g. Alice, Bob)"
                    placeholderTextColor={colors.textMuted}
                    onSubmitEditing={handleAddMember}
                    returnKeyType="done"
                    style={[
                      styles.textInput,
                      styles.memberTextInput,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        borderRadius: tokens.radius.md,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={handleAddMember}
                    activeOpacity={0.7}
                    style={[
                      styles.addMemberBtn,
                      {
                        backgroundColor: colors.accentPrimary,
                        borderRadius: tokens.radius.md,
                      },
                    ]}
                  >
                    <Feather name="plus" size={18} color={colors.accentForeground} />
                    <Text style={[styles.addMemberBtnText, { color: colors.accentForeground }]}>
                      Add
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Members Chip List */}
                <View style={styles.memberChipsWrap}>
                  {members.map((member, index) => {
                    const isOwner = index === 0;
                    return (
                      <View
                        key={`${member}-${index}`}
                        style={[
                          styles.memberChip,
                          {
                            backgroundColor: isOwner ? colors.accentSubtle : colors.surfaceSubtle,
                            borderColor: isOwner ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.full,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isOwner ? 'person' : 'person-outline'}
                          size={14}
                          color={isOwner ? colors.accentPrimary : colors.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.memberNameText,
                            { color: isOwner ? colors.accentPrimary : colors.textPrimary },
                          ]}
                        >
                          {member} {isOwner ? '(Owner)' : ''}
                        </Text>
                        {!isOwner && (
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(index)}
                            style={styles.chipRemoveBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="x" size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Private group members are 100% offline local dummy profiles.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.typeNoteBox,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                    padding: 14,
                    marginBottom: 16,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.accentPrimary}
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.accentPrimary, marginBottom: 4 }]}>
                    MULTI-USER REAL SYNC
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                    Dummy member entries are disabled for shared groups. You will start as the group owner, and other members join directly using your 6-character group invite code.
                  </Text>
                </View>
              </View>
            )}

            {/* Submit Button */}
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
                Create Group
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
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  currencyChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  memberTextInput: {
    flex: 1,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 4,
  },
  addMemberBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipRemoveBtn: {
    marginLeft: 6,
    padding: 2,
  },
  helperText: {
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
  typePillContainer: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: 1,
    gap: 4,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  typePillText: {
    fontSize: 12,
  },
  typeNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  typeNoteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});
