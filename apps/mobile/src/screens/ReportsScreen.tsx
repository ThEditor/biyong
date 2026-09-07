import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { generateMonthlyReport, formatMoney } from '@biyong/domain';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  Box,
  Text,
  Card,
  HStack,
  VStack,
  Badge,
  BadgeText,
} from '@gluestack-ui/themed';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

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

export const ReportsScreen: React.FC = () => {
  const { colors, tokens } = useAppTheme();
  const {
    transactions,
    categories,
    fixedVsVariable,
    spendingTrends,
    personalSpendingBreakdown,
    reimbursementSummary,
    subscriptionBurnRate,
  } = useLedger();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed (1-12)

  const formatTrendMonth = (periodStr: string) => {
    const [y, m] = periodStr.split('-');
    const mIndex = parseInt(m, 10) - 1;
    return `${MONTH_NAMES[mIndex]?.substring(0, 3) ?? m} ${y}`;
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const report = useMemo(() => {
    return generateMonthlyReport(transactions, selectedYear, selectedMonth, categories);
  }, [transactions, selectedYear, selectedMonth, categories]);

  const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  const hasData = report.totalIncomeMinor > 0 || report.totalExpenseMinor > 0;

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Navigation Card */}
        <Card
          backgroundColor={colors.surface}
          borderColor={colors.border}
          borderWidth={1}
          borderRadius={tokens.radius.md}
          p={tokens.spacing.md}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn}>
              <Feather name="chevron-left" size={20} color={colors.accentPrimary} />
            </TouchableOpacity>

            <VStack alignItems="center">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
                MONTHLY CASH FLOW
              </Text>
              <Text color={colors.textPrimary} fontSize={18} fontWeight="bold" mt={2}>
                {monthLabel}
              </Text>
            </VStack>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn}>
              <Feather name="chevron-right" size={20} color={colors.accentPrimary} />
            </TouchableOpacity>
          </HStack>
        </Card>

        {/* 4 Summary Cards Grid */}
        <VStack space="md">
          <HStack space="md">
            {/* Total Income Card */}
            <Card
              flex={1}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  TOTAL INCOME
                </Text>
                <Feather name="arrow-down-left" size={14} color={colors.success} />
              </HStack>
              <Text color={colors.success} fontSize={18} fontWeight="bold" mt={6}>
                +{formatMoney(report.totalIncomeMinor, 'INR')}
              </Text>
              <Text color={colors.textMuted} fontSize={10} mt={2}>
                Earned this month
              </Text>
            </Card>

            {/* Total Expense Card */}
            <Card
              flex={1}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  TOTAL SPENT
                </Text>
                <Feather name="arrow-up-right" size={14} color={colors.danger} />
              </HStack>
              <Text color={colors.danger} fontSize={18} fontWeight="bold" mt={6}>
                -{formatMoney(report.totalExpenseMinor, 'INR')}
              </Text>
              <Text color={colors.textMuted} fontSize={10} mt={2}>
                Transfers excluded
              </Text>
            </Card>
          </HStack>

          <HStack space="md">
            {/* Net Savings Card */}
            <Card
              flex={1}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  NET SAVINGS
                </Text>
                <Feather name="shield" size={14} color={colors.accentPrimary} />
              </HStack>
              <Text
                color={report.netSavingsMinor >= 0 ? colors.textPrimary : colors.danger}
                fontSize={18}
                fontWeight="bold"
                mt={6}
              >
                {formatMoney(report.netSavingsMinor, 'INR')}
              </Text>
              <Text color={colors.textMuted} fontSize={10} mt={2}>
                Income minus expenses
              </Text>
            </Card>

            {/* Savings Rate Card */}
            <Card
              flex={1}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                  SAVINGS RATE
                </Text>
                <Feather name="percent" size={14} color={colors.accentPrimary} />
              </HStack>
              <HStack alignItems="center" space="xs" mt={6}>
                <Text color={colors.accentPrimary} fontSize={22} fontWeight="bold">
                  {report.savingsRatePercent}%
                </Text>
                <Badge
                  backgroundColor={colors.accentSubtle}
                  borderRadius={tokens.radius.sm}
                  px={5}
                  py={1}
                >
                  <BadgeText color={colors.accentPrimary} fontSize={10} fontWeight="bold">
                    {report.savingsRatePercent >= 20 ? 'HEALTHY' : 'LOW'}
                  </BadgeText>
                </Badge>
              </HStack>
              <Text color={colors.textMuted} fontSize={10} mt={2}>
                Target: &gt;= 20%
              </Text>
            </Card>
          </HStack>
        </VStack>

        {!hasData ? (
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.xl}
            alignItems="center"
          >
            <Box
              width={50}
              height={50}
              borderRadius={tokens.radius.full}
              backgroundColor={colors.surfaceSubtle}
              alignItems="center"
              justifyContent="center"
              mb={10}
            >
              <Ionicons name="bar-chart-outline" size={26} color={colors.textSecondary} />
            </Box>
            <Text color={colors.textPrimary} fontSize={16} fontWeight="bold">
              No Data for {monthLabel}
            </Text>
            <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4}>
              There are no recorded expenses or income transactions for this period.
            </Text>
          </Card>
        ) : (
          <>
            {/* Category Breakdown */}
            <VStack space="sm">
              <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
                SPENDING BY CATEGORY
              </Text>

              {report.categoryBreakdown.map((item) => (
                <Card
                  key={item.categoryId}
                  backgroundColor={colors.surface}
                  borderColor={colors.border}
                  borderWidth={1}
                  borderRadius={tokens.radius.md}
                  p={tokens.spacing.md}
                >
                  <HStack justifyContent="space-between" alignItems="center" mb={6}>
                    <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                      {item.categoryName || 'Uncategorized'}
                    </Text>
                    <HStack alignItems="center" space="xs">
                      <Text color={colors.textPrimary} fontSize={14} fontWeight="bold">
                        {formatMoney(item.spentMinor, 'INR')}
                      </Text>
                      <Badge
                        backgroundColor={colors.surfaceSubtle}
                        borderRadius={tokens.radius.sm}
                        px={5}
                        py={2}
                      >
                        <BadgeText color={colors.textSecondary} fontSize={10} fontWeight="bold">
                          {item.percentage}%
                        </BadgeText>
                      </Badge>
                    </HStack>
                  </HStack>

                  {/* Progress Bar */}
                  <Box
                    height={6}
                    width="100%"
                    backgroundColor={colors.surfaceSubtle}
                    borderRadius={tokens.radius.full}
                    overflow="hidden"
                  >
                    <Box
                      height="100%"
                      width={`${Math.min(100, Math.max(2, item.percentage))}%`}
                      backgroundColor={colors.accentPrimary}
                      borderRadius={tokens.radius.full}
                    />
                  </Box>
                </Card>
              ))}
            </VStack>

            {/* Top Payees */}
            {report.topMerchants.length > 0 && (
              <VStack space="sm">
                <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
                  TOP MERCHANTS / PAYEES
                </Text>

                <Card
                  backgroundColor={colors.surface}
                  borderColor={colors.border}
                  borderWidth={1}
                  borderRadius={tokens.radius.md}
                  p={tokens.spacing.md}
                >
                  {report.topMerchants.slice(0, 5).map((m, idx) => (
                    <HStack
                      key={m.merchant}
                      justifyContent="space-between"
                      alignItems="center"
                      py={8}
                      borderBottomWidth={idx < Math.min(report.topMerchants.length, 5) - 1 ? 1 : 0}
                      borderBottomColor={colors.border}
                    >
                      <HStack alignItems="center" space="sm">
                        <Box
                          width={24}
                          height={24}
                          backgroundColor={colors.surfaceSubtle}
                          borderRadius={tokens.radius.sm}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text color={colors.textSecondary} fontSize={11} fontWeight="bold">
                            {idx + 1}
                          </Text>
                        </Box>
                        <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                          {m.merchant}
                        </Text>
                      </HStack>

                      <Text color={colors.textPrimary} fontSize={14} fontWeight="bold">
                        {formatMoney(m.spentMinor, 'INR')}
                      </Text>
                    </HStack>
                  ))}
                </Card>
              </VStack>
            )}
          </>
        )}

        {/* Fixed vs Variable Spending Breakdown Card */}
        {fixedVsVariable && fixedVsVariable.totalSpendingMinor > 0 && (
          <VStack space="sm">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              FIXED VS VARIABLE SPENDING
            </Text>

            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    FIXED SPENDING
                  </Text>
                  <Text color={colors.accentPrimary} fontSize={18} fontWeight="bold" mt={4}>
                    {formatMoney(fixedVsVariable.fixedSpendingMinor, 'INR')}
                  </Text>
                  <Text color={colors.textMuted} fontSize={11}>
                    {fixedVsVariable.fixedPercentage}% of spending
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    VARIABLE SPENDING
                  </Text>
                  <Text color={colors.warning} fontSize={18} fontWeight="bold" mt={4}>
                    {formatMoney(fixedVsVariable.variableSpendingMinor, 'INR')}
                  </Text>
                  <Text color={colors.textMuted} fontSize={11}>
                    {fixedVsVariable.variablePercentage}% of spending
                  </Text>
                </VStack>
              </HStack>

              {/* Two-color Split Horizontal Bar */}
              <HStack
                height={8}
                width="100%"
                backgroundColor={colors.surfaceSubtle}
                borderRadius={tokens.radius.full}
                overflow="hidden"
                my={12}
              >
                {fixedVsVariable.fixedPercentage > 0 && (
                  <Box
                    height="100%"
                    width={`${fixedVsVariable.fixedPercentage}%`}
                    backgroundColor={colors.accentPrimary}
                  />
                )}
                {fixedVsVariable.variablePercentage > 0 && (
                  <Box
                    height="100%"
                    width={`${fixedVsVariable.variablePercentage}%`}
                    backgroundColor={colors.warning}
                  />
                )}
              </HStack>

              {/* Legend & Plain English explanation */}
              <HStack space="md" alignItems="center" mb={8}>
                <HStack alignItems="center" space="xs">
                  <Box
                    width={8}
                    height={8}
                    borderRadius={tokens.radius.full}
                    backgroundColor={colors.accentPrimary}
                  />
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="600">
                    Fixed ({fixedVsVariable.fixedPercentage}%)
                  </Text>
                </HStack>
                <HStack alignItems="center" space="xs">
                  <Box
                    width={8}
                    height={8}
                    borderRadius={tokens.radius.full}
                    backgroundColor={colors.warning}
                  />
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="600">
                    Variable ({fixedVsVariable.variablePercentage}%)
                  </Text>
                </HStack>
              </HStack>

              <Text color={colors.textMuted} fontSize={11} lineHeight={16}>
                Fixed includes recurring bills & utilities, Variable includes day-to-day spending.
              </Text>
            </Card>
          </VStack>
        )}

        {/* Personal vs Reimbursable Spending Breakdown Card */}
        {personalSpendingBreakdown && (
          <VStack space="sm">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              PERSONAL VS REIMBURSABLE SPENDING
            </Text>

            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center" mb={10}>
                <VStack>
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    GROSS SPENDING
                  </Text>
                  <Text color={colors.textPrimary} fontSize={16} fontWeight="bold" mt={2}>
                    {formatMoney(personalSpendingBreakdown.grossExpenseMinor, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="center">
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    REIMBURSABLE
                  </Text>
                  <Text color={colors.warning} fontSize={16} fontWeight="bold" mt={2}>
                    -{formatMoney(personalSpendingBreakdown.reimbursableExpenseMinor, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    NET PERSONAL
                  </Text>
                  <Text color={colors.accentPrimary} fontSize={16} fontWeight="bold" mt={2}>
                    {formatMoney(personalSpendingBreakdown.netPersonalExpenseMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              {reimbursementSummary && (
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  pt={8}
                  borderTopWidth={1}
                  borderTopColor={colors.border}
                >
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="500">
                    Pending Claims: {formatMoney(reimbursementSummary.pendingMinor, 'INR')}
                  </Text>
                  <Text color={colors.success} fontSize={11} fontWeight="600">
                    Reimbursed: {formatMoney(reimbursementSummary.reimbursedMinor, 'INR')}
                  </Text>
                </HStack>
              )}
            </Card>
          </VStack>
        )}

        {/* Subscriptions & Recurring Burn Rate Card */}
        {subscriptionBurnRate && subscriptionBurnRate.activeCount > 0 && (
          <VStack space="sm">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              RECURRING & SUBSCRIPTIONS BURN RATE
            </Text>

            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    MONTHLY BURN RATE
                  </Text>
                  <Text color={colors.danger} fontSize={18} fontWeight="bold" mt={4}>
                    {formatMoney(subscriptionBurnRate.monthlyBurnRateMinor, 'INR')} / mo
                  </Text>
                  <Text color={colors.textMuted} fontSize={11} mt={2}>
                    Across {subscriptionBurnRate.activeCount} active subscription{subscriptionBurnRate.activeCount === 1 ? '' : 's'}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                    ANNUALIZED COST
                  </Text>
                  <Text color={colors.textPrimary} fontSize={16} fontWeight="bold" mt={4}>
                    {formatMoney(subscriptionBurnRate.yearlyBurnRateMinor, 'INR')} / yr
                  </Text>
                </VStack>
              </HStack>
            </Card>
          </VStack>
        )}

        {/* 6-Month Spending Trends Section */}
        {spendingTrends.length > 0 && (
          <VStack space="sm">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              SPENDING & SAVINGS TRENDS
            </Text>

            {spendingTrends.map((trend) => (
              <Card
                key={trend.period}
                backgroundColor={colors.surface}
                borderColor={colors.border}
                borderWidth={1}
                borderRadius={tokens.radius.md}
                p={tokens.spacing.md}
              >
                <HStack justifyContent="space-between" alignItems="center" mb={6}>
                  <Text color={colors.textPrimary} fontSize={14} fontWeight="700">
                    {formatTrendMonth(trend.period)}
                  </Text>
                  <Badge
                    backgroundColor={trend.savingsRate >= 20 ? colors.accentSubtle : colors.surfaceSubtle}
                    borderRadius={tokens.radius.sm}
                    px={6}
                    py={2}
                  >
                    <BadgeText
                      color={trend.savingsRate >= 20 ? colors.accentPrimary : colors.textSecondary}
                      fontSize={10}
                      fontWeight="bold"
                    >
                      Savings Rate: {trend.savingsRate}%
                    </BadgeText>
                  </Badge>
                </HStack>

                <HStack justifyContent="space-between" alignItems="center" mt={4}>
                  <VStack>
                    <Text color={colors.textMuted} fontSize={10}>
                      Income
                    </Text>
                    <Text color={colors.success} fontSize={13} fontWeight="600">
                      +{formatMoney(trend.incomeMinor, 'INR')}
                    </Text>
                  </VStack>

                  <VStack alignItems="center">
                    <Text color={colors.textMuted} fontSize={10}>
                      Expenses
                    </Text>
                    <Text color={colors.danger} fontSize={13} fontWeight="600">
                      -{formatMoney(trend.expenseMinor, 'INR')}
                    </Text>
                  </VStack>

                  <VStack alignItems="flex-end">
                    <Text color={colors.textMuted} fontSize={10}>
                      Savings
                    </Text>
                    <Text
                      color={trend.savingsMinor >= 0 ? colors.textPrimary : colors.danger}
                      fontSize={13}
                      fontWeight="700"
                    >
                      {formatMoney(trend.savingsMinor, 'INR')}
                    </Text>
                  </VStack>
                </HStack>
              </Card>
            ))}
          </VStack>
        )}
      </ScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  navArrowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
