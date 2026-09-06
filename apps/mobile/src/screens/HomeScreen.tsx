import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
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
        {/* Top Header */}
        <HStack justifyContent="space-between" alignItems="center" mt={4} mb={2}>
          <VStack>
            <Text color={colors.textPrimary} fontSize={26} fontWeight="800" letterSpacing={-0.5}>
              biyong
            </Text>
            <Text color={colors.textSecondary} fontSize={13} mt={1}>
              Personal Financial Overview
            </Text>
          </VStack>

          <TouchableOpacity
            onPress={() => openAddModal()}
            style={[
              styles.headerAddBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: tokens.radius.full,
              },
            ]}
          >
            <Feather name="plus" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
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
              TOTAL NET WORTH
            </Text>
            <Text color={colors.textMuted} fontSize={11} fontWeight="bold">
              INR
            </Text>
          </HStack>

          <Text
            color={colors.textPrimary}
            fontSize={36}
            fontWeight="800"
            letterSpacing={-0.5}
            mt={6}
          >
            {formatMoney(netWorthMinor, 'INR')}
          </Text>

          <Text color={colors.textMuted} fontSize={12} mt={4}>
            {activeAccounts.length === 0
              ? 'Add an account to begin tracking your net worth'
              : `Across ${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'}`}
          </Text>

          {/* Quick Action Buttons */}
          <HStack space="sm" mt={18}>
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
              <Feather name="arrow-up-right" size={16} color={colors.danger} />
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
              <Feather name="arrow-down-left" size={16} color={colors.success} />
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
              <Feather name="repeat" size={15} color={colors.accentPrimary} />
              <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                Transfer
              </Text>
            </TouchableOpacity>
          </HStack>
        </Card>

        {/* Accounts Section */}
        <VStack space="sm">
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
              ACCOUNTS
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
                width={48}
                height={48}
                borderRadius={tokens.radius.full}
                backgroundColor={colors.surfaceSubtle}
                alignItems="center"
                justifyContent="center"
                mb={8}
              >
                <Ionicons name="wallet-outline" size={24} color={colors.textSecondary} />
              </Box>
              <Text color={colors.textPrimary} fontSize={15} fontWeight="600">
                No Accounts Yet
              </Text>
              <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4} mb={12}>
                Set up a bank account or cash wallet to start tracking your finances.
              </Text>
              <Button
                onPress={onNavigateToAccounts}
                backgroundColor={colors.accentPrimary}
                borderRadius={tokens.radius.md}
                size="sm"
              >
                <ButtonText color={colors.accentForeground} fontSize={13} fontWeight="bold">
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
                  width={170}
                >
                  <TouchableOpacity onPress={onNavigateToAccounts}>
                    <HStack justifyContent="space-between" alignItems="center" mb={10}>
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
                        px={5}
                        py={2}
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
                      fontSize={18}
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
              RECENT ACTIVITY
            </Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity onPress={onNavigateToTransactions}>
                <HStack alignItems="center" space="xs">
                  <Text color={colors.accentPrimary} fontSize={12} fontWeight="600">
                    View All
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
                width={48}
                height={48}
                borderRadius={tokens.radius.full}
                backgroundColor={colors.surfaceSubtle}
                alignItems="center"
                justifyContent="center"
                mb={8}
              >
                <Ionicons name="receipt-outline" size={24} color={colors.textSecondary} />
              </Box>
              <Text color={colors.textPrimary} fontSize={15} fontWeight="600">
                No Transactions Yet
              </Text>
              <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4}>
                Tap the + button below to log your first expense or income.
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
        <Feather name="plus" size={26} color={colors.accentForeground} />
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
  headerAddBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
