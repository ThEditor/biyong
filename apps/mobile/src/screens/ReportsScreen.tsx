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
  const { transactions, categories } = useLedger();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed (1-12)

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
