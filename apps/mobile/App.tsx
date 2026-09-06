import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Box, Text, HStack } from '@gluestack-ui/themed';
import { MobileThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { LedgerProvider, useLedger } from './src/context/LedgerContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { BudgetsGoalsScreen } from './src/screens/BudgetsGoalsScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NetWorthScreen } from './src/screens/NetWorthScreen';
import { QuickAddModal } from './src/components/QuickAddModal';
import { OnboardingModal } from './src/components/OnboardingModal';
import { AuthModal } from './src/components/AuthModal';

type ScreenType =
  | 'home'
  | 'accounts'
  | 'transactions'
  | 'groups'
  | 'budgets'
  | 'reports'
  | 'settings'
  | 'networth';

interface BottomTabItem {
  id: ScreenType;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

const LEFT_TABS: BottomTabItem[] = [
  {
    id: 'home',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    id: 'reports',
    label: 'Report',
    activeIcon: 'bar-chart',
    inactiveIcon: 'bar-chart-outline',
  },
];

const RIGHT_TABS: BottomTabItem[] = [
  {
    id: 'budgets',
    label: 'Plan',
    activeIcon: 'wallet',
    inactiveIcon: 'wallet-outline',
  },
  {
    id: 'settings',
    label: 'Settings',
    activeIcon: 'settings',
    inactiveIcon: 'settings-outline',
  },
];

function MainNavigator() {
  const { colors, tokens, resolvedMode } = useAppTheme();
  const { isReady, hasCompletedOnboarding, openAddModal } = useLedger();
  const [activeScreen, setActiveScreen] = useState<ScreenType>('home');
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  if (!isReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text color={colors.textSecondary} fontSize={14} mt={14} fontWeight="600">
          Loading your financial ledger...
        </Text>
      </View>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home':
        return (
          <HomeScreen
            onNavigateToAccounts={() => setActiveScreen('accounts')}
            onNavigateToTransactions={() => setActiveScreen('transactions')}
            onNavigateToGroups={() => setActiveScreen('groups')}
            onNavigateToReports={() => setActiveScreen('reports')}
            onNavigateToPlan={() => setActiveScreen('budgets')}
            onNavigateToNetWorth={() => setActiveScreen('networth')}
          />
        );
      case 'accounts':
        return <AccountsScreen onBack={() => setActiveScreen('home')} />;
      case 'transactions':
        return <TransactionsScreen onBack={() => setActiveScreen('home')} />;
      case 'groups':
        return <GroupsScreen onBack={() => setActiveScreen('home')} />;
      case 'budgets':
        return <BudgetsGoalsScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'networth':
        return <NetWorthScreen onBack={() => setActiveScreen('home')} />;
    }
  };

  const isHomeGroupActive =
    activeScreen === 'home' ||
    activeScreen === 'accounts' ||
    activeScreen === 'transactions' ||
    activeScreen === 'groups' ||
    activeScreen === 'networth';

  return (
    <View
      style={[
        styles.rootContainer,
        {
          backgroundColor: colors.background
        },
      ]}
    >
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent={false} />

      {/* Screen Content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Persistent Bottom Bar with Elevated Center FAB */}
      <Box
        backgroundColor={colors.surface}
        borderTopWidth={1}
        borderTopColor={colors.border}
        px={6}
        pt={4}
        pb={bottomInset}
      >
        <HStack justifyContent="space-around" alignItems="center">
          {/* Left Tabs (Home, Report) */}
          {LEFT_TABS.map((tab) => {
            const isActive = tab.id === 'home' ? isHomeGroupActive : activeScreen === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveScreen(tab.id)}
                activeOpacity={0.7}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: colors.accentSubtle,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.inactiveIcon}
                  size={20}
                  color={isActive ? colors.accentPrimary : colors.textSecondary}
                />
                <Text
                  color={isActive ? colors.accentPrimary : colors.textSecondary}
                  fontSize={10}
                  fontWeight={isActive ? '700' : '500'}
                  mt={2}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Elevated Center Floating Action Button (FAB) */}
          <View style={styles.fabContainer}>
            <TouchableOpacity
              onPress={() => openAddModal()}
              activeOpacity={0.85}
              style={[
                styles.centerFab,
                {
                  backgroundColor: colors.accentPrimary,
                  shadowColor: colors.accentPrimary,
                },
              ]}
            >
              <Ionicons name="add" size={28} color={colors.accentForeground} />
            </TouchableOpacity>
          </View>

          {/* Right Tabs (Plan, Settings) */}
          {RIGHT_TABS.map((tab) => {
            const isActive = activeScreen === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveScreen(tab.id)}
                activeOpacity={0.7}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: colors.accentSubtle,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.inactiveIcon}
                  size={20}
                  color={isActive ? colors.accentPrimary : colors.textSecondary}
                />
                <Text
                  color={isActive ? colors.accentPrimary : colors.textSecondary}
                  fontSize={10}
                  fontWeight={isActive ? '700' : '500'}
                  mt={2}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </HStack>
      </Box>

      {/* Global Quick Add Modal */}
      <QuickAddModal />

      {/* Authentication & Cloud Sync Modal */}
      <AuthModal />

      {/* Onboarding Flow for First-time Launch */}
      <OnboardingModal visible={!hasCompletedOnboarding} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MobileThemeProvider initialMode="dark" initialAccent="violet">
        <LedgerProvider>
          <MainNavigator />
        </LedgerProvider>
      </MobileThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 54,
  },
  fabContainer: {
    position: 'relative',
    top: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
