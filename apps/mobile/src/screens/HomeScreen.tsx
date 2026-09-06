import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { formatMoney } from '@biyong/domain';
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
import { TransactionItem } from '../components/TransactionItem';

interface HomeScreenProps {
  onNavigateToAccounts: () => void;
  onNavigateToTransactions: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToAccounts,
  onNavigateToTransactions,
}) => {
  const { colors, tokens } = useAppTheme();
  const {
    netWorthMinor,
    accounts,
    transactions,
    categories,
    openAddModal,
    openEditModal,
  } = useLedger();

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const recentTransactions = transactions.slice(0, 5);

  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || 'Unknown Account';
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return undefined;
    return categories.find((c) => c.id === id)?.name;
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <HStack justifyContent="space-between" alignItems="center" mt={4} mb={4}>
          <VStack>
            <Text color={colors.textPrimary} fontSize={26} fontWeight="800" letterSpacing={-0.5}>
              biyong
            </Text>
            <Text color={colors.textSecondary} fontSize={13} mt={1}>
              Personal Financial Ledger
            </Text>
          </VStack>

          <Badge
            backgroundColor={colors.accentSubtle}
            borderRadius={tokens.radius.full}
            px={10}
            py={4}
          >
            <HStack alignItems="center" space="xs">
              <Box width={6} height={6} borderRadius={3} backgroundColor={colors.accentPrimary} />
              <BadgeText color={colors.accentPrimary} fontSize={10} fontWeight="bold" letterSpacing={0.5}>
                OFFLINE READY
              </BadgeText>
            </HStack>
          </Badge>
        </HStack>

        {/* Net Worth Card */}
        <Card
          backgroundColor={colors.surface}
          borderColor={colors.border}
          borderWidth={1}
          borderRadius={tokens.radius.lg}
          p={tokens.spacing.lg}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
              NET WORTH
            </Text>
            <Text color={colors.textMuted} fontSize={11} fontWeight="bold">
              INR
            </Text>
          </HStack>

          <Text
            color={colors.textPrimary}
            fontSize={34}
            fontWeight="800"
            letterSpacing={-0.5}
            mt={6}
          >
            {formatMoney(netWorthMinor, 'INR')}
          </Text>

          <Text color={colors.textMuted} fontSize={12} mt={6}>
            Derived directly from local SQLite transactions • 100% private
          </Text>

          {/* Quick Action Buttons */}
          <HStack space="sm" mt={16}>
            <TouchableOpacity
              onPress={() => openAddModal('expense')}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Text color={colors.danger} fontSize={16} fontWeight="bold">
                ↗
              </Text>
              <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openAddModal('income')}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Text color={colors.success} fontSize={16} fontWeight="bold">
                ↙
              </Text>
              <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openAddModal('transfer')}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                },
              ]}
            >
              <Text color={colors.accentPrimary} fontSize={16} fontWeight="bold">
                ⇄
              </Text>
              <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                Transfer
              </Text>
            </TouchableOpacity>
          </HStack>
        </Card>

        {/* Accounts Preview */}
        <VStack space="sm">
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              ACCOUNTS
            </Text>
            <TouchableOpacity onPress={onNavigateToAccounts}>
              <Text color={colors.accentPrimary} fontSize={12} fontWeight="600">
                View All →
              </Text>
            </TouchableOpacity>
          </HStack>

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
                width={170}
              >
                <TouchableOpacity onPress={onNavigateToAccounts}>
                  <HStack justifyContent="space-between" alignItems="center" mb={8}>
                    <Text
                      color={colors.textPrimary}
                      fontSize={13}
                      fontWeight="600"
                      numberOfLines={1}
                      flex={1}
                      mr={4}
                    >
                      {acc.name}
                    </Text>
                    <Badge
                      backgroundColor={colors.surfaceSubtle}
                      borderRadius={tokens.radius.sm}
                      px={5}
                      py={2}
                    >
                      <BadgeText color={colors.textSecondary} fontSize={9} fontWeight="bold">
                        {acc.type.toUpperCase()}
                      </BadgeText>
                    </Badge>
                  </HStack>

                  <Text color={colors.textPrimary} fontSize={18} fontWeight="bold">
                    {formatMoney(acc.derivedBalanceMinor, 'INR')}
                  </Text>

                  <Text color={colors.textMuted} fontSize={11} mt={4}>
                    Initial: {formatMoney(acc.initialBalanceMinor, 'INR')}
                  </Text>
                </TouchableOpacity>
              </Card>
            ))}
          </ScrollView>
        </VStack>

        {/* Recent Transactions */}
        <VStack space="sm">
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              RECENT TRANSACTIONS
            </Text>
            <TouchableOpacity onPress={onNavigateToTransactions}>
              <Text color={colors.accentPrimary} fontSize={12} fontWeight="600">
                View All →
              </Text>
            </TouchableOpacity>
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
              <Text color={colors.textPrimary} fontSize={15} fontWeight="600">
                No Transactions Yet
              </Text>
              <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={6}>
                Tap the floating + button below or record an expense/income to get started.
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
              />
            ))
          )}
        </VStack>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openAddModal()}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accentPrimary,
            borderRadius: tokens.radius.full,
          },
        ]}
      >
        <Text color={colors.accentForeground} fontSize={30} fontWeight="300" lineHeight={34}>
          +
        </Text>
      </TouchableOpacity>
    </Box>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    gap: 6,
  },
  accountsScroll: {
    gap: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
