import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  Box,
  Text,
  Card,
  HStack,
  VStack,
  Badge,
  BadgeText,
  Button,
  ButtonText,
} from '@gluestack-ui/themed';
import type { Transaction } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import { TransactionItem } from '../components/TransactionItem';
import { SplitTransactionModal } from '../components/SplitTransactionModal';

export interface HomeScreenProps {
  onNavigateToAccounts: () => void;
  onNavigateToTransactions: () => void;
  onNavigateToGroups: () => void;
  onNavigateToReports?: () => void;
  onNavigateToPlan?: () => void;
  onNavigateToNetWorth?: () => void;
  onNavigateToIntelligence?: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToAccounts,
  onNavigateToTransactions,
  onNavigateToGroups,
  onNavigateToReports,
  onNavigateToPlan,
  onNavigateToNetWorth,
  onNavigateToIntelligence,
}) => {
  const { colors, tokens } = useAppTheme();
  const {
    netWorthMinor,
    wealthSummary,
    accounts,
    transactions,
    categories,
    budgets,
    peerDebtSummary,
    subscriptionBurnRate,
    reimbursementSummary,
    anomalies,
    openAddModal,
    openEditModal,
    isGuest,
    syncStatus,
    pendingSyncCount,
    syncNow,
    openAuthModal,
  } = useLedger();

  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);

  const now = new Date();
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Cashflow for current month
  const { monthIncomeMinor, monthExpenseMinor } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === 'income') income += tx.amountMinor;
        if (tx.type === 'expense') expense += tx.amountMinor;
      }
    }
    return { monthIncomeMinor: income, monthExpenseMinor: expense };
  }, [transactions, currentMonthPrefix]);

  // Safe to spend calculation
  const safeToSpend = useMemo(() => {
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.effectiveBudgetMinor, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spentMinor, 0);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, daysInMonth - now.getDate());

    if (totalBudgeted > 0) {
      const remaining = Math.max(0, totalBudgeted - totalSpent);
      const percentUsed = Math.min(100, Math.round((totalSpent / totalBudgeted) * 100));
      const percentSafe = Math.max(0, 100 - percentUsed);
      return {
        safeMinor: remaining,
        targetMinor: totalBudgeted,
        percentSafe,
        daysRemaining,
        hasBudget: true,
      };
    }

    // Default fallback if no budgets set
    const net = Math.max(0, monthIncomeMinor - monthExpenseMinor);
    return {
      safeMinor: net,
      targetMinor: Math.max(net, monthIncomeMinor || 5000000),
      percentSafe: monthIncomeMinor > 0 ? Math.max(0, Math.round((net / monthIncomeMinor) * 100)) : 100,
      daysRemaining,
      hasBudget: false,
    };
  }, [budgets, monthIncomeMinor, monthExpenseMinor, now]);

  let syncIcon: keyof typeof Ionicons.glyphMap = 'cloud-done-outline';
  let syncLabel = 'Synced';
  let syncColor = colors.success;

  if (isGuest) {
    syncIcon = 'cloud-offline-outline';
    syncLabel = 'Guest';
    syncColor = colors.textSecondary;
  } else if (syncStatus === 'syncing') {
    syncIcon = 'cloud-upload-outline';
    syncLabel = 'Syncing...';
    syncColor = colors.accentPrimary;
  } else if (pendingSyncCount > 0) {
    syncIcon = 'cloud-upload-outline';
    syncLabel = `Sync (${pendingSyncCount})`;
    syncColor = colors.warning;
  }

  const handleSyncPress = () => {
    if (isGuest) {
      openAuthModal();
    } else {
      syncNow();
    }
  };

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const recentTransactions = transactions.slice(0, 5);

  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || 'Unknown Account';
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return undefined;
    return categories.find((c) => c.id === id)?.name;
  };

  const getAccountIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'bank':
        return 'business-outline';
      case 'cash':
        return 'cash-outline';
      case 'credit':
      case 'debit':
        return 'card-outline';
      case 'investment':
        return 'trending-up-outline';
      default:
        return 'wallet-outline';
    }
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header Navigation matching Mockup */}
        <HStack justifyContent="space-between" alignItems="center" mt={4} mb={2}>
          <HStack alignItems="center" space="sm">
            <View
              style={[
                styles.profileAvatar,
                {
                  backgroundColor: isGuest ? colors.surfaceSubtle : colors.accentPrimary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name={isGuest ? 'person-outline' : 'person'}
                size={18}
                color={isGuest ? colors.textSecondary : colors.accentForeground}
              />
            </View>
            <VStack>
              <Text color={colors.textPrimary} fontSize={18} fontWeight="800" letterSpacing={-0.3}>
                biyong
              </Text>
              <Text color={colors.textSecondary} fontSize={11} fontWeight="500">
                {currentMonthLabel}
              </Text>
            </VStack>
          </HStack>

          <HStack space="xs" alignItems="center">
            {/* Cloud Sync Status Pill Button */}
            <TouchableOpacity
              onPress={handleSyncPress}
              style={[
                styles.syncPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.full,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name={syncIcon} size={14} color={syncColor} />
              <Text style={[styles.syncPillText, { color: colors.textPrimary }]}>
                {syncLabel}
              </Text>
            </TouchableOpacity>
          </HStack>
        </HStack>

        {/* Hero Current Balance Card (Theme-Adaptive Accent Banner) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onNavigateToAccounts}
          style={[
            styles.heroCardContainer,
            {
              backgroundColor: colors.accentPrimary,
              shadowColor: colors.accentPrimary,
              borderRadius: tokens.radius.lg,
            },
          ]}
        >
          <View style={styles.heroCardContent}>
            <HStack justifyContent="space-between" alignItems="center">
              <HStack alignItems="center" space="xs">
                <Text style={[styles.heroLabel, { color: colors.accentForeground }]}>
                  CURRENT BALANCE
                </Text>
                <TouchableOpacity
                  onPress={() => setIsBalanceHidden(!isBalanceHidden)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={colors.accentForeground}
                  />
                </TouchableOpacity>
              </HStack>
              <HStack alignItems="center" space="xs">
                <Text style={[styles.heroCurrency, { color: colors.accentForeground }]}>
                  INR
                </Text>
                <Feather name="chevron-right" size={14} color={colors.accentForeground} />
              </HStack>
            </HStack>

            <Text style={[styles.heroAmount, { color: colors.accentForeground }]}>
              {isBalanceHidden ? '₹ ••••••' : formatMoney(netWorthMinor, 'INR')}
            </Text>

            <HStack justifyContent="space-between" alignItems="center" mt={8}>
              <Text style={[styles.heroSubtitle, { color: colors.accentForeground }]}>
                {activeAccounts.length === 0
                  ? 'Tap to add your first account'
                  : `Across ${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'}`}
              </Text>
              <View style={[styles.trendBadge, { backgroundColor: colors.accentSubtle }]}>
                <Feather name="trending-up" size={11} color={colors.accentPrimary} style={{ marginRight: 4 }} />
                <Text style={[styles.trendBadgeText, { color: colors.accentPrimary }]}>Active</Text>
              </View>
            </HStack>
          </View>
        </TouchableOpacity>

        {/* Quick Action Pills Row */}
        <HStack space="xs" justifyContent="space-between">
          <TouchableOpacity
            onPress={() => openAddModal('expense')}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: tokens.radius.md,
              },
            ]}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Feather name="arrow-up-right" size={15} color={colors.danger} />
            </View>
            <Text color={colors.textPrimary} fontSize={11} fontWeight="700" mt={4}>
              Expense
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openAddModal('transfer')}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: tokens.radius.md,
              },
            ]}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
              <Feather name="repeat" size={15} color="#6366F1" />
            </View>
            <Text color={colors.textPrimary} fontSize={11} fontWeight="700" mt={4}>
              Transfer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNavigateToGroups}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: tokens.radius.md,
              },
            ]}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="people" size={15} color={colors.success} />
            </View>
            <Text color={colors.textPrimary} fontSize={11} fontWeight="700" mt={4}>
              Split
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNavigateToAccounts}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: tokens.radius.md,
              },
            ]}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="wallet-outline" size={15} color={colors.accentPrimary} />
            </View>
            <Text color={colors.textPrimary} fontSize={11} fontWeight="700" mt={4}>
              Accounts
            </Text>
          </TouchableOpacity>
        </HStack>

        {/* Wealth & Net Worth Banner Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onNavigateToNetWorth?.()}
        >
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.lg}
            p={tokens.spacing.md}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <HStack space="sm" alignItems="center">
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.accentSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="layers" size={18} color={colors.accentPrimary} />
                </View>
                <VStack>
                  <HStack space="xs" alignItems="center">
                    <Text color={colors.textSecondary} fontSize={11} fontWeight="700" letterSpacing={0.5} textTransform="uppercase">
                      Wealth & Net Worth
                    </Text>
                  </HStack>
                  <Text color={colors.textPrimary} fontSize={16} fontWeight="800" mt={2}>
                    {isBalanceHidden ? '₹ ••••••' : formatMoney(wealthSummary?.netWorthMinor ?? netWorthMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              <HStack space="xs" alignItems="center">
                <VStack alignItems="flex-end" mr={4}>
                  <Text color={colors.success} fontSize={11} fontWeight="600">
                    +{formatMoney(wealthSummary?.totalAssetsMinor ?? netWorthMinor, 'INR')}
                  </Text>
                  <Text color={colors.danger} fontSize={11} fontWeight="600">
                    -{formatMoney(wealthSummary?.totalLiabilitiesMinor ?? 0, 'INR')}
                  </Text>
                </VStack>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </HStack>
            </HStack>
          </Card>
        </TouchableOpacity>

        {/* Intelligence & Advanced Workflows Hub Banner */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onNavigateToIntelligence?.()}
        >
          <Card
            backgroundColor={colors.surface}
            borderColor={anomalies.length > 0 ? colors.warning : colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.lg}
            p={tokens.spacing.md}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <HStack space="sm" alignItems="center" flex={1}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: anomalies.length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name={anomalies.length > 0 ? 'alert-triangle' : 'zap'}
                    size={18}
                    color={anomalies.length > 0 ? colors.warning : '#6366F1'}
                  />
                </View>
                <VStack flex={1}>
                  <HStack space="xs" alignItems="center">
                    <Text color={colors.textSecondary} fontSize={11} fontWeight="700" letterSpacing={0.5} textTransform="uppercase">
                      Intelligence & Workflows
                    </Text>
                    {anomalies.length > 0 && (
                      <Badge backgroundColor="rgba(245, 158, 11, 0.2)" borderRadius={tokens.radius.full} px={6} py={1}>
                        <BadgeText color={colors.warning} fontSize={10} fontWeight="700">
                          {anomalies.length} Alert{anomalies.length > 1 ? 's' : ''}
                        </BadgeText>
                      </Badge>
                    )}
                  </HStack>
                  <Text color={colors.textPrimary} fontSize={13} fontWeight="600" mt={2} numberOfLines={1}>
                    {anomalies.length > 0
                      ? `${anomalies[0].title} (${anomalies.length} anomaly detected)`
                      : `Natural language queries, runway & debt tracker`}
                  </Text>
                </VStack>
              </HStack>

              <Feather name="chevron-right" size={16} color={colors.textSecondary} />
            </HStack>
          </Card>
        </TouchableOpacity>

        {/* Cashflow Summary Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onNavigateToReports?.()}
        >
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.lg}
            p={tokens.spacing.md}
          >
            <HStack justifyContent="space-between" alignItems="center" mb={10}>
              <HStack alignItems="center" space="xs">
                <Ionicons name="pie-chart-outline" size={15} color={colors.accentPrimary} />
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
                  CASHFLOW ({MONTH_NAMES[now.getMonth()]?.substring(0, 3)?.toUpperCase()})
                </Text>
              </HStack>
              <HStack alignItems="center" space="xs">
                <Text color={colors.accentPrimary} fontSize={11} fontWeight="600">
                  Reports
                </Text>
                <Feather name="chevron-right" size={13} color={colors.accentPrimary} />
              </HStack>
            </HStack>

            <HStack justifyContent="space-between" alignItems="center">
              <HStack space="sm" alignItems="center" flex={1}>
                <View style={[styles.cashflowIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Feather name="arrow-down-left" size={16} color={colors.success} />
                </View>
                <VStack>
                  <Text color={colors.textMuted} fontSize={10} fontWeight="600">
                    Income
                  </Text>
                  <Text color={colors.success} fontSize={16} fontWeight="800">
                    +{formatMoney(monthIncomeMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              <View style={[styles.verticalSeparator, { backgroundColor: colors.border }]} />

              <HStack space="sm" alignItems="center" flex={1} pl={12}>
                <View style={[styles.cashflowIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Feather name="arrow-up-right" size={16} color={colors.danger} />
                </View>
                <VStack>
                  <Text color={colors.textMuted} fontSize={10} fontWeight="600">
                    Expenses
                  </Text>
                  <Text color={colors.danger} fontSize={16} fontWeight="800">
                    -{formatMoney(monthExpenseMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>
            </HStack>
          </Card>
        </TouchableOpacity>

        {/* Safe to Spend Widget */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onNavigateToPlan?.()}
        >
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.lg}
            p={tokens.spacing.md}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <HStack alignItems="center" space="md" flex={1}>
                {/* Gauge percentage ring badge */}
                <View
                  style={[
                    styles.gaugeRing,
                    {
                      borderColor: safeToSpend.percentSafe > 40 ? colors.success : colors.warning,
                      backgroundColor: colors.surfaceSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.gaugePercentText,
                      {
                        color: safeToSpend.percentSafe > 40 ? colors.success : colors.warning,
                      },
                    ]}
                  >
                    {safeToSpend.percentSafe}%
                  </Text>
                </View>

                <VStack flex={1}>
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.6}>
                    SAFE TO SPEND
                  </Text>
                  <Text color={colors.textPrimary} fontSize={18} fontWeight="800" mt={1}>
                    {formatMoney(safeToSpend.safeMinor, 'INR')}
                  </Text>
                  <Text color={colors.textMuted} fontSize={11} mt={1}>
                    {safeToSpend.hasBudget
                      ? `of ${formatMoney(safeToSpend.targetMinor, 'INR')} budgeted`
                      : 'Set category budgets in Plan'}
                  </Text>
                </VStack>
              </HStack>

              <Badge
                backgroundColor={colors.surfaceSubtle}
                borderColor={colors.border}
                borderWidth={1}
                borderRadius={tokens.radius.sm}
                px={8}
                py={4}
              >
                <BadgeText color={colors.textSecondary} fontSize={10} fontWeight="bold">
                  {safeToSpend.daysRemaining} days left
                </BadgeText>
              </Badge>
            </HStack>
          </Card>
        </TouchableOpacity>

        {/* Accounts Carousel Preview */}
        <VStack space="sm">
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              YOUR ACCOUNTS
            </Text>
            <TouchableOpacity onPress={onNavigateToAccounts}>
              <HStack alignItems="center" space="xs">
                <Text color={colors.accentPrimary} fontSize={12} fontWeight="600">
                  Manage
                </Text>
                <Feather name="chevron-right" size={14} color={colors.accentPrimary} />
              </HStack>
            </TouchableOpacity>
          </HStack>

          {activeAccounts.length === 0 ? (
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.lg}
              alignItems="center"
            >
              <Box
                width={44}
                height={44}
                borderRadius={tokens.radius.full}
                backgroundColor={colors.surfaceSubtle}
                alignItems="center"
                justifyContent="center"
                mb={8}
              >
                <Ionicons name="wallet-outline" size={22} color={colors.textSecondary} />
              </Box>
              <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                No Accounts Configured
              </Text>
              <Text color={colors.textSecondary} fontSize={12} textAlign="center" mt={4} mb={10}>
                Add a bank, credit card, or cash wallet to start tracking.
              </Text>
              <Button
                onPress={onNavigateToAccounts}
                backgroundColor={colors.accentPrimary}
                borderRadius={tokens.radius.sm}
                size="xs"
              >
                <ButtonText color={colors.accentForeground} fontSize={12} fontWeight="bold">
                  + Add Account
                </ButtonText>
              </Button>
            </Card>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountsScroll}
            >
              {activeAccounts.map((acc) => (
                <Card
                  key={acc.id}
                  backgroundColor={colors.surface}
                  borderColor={colors.border}
                  borderWidth={1}
                  borderRadius={tokens.radius.md}
                  p={tokens.spacing.md}
                  width={160}
                >
                  <TouchableOpacity onPress={onNavigateToAccounts}>
                    <HStack justifyContent="space-between" alignItems="center" mb={8}>
                      <Box
                        width={28}
                        height={28}
                        borderRadius={tokens.radius.sm}
                        backgroundColor={colors.surfaceSubtle}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons
                          name={getAccountIcon(acc.type)}
                          size={15}
                          color={colors.accentPrimary}
                        />
                      </Box>
                      <Badge
                        backgroundColor={colors.surfaceSubtle}
                        borderRadius={tokens.radius.sm}
                        px={4}
                        py={1}
                      >
                        <BadgeText color={colors.textSecondary} fontSize={9} fontWeight="bold">
                          {acc.type.toUpperCase()}
                        </BadgeText>
                      </Badge>
                    </HStack>

                    <Text
                      color={colors.textPrimary}
                      fontSize={13}
                      fontWeight="600"
                      numberOfLines={1}
                    >
                      {acc.name}
                    </Text>

                    <Text
                      color={acc.derivedBalanceMinor >= 0 ? colors.textPrimary : colors.danger}
                      fontSize={16}
                      fontWeight="bold"
                      mt={4}
                    >
                      {formatMoney(acc.derivedBalanceMinor, 'INR')}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </ScrollView>
          )}
        </VStack>

        {/* Recent Transactions Section */}
        <VStack space="sm">
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              RECENT TRANSACTIONS
            </Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity onPress={onNavigateToTransactions}>
                <HStack alignItems="center" space="xs">
                  <Text color={colors.accentPrimary} fontSize={12} fontWeight="600">
                    See All
                  </Text>
                  <Feather name="chevron-right" size={14} color={colors.accentPrimary} />
                </HStack>
              </TouchableOpacity>
            )}
          </HStack>

          {recentTransactions.length === 0 ? (
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.lg}
              alignItems="center"
            >
              <Box
                width={44}
                height={44}
                borderRadius={tokens.radius.full}
                backgroundColor={colors.surfaceSubtle}
                alignItems="center"
                justifyContent="center"
                mb={8}
              >
                <Ionicons name="receipt-outline" size={22} color={colors.textSecondary} />
              </Box>
              <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                No Transactions Yet
              </Text>
              <Text color={colors.textSecondary} fontSize={12} textAlign="center" mt={4}>
                Tap the + button below to log your first transaction.
              </Text>
            </Card>
          ) : (
            recentTransactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                accountName={getAccountName(tx.accountId)}
                toAccountName={tx.toAccountId ? getAccountName(tx.toAccountId) : undefined}
                categoryName={getCategoryName(tx.categoryId)}
                onPress={openEditModal}
                onSplit={(txToSplit) => setSplittingTransaction(txToSplit)}
              />
            ))
          )}
        </VStack>
      </ScrollView>

      <SplitTransactionModal
        visible={!!splittingTransaction}
        transaction={splittingTransaction}
        onClose={() => setSplittingTransaction(null)}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    gap: 5,
  },
  syncPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroCardContainer: {
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  heroCardContent: {
    padding: 20,
  },
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroCurrency: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  trendBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  quickActionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalSeparator: {
    width: 1,
    height: 36,
  },
  gaugeRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  accountsScroll: {
    gap: 10,
  },
});
