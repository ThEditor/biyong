import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import {
  formatMoney,
  canEditExpense,
  canDeleteExpense,
  type DependencyGraph,
} from '@biyong/domain';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import { AddGroupModal } from '../components/AddGroupModal';
import { JoinGroupModal } from '../components/JoinGroupModal';
import { AddGroupExpenseModal } from '../components/AddGroupExpenseModal';
import { SettleModal } from '../components/SettleModal';
import { ExplanationModal } from '../components/ExplanationModal';
import { InteractiveGraphView } from '../components/InteractiveGraphView';

type GroupDetailTab = 'expenses' | 'balances' | 'graph';

export interface GroupsScreenProps {
  onBack?: () => void;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ onBack }) => {
  const { colors, tokens } = useAppTheme();
  const {
    groups,
    activeGroupId,
    activeGroup,
    activeGroupMembers,
    activeGroupExpenses,
    activeGroupSettlements,
    activeGroupBalances,
    activeGroupTransfers,
    selectGroup,
    deleteGroup,
    deleteGroupExpense,
    getGroupDependencyGraph,
    createGroupInvite,
    user,
  } = useLedger();

  // Modals state
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [inviteModalCode, setInviteModalCode] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePrefill, setSettlePrefill] = useState<{
    fromMemberId?: string;
    toMemberId?: string;
    amountMinor?: number;
  }>({});

  const [selectedExplanationMemberId, setSelectedExplanationMemberId] = useState<string | null>(
    null
  );

  // Active group sub-tab
  const [activeTab, setActiveTab] = useState<GroupDetailTab>('expenses');

  // Graph data state
  const [graphData, setGraphData] = useState<DependencyGraph | null>(null);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [graphFilter, setGraphFilter] = useState<'all' | 'pay' | 'share' | 'settle'>('all');

  // Load graph data when switching to graph tab
  useEffect(() => {
    if (activeGroupId && activeTab === 'graph') {
      setIsGraphLoading(true);
      getGroupDependencyGraph()
        .then((res) => setGraphData(res))
        .catch((err) => console.error('Failed to load dependency graph:', err))
        .finally(() => setIsGraphLoading(false));
    }
  }, [activeGroupId, activeTab, activeGroupExpenses, activeGroupSettlements]);

  const currency = activeGroup?.currency ?? 'INR';

  const totalGroupSpendMinor = useMemo(() => {
    return activeGroupExpenses.reduce((sum, e) => sum + e.amountMinor, 0);
  }, [activeGroupExpenses]);

  const handleDeleteGroupConfirm = (groupId: string, groupName: string) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${groupName}"? All associated expenses, splits, and settlements will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGroup(groupId);
          },
        },
      ]
    );
  };

  const handleDeleteExpenseConfirm = (expenseId: string, title: string) => {
    Alert.alert(
      'Delete Expense',
      `Delete "${title}"? Group member balances will be recalculated automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGroupExpense(expenseId);
          },
        },
      ]
    );
  };

  const handleOpenSettle = (fromId?: string, toId?: string, amountMinor?: number) => {
    setSettlePrefill({
      fromMemberId: fromId,
      toMemberId: toId,
      amountMinor,
    });
    setIsSettleOpen(true);
  };

  // -------------------------------------------------------------
  // VIEW 1: Groups Overview (No Active Group Selected)
  // -------------------------------------------------------------
  if (!activeGroupId || !activeGroup) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.screenHeader, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {onBack && (
                <TouchableOpacity onPress={onBack} style={{ marginRight: 6 }}>
                  <Feather name="chevron-left" size={22} color={colors.accentPrimary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                Groups & Splits
              </Text>
            </View>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Multi-payer expenses & debt simplification
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => setIsJoinGroupOpen(true)}
              style={[
                styles.headerSecondaryBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Ionicons
                name="enter-outline"
                size={15}
                color={colors.textPrimary}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.headerSecondaryBtnText, { color: colors.textPrimary }]}>
                Join
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsAddGroupOpen(true)}
              style={[
                styles.headerAddBtn,
                { backgroundColor: colors.accentPrimary, borderRadius: tokens.radius.md },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Feather name="plus" size={15} color={colors.accentForeground} style={{ marginRight: 2 }} />
              <Text style={[styles.headerAddBtnText, { color: colors.accentForeground }]}>
                New
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Banner Card */}
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
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.accentPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoCardTitle, { color: colors.textPrimary }]}>
                Private & 100% Offline
              </Text>
              <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
                Split trips, apartment rent, or group dinners without cloud lock-in. Settle up with
                deterministic greedy debt simplification.
              </Text>
            </View>
          </View>

          {/* Group List Header */}
          <View style={styles.listHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              ACTIVE GROUPS ({groups.length})
            </Text>
          </View>

          {/* Group Cards */}
          {groups.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.lg,
                },
              ]}
            >
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No Groups Created Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Create an offline group to start splitting shared expenses with friends or
                roommates.
              </Text>
              <TouchableOpacity
                onPress={() => setIsAddGroupOpen(true)}
                style={[
                  styles.ctaButton,
                  { backgroundColor: colors.accentPrimary, borderRadius: tokens.radius.md },
                ]}
              >
                <Feather name="plus" size={16} color={colors.accentForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.ctaButtonText, { color: colors.accentForeground }]}>
                  Create First Group
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            groups.map((grp) => (
              <TouchableOpacity
                key={grp.id}
                onPress={() => selectGroup(grp.id)}
                activeOpacity={0.7}
                style={[
                  styles.groupCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <View style={styles.groupCardLeft}>
                  <View
                    style={[
                      styles.groupIconBox,
                      {
                        backgroundColor: colors.accentSubtle,
                        borderRadius: tokens.radius.sm,
                      },
                    ]}
                  >
                    <Ionicons name="people" size={20} color={colors.accentPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.groupCardName, { color: colors.textPrimary }]}>
                      {grp.name}
                    </Text>
                    <View style={styles.groupMetaRow}>
                      <View
                        style={[
                          styles.currencyTag,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                            borderRadius: 4,
                          },
                        ]}
                      >
                        <Text style={[styles.currencyTagText, { color: colors.textSecondary }]}>
                          {grp.currency}
                        </Text>
                      </View>
                      <Text style={[styles.groupDateText, { color: colors.textMuted }]}>
                        Created {grp.createdAt.substring(0, 10)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.groupCardRight}>
                  <TouchableOpacity
                    onPress={() => handleDeleteGroupConfirm(grp.id, grp.name)}
                    style={styles.deleteGroupBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <AddGroupModal visible={isAddGroupOpen} onClose={() => setIsAddGroupOpen(false)} />
        <JoinGroupModal visible={isJoinGroupOpen} onClose={() => setIsJoinGroupOpen(false)} />
      </View>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: Active Group Details (Tabs: Expenses | Balances | Graph)
  // -------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header Navigation */}
      <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => selectGroup(null)}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={colors.accentPrimary} />
          <Text style={[styles.backButtonText, { color: colors.accentPrimary }]}>All Groups</Text>
        </TouchableOpacity>

        <View style={styles.detailHeaderCenter}>
          <Text style={[styles.detailTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeGroup.name}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!activeGroup.isPrivate && (
            <TouchableOpacity
              onPress={async () => {
                setIsGeneratingInvite(true);
                setInviteCopied(false);
                try {
                  const code = await createGroupInvite(activeGroup.id);
                  setInviteModalCode(code);
                } catch (err: any) {
                  Alert.alert('Invite Error', err?.message || 'Failed to generate invite code.');
                } finally {
                  setIsGeneratingInvite(false);
                }
              }}
              disabled={isGeneratingInvite}
              style={[
                styles.shareInviteBtn,
                {
                  backgroundColor: colors.accentSubtle,
                  borderColor: colors.accentPrimary,
                  borderRadius: tokens.radius.sm,
                },
              ]}
            >
              {isGeneratingInvite ? (
                <ActivityIndicator size="small" color={colors.accentPrimary} />
              ) : (
                <>
                  <Ionicons
                    name="share-social-outline"
                    size={14}
                    color={colors.accentPrimary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.shareInviteBtnText, { color: colors.accentPrimary }]}>
                    Share Invite
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View
            style={[
              styles.currencyBadge,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.currencyBadgeText, { color: colors.accentPrimary }]}>
              {currency}
            </Text>
          </View>
        </View>
      </View>

      {/* Summary Header Metrics */}
      <View
        style={[
          styles.groupSummaryBanner,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryColLabel, { color: colors.textMuted }]}>TOTAL SPEND</Text>
          <Text style={[styles.summaryColVal, { color: colors.textPrimary }]}>
            {formatMoney(totalGroupSpendMinor, currency)}
          </Text>
        </View>
        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryColLabel, { color: colors.textMuted }]}>MEMBERS</Text>
          <Text style={[styles.summaryColVal, { color: colors.textPrimary }]}>
            {activeGroupMembers.length}
          </Text>
        </View>
        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryColLabel, { color: colors.textMuted }]}>EXPENSES</Text>
          <Text style={[styles.summaryColVal, { color: colors.textPrimary }]}>
            {activeGroupExpenses.length}
          </Text>
        </View>
      </View>

      {/* Sub-Tab Navigation Switch */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(
          [
            { id: 'expenses', label: 'Expenses', icon: 'receipt-outline' },
            { id: 'balances', label: 'Balances & Settle', icon: 'swap-horizontal' },
            { id: 'graph', label: 'Graph', icon: 'git-network-outline' },
          ] as const
        ).map((t) => {
          const isSelected = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[
                styles.tabBarButton,
                isSelected && {
                  borderBottomColor: colors.accentPrimary,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={isSelected ? colors.accentPrimary : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBarLabel,
                  {
                    color: isSelected ? colors.accentPrimary : colors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ----------------- EXPENSES TAB ----------------- */}
      {activeTab === 'expenses' && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {activeGroupExpenses.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.lg,
                  },
                ]}
              >
                <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No Group Expenses
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Add dinner, flights, fuel, or stays to let Biyong automatically calculate everyone's
                  share.
                </Text>
                <TouchableOpacity
                  onPress={() => setIsAddExpenseOpen(true)}
                  style={[
                    styles.ctaButton,
                    { backgroundColor: colors.accentPrimary, borderRadius: tokens.radius.md },
                  ]}
                >
                  <Feather name="plus" size={16} color={colors.accentForeground} style={{ marginRight: 6 }} />
                  <Text style={[styles.ctaButtonText, { color: colors.accentForeground }]}>
                    Add Expense
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeGroupExpenses.map((exp) => {
                // Figure out payer names
                const payerNames = exp.payers
                  .map((p) => {
                    const mem = activeGroupMembers.find((m) => m.id === p.memberId);
                    return mem ? mem.name : 'Unknown';
                  })
                  .join(', ');

                // Creator attribution
                let creatorName = 'You';
                if (exp.createdByUserId) {
                  if (user?.id && exp.createdByUserId === user.id) {
                    creatorName = 'You';
                  } else {
                    const match = activeGroupMembers.find((m) => m.userId === exp.createdByUserId);
                    creatorName = match ? match.name : 'Another Member';
                  }
                } else if (exp.createdByMemberId) {
                  const match = activeGroupMembers.find((m) => m.id === exp.createdByMemberId);
                  if (match) {
                    creatorName = match.name.toLowerCase() === 'you' ? 'You' : match.name;
                  }
                }

                const currentUserId = user?.id ?? '';
                const canEdit = canEditExpense(currentUserId, exp);
                const canDelete = canDeleteExpense(currentUserId, exp, activeGroup.ownerId);

                return (
                  <View
                    key={exp.id}
                    style={[
                      styles.expenseCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: tokens.radius.md,
                      },
                    ]}
                  >
                    <View style={styles.expenseCardLeft}>
                      <View style={styles.expenseTitleRow}>
                        <Text style={[styles.expenseTitle, { color: colors.textPrimary }]}>
                          {exp.title}
                        </Text>
                        {!canEdit && (
                          <View
                            style={[
                              styles.readOnlyBadge,
                              {
                                backgroundColor: colors.surfaceSubtle,
                                borderColor: colors.border,
                                borderRadius: 4,
                              },
                            ]}
                          >
                            <Feather name="lock" size={10} color={colors.textMuted} style={{ marginRight: 3 }} />
                            <Text style={[styles.readOnlyText, { color: colors.textMuted }]}>
                              Read-only
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.expenseMetaRow}>
                        <Text style={[styles.expenseMetaText, { color: colors.textMuted }]}>
                          {exp.date} • Paid by{' '}
                          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                            {payerNames}
                          </Text>
                        </Text>
                        <View
                          style={[
                            styles.splitPill,
                            {
                              backgroundColor: colors.surfaceSubtle,
                              borderColor: colors.border,
                              borderRadius: 4,
                            },
                          ]}
                        >
                          <Text style={[styles.splitPillText, { color: colors.accentPrimary }]}>
                            {exp.splitMethod.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Creator Attribution */}
                      <View style={styles.attributionRow}>
                        <Ionicons
                          name="person-circle-outline"
                          size={12}
                          color={colors.textMuted}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.attributionText, { color: colors.textMuted }]}>
                          Added by{' '}
                          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                            {creatorName}
                          </Text>
                        </Text>
                      </View>

                      {exp.notes && (
                        <Text
                          style={[styles.expenseNotes, { color: colors.textMuted }]}
                          numberOfLines={1}
                        >
                          {exp.notes}
                        </Text>
                      )}
                    </View>

                    <View style={styles.expenseCardRight}>
                      <Text style={[styles.expenseAmount, { color: colors.textPrimary }]}>
                        {formatMoney(exp.amountMinor, currency)}
                      </Text>
                      {canDelete ? (
                        <TouchableOpacity
                          onPress={() => handleDeleteExpenseConfirm(exp.id, exp.title)}
                          style={styles.deleteExpenseBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="trash-2" size={15} color={colors.danger} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.disabledLockBtn}>
                          <Feather name="lock" size={13} color={colors.textMuted} />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Floating Action Button */}
          <TouchableOpacity
            onPress={() => setIsAddExpenseOpen(true)}
            activeOpacity={0.85}
            style={[
              styles.fab,
              {
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.full,
              },
            ]}
          >
            <Feather name="plus" size={20} color={colors.accentForeground} style={{ marginRight: 6 }} />
            <Text style={[styles.fabText, { color: colors.accentForeground }]}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ----------------- BALANCES & SETTLE TAB ----------------- */}
      {activeTab === 'balances' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Member Net Balances */}
          <View style={styles.sectionHeaderWrap}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              MEMBER BALANCES
            </Text>
            <Text style={[styles.sectionSubheading, { color: colors.textMuted }]}>
              Tap any member to view full calculation breakdown
            </Text>
          </View>

          {activeGroupMembers.map((member) => {
            const bal = activeGroupBalances.get(member.id) ?? 0;
            const isSettled = bal === 0;
            const isCreditor = bal > 0;
            const badgeColor = isSettled
              ? colors.textMuted
              : isCreditor
              ? colors.success
              : colors.danger;
            const badgeBg = isSettled
              ? colors.surfaceSubtle
              : isCreditor
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)';
            const badgeText = isSettled ? 'Settled' : isCreditor ? 'Gets Back' : 'Owes';

            return (
              <TouchableOpacity
                key={member.id}
                onPress={() => setSelectedExplanationMemberId(member.id)}
                activeOpacity={0.7}
                style={[
                  styles.memberBalanceCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <View style={styles.memberBalanceLeft}>
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        borderRadius: tokens.radius.full,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.memberNameBold, { color: colors.textPrimary }]}>
                      {member.name}
                    </Text>
                    <View style={styles.explanationPromptRow}>
                      <Text style={[styles.viewBreakdownText, { color: colors.accentPrimary }]}>
                        View breakdown
                      </Text>
                      <Feather name="chevron-right" size={12} color={colors.accentPrimary} />
                    </View>
                  </View>
                </View>

                <View style={styles.memberBalanceRight}>
                  <Text
                    style={[
                      styles.memberBalanceValue,
                      {
                        color: isSettled
                          ? colors.textMuted
                          : isCreditor
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  >
                    {bal > 0 ? '+' : ''}
                    {formatMoney(bal, currency)}
                  </Text>
                  <View
                    style={[
                      styles.balanceBadge,
                      { backgroundColor: badgeBg, borderColor: badgeColor },
                    ]}
                  >
                    <Text style={[styles.balanceBadgeText, { color: badgeColor }]}>
                      {badgeText}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Debt Simplification Algorithm Section */}
          <View style={[styles.sectionHeaderWrap, { marginTop: 24 }]}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              SIMPLIFIED SETTLEMENTS
            </Text>
            <View
              style={[
                styles.algoPill,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.sm,
                },
              ]}
            >
              <Ionicons
                name="flash-outline"
                size={14}
                color={colors.accentPrimary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.algoPillText, { color: colors.textSecondary }]}>
                Greedy min-cash-flow algorithm minimizes required payments
              </Text>
            </View>
          </View>

          {activeGroupTransfers.length === 0 ? (
            <View
              style={[
                styles.allSettledCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Ionicons name="checkmark-done-circle" size={36} color={colors.success} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.allSettledTitle, { color: colors.textPrimary }]}>
                  All Settled Up
                </Text>
                <Text style={[styles.allSettledSubtitle, { color: colors.textSecondary }]}>
                  Everyone is even. No pending transactions are needed.
                </Text>
              </View>
            </View>
          ) : (
            activeGroupTransfers.map((transfer, idx) => {
              const fromMem = activeGroupMembers.find((m) => m.id === transfer.fromMemberId);
              const toMem = activeGroupMembers.find((m) => m.id === transfer.toMemberId);

              return (
                <View
                  key={`transfer-${idx}`}
                  style={[
                    styles.transferCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.transferDesc, { color: colors.textPrimary }]}>
                      <Text style={{ fontWeight: '700' }}>{fromMem?.name ?? 'Member'}</Text> pays{' '}
                      <Text style={{ fontWeight: '700' }}>{toMem?.name ?? 'Member'}</Text>
                    </Text>
                    <Text style={[styles.transferAmountLarge, { color: colors.accentPrimary }]}>
                      {formatMoney(transfer.amountMinor, currency)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      handleOpenSettle(
                        transfer.fromMemberId,
                        transfer.toMemberId,
                        transfer.amountMinor
                      )
                    }
                    activeOpacity={0.8}
                    style={[
                      styles.settleUpBtn,
                      {
                        backgroundColor: colors.accentPrimary,
                        borderRadius: tokens.radius.sm,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.accentForeground}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.settleUpBtnText, { color: colors.accentForeground }]}>
                      Settle Up
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {/* Past Settlements History */}
          {activeGroupSettlements.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginBottom: 8 }]}>
                SETTLEMENT HISTORY ({activeGroupSettlements.length})
              </Text>
              {activeGroupSettlements.map((stl) => {
                const fromMem = activeGroupMembers.find((m) => m.id === stl.fromMemberId);
                const toMem = activeGroupMembers.find((m) => m.id === stl.toMemberId);
                return (
                  <View
                    key={stl.id}
                    style={[
                      styles.pastSettleRow,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        borderRadius: tokens.radius.sm,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.success}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pastSettleText, { color: colors.textPrimary }]}>
                        {fromMem?.name ?? 'Someone'} paid {toMem?.name ?? 'Someone'}
                      </Text>
                      <Text style={[styles.pastSettleDate, { color: colors.textMuted }]}>
                        {stl.settledAt.substring(0, 10)} {stl.notes ? `• ${stl.notes}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.pastSettleAmount, { color: colors.success }]}>
                      {formatMoney(stl.amountMinor, currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ----------------- GRAPH TAB ----------------- */}
      {activeTab === 'graph' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isGraphLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accentPrimary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Building financial dependency network...
              </Text>
            </View>
          ) : !graphData ? (
            <View style={styles.centerBox}>
              <Text style={{ color: colors.textMuted }}>No graph data available.</Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {/* Network Overview Stats */}
              <View
                style={[
                  styles.networkStatsCard,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <View style={styles.networkStatCol}>
                  <Text style={[styles.networkStatVal, { color: colors.textPrimary }]}>
                    {graphData.nodes.filter((n) => n.type === 'member').length}
                  </Text>
                  <Text style={[styles.networkStatLabel, { color: colors.textMuted }]}>
                    Members
                  </Text>
                </View>
                <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
                <View style={styles.networkStatCol}>
                  <Text style={[styles.networkStatVal, { color: colors.textPrimary }]}>
                    {graphData.nodes.filter((n) => n.type === 'expense').length}
                  </Text>
                  <Text style={[styles.networkStatLabel, { color: colors.textMuted }]}>
                    Expenses
                  </Text>
                </View>
                <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
                <View style={styles.networkStatCol}>
                  <Text style={[styles.networkStatVal, { color: colors.accentPrimary }]}>
                    {graphData.edges.length}
                  </Text>
                  <Text style={[styles.networkStatLabel, { color: colors.textMuted }]}>
                    Dependencies
                  </Text>
                </View>
              </View>

              {/* Filter Pills */}
              <View style={styles.graphFilterRow}>
                {(
                  [
                    { id: 'all', label: 'All Flows' },
                    { id: 'pay', label: 'Funded (Pay)' },
                    { id: 'share', label: 'Owed (Share)' },
                    { id: 'settle', label: 'Settled' },
                  ] as const
                ).map((f) => {
                  const isSelected = graphFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setGraphFilter(f.id)}
                      style={[
                        styles.graphFilterChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.graphFilterChipText,
                          { color: isSelected ? colors.accentForeground : colors.textSecondary },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Interactive Draggable Visual Graph */}
              <InteractiveGraphView
                nodes={graphData.nodes}
                edges={graphData.edges}
                currency={currency}
                activeFilter={graphFilter}
              />

              {/* Flow Edges Detailed Audit */}
              <View style={styles.edgesList}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginBottom: 8 }]}>
                  TRANSACTION DEPENDENCY AUDIT
                </Text>
                {graphData.edges
                  .filter((e) => {
                    if (graphFilter === 'pay') return e.label.toLowerCase().includes('paid');
                    if (graphFilter === 'share') return e.label.toLowerCase().includes('share');
                    if (graphFilter === 'settle') return e.label.toLowerCase().includes('settled');
                    return true;
                  })
                  .map((edge) => {
                    const sourceNode = graphData.nodes.find((n) => n.id === edge.source);
                    const targetNode = graphData.nodes.find((n) => n.id === edge.target);
                    const isPay = edge.label.toLowerCase().includes('paid');
                    const isSettle = edge.label.toLowerCase().includes('settled');
                    const edgeColor = isSettle
                      ? colors.success
                      : isPay
                      ? colors.accentPrimary
                      : colors.textSecondary;

                    return (
                      <View
                        key={edge.id}
                        style={[
                          styles.edgeRow,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderRadius: tokens.radius.md,
                          },
                        ]}
                      >
                        {/* Source Node */}
                        <View style={styles.nodePill}>
                          <Ionicons
                            name={sourceNode?.type === 'member' ? 'person' : 'receipt'}
                            size={14}
                            color={colors.accentPrimary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[styles.nodeText, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {sourceNode?.label ?? 'Node'}
                          </Text>
                        </View>

                        {/* Arrow & Label */}
                        <View style={styles.edgeConnector}>
                          <View
                            style={[styles.edgeBadge, { backgroundColor: colors.surfaceSubtle }]}
                          >
                            <Text style={[styles.edgeBadgeText, { color: edgeColor }]}>
                              {edge.label} {formatMoney(edge.amountMinor, currency)}
                            </Text>
                          </View>
                          <Ionicons name="arrow-forward" size={16} color={edgeColor} />
                        </View>

                        {/* Target Node */}
                        <View style={styles.nodePill}>
                          <Ionicons
                            name={targetNode?.type === 'member' ? 'person' : 'receipt'}
                            size={14}
                            color={colors.accentPrimary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[styles.nodeText, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {targetNode?.label ?? 'Node'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modals */}
      <AddGroupExpenseModal
        visible={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
      />

      <SettleModal
        visible={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        initialFromMemberId={settlePrefill.fromMemberId}
        initialToMemberId={settlePrefill.toMemberId}
        initialAmountMinor={settlePrefill.amountMinor}
      />

      <ExplanationModal
        visible={!!selectedExplanationMemberId}
        onClose={() => setSelectedExplanationMemberId(null)}
        memberId={selectedExplanationMemberId}
      />

      {/* Invite Code Modal */}
      <Modal
        visible={inviteModalCode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalCode(null)}
      >
        <View style={styles.inviteModalOverlay}>
          <View
            style={[
              styles.inviteModalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
                borderRadius: tokens.radius.lg,
              },
            ]}
          >
            <View style={styles.inviteModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={colors.accentPrimary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.inviteModalTitle, { color: colors.textPrimary }]}>
                  Invite Friends
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInviteModalCode(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inviteModalSubtitle, { color: colors.textSecondary }]}>
              Share this code with friends so they can join "{activeGroup?.name}".
            </Text>

            <View
              style={[
                styles.codeDisplayBox,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Text style={[styles.codeDisplayText, { color: colors.textPrimary }]}>
                {inviteModalCode}
              </Text>
            </View>

            <View style={styles.inviteActionsRow}>
              <TouchableOpacity
                onPress={async () => {
                  if (inviteModalCode) {
                    try {
                      await Clipboard.setStringAsync(inviteModalCode);
                    } catch (e) {
                      console.warn('Clipboard.setStringAsync error:', e);
                    }
                  }
                  setInviteCopied(true);
                  Alert.alert(
                    'Code Copied to Clipboard',
                    `Invite code "${inviteModalCode}" has been copied to your clipboard. Give this code to your friends to enter on the "Join Group" screen.`
                  );
                }}
                style={[
                  styles.copyCodeBtn,
                  {
                    backgroundColor: inviteCopied ? colors.success : colors.accentPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <Ionicons
                  name={inviteCopied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={colors.accentForeground}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.copyCodeBtnText, { color: colors.accentForeground }]}>
                  {inviteCopied ? 'Code Copied' : 'Copy Code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  headerAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 80,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoCardText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  listHeaderRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionSubheading: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeaderWrap: {
    gap: 2,
    marginBottom: 4,
  },
  emptyBox: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 18,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  groupCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  groupIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  currencyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  currencyTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  groupDateText: {
    fontSize: 11,
  },
  groupCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deleteGroupBtn: {
    padding: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  detailHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
  currencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupSummaryBanner: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryColLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryColVal: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  dividerVertical: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabBarLabel: {
    fontSize: 12,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  expenseCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  expenseMetaText: {
    fontSize: 12,
  },
  splitPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  splitPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  expenseNotes: {
    fontSize: 11,
    marginTop: 4,
  },
  expenseCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  deleteExpenseBtn: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  memberBalanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberNameBold: {
    fontSize: 14,
    fontWeight: '700',
  },
  explanationPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  viewBreakdownText: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberBalanceRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  memberBalanceValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
  },
  balanceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  algoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  algoPillText: {
    fontSize: 11,
    flex: 1,
  },
  allSettledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  allSettledTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  allSettledSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  transferDesc: {
    fontSize: 14,
  },
  transferAmountLarge: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  settleUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  settleUpBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pastSettleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  pastSettleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pastSettleDate: {
    fontSize: 11,
    marginTop: 1,
  },
  pastSettleAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
  },
  networkStatsCard: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderWidth: 1,
  },
  networkStatCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkStatVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  networkStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  graphFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  graphFilterChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  graphFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  edgesList: {
    gap: 10,
  },
  edgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
  },
  nodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '30%',
  },
  nodeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  edgeConnector: {
    alignItems: 'center',
    gap: 2,
  },
  edgeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  edgeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  headerSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  shareInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  shareInviteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expenseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  readOnlyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attributionText: {
    fontSize: 11,
  },
  disabledLockBtn: {
    padding: 6,
    opacity: 0.5,
  },
  inviteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inviteModalCard: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    padding: 20,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inviteModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  codeDisplayBox: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  codeDisplayText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteActionsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  copyCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  copyCodeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
