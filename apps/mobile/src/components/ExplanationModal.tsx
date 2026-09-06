import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { MemberSettlementExplanation } from '@biyong/domain';
import { formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

interface ExplanationModalProps {
  visible: boolean;
  onClose: () => void;
  memberId: string | null;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  visible,
  onClose,
  memberId,
}) => {
  const { colors, tokens } = useAppTheme();
  const { activeGroup, activeGroupMembers, getMemberExplanation } = useLedger();

  const [explanation, setExplanation] = useState<MemberSettlementExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && memberId) {
      setIsLoading(true);
      getMemberExplanation(memberId)
        .then((data) => setExplanation(data))
        .catch((err) => console.error('Failed to get explanation:', err))
        .finally(() => setIsLoading(false));
    } else {
      setExplanation(null);
    }
  }, [visible, memberId]);

  const member = activeGroupMembers.find((m) => m.id === memberId);
  const currency = activeGroup?.currency ?? 'INR';

  const totalPaidExpenses = explanation
    ? explanation.origins.reduce((sum, o) => sum + o.paidMinor, 0)
    : 0;
  const totalAllocatedExpenses = explanation
    ? explanation.origins.reduce((sum, o) => sum + o.allocatedMinor, 0)
    : 0;

  const netBal = explanation?.netBalanceMinor ?? 0;
  const isSettled = netBal === 0;
  const isCreditor = netBal > 0;
  const statusColor = isSettled ? colors.textMuted : isCreditor ? colors.success : colors.danger;
  const statusText = isSettled
    ? 'Settled Up'
    : isCreditor
    ? `Gets Back ${formatMoney(netBal, currency)}`
    : `Owes ${formatMoney(Math.abs(netBal), currency)}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
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
            <View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {member?.name ?? 'Member'} Breakdown
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Transparent audit of paid vs owed amounts
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accentPrimary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Calculating breakdown...
              </Text>
            </View>
          ) : !explanation ? (
            <View style={styles.centerBox}>
              <Text style={{ color: colors.textMuted }}>No explanation data available.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollBody}>
              {/* Summary Card */}
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <View style={styles.summaryTopRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                    NET BALANCE
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isSettled
                          ? colors.surfaceSubtle
                          : isCreditor
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        borderColor: statusColor,
                      },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                  </View>
                </View>

                {/* Metrics 2x2 Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                      Total Paid for Group
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                      {formatMoney(totalPaidExpenses, currency)}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                      Total Allocated Share
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                      {formatMoney(totalAllocatedExpenses, currency)}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                      Settlements Sent
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                      {formatMoney(explanation.settlementsMadeMinor, currency)}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                      Settlements Received
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                      {formatMoney(explanation.settlementsReceivedMinor, currency)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Expense Origins List */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  EXPENSE ACTIVITY ({explanation.origins.length})
                </Text>

                {explanation.origins.length === 0 ? (
                  <Text style={[styles.emptyNote, { color: colors.textMuted }]}>
                    No expense activity found for this member.
                  </Text>
                ) : (
                  explanation.origins.map((origin) => {
                    const isPositive = origin.netContributionMinor > 0;
                    const isZero = origin.netContributionMinor === 0;
                    const signColor = isZero
                      ? colors.textMuted
                      : isPositive
                      ? colors.success
                      : colors.danger;
                    const signSymbol = isZero ? '' : isPositive ? '+' : '-';

                    return (
                      <View
                        key={origin.expenseId}
                        style={[
                          styles.originRow,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text
                            style={[styles.originTitle, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {origin.expenseTitle}
                          </Text>
                          <Text style={[styles.originSub, { color: colors.textMuted }]}>
                            Cost: {formatMoney(origin.totalAmountMinor, currency)} • Paid:{' '}
                            {formatMoney(origin.paidMinor, currency)} • Share:{' '}
                            {formatMoney(origin.allocatedMinor, currency)}
                          </Text>
                        </View>
                        <View style={styles.originRight}>
                          <Text style={[styles.originImpact, { color: signColor }]}>
                            {signSymbol}
                            {formatMoney(Math.abs(origin.netContributionMinor), currency)}
                          </Text>
                          <Text style={[styles.impactLabel, { color: colors.textMuted }]}>
                            {isZero ? 'neutral' : isPositive ? 'lent' : 'borrowed'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Simplified Transfers Section */}
              {explanation.transfers.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    PENDING SETTLEMENT TRANSFERS
                  </Text>
                  {explanation.transfers.map((transfer, idx) => {
                    const fromMem = activeGroupMembers.find((m) => m.id === transfer.fromMemberId);
                    const toMem = activeGroupMembers.find((m) => m.id === transfer.toMemberId);
                    const isThisMemberPayer = transfer.fromMemberId === memberId;

                    return (
                      <View
                        key={`transfer-${idx}`}
                        style={[
                          styles.transferRow,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                            borderRadius: tokens.radius.sm,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isThisMemberPayer ? 'arrow-forward-circle' : 'arrow-back-circle'}
                          size={20}
                          color={isThisMemberPayer ? colors.danger : colors.success}
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.transferText, { color: colors.textPrimary }]}>
                            {fromMem?.name ?? 'Someone'} pays {toMem?.name ?? 'Someone'}
                          </Text>
                        </View>
                        <Text style={[styles.transferAmount, { color: colors.textPrimary }]}>
                          {formatMoney(transfer.amountMinor, currency)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
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
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollBody: {
    padding: 20,
    gap: 16,
  },
  summaryCard: {
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricItem: {
    width: '48%',
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyNote: {
    fontSize: 13,
    paddingVertical: 8,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
  },
  originTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  originSub: {
    fontSize: 11,
    marginTop: 2,
  },
  originRight: {
    alignItems: 'flex-end',
  },
  originImpact: {
    fontSize: 14,
    fontWeight: '700',
  },
  impactLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
  },
  transferText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transferAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
