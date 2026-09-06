import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
import type { Goal } from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import { AddBudgetModal } from '../components/AddBudgetModal';
import { AddGoalModal } from '../components/AddGoalModal';
import { ContributeGoalModal } from '../components/ContributeGoalModal';

export const BudgetsGoalsScreen: React.FC = () => {
  const { colors, tokens } = useAppTheme();
  const { budgets, goals, categories, deleteBudget, deleteGoal } = useLedger();

  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);

  const getCategory = (catId: string) => {
    return categories.find((c) => c.id === catId);
  };

  const getCategoryIcon = (catId: string): keyof typeof Ionicons.glyphMap => {
    switch (catId) {
      case 'cat-food':
        return 'restaurant-outline';
      case 'cat-groceries':
        return 'cart-outline';
      case 'cat-transport':
        return 'car-outline';
      case 'cat-housing':
        return 'home-outline';
      case 'cat-utilities':
        return 'flash-outline';
      case 'cat-shopping':
        return 'bag-handle-outline';
      case 'cat-entertainment':
        return 'film-outline';
      case 'cat-health':
        return 'medkit-outline';
      case 'cat-salary':
        return 'cash-outline';
      case 'cat-investment':
        return 'trending-up-outline';
      default:
        return 'pricetag-outline';
    }
  };

  // Budgets Summary Calculations
  const budgetSummary = useMemo(() => {
    const totalBudgetedMinor = budgets.reduce((acc, b) => acc + b.effectiveBudgetMinor, 0);
    const totalSpentMinor = budgets.reduce((acc, b) => acc + b.spentMinor, 0);
    const totalRemainingMinor = totalBudgetedMinor - totalSpentMinor;
    const overallPercentage =
      totalBudgetedMinor > 0 ? Math.round((totalSpentMinor / totalBudgetedMinor) * 100) : 0;

    return {
      totalBudgetedMinor,
      totalSpentMinor,
      totalRemainingMinor,
      overallPercentage,
    };
  }, [budgets]);

  // Goals Summary Calculations
  const goalSummary = useMemo(() => {
    const totalTargetMinor = goals.reduce((acc, g) => acc + g.targetAmountMinor, 0);
    const totalSavedMinor = goals.reduce((acc, g) => acc + g.currentAmountMinor, 0);
    const totalRemainingMinor = Math.max(0, totalTargetMinor - totalSavedMinor);
    const overallPercentage =
      totalTargetMinor > 0
        ? Math.min(100, Math.round((totalSavedMinor / totalTargetMinor) * 100))
        : 0;

    return {
      totalTargetMinor,
      totalSavedMinor,
      totalRemainingMinor,
      overallPercentage,
    };
  }, [goals]);

  const handleDeleteBudget = (budgetId: string, categoryName: string) => {
    Alert.alert(
      'Delete Budget',
      `Are you sure you want to remove the budget for "${categoryName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudget(budgetId);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete budget.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteGoal = (goalId: string, title: string) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete the goal "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGoal(goalId);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete goal.');
            }
          },
        },
      ]
    );
  };

  const getHealthColor = (health: 'healthy' | 'warning' | 'exceeded') => {
    switch (health) {
      case 'healthy':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'exceeded':
        return colors.danger;
    }
  };

  const getHealthLabel = (health: 'healthy' | 'warning' | 'exceeded') => {
    switch (health) {
      case 'healthy':
        return 'HEALTHY';
      case 'warning':
        return 'WARNING';
      case 'exceeded':
        return 'EXCEEDED';
    }
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Segmented Control */}
        <Box
          flexDirection="row"
          p={4}
          backgroundColor={colors.surfaceSubtle}
          borderRadius={tokens.radius.md}
          borderWidth={1}
          borderColor={colors.border}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('budgets')}
            style={[
              styles.tabPill,
              activeTab === 'budgets' && {
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.sm,
              },
            ]}
          >
            <HStack alignItems="center" space="xs">
              <Ionicons
                name="pie-chart-outline"
                size={16}
                color={activeTab === 'budgets' ? colors.accentForeground : colors.textSecondary}
              />
              <Text
                color={activeTab === 'budgets' ? colors.accentForeground : colors.textSecondary}
                fontSize={13}
                fontWeight="700"
              >
                Budgets ({budgets.length})
              </Text>
            </HStack>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('goals')}
            style={[
              styles.tabPill,
              activeTab === 'goals' && {
                backgroundColor: colors.accentPrimary,
                borderRadius: tokens.radius.sm,
              },
            ]}
          >
            <HStack alignItems="center" space="xs">
              <Ionicons
                name="flag-outline"
                size={16}
                color={activeTab === 'goals' ? colors.accentForeground : colors.textSecondary}
              />
              <Text
                color={activeTab === 'goals' ? colors.accentForeground : colors.textSecondary}
                fontSize={13}
                fontWeight="700"
              >
                Goals ({goals.length})
              </Text>
            </HStack>
          </TouchableOpacity>
        </Box>

        {activeTab === 'budgets' ? (
          /* ========================================================
             BUDGETS TAB CONTENT
             ======================================================== */
          <>
            {/* Budgets Summary Card */}
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.lg}
              p={tokens.spacing.lg}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
                  OVERALL BUDGET ADHERENCE
                </Text>
                <Badge
                  backgroundColor={colors.surfaceSubtle}
                  borderRadius={tokens.radius.sm}
                  px={6}
                  py={2}
                >
                  <BadgeText color={colors.textSecondary} fontSize={10} fontWeight="bold">
                    {budgetSummary.overallPercentage}% USED
                  </BadgeText>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="baseline" mt={8}>
                <VStack>
                  <Text color={colors.textMuted} fontSize={11}>
                    Spent
                  </Text>
                  <Text color={colors.textPrimary} fontSize={24} fontWeight="800">
                    {formatMoney(budgetSummary.totalSpentMinor, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textMuted} fontSize={11}>
                    Total Budget
                  </Text>
                  <Text color={colors.textSecondary} fontSize={18} fontWeight="700">
                    {formatMoney(budgetSummary.totalBudgetedMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              {/* Progress Bar */}
              <Box
                height={8}
                width="100%"
                backgroundColor={colors.surfaceSubtle}
                borderRadius={tokens.radius.full}
                overflow="hidden"
                mt={12}
              >
                <Box
                  height="100%"
                  width={`${Math.min(100, Math.max(1, budgetSummary.overallPercentage))}%`}
                  backgroundColor={
                    budgetSummary.overallPercentage >= 100
                      ? colors.danger
                      : budgetSummary.overallPercentage >= 80
                      ? colors.warning
                      : colors.success
                  }
                  borderRadius={tokens.radius.full}
                />
              </Box>

              <HStack justifyContent="space-between" alignItems="center" mt={12}>
                <Text color={colors.textMuted} fontSize={12}>
                  {budgetSummary.totalRemainingMinor >= 0 ? 'Remaining across budgets' : 'Over budget'}
                </Text>
                <Text
                  color={budgetSummary.totalRemainingMinor >= 0 ? colors.success : colors.danger}
                  fontSize={14}
                  fontWeight="700"
                >
                  {formatMoney(Math.abs(budgetSummary.totalRemainingMinor), 'INR')}
                </Text>
              </HStack>

              <Button
                onPress={() => setShowAddBudgetModal(true)}
                backgroundColor={colors.accentPrimary}
                borderRadius={tokens.radius.md}
                mt={16}
              >
                <HStack alignItems="center" space="xs">
                  <Feather name="plus" size={16} color={colors.accentForeground} />
                  <ButtonText color={colors.accentForeground} fontSize={14} fontWeight="bold">
                    Set New Budget
                  </ButtonText>
                </HStack>
              </Button>
            </Card>

            {/* Budgets List */}
            <VStack space="sm">
              <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
                CATEGORY BUDGETS
              </Text>

              {budgets.length === 0 ? (
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
                    <Ionicons name="pie-chart-outline" size={26} color={colors.textSecondary} />
                  </Box>
                  <Text color={colors.textPrimary} fontSize={16} fontWeight="600">
                    No Budgets Set
                  </Text>
                  <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4} mb={12}>
                    Define monthly or weekly spending limits for categories like Groceries, Dining, or Shopping to prevent overspending.
                  </Text>
                  <Button
                    onPress={() => setShowAddBudgetModal(true)}
                    backgroundColor={colors.accentPrimary}
                    borderRadius={tokens.radius.md}
                    size="sm"
                  >
                    <ButtonText color={colors.accentForeground} fontSize={13} fontWeight="bold">
                      + Create Budget
                    </ButtonText>
                  </Button>
                </Card>
              ) : (
                budgets.map((b) => {
                  const cat = getCategory(b.categoryId);
                  const catName = cat?.name ?? 'Category';
                  const healthColor = getHealthColor(b.health);

                  return (
                    <Card
                      key={b.budgetId}
                      backgroundColor={colors.surface}
                      borderColor={colors.border}
                      borderWidth={1}
                      borderRadius={tokens.radius.md}
                      p={tokens.spacing.md}
                    >
                      <HStack justifyContent="space-between" alignItems="center" mb={8}>
                        <HStack alignItems="center" space="sm" flex={1}>
                          <Box
                            width={36}
                            height={36}
                            borderRadius={tokens.radius.sm}
                            backgroundColor={colors.surfaceSubtle}
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Ionicons
                              name={getCategoryIcon(b.categoryId)}
                              size={18}
                              color={colors.accentPrimary}
                            />
                          </Box>
                          <VStack flex={1}>
                            <HStack alignItems="center" space="xs">
                              <Text color={colors.textPrimary} fontSize={15} fontWeight="700">
                                {catName}
                              </Text>
                              {b.budget.rollover && (
                                <Badge
                                  backgroundColor={colors.surfaceSubtle}
                                  borderRadius={tokens.radius.sm}
                                  px={5}
                                  py={1}
                                >
                                  <BadgeText color={colors.accentPrimary} fontSize={9} fontWeight="bold">
                                    ROLLOVER
                                  </BadgeText>
                                </Badge>
                              )}
                            </HStack>
                            <Text color={colors.textSecondary} fontSize={11}>
                              {b.budget.period.toUpperCase()} • {b.daysRemaining} days left
                            </Text>
                          </VStack>
                        </HStack>

                        <HStack alignItems="center" space="sm">
                          <Badge
                            backgroundColor={colors.surfaceSubtle}
                            borderColor={healthColor}
                            borderWidth={1}
                            borderRadius={tokens.radius.sm}
                            px={6}
                            py={2}
                          >
                            <BadgeText color={healthColor} fontSize={10} fontWeight="bold">
                              {getHealthLabel(b.health)}
                            </BadgeText>
                          </Badge>

                          <TouchableOpacity
                            onPress={() => handleDeleteBudget(b.budgetId, catName)}
                            style={styles.deleteBtn}
                          >
                            <Feather name="trash-2" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </HStack>
                      </HStack>

                      {/* Progress Bar */}
                      <Box
                        height={6}
                        width="100%"
                        backgroundColor={colors.surfaceSubtle}
                        borderRadius={tokens.radius.full}
                        overflow="hidden"
                        my={6}
                      >
                        <Box
                          height="100%"
                          width={`${Math.min(100, Math.max(1, b.percentageUsed))}%`}
                          backgroundColor={healthColor}
                          borderRadius={tokens.radius.full}
                        />
                      </Box>

                      {/* Spent vs Budgeted */}
                      <HStack justifyContent="space-between" alignItems="center" mt={4}>
                        <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                          {formatMoney(b.spentMinor, 'INR')}{' '}
                          <Text color={colors.textMuted} fontSize={12} fontWeight="400">
                            of {formatMoney(b.effectiveBudgetMinor, 'INR')}
                          </Text>
                        </Text>
                        <Text color={colors.textSecondary} fontSize={12} fontWeight="bold">
                          {b.percentageUsed}%
                        </Text>
                      </HStack>

                      {/* Daily Allowance */}
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                        mt={8}
                        pt={8}
                        borderTopWidth={1}
                        borderTopColor={colors.border}
                      >
                        <HStack alignItems="center" space="xs">
                          <Feather name="calendar" size={12} color={colors.textSecondary} />
                          <Text color={colors.textSecondary} fontSize={11}>
                            Daily allowance:
                          </Text>
                        </HStack>
                        <Text
                          color={b.dailyAllowanceMinor > 0 ? colors.textPrimary : colors.danger}
                          fontSize={12}
                          fontWeight="700"
                        >
                          {formatMoney(b.dailyAllowanceMinor, 'INR')} / day
                        </Text>
                      </HStack>
                    </Card>
                  );
                })
              )}
            </VStack>
          </>
        ) : (
          /* ========================================================
             GOALS TAB CONTENT
             ======================================================== */
          <>
            {/* Goals Summary Card */}
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.lg}
              p={tokens.spacing.lg}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
                  TOTAL SAVINGS PROGRESS
                </Text>
                <Badge
                  backgroundColor={colors.surfaceSubtle}
                  borderRadius={tokens.radius.sm}
                  px={6}
                  py={2}
                >
                  <BadgeText color={colors.textSecondary} fontSize={10} fontWeight="bold">
                    {goalSummary.overallPercentage}% ACHIEVED
                  </BadgeText>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="baseline" mt={8}>
                <VStack>
                  <Text color={colors.textMuted} fontSize={11}>
                    Total Saved
                  </Text>
                  <Text color={colors.accentPrimary} fontSize={24} fontWeight="800">
                    {formatMoney(goalSummary.totalSavedMinor, 'INR')}
                  </Text>
                </VStack>

                <VStack alignItems="flex-end">
                  <Text color={colors.textMuted} fontSize={11}>
                    Target Sum
                  </Text>
                  <Text color={colors.textSecondary} fontSize={18} fontWeight="700">
                    {formatMoney(goalSummary.totalTargetMinor, 'INR')}
                  </Text>
                </VStack>
              </HStack>

              {/* Progress Bar */}
              <Box
                height={8}
                width="100%"
                backgroundColor={colors.surfaceSubtle}
                borderRadius={tokens.radius.full}
                overflow="hidden"
                mt={12}
              >
                <Box
                  height="100%"
                  width={`${Math.min(100, Math.max(1, goalSummary.overallPercentage))}%`}
                  backgroundColor={colors.accentPrimary}
                  borderRadius={tokens.radius.full}
                />
              </Box>

              <HStack justifyContent="space-between" alignItems="center" mt={12}>
                <Text color={colors.textMuted} fontSize={12}>
                  Remaining to hit all targets
                </Text>
                <Text color={colors.textPrimary} fontSize={14} fontWeight="700">
                  {formatMoney(goalSummary.totalRemainingMinor, 'INR')}
                </Text>
              </HStack>

              <Button
                onPress={() => setShowAddGoalModal(true)}
                backgroundColor={colors.accentPrimary}
                borderRadius={tokens.radius.md}
                mt={16}
              >
                <HStack alignItems="center" space="xs">
                  <Feather name="plus" size={16} color={colors.accentForeground} />
                  <ButtonText color={colors.accentForeground} fontSize={14} fontWeight="bold">
                    Create New Goal
                  </ButtonText>
                </HStack>
              </Button>
            </Card>

            {/* Goals List */}
            <VStack space="sm">
              <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
                SAVINGS GOALS
              </Text>

              {goals.length === 0 ? (
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
                    <Ionicons name="flag-outline" size={26} color={colors.textSecondary} />
                  </Box>
                  <Text color={colors.textPrimary} fontSize={16} fontWeight="600">
                    No Goals Created
                  </Text>
                  <Text color={colors.textSecondary} fontSize={13} textAlign="center" mt={4} mb={12}>
                    Set ambitious milestones like an Emergency Fund, a dream gadget, or a down payment to automate your savings discipline.
                  </Text>
                  <Button
                    onPress={() => setShowAddGoalModal(true)}
                    backgroundColor={colors.accentPrimary}
                    borderRadius={tokens.radius.md}
                    size="sm"
                  >
                    <ButtonText color={colors.accentForeground} fontSize={13} fontWeight="bold">
                      + Start a Goal
                    </ButtonText>
                  </Button>
                </Card>
              ) : (
                goals.map((g) => {
                  return (
                    <Card
                      key={g.goalId}
                      backgroundColor={colors.surface}
                      borderColor={colors.border}
                      borderWidth={1}
                      borderRadius={tokens.radius.md}
                      p={tokens.spacing.md}
                    >
                      <HStack justifyContent="space-between" alignItems="center" mb={8}>
                        <VStack flex={1} mr={8}>
                          <HStack alignItems="center" space="xs">
                            <Text color={colors.textPrimary} fontSize={16} fontWeight="700">
                              {g.title}
                            </Text>
                            {g.isCompleted && (
                              <Badge
                                backgroundColor={colors.success}
                                borderRadius={tokens.radius.sm}
                                px={5}
                                py={1}
                              >
                                <BadgeText color={colors.accentForeground} fontSize={9} fontWeight="bold">
                                  COMPLETED
                                </BadgeText>
                              </Badge>
                            )}
                          </HStack>
                          <Text color={colors.textSecondary} fontSize={11} mt={1}>
                            Target: {g.goal.targetDate} • {g.monthsRemaining} mo remaining
                          </Text>
                        </VStack>

                        <HStack alignItems="center" space="xs">
                          <TouchableOpacity
                            onPress={() => handleDeleteGoal(g.goalId, g.title)}
                            style={styles.deleteBtn}
                          >
                            <Feather name="trash-2" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </HStack>
                      </HStack>

                      {/* Progress Bar */}
                      <Box
                        height={6}
                        width="100%"
                        backgroundColor={colors.surfaceSubtle}
                        borderRadius={tokens.radius.full}
                        overflow="hidden"
                        my={6}
                      >
                        <Box
                          height="100%"
                          width={`${g.percentageComplete}%`}
                          backgroundColor={g.isCompleted ? colors.success : colors.accentPrimary}
                          borderRadius={tokens.radius.full}
                        />
                      </Box>

                      {/* Saved vs Target */}
                      <HStack justifyContent="space-between" alignItems="center" mt={4}>
                        <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                          {formatMoney(g.currentAmountMinor, 'INR')}{' '}
                          <Text color={colors.textMuted} fontSize={12} fontWeight="400">
                            of {formatMoney(g.targetAmountMinor, 'INR')}
                          </Text>
                        </Text>
                        <Text color={colors.accentPrimary} fontSize={13} fontWeight="bold">
                          {g.percentageComplete}%
                        </Text>
                      </HStack>

                      {/* Monthly Savings Needed & Actions */}
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                        mt={10}
                        pt={10}
                        borderTopWidth={1}
                        borderTopColor={colors.border}
                      >
                        <VStack>
                          {!g.isCompleted ? (
                            <>
                              <Text color={colors.textMuted} fontSize={10}>
                                Monthly savings needed
                              </Text>
                              <Text color={colors.textPrimary} fontSize={12} fontWeight="700">
                                {formatMoney(g.requiredMonthlySavingsMinor, 'INR')} / mo
                              </Text>
                            </>
                          ) : (
                            <Text color={colors.success} fontSize={12} fontWeight="700">
                              Goal Fully Funded
                            </Text>
                          )}
                        </VStack>

                        {!g.isCompleted && (
                          <Button
                            onPress={() => setContributingGoal(g.goal)}
                            size="xs"
                            backgroundColor={colors.accentPrimary}
                            borderRadius={tokens.radius.sm}
                          >
                            <HStack alignItems="center" space="xs">
                              <Feather name="plus-circle" size={12} color={colors.accentForeground} />
                              <ButtonText color={colors.accentForeground} fontSize={11} fontWeight="bold">
                                Contribute
                              </ButtonText>
                            </HStack>
                          </Button>
                        )}
                      </HStack>
                    </Card>
                  );
                })
              )}
            </VStack>
          </>
        )}
      </ScrollView>

      {/* Add Budget Modal */}
      <AddBudgetModal
        visible={showAddBudgetModal}
        onClose={() => setShowAddBudgetModal(false)}
      />

      {/* Add Goal Modal */}
      <AddGoalModal
        visible={showAddGoalModal}
        onClose={() => setShowAddGoalModal(false)}
      />

      {/* Contribute Goal Modal */}
      <ContributeGoalModal
        visible={contributingGoal !== null}
        goal={contributingGoal}
        onClose={() => setContributingGoal(null)}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  tabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  deleteBtn: {
    padding: 6,
  },
});
