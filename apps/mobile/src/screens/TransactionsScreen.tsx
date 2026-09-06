import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { filterTransactions, formatMoney } from '@biyong/domain';
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

export const TransactionsScreen: React.FC = () => {
  const { colors, tokens } = useAppTheme();
  const { transactions, accounts, categories, openEditModal } = useLedger();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');

  const filteredTransactions = useMemo(() => {
    const filterInput = {
      type: selectedType === 'all' ? undefined : selectedType,
      categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
      searchQuery: searchQuery.trim().length > 0 ? searchQuery : undefined,
    };
    return filterTransactions(transactions, filterInput);
  }, [transactions, selectedType, selectedCategoryId, searchQuery]);

  const filterStats = useMemo(() => {
    let incomeMinor = 0;
    let expenseMinor = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'income') incomeMinor += tx.amountMinor;
      if (tx.type === 'expense') expenseMinor += tx.amountMinor;
    }
    return {
      count: filteredTransactions.length,
      incomeMinor,
      expenseMinor,
      netMinor: incomeMinor - expenseMinor,
    };
  }, [filteredTransactions]);

  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || 'Unknown Account';
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return undefined;
    return categories.find((c) => c.id === id)?.name;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedCategoryId('all');
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <Box
        p={12}
        gap={10}
        backgroundColor={colors.surface}
        borderBottomWidth={1}
        borderBottomColor={colors.border}
      >
        {/* Search Bar */}
        <Box
          flexDirection="row"
          alignItems="center"
          borderWidth={1}
          borderColor={colors.border}
          backgroundColor={colors.surfaceSubtle}
          borderRadius={tokens.radius.md}
          px={12}
          height={42}
        >
          <Text fontSize={14} mr={8}>
            🔍
          </Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search merchant, notes, tags..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text color={colors.textMuted} fontSize={14} fontWeight="bold">
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </Box>

        {/* Type Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeChipsRow}
        >
          {(['all', 'expense', 'income', 'transfer'] as const).map((t) => {
            const isSelected = selectedType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                    borderColor: isSelected ? colors.accentPrimary : colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Text
                  color={isSelected ? colors.accentForeground : colors.textSecondary}
                  fontSize={12}
                  fontWeight="600"
                >
                  {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catChipsRow}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategoryId('all')}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedCategoryId === 'all' ? colors.accentPrimary : colors.surfaceSubtle,
                borderColor: selectedCategoryId === 'all' ? colors.accentPrimary : colors.border,
                borderRadius: tokens.radius.sm,
              },
            ]}
          >
            <Text
              color={selectedCategoryId === 'all' ? colors.accentForeground : colors.textSecondary}
              fontSize={12}
              fontWeight="600"
            >
              All Categories
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategoryId(cat.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                    borderColor: isSelected ? colors.accentPrimary : colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Text
                  color={isSelected ? colors.accentForeground : colors.textSecondary}
                  fontSize={12}
                  fontWeight="600"
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Box>

      {/* Filter Stats Sub-bar */}
      <HStack
        justifyContent="space-between"
        alignItems="center"
        px={16}
        py={8}
        backgroundColor={colors.surfaceSubtle}
        borderBottomWidth={1}
        borderBottomColor={colors.border}
      >
        <Text color={colors.textSecondary} fontSize={12} fontWeight="600">
          {filterStats.count} transaction{filterStats.count === 1 ? '' : 's'}
        </Text>
        <HStack alignItems="center" space="xs">
          <Text color={colors.danger} fontSize={12} fontWeight="bold">
            -{formatMoney(filterStats.expenseMinor, 'INR')}
          </Text>
          <Text color={colors.textMuted} fontSize={10}>
            •
          </Text>
          <Text color={colors.success} fontSize={12} fontWeight="bold">
            +{formatMoney(filterStats.incomeMinor, 'INR')}
          </Text>
        </HStack>
      </HStack>

      {/* Transaction List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTransactions.length === 0 ? (
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.xl}
            alignItems="center"
            mt={20}
          >
            <Text fontSize={32} mb={8}>
              🔍
            </Text>
            <Text color={colors.textPrimary} fontSize={16} fontWeight="bold">
              No Transactions Found
            </Text>
            <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4}>
              No transactions match your active filters or search terms.
            </Text>
            <Button
              onPress={resetFilters}
              backgroundColor={colors.accentSubtle}
              borderRadius={tokens.radius.sm}
              mt={16}
            >
              <ButtonText color={colors.accentPrimary} fontSize={13} fontWeight="bold">
                Reset All Filters
              </ButtonText>
            </Button>
          </Card>
        ) : (
          filteredTransactions.map((tx) => (
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
      </ScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearSearchBtn: {
    padding: 4,
  },
  typeChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
