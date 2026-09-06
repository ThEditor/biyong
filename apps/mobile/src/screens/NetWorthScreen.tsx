import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import {
  Box,
  Text,
  Card,
  HStack,
  VStack,
} from '@gluestack-ui/themed';
import { formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { Investment, Liability } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import { AddInvestmentModal } from '../components/AddInvestmentModal';
import { AddLiabilityModal } from '../components/AddLiabilityModal';
import { PayLiabilityModal } from '../components/PayLiabilityModal';

export interface NetWorthScreenProps {
  onBack: () => void;
}

type TabType = 'overview' | 'investments' | 'liabilities';
type InvestmentFilter = 'all' | 'equity' | 'debt' | 'gold' | 'retirement' | 'other';

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: '#3B82F6',
  debt: '#10B981',
  'cash & bank': '#06B6D4',
  gold: '#F59E0B',
  retirement: '#8B5CF6',
  other: '#64748B',
};

const INVESTMENT_TYPE_TO_CLASS: Record<Investment['type'], InvestmentFilter> = {
  stock: 'equity',
  mutual_fund: 'equity',
  etf: 'equity',
  fd: 'debt',
  rd: 'debt',
  bond: 'debt',
  gold: 'gold',
  ppf: 'retirement',
  epf: 'retirement',
  nps: 'retirement',
  esop: 'other',
  other: 'other',
};

const INVESTMENT_TYPE_LABELS: Record<Investment['type'], string> = {
  mutual_fund: 'Mutual Fund',
  stock: 'Stock',
  etf: 'ETF',
  fd: 'Fixed Deposit',
  rd: 'Recurring Dep.',
  bond: 'Bond',
  gold: 'Gold / SGB',
  ppf: 'PPF',
  epf: 'EPF',
  nps: 'NPS',
  esop: 'ESOP',
  other: 'Other',
};

const LIABILITY_TYPE_LABELS: Record<Liability['type'], string> = {
  loan: 'Loan',
  credit_card: 'Credit Card',
  emi: 'EMI',
  bnpl: 'BNPL',
  other: 'Other Debt',
};

export const NetWorthScreen: React.FC<NetWorthScreenProps> = ({ onBack }) => {
  const { colors, tokens } = useAppTheme();
  const {
    netWorthMinor,
    wealthSummary,
    investments,
    liabilities,
    investmentAnalytics,
    liabilityAnalytics,
    historicalNetWorth,
    deleteInvestment,
    deleteLiability,
  } = useLedger();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [investmentFilter, setInvestmentFilter] = useState<InvestmentFilter>('all');

  // Modals state
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const [isAddLiabilityOpen, setIsAddLiabilityOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);

  const [payingLiability, setPayingLiability] = useState<Liability | null>(null);

  const totalAssetsMinor = wealthSummary?.totalAssetsMinor ?? 0;
  const totalLiabilitiesMinor = wealthSummary?.totalLiabilitiesMinor ?? 0;

  // Filtered investments
  const filteredInvestments = useMemo(() => {
    if (investmentFilter === 'all') return investments;
    return investments.filter((inv) => INVESTMENT_TYPE_TO_CLASS[inv.type] === investmentFilter);
  }, [investments, investmentFilter]);

  const handleDeleteInvestment = (inv: Investment) => {
    Alert.alert(
      'Delete Investment',
      `Are you sure you want to remove "${inv.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvestment(inv.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete investment.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteLiability = (liab: Liability) => {
    Alert.alert(
      'Delete Liability',
      `Are you sure you want to remove "${liab.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLiability(liab.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete liability.');
            }
          },
        },
      ]
    );
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      {/* Top Header Bar */}
      <HStack
        justifyContent="space-between"
        alignItems="center"
        px={16}
        pt={12}
        pb={12}
        borderBottomWidth={1}
        borderBottomColor={colors.border}
        backgroundColor={colors.surface}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={18} color={colors.textPrimary} style={{ marginRight: 4 }} />
          <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
            Back
          </Text>
        </TouchableOpacity>

        <Text color={colors.textPrimary} fontSize={17} fontWeight="700">
          Wealth & Net Worth
        </Text>

        <View
          style={[
            styles.currencyPill,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              borderRadius: tokens.radius.full,
            },
          ]}
        >
          <Text color={colors.textSecondary} fontSize={11} fontWeight="700">
            INR
          </Text>
        </View>
      </HStack>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Net Worth Card */}
        <Box
          backgroundColor={colors.accentPrimary}
          p={20}
          borderRadius={tokens.radius.lg}
          shadowColor={colors.accentPrimary}
          style={styles.heroCard}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.accentForeground} fontSize={12} fontWeight="700" letterSpacing={1} textTransform="uppercase">
              Total Net Worth
            </Text>
            <View style={[styles.heroBadge, { backgroundColor: colors.accentSubtle }]}>
              <Feather
                name={netWorthMinor >= 0 ? 'trending-up' : 'trending-down'}
                size={12}
                color={colors.accentPrimary}
                style={{ marginRight: 4 }}
              />
              <Text color={colors.accentPrimary} fontSize={11} fontWeight="700">
                {netWorthMinor >= 0 ? 'Solvent' : 'Deficit'}
              </Text>
            </View>
          </HStack>

          <Text color={colors.accentForeground} fontSize={32} fontWeight="800" mt={8} letterSpacing={-0.5}>
            {formatMoney(netWorthMinor, 'INR')}
          </Text>

          {/* Sub-row: Total Assets vs Total Liabilities */}
          <HStack
            justifyContent="space-between"
            alignItems="center"
            mt={16}
            pt={14}
            borderTopWidth={1}
            borderTopColor="rgba(255, 255, 255, 0.2)"
          >
            <VStack>
              <Text color={colors.accentForeground} opacity={0.8} fontSize={11} fontWeight="600">
                TOTAL ASSETS
              </Text>
              <Text color={colors.accentForeground} fontSize={15} fontWeight="700" mt={2}>
                +{formatMoney(totalAssetsMinor, 'INR')}
              </Text>
            </VStack>

            <View style={{ width: 1, height: 28, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

            <VStack alignItems="flex-end">
              <Text color={colors.accentForeground} opacity={0.8} fontSize={11} fontWeight="600">
                TOTAL LIABILITIES
              </Text>
              <Text color={colors.accentForeground} fontSize={15} fontWeight="700" mt={2}>
                -{formatMoney(totalLiabilitiesMinor, 'INR')}
              </Text>
            </VStack>
          </HStack>
        </Box>

        {/* Segmented Tab Switch (Overview | Investments | Liabilities) */}
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
          {(['overview', 'investments', 'liabilities'] as TabType[]).map((tab) => {
            const isSelected = activeTab === tab;
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
                style={[
                  styles.segmentBtn,
                  isSelected && {
                    backgroundColor: colors.surface,
                    borderRadius: tokens.radius.sm,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                <Text
                  color={isSelected ? colors.accentPrimary : colors.textSecondary}
                  fontSize={13}
                  fontWeight={isSelected ? '700' : '500'}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ======================= OVERVIEW TAB ======================= */}
        {activeTab === 'overview' && (
          <VStack space="md">
            {/* Asset Allocation Card */}
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.lg}
              p={16}
            >
              <HStack justifyContent="space-between" alignItems="center" mb={12}>
                <HStack space="xs" alignItems="center">
                  <Feather name="pie-chart" size={16} color={colors.accentPrimary} />
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="700">
                    Asset Allocation
                  </Text>
                </HStack>
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                  Total: {formatMoney(totalAssetsMinor, 'INR')}
                </Text>
              </HStack>

              {/* Progress Stack Bar */}
              {totalAssetsMinor > 0 ? (
                <>
                  <View style={styles.allocationStackBar}>
                    {wealthSummary?.assetAllocation.map((item, index) => {
                      const color =
                        ASSET_CLASS_COLORS[item.category.toLowerCase()] ||
                        ASSET_CLASS_COLORS.other;
                      return (
                        <View
                          key={index}
                          style={{
                            height: '100%',
                            width: `${Math.max(1, item.percentage)}%`,
                            backgroundColor: color,
                          }}
                        />
                      );
                    })}
                  </View>

                  {/* Allocation Legend */}
                  <VStack space="xs" mt={12}>
                    {wealthSummary?.assetAllocation.map((item, index) => {
                      const color =
                        ASSET_CLASS_COLORS[item.category.toLowerCase()] ||
                        ASSET_CLASS_COLORS.other;
                      return (
                        <HStack key={index} justifyContent="space-between" alignItems="center" py={4}>
                          <HStack space="xs" alignItems="center">
                            <View style={[styles.legendDot, { backgroundColor: color }]} />
                            <Text color={colors.textPrimary} fontSize={13} fontWeight="500">
                              {item.category}
                            </Text>
                          </HStack>
                          <HStack space="sm" alignItems="center">
                            <Text color={colors.textSecondary} fontSize={12} fontWeight="500">
                              {item.percentage}%
                            </Text>
                            <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                              {formatMoney(item.amountMinor, 'INR')}
                            </Text>
                          </HStack>
                        </HStack>
                      );
                    })}
                  </VStack>
                </>
              ) : (
                <Box py={16} alignItems="center">
                  <Feather name="inbox" size={24} color={colors.textSecondary} />
                  <Text color={colors.textSecondary} fontSize={13} mt={6}>
                    No assets recorded yet. Add accounts or investments to view allocation.
                  </Text>
                </Box>
              )}
            </Card>

            {/* Historical Net Worth Trajectory */}
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.lg}
              p={16}
            >
              <HStack justifyContent="space-between" alignItems="center" mb={12}>
                <HStack space="xs" alignItems="center">
                  <Feather name="activity" size={16} color={colors.accentPrimary} />
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="700">
                    Net Worth Trajectory
                  </Text>
                </HStack>
                <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                  Last 6 Months
                </Text>
              </HStack>

              {historicalNetWorth.length > 0 ? (
                <VStack space="xs">
                  {historicalNetWorth.map((pt, idx) => (
                    <Box
                      key={pt.date}
                      py={10}
                      borderBottomWidth={idx === historicalNetWorth.length - 1 ? 0 : 1}
                      borderBottomColor={colors.border}
                    >
                      <HStack justifyContent="space-between" alignItems="center">
                        <VStack>
                          <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                            {pt.date}
                          </Text>
                          <HStack space="xs" alignItems="center" mt={2}>
                            <Text color={colors.success} fontSize={11} fontWeight="500">
                              +{formatMoney(pt.assetsMinor, 'INR')}
                            </Text>
                            <Text color={colors.textSecondary} fontSize={11}>
                              /
                            </Text>
                            <Text color={colors.danger} fontSize={11} fontWeight="500">
                              -{formatMoney(pt.liabilitiesMinor, 'INR')}
                            </Text>
                          </HStack>
                        </VStack>

                        <Text
                          color={pt.netWorthMinor >= 0 ? colors.textPrimary : colors.danger}
                          fontSize={15}
                          fontWeight="700"
                        >
                          {formatMoney(pt.netWorthMinor, 'INR')}
                        </Text>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Box py={16} alignItems="center">
                  <Feather name="calendar" size={24} color={colors.textSecondary} />
                  <Text color={colors.textSecondary} fontSize={13} mt={6}>
                    Trajectory will appear as monthly snapshots accumulate.
                  </Text>
                </Box>
              )}
            </Card>
          </VStack>
        )}

        {/* ======================= INVESTMENTS TAB ======================= */}
        {activeTab === 'investments' && (
          <VStack space="md">
            {/* Portfolio Analytics Card */}
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.lg}
              p={16}
            >
              <HStack justifyContent="space-between" alignItems="center" mb={12}>
                <Text color={colors.textSecondary} fontSize={11} fontWeight="700" letterSpacing={0.5} textTransform="uppercase">
                  Portfolio Analytics
                </Text>
                {investmentAnalytics && investmentAnalytics.investedAmountMinor > 0 && (
                  <View
                    style={[
                      styles.heroBadge,
                      {
                        backgroundColor:
                          investmentAnalytics.totalGainMinor >= 0
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}
                  >
                    <Feather
                      name={investmentAnalytics.totalGainMinor >= 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={investmentAnalytics.totalGainMinor >= 0 ? colors.success : colors.danger}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      color={investmentAnalytics.totalGainMinor >= 0 ? colors.success : colors.danger}
                      fontSize={11}
                      fontWeight="700"
                    >
                      {investmentAnalytics.totalGainMinor >= 0 ? '+' : ''}
                      {investmentAnalytics.absoluteReturnPercent}%
                    </Text>
                  </View>
                )}
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="500">
                    Total Invested
                  </Text>
                  <Text color={colors.textPrimary} fontSize={18} fontWeight="700" mt={2}>
                    {formatMoney(investmentAnalytics?.investedAmountMinor ?? 0, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="500">
                    Current Value
                  </Text>
                  <Text color={colors.textPrimary} fontSize={18} fontWeight="700" mt={2}>
                    {formatMoney(investmentAnalytics?.currentValueMinor ?? 0, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              {investmentAnalytics && (
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  mt={14}
                  pt={10}
                  borderTopWidth={1}
                  borderTopColor={colors.border}
                >
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
                    Absolute Return
                  </Text>
                  <Text
                    color={investmentAnalytics.totalGainMinor >= 0 ? colors.success : colors.danger}
                    fontSize={14}
                    fontWeight="700"
                  >
                    {investmentAnalytics.totalGainMinor >= 0 ? '+' : ''}
                    {formatMoney(investmentAnalytics.totalGainMinor, 'INR')}
                  </Text>
                </HStack>
              )}
            </Card>

            {/* Category Filter Pills & Add Button */}
            <HStack justifyContent="space-between" alignItems="center">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {(['all', 'equity', 'debt', 'gold', 'retirement', 'other'] as InvestmentFilter[]).map((f) => {
                  const isSelected = investmentFilter === f;
                  const label = f.charAt(0).toUpperCase() + f.slice(1);
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setInvestmentFilter(f)}
                      activeOpacity={0.7}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSelected ? colors.accentPrimary : colors.surface,
                          borderColor: isSelected ? colors.accentPrimary : colors.border,
                          borderRadius: tokens.radius.full,
                        },
                      ]}
                    >
                      <Text
                        color={isSelected ? colors.accentForeground : colors.textSecondary}
                        fontSize={12}
                        fontWeight={isSelected ? '700' : '500'}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </HStack>

            {/* Top Action Button */}
            <TouchableOpacity
              onPress={() => {
                setEditingInvestment(null);
                setIsAddInvestmentOpen(true);
              }}
              activeOpacity={0.8}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Feather name="plus" size={16} color={colors.accentForeground} style={{ marginRight: 6 }} />
              <Text color={colors.accentForeground} fontSize={14} fontWeight="700">
                Add Investment
              </Text>
            </TouchableOpacity>

            {/* Investment Cards List */}
            {filteredInvestments.length > 0 ? (
              <VStack space="sm">
                {filteredInvestments.map((inv) => {
                  const gain = inv.currentValueMinor - inv.investedAmountMinor;
                  const pct =
                    inv.investedAmountMinor > 0
                      ? Math.round((gain / inv.investedAmountMinor) * 100)
                      : 0;

                  return (
                    <Card
                      key={inv.id}
                      backgroundColor={colors.surface}
                      borderColor={colors.border}
                      borderWidth={1}
                      borderRadius={tokens.radius.md}
                      p={14}
                    >
                      <HStack justifyContent="space-between" alignItems="flex-start">
                        <VStack flex={1} mr={8}>
                          <Text color={colors.textPrimary} fontSize={15} fontWeight="700">
                            {inv.name}
                          </Text>
                          <HStack space="xs" alignItems="center" mt={4}>
                            <View
                              style={[
                                styles.typePill,
                                {
                                  backgroundColor: colors.surfaceSubtle,
                                  borderColor: colors.border,
                                  borderRadius: tokens.radius.sm,
                                },
                              ]}
                            >
                              <Text color={colors.textSecondary} fontSize={10} fontWeight="700">
                                {INVESTMENT_TYPE_LABELS[inv.type] || inv.type.toUpperCase()}
                              </Text>
                            </View>
                            {inv.notes && (
                              <Text color={colors.textSecondary} fontSize={11} numberOfLines={1} flex={1}>
                                • {inv.notes}
                              </Text>
                            )}
                          </HStack>
                        </VStack>

                        {/* Edit & Delete Action Buttons */}
                        <HStack space="xs" alignItems="center">
                          <TouchableOpacity
                            onPress={() => {
                              setEditingInvestment(inv);
                              setIsAddInvestmentOpen(true);
                            }}
                            style={styles.cardActionIcon}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteInvestment(inv)}
                            style={styles.cardActionIcon}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="trash-2" size={14} color={colors.danger} />
                          </TouchableOpacity>
                        </HStack>
                      </HStack>

                      {/* Amounts row */}
                      <HStack justifyContent="space-between" alignItems="flex-end" mt={12} pt={10} borderTopWidth={1} borderTopColor={colors.border}>
                        <VStack>
                          <Text color={colors.textSecondary} fontSize={11}>
                            Invested
                          </Text>
                          <Text color={colors.textSecondary} fontSize={13} fontWeight="600" mt={1}>
                            {formatMoney(inv.investedAmountMinor, inv.currency)}
                          </Text>
                        </VStack>

                        <VStack alignItems="center">
                          <Text color={colors.textSecondary} fontSize={11}>
                            Current
                          </Text>
                          <Text color={colors.textPrimary} fontSize={15} fontWeight="700" mt={1}>
                            {formatMoney(inv.currentValueMinor, inv.currency)}
                          </Text>
                        </VStack>

                        <VStack alignItems="flex-end">
                          <View
                            style={[
                              styles.returnBadge,
                              {
                                backgroundColor:
                                  gain >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              },
                            ]}
                          >
                            <Text
                              color={gain >= 0 ? colors.success : colors.danger}
                              fontSize={11}
                              fontWeight="700"
                            >
                              {gain >= 0 ? '+' : ''}
                              {pct}% ({gain >= 0 ? '+' : ''}
                              {formatMoney(gain, inv.currency)})
                            </Text>
                          </View>
                        </VStack>
                      </HStack>
                    </Card>
                  );
                })}
              </VStack>
            ) : (
              <Box
                py={36}
                px={20}
                alignItems="center"
                backgroundColor={colors.surface}
                borderRadius={tokens.radius.lg}
                borderWidth={1}
                borderColor={colors.border}
              >
                <Feather name="trending-up" size={32} color={colors.textSecondary} />
                <Text color={colors.textPrimary} fontSize={15} fontWeight="700" mt={12}>
                  No Investments Added
                </Text>
                <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4}>
                  Track your stocks, mutual funds, gold, and deposits all in one place.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingInvestment(null);
                    setIsAddInvestmentOpen(true);
                  }}
                  style={[
                    styles.ctaBtn,
                    {
                      backgroundColor: colors.accentPrimary,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                >
                  <Text color={colors.accentForeground} fontSize={13} fontWeight="700">
                    + Add Your First Investment
                  </Text>
                </TouchableOpacity>
              </Box>
            )}
          </VStack>
        )}

        {/* ======================= LIABILITIES TAB ======================= */}
        {activeTab === 'liabilities' && (
          <VStack space="md">
            {/* Debt Analytics Card */}
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.lg}
              p={16}
            >
              <HStack justifyContent="space-between" alignItems="center" mb={12}>
                <Text color={colors.textSecondary} fontSize={11} fontWeight="700" letterSpacing={0.5} textTransform="uppercase">
                  Debt Analytics
                </Text>
                {liabilityAnalytics && (
                  <Text color={colors.accentPrimary} fontSize={12} fontWeight="700">
                    {liabilityAnalytics.payoffProgressPercent}% Paid Off
                  </Text>
                )}
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="500">
                    Total Principal
                  </Text>
                  <Text color={colors.textPrimary} fontSize={18} fontWeight="700" mt={2}>
                    {formatMoney(liabilityAnalytics?.totalPrincipalMinor ?? 0, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="500">
                    Outstanding
                  </Text>
                  <Text color={colors.danger} fontSize={18} fontWeight="700" mt={2}>
                    {formatMoney(liabilityAnalytics?.totalRemainingMinor ?? 0, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              {/* Payoff Progress Bar */}
              <View style={[styles.progressTrack, { backgroundColor: colors.border, marginTop: 14 }]}>
                <View
                  style={{
                    height: '100%',
                    width: `${liabilityAnalytics?.payoffProgressPercent ?? 0}%`,
                    backgroundColor: colors.accentPrimary,
                    borderRadius: tokens.radius.full,
                  }}
                />
              </View>
            </Card>

            {/* Top Action Button */}
            <TouchableOpacity
              onPress={() => {
                setEditingLiability(null);
                setIsAddLiabilityOpen(true);
              }}
              activeOpacity={0.8}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.accentPrimary,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Feather name="plus" size={16} color={colors.accentForeground} style={{ marginRight: 6 }} />
              <Text color={colors.accentForeground} fontSize={14} fontWeight="700">
                Add Liability
              </Text>
            </TouchableOpacity>

            {/* Liability Cards List */}
            {liabilities.length > 0 ? (
              <VStack space="sm">
                {liabilities.map((liab) => {
                  return (
                    <Card
                      key={liab.id}
                      backgroundColor={colors.surface}
                      borderColor={colors.border}
                      borderWidth={1}
                      borderRadius={tokens.radius.md}
                      p={14}
                    >
                      <HStack justifyContent="space-between" alignItems="flex-start">
                        <VStack flex={1} mr={8}>
                          <Text color={colors.textPrimary} fontSize={15} fontWeight="700">
                            {liab.name}
                          </Text>
                          <HStack space="xs" alignItems="center" mt={4}>
                            <View
                              style={[
                                styles.typePill,
                                {
                                  backgroundColor: colors.surfaceSubtle,
                                  borderColor: colors.border,
                                  borderRadius: tokens.radius.sm,
                                },
                              ]}
                            >
                              <Text color={colors.textSecondary} fontSize={10} fontWeight="700">
                                {LIABILITY_TYPE_LABELS[liab.type] || liab.type.toUpperCase()}
                              </Text>
                            </View>
                            {liab.interestRatePercent > 0 && (
                              <Text color={colors.textSecondary} fontSize={11}>
                                • {liab.interestRatePercent}% p.a.
                              </Text>
                            )}
                            {liab.dueDate && (
                              <Text color={colors.textSecondary} fontSize={11}>
                                • Due: {liab.dueDate}
                              </Text>
                            )}
                          </HStack>
                        </VStack>

                        {/* Edit & Delete Action Buttons */}
                        <HStack space="xs" alignItems="center">
                          <TouchableOpacity
                            onPress={() => {
                              setEditingLiability(liab);
                              setIsAddLiabilityOpen(true);
                            }}
                            style={styles.cardActionIcon}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteLiability(liab)}
                            style={styles.cardActionIcon}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="trash-2" size={14} color={colors.danger} />
                          </TouchableOpacity>
                        </HStack>
                      </HStack>

                      {/* Amounts & Pay CTA Row */}
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                        mt={12}
                        pt={10}
                        borderTopWidth={1}
                        borderTopColor={colors.border}
                      >
                        <VStack>
                          <Text color={colors.textSecondary} fontSize={11}>
                            Remaining Outstanding
                          </Text>
                          <Text color={colors.danger} fontSize={16} fontWeight="700" mt={1}>
                            {formatMoney(liab.remainingAmountMinor, liab.currency)}
                          </Text>
                        </VStack>

                        <TouchableOpacity
                          onPress={() => setPayingLiability(liab)}
                          activeOpacity={0.7}
                          style={[
                            styles.payBtn,
                            {
                              backgroundColor: colors.surfaceSubtle,
                              borderColor: colors.border,
                              borderRadius: tokens.radius.sm,
                            },
                          ]}
                        >
                          <Feather name="arrow-down-left" size={13} color={colors.accentPrimary} style={{ marginRight: 4 }} />
                          <Text color={colors.accentPrimary} fontSize={12} fontWeight="700">
                            Pay
                          </Text>
                        </TouchableOpacity>
                      </HStack>
                    </Card>
                  );
                })}
              </VStack>
            ) : (
              <Box
                py={36}
                px={20}
                alignItems="center"
                backgroundColor={colors.surface}
                borderRadius={tokens.radius.lg}
                borderWidth={1}
                borderColor={colors.border}
              >
                <Feather name="shield" size={32} color={colors.textSecondary} />
                <Text color={colors.textPrimary} fontSize={15} fontWeight="700" mt={12}>
                  No Liabilities
                </Text>
                <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4}>
                  You are currently debt-free, or haven't recorded any loans or credit cards yet.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingLiability(null);
                    setIsAddLiabilityOpen(true);
                  }}
                  style={[
                    styles.ctaBtn,
                    {
                      backgroundColor: colors.accentPrimary,
                      borderRadius: tokens.radius.md,
                    },
                  ]}
                >
                  <Text color={colors.accentForeground} fontSize={13} fontWeight="700">
                    + Add A Liability
                  </Text>
                </TouchableOpacity>
              </Box>
            )}
          </VStack>
        )}
      </ScrollView>

      {/* Add / Edit Investment Modal */}
      <AddInvestmentModal
        visible={isAddInvestmentOpen}
        onClose={() => {
          setIsAddInvestmentOpen(false);
          setEditingInvestment(null);
        }}
        editingInvestment={editingInvestment}
      />

      {/* Add / Edit Liability Modal */}
      <AddLiabilityModal
        visible={isAddLiabilityOpen}
        onClose={() => {
          setIsAddLiabilityOpen(false);
          setEditingLiability(null);
        }}
        editingLiability={editingLiability}
      />

      {/* Pay Liability Modal */}
      <PayLiabilityModal
        visible={payingLiability !== null}
        onClose={() => setPayingLiability(null)}
        liability={payingLiability}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  currencyPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroCard: {
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  segmentContainer: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allocationStackBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 12,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  cardActionIcon: {
    padding: 6,
  },
  returnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  ctaBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
