import React, { useState, useEffect } from "react";
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
  Alert,
} from "react-native";
import type { Transaction, GroupMember } from "@biyong/schemas";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";
import { useLedger } from "../context/LedgerContext";
import { formatMoney } from "@biyong/domain";

export interface SplitTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSplitSuccess?: () => void;
}

type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({
  visible,
  onClose,
  transaction,
  onSplitSuccess,
}) => {
  const { colors, tokens } = useAppTheme();
  const {
    groups,
    splitTransactionIntoGroup,
    selectGroup,
    getGroupMembers,
    getSplitGroupIdsForTransaction,
    user,
  } = useLedger();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(() =>
    groups.length > 0 ? groups[0].id : ""
  );
  const [alreadySplitGroupIds, setAlreadySplitGroupIds] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [payerMemberId, setPayerMemberId] = useState<string>("");

  // Split method state
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [equalInvolved, setEqualInvolved] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query split groups for this transaction on open
  useEffect(() => {
    if (visible && transaction) {
      getSplitGroupIdsForTransaction(transaction.id)
        .then((splitIds) => {
          setAlreadySplitGroupIds(splitIds);
          if (splitIds.includes(selectedGroupId)) {
            const availableGroup = groups.find((g) => !splitIds.includes(g.id));
            if (availableGroup) {
              setSelectedGroupId(availableGroup.id);
            }
          }
        })
        .catch((err) => console.warn("Failed to query split groups:", err));
    }
  }, [visible, transaction, groups]);

  // Load group members when selected group changes
  useEffect(() => {
    if (visible && selectedGroupId) {
      getGroupMembers(selectedGroupId)
        .then((members) => {
          setGroupMembers(members);

          // Select default payer
          const myMember =
            members.find(
              (m) =>
                (user && m.userId === user.id) ||
                m.name.toLowerCase() === "you" ||
                m.role === "owner"
            ) || members[0];
          if (myMember) {
            setPayerMemberId(myMember.id);
          }

          // Initialize splits
          const initialEqual: Record<string, boolean> = {};
          const initialShares: Record<string, string> = {};
          const initialPercentages: Record<string, string> = {};
          const initialExact: Record<string, string> = {};

          const evenPercent = members.length > 0 ? (100 / members.length).toFixed(1) : "0";
          const evenExact =
            transaction && members.length > 0
              ? (transaction.amountMinor / 100 / members.length).toFixed(2)
              : "0";

          members.forEach((m) => {
            initialEqual[m.id] = true;
            initialShares[m.id] = "1";
            initialPercentages[m.id] = evenPercent;
            initialExact[m.id] = evenExact;
          });

          setEqualInvolved(initialEqual);
          setShares(initialShares);
          setPercentages(initialPercentages);
          setExactAmounts(initialExact);
        })
        .catch((err) => console.warn("Failed to get group members:", err));
    }
  }, [visible, selectedGroupId, user, transaction]);

  if (!transaction) return null;

  const totalAmountMinor = transaction.amountMinor;
  const currency = transaction.currency || "INR";
  const isSelectedGroupAlreadySplit = alreadySplitGroupIds.includes(selectedGroupId);

  // Split calculations
  const equalSelectedCount = groupMembers.filter((m) => equalInvolved[m.id]).length;
  const equalShareMinor =
    equalSelectedCount > 0 ? Math.floor(totalAmountMinor / equalSelectedCount) : 0;

  const exactSumMinor = groupMembers.reduce((sum, m) => {
    const val = parseFloat(exactAmounts[m.id] || "0");
    return sum + (!isNaN(val) && val > 0 ? Math.round(val * 100) : 0);
  }, 0);

  const percentageSum = groupMembers.reduce((sum, m) => {
    const val = parseFloat(percentages[m.id] || "0");
    return sum + (!isNaN(val) ? val : 0);
  }, 0);

  const totalSharesCount = groupMembers.reduce((sum, m) => {
    const val = parseInt(shares[m.id] || "0", 10);
    return sum + (!isNaN(val) && val > 0 ? val : 0);
  }, 0);

  const handleToggleEqual = (memberId: string) => {
    setEqualInvolved((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const handleSplit = async () => {
    if (!selectedGroupId) {
      setError("Please select a group to split this transaction with.");
      return;
    }

    if (isSelectedGroupAlreadySplit) {
      setError("This transaction has already been split into this group.");
      return;
    }

    // Build allocations
    let allocations: Array<{
      memberId: string;
      amountMinor?: number;
      percentage?: number;
      shares?: number;
    }> = [];

    if (splitMethod === "equal") {
      const involved = groupMembers.filter((m) => equalInvolved[m.id]);
      if (involved.length === 0) {
        setError("At least one member must be selected for equal split.");
        return;
      }
      allocations = involved.map((m) => ({ memberId: m.id }));
    } else if (splitMethod === "exact") {
      allocations = groupMembers
        .map((m) => {
          const val = parseFloat(exactAmounts[m.id] || "0");
          return {
            memberId: m.id,
            amountMinor: !isNaN(val) && val > 0 ? Math.round(val * 100) : 0,
          };
        })
        .filter((a) => (a.amountMinor ?? 0) > 0);

      const sum = allocations.reduce((acc, a) => acc + (a.amountMinor ?? 0), 0);
      if (sum !== totalAmountMinor) {
        setError(
          `Exact split sum (${formatMoney(sum, currency)}) does not match total (${formatMoney(
            totalAmountMinor,
            currency
          )}).`
        );
        return;
      }
    } else if (splitMethod === "percentage") {
      allocations = groupMembers
        .map((m) => {
          const val = parseFloat(percentages[m.id] || "0");
          return {
            memberId: m.id,
            percentage: !isNaN(val) && val > 0 ? val : 0,
          };
        })
        .filter((a) => (a.percentage ?? 0) > 0);

      if (Math.round(percentageSum) !== 100) {
        setError(`Split percentages must sum to 100% (currently ${percentageSum.toFixed(1)}%).`);
        return;
      }
    } else if (splitMethod === "shares") {
      allocations = groupMembers
        .map((m) => {
          const val = parseInt(shares[m.id] || "0", 10);
          return {
            memberId: m.id,
            shares: !isNaN(val) && val > 0 ? val : 0,
          };
        })
        .filter((a) => (a.shares ?? 0) > 0);

      if (totalSharesCount <= 0) {
        setError("Total shares must be at least 1.");
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await splitTransactionIntoGroup(
        transaction.id,
        selectedGroupId,
        splitMethod,
        allocations,
        payerMemberId
      );
      await selectGroup(selectedGroupId);
      if (onSplitSuccess) {
        onSplitSuccess();
      }
      onClose();
      Alert.alert(
        "Transaction Split",
        `Successfully split ${formatMoney(transaction.amountMinor, currency)} into the group!`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to split transaction into group.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                name="git-branch-outline"
                size={20}
                color={colors.accentPrimary}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Split into Group
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.danger }]}>
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>{error}</Text>
              </View>
            )}

            {/* Already Split Warning Banner */}
            {isSelectedGroupAlreadySplit && (
              <View
                style={[
                  styles.warningBanner,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.danger,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.warningTitle, { color: colors.danger }]}>
                    Already Split in This Group
                  </Text>
                  <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                    This transaction has already been added to this group. Duplicate splits of the same transaction into the same group are disabled.
                  </Text>
                </View>
              </View>
            )}

            {/* Transaction Preview Card */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <View style={styles.previewTop}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                  ORIGINAL TRANSACTION
                </Text>
                <Text style={[styles.previewDate, { color: colors.textMuted }]}>
                  {transaction.date}
                </Text>
              </View>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
                {transaction.merchant || transaction.notes || "Expense"}
              </Text>
              <Text style={[styles.previewAmount, { color: colors.accentPrimary }]}>
                {formatMoney(transaction.amountMinor, currency)}
              </Text>
            </View>

            {/* Group Selection */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                1. SELECT GROUP
              </Text>

              {groups.length === 0 ? (
                <View
                  style={[
                    styles.noGroupsBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.noGroupsText, { color: colors.textSecondary }]}>
                    No groups available. Please create or join a group first.
                  </Text>
                </View>
              ) : (
                <View style={styles.groupsList}>
                  {groups.map((grp) => {
                    const isSelected = selectedGroupId === grp.id;
                    const isGroupAlreadySplit = alreadySplitGroupIds.includes(grp.id);

                    return (
                      <TouchableOpacity
                        key={grp.id}
                        onPress={() => setSelectedGroupId(grp.id)}
                        style={[
                          styles.groupOption,
                          {
                            backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceSubtle,
                            borderColor: isGroupAlreadySplit
                              ? colors.borderStrong
                              : isSelected
                              ? colors.accentPrimary
                              : colors.border,
                            borderRadius: tokens.radius.md,
                            opacity: isGroupAlreadySplit ? 0.75 : 1,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View
                            style={[
                              styles.groupIconBox,
                              {
                                backgroundColor: isSelected ? colors.accentPrimary : colors.surface,
                              },
                            ]}
                          >
                            <Ionicons
                              name={grp.isPrivate ? "shield-outline" : "globe-outline"}
                              size={16}
                              color={isSelected ? colors.accentForeground : colors.accentPrimary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text
                                style={[styles.groupName, { color: colors.textPrimary }]}
                                numberOfLines={1}
                              >
                                {grp.name}
                              </Text>
                              {isGroupAlreadySplit && (
                                <View
                                  style={[
                                    styles.alreadySplitBadge,
                                    { backgroundColor: colors.border },
                                  ]}
                                >
                                  <Text style={[styles.alreadySplitBadgeText, { color: colors.textSecondary }]}>
                                    Already Split
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.groupMeta, { color: colors.textMuted }]}>
                              {grp.isPrivate ? "Private offline" : "Shared synced"} • {grp.currency}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color={isSelected ? colors.accentPrimary : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Payer Selection */}
            {groupMembers.length > 0 && !isSelectedGroupAlreadySplit && (
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  2. WHO PAID?
                </Text>
                <View style={styles.chipRow}>
                  {groupMembers.map((m) => {
                    const isSelected = payerMemberId === m.id;
                    const isMe =
                      (user && m.userId === user.id) ||
                      m.name.toLowerCase() === "you" ||
                      m.role === "owner";

                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => setPayerMemberId(m.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.accentForeground : colors.textPrimary },
                          ]}
                        >
                          {m.name} {isMe ? "(You)" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Split Method Selector */}
            {groupMembers.length > 0 && !isSelectedGroupAlreadySplit && (
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  3. HOW TO SPLIT?
                </Text>
                <View style={styles.chipRow}>
                  {(
                    [
                      { id: "equal", label: "Equally" },
                      { id: "exact", label: "Exact Amounts" },
                      { id: "percentage", label: "Percentages" },
                      { id: "shares", label: "Shares" },
                    ] as const
                  ).map((sm) => {
                    const isSelected = splitMethod === sm.id;
                    return (
                      <TouchableOpacity
                        key={sm.id}
                        onPress={() => setSplitMethod(sm.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.accentPrimary : colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.accentForeground : colors.textPrimary },
                          ]}
                        >
                          {sm.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Split Configuration Details */}
                <View
                  style={[
                    styles.configBox,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                >
                  {/* Equal Split */}
                  {splitMethod === "equal" && (
                    <View style={{ gap: 10 }}>
                      <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                        Select participants ({equalSelectedCount} selected • {formatMoney(equalShareMinor, currency)} each):
                      </Text>
                      {groupMembers.map((m) => {
                        const isInvolved = !!equalInvolved[m.id];
                        return (
                          <TouchableOpacity
                            key={m.id}
                            onPress={() => handleToggleEqual(m.id)}
                            style={[
                              styles.memberCheckRow,
                              { borderBottomColor: colors.border },
                            ]}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Ionicons
                                name={isInvolved ? "checkbox" : "square-outline"}
                                size={20}
                                color={isInvolved ? colors.accentPrimary : colors.textMuted}
                              />
                              <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                                {m.name}
                              </Text>
                            </View>
                            <Text
                              style={{
                                color: isInvolved ? colors.accentPrimary : colors.textMuted,
                                fontWeight: "600",
                                fontSize: 13,
                              }}
                            >
                              {isInvolved ? formatMoney(equalShareMinor, currency) : "Excluded"}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Exact Amounts Split */}
                  {splitMethod === "exact" && (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                          Enter amount for each person:
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              exactSumMinor === totalAmountMinor ? colors.success : colors.danger,
                          }}
                        >
                          Sum: {formatMoney(exactSumMinor, currency)} / {formatMoney(totalAmountMinor, currency)}
                        </Text>
                      </View>
                      {groupMembers.map((m) => (
                        <View key={m.id} style={styles.memberInputRow}>
                          <Text style={[styles.memberName, { color: colors.textPrimary, flex: 1 }]}>
                            {m.name}
                          </Text>
                          <TextInput
                            value={exactAmounts[m.id] || ""}
                            onChangeText={(t) =>
                              setExactAmounts((prev) => ({ ...prev, [m.id]: t }))
                            }
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            style={[
                              styles.miniInput,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.textPrimary,
                                borderRadius: tokens.radius.sm,
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Percentage Split */}
                  {splitMethod === "percentage" && (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                          Enter percentage for each person:
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              Math.round(percentageSum) === 100 ? colors.success : colors.danger,
                          }}
                        >
                          Total: {percentageSum.toFixed(1)}% / 100%
                        </Text>
                      </View>
                      {groupMembers.map((m) => (
                        <View key={m.id} style={styles.memberInputRow}>
                          <Text style={[styles.memberName, { color: colors.textPrimary, flex: 1 }]}>
                            {m.name}
                          </Text>
                          <TextInput
                            value={percentages[m.id] || ""}
                            onChangeText={(t) =>
                              setPercentages((prev) => ({ ...prev, [m.id]: t }))
                            }
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            style={[
                              styles.miniInput,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.textPrimary,
                                borderRadius: tokens.radius.sm,
                              },
                            ]}
                          />
                          <Text style={{ color: colors.textMuted, fontSize: 13, width: 16 }}>%</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Shares Split */}
                  {splitMethod === "shares" && (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                          Enter shares count (e.g. 1, 2):
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accentPrimary }}>
                          Total Shares: {totalSharesCount}
                        </Text>
                      </View>
                      {groupMembers.map((m) => {
                        const mShares = parseInt(shares[m.id] || "0", 10);
                        const shareMinor =
                          totalSharesCount > 0 && mShares > 0
                            ? Math.round((totalAmountMinor * mShares) / totalSharesCount)
                            : 0;

                        return (
                          <View key={m.id} style={styles.memberInputRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                                {m.name}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                {formatMoney(shareMinor, currency)}
                              </Text>
                            </View>
                            <TextInput
                              value={shares[m.id] || ""}
                              onChangeText={(t) => setShares((prev) => ({ ...prev, [m.id]: t }))}
                              keyboardType="numeric"
                              placeholder="1"
                              placeholderTextColor={colors.textMuted}
                              style={[
                                styles.miniInput,
                                {
                                  backgroundColor: colors.surface,
                                  borderColor: colors.border,
                                  color: colors.textPrimary,
                                  borderRadius: tokens.radius.sm,
                                },
                              ]}
                            />
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>shares</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Submit Button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleSplit}
              disabled={isSubmitting || groups.length === 0 || isSelectedGroupAlreadySplit}
              style={[
                styles.splitSubmitBtn,
                {
                  backgroundColor:
                    groups.length === 0 || isSelectedGroupAlreadySplit
                      ? colors.border
                      : colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.splitSubmitBtnText,
                  {
                    color:
                      groups.length === 0 || isSelectedGroupAlreadySplit
                        ? colors.textMuted
                        : colors.accentForeground,
                  },
                ]}
              >
                {isSubmitting
                  ? "Adding to Group..."
                  : isSelectedGroupAlreadySplit
                  ? "Already Split in This Group"
                  : "Confirm Group Split"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "90%",
    borderTopWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 16,
  },
  previewCard: {
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  previewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  previewDate: {
    fontSize: 11,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  previewAmount: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  inputSection: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  noGroupsBox: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  noGroupsText: {
    fontSize: 13,
    textAlign: "center",
  },
  groupsList: {
    gap: 8,
  },
  groupOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1.5,
  },
  groupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: {
    fontSize: 14,
    fontWeight: "700",
  },
  alreadySplitBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alreadySplitBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  groupMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  configBox: {
    padding: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  memberCheckRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  memberName: {
    fontSize: 13,
    fontWeight: "600",
  },
  memberInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  miniInput: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 80,
    fontSize: 13,
    textAlign: "right",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  splitSubmitBtn: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  splitSubmitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
