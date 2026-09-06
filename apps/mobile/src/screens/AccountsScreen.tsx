import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { formatMoney } from '@biyong/domain';
import { Ionicons, Feather } from '@expo/vector-icons';
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
import { AddAccountModal } from '../components/AddAccountModal';
import type { AccountWithDerivedBalance } from '@biyong/application';

export const AccountsScreen: React.FC = () => {
  const { colors, tokens } = useAppTheme();
  const { accounts, archiveAccount } = useLedger();

  const [showAddModal, setShowAddModal] = useState(false);
  const [filterArchived, setFilterArchived] = useState(false);

  const displayedAccounts = filterArchived
    ? accounts
    : accounts.filter((a) => !a.isArchived);

  const totalDerivedBalance = displayedAccounts
    .filter((a) => !a.isArchived)
    .reduce((acc, a) => acc + a.derivedBalanceMinor, 0);

  const handleArchive = (acc: AccountWithDerivedBalance) => {
    if (acc.isArchived) return;
    Alert.alert(
      'Archive Account',
      `Are you sure you want to archive "${acc.name}"? Existing transactions will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveAccount(acc.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to archive account.');
            }
          },
        },
      ]
    );
  };

  const getAccountIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'bank':
        return 'business-outline';
      case 'cash':
        return 'cash-outline';
      case 'wallet':
        return 'wallet-outline';
      case 'credit':
      case 'debit':
        return 'card-outline';
      case 'investment':
        return 'trending-up-outline';
      default:
        return 'folder-outline';
    }
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Summary */}
        <Card
          backgroundColor={colors.surface}
          borderColor={colors.border}
          borderWidth={1}
          borderRadius={tokens.radius.lg}
          p={tokens.spacing.lg}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
              TOTAL ASSET BALANCE
            </Text>
            {accounts.some((a) => a.isArchived) && (
              <TouchableOpacity
                onPress={() => setFilterArchived(!filterArchived)}
                style={[
                  styles.archiveToggle,
                  {
                    backgroundColor: filterArchived ? colors.accentPrimary : colors.surfaceSubtle,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Text
                  color={filterArchived ? colors.accentForeground : colors.textSecondary}
                  fontSize={11}
                  fontWeight="600"
                >
                  {filterArchived ? 'Showing All' : 'Active Only'}
                </Text>
              </TouchableOpacity>
            )}
          </HStack>

          <Text
            color={colors.textPrimary}
            fontSize={34}
            fontWeight="800"
            letterSpacing={-0.5}
            mt={8}
          >
            {formatMoney(totalDerivedBalance, 'INR')}
          </Text>

          <Text color={colors.textMuted} fontSize={12} mt={4}>
            {displayedAccounts.length === 0
              ? 'No accounts configured yet'
              : `${displayedAccounts.length} active account${displayedAccounts.length === 1 ? '' : 's'}`}
          </Text>

          <Button
            onPress={() => setShowAddModal(true)}
            backgroundColor={colors.accentPrimary}
            borderRadius={tokens.radius.md}
            mt={16}
          >
            <HStack alignItems="center" space="xs">
              <Feather name="plus" size={16} color={colors.accentForeground} />
              <ButtonText color={colors.accentForeground} fontSize={14} fontWeight="bold">
                Add New Account
              </ButtonText>
            </HStack>
          </Button>
        </Card>

        {/* Accounts List */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            YOUR ACCOUNTS
          </Text>

          {displayedAccounts.length === 0 ? (
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
                <Ionicons name="wallet-outline" size={26} color={colors.textSecondary} />
              </Box>
              <Text color={colors.textPrimary} fontSize={16} fontWeight="600">
                No Accounts Found
              </Text>
              <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4} mb={12}>
                Create an account for your bank, credit card, or cash wallet to begin organizing your money.
              </Text>
            </Card>
          ) : (
            displayedAccounts.map((acc) => (
              <Card
                key={acc.id}
                backgroundColor={colors.surface}
                borderColor={colors.border}
                borderWidth={1}
                borderRadius={tokens.radius.md}
                p={tokens.spacing.md}
                opacity={acc.isArchived ? 0.6 : 1}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack alignItems="center" space="md" flex={1} mr={10}>
                    <Box
                      width={40}
                      height={40}
                      borderRadius={tokens.radius.full}
                      backgroundColor={colors.surfaceSubtle}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons
                        name={getAccountIcon(acc.type)}
                        size={20}
                        color={colors.accentPrimary}
                      />
                    </Box>

                    <VStack flex={1}>
                      <HStack alignItems="center" space="xs">
                        <Text color={colors.textPrimary} fontSize={15} fontWeight="600">
                          {acc.name}
                        </Text>
                        {acc.isArchived && (
                          <Badge
                            backgroundColor={colors.surfaceSubtle}
                            borderRadius={tokens.radius.sm}
                            px={6}
                            py={2}
                          >
                            <BadgeText color={colors.textMuted} fontSize={9} fontWeight="bold">
                              ARCHIVED
                            </BadgeText>
                          </Badge>
                        )}
                      </HStack>

                      <Text color={colors.textSecondary} fontSize={12} mt={2}>
                        {acc.type.toUpperCase()}
                      </Text>
                    </VStack>
                  </HStack>

                  <VStack alignItems="flex-end">
                    <Text
                      color={acc.derivedBalanceMinor >= 0 ? colors.textPrimary : colors.danger}
                      fontSize={16}
                      fontWeight="bold"
                    >
                      {formatMoney(acc.derivedBalanceMinor, 'INR')}
                    </Text>

                    {!acc.isArchived && (
                      <TouchableOpacity onPress={() => handleArchive(acc)} style={styles.archiveAction}>
                        <HStack alignItems="center" space="xs">
                          <Feather name="archive" size={11} color={colors.textMuted} />
                          <Text color={colors.textMuted} fontSize={11} fontWeight="500">
                            Archive
                          </Text>
                        </HStack>
                      </TouchableOpacity>
                    )}
                  </VStack>
                </HStack>
              </Card>
            ))
          )}
        </VStack>
      </ScrollView>

      {/* Add Account Modal */}
      <AddAccountModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
    </Box>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  archiveToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  archiveAction: {
    marginTop: 4,
    paddingVertical: 2,
  },
});
