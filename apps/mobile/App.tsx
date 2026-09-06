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
import { QuickAddModal } from './src/components/QuickAddModal';
import { OnboardingModal } from './src/components/OnboardingModal';
import { AuthModal } from './src/components/AuthModal';

type TabType = 'home' | 'accounts' | 'transactions' | 'groups' | 'budgets' | 'reports' | 'settings';

interface TabItem {
  id: TabType;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  {
    id: 'home',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    id: 'accounts',
    label: 'Accounts',
    activeIcon: 'wallet',
    inactiveIcon: 'wallet-outline',
  },
  {
    id: 'transactions',
    label: 'Activity',
    activeIcon: 'swap-horizontal',
    inactiveIcon: 'swap-horizontal-outline',
  },
  {
    id: 'groups',
    label: 'Groups',
    activeIcon: 'people',
    inactiveIcon: 'people-outline',
  },
  {
    id: 'budgets',
    label: 'Budgets',
    activeIcon: 'pie-chart',
    inactiveIcon: 'pie-chart-outline',
  },
  {
    id: 'reports',
    label: 'Reports',
    activeIcon: 'bar-chart',
    inactiveIcon: 'bar-chart-outline',
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
  const { isReady, hasCompletedOnboarding } = useLedger();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const insets = useSafeAreaInsets();

  // Top inset accounts for Android status bar and iOS notch / Dynamic Island
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0
  );
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  if (!isReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text color={colors.textSecondary} fontSize={14} mt={14} fontWeight="600">
          Loading your financial ledger...
        </Text>
      </View>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            onNavigateToAccounts={() => setActiveTab('accounts')}
            onNavigateToTransactions={() => setActiveTab('transactions')}
          />
        );
      case 'accounts':
        return <AccountsScreen />;
      case 'transactions':
        return <TransactionsScreen />;
      case 'groups':
        return <GroupsScreen />;
      case 'budgets':
        return <BudgetsGoalsScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
    }
  };

  return (
    <View
      style={[
        styles.rootContainer,
        {
          backgroundColor: colors.background,
          paddingTop: topInset,
        },
      ]}
    >
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent={false} />

      {/* Screen Content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Tab Bar with Inset Protection */}
      <Box
        backgroundColor={colors.surface}
        borderTopWidth={1}
        borderTopColor={colors.border}
        px={2}
        pt={6}
        pb={bottomInset}
      >
        <HStack justifyContent="space-around" alignItems="center">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
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
                  mt={3}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </HStack>
      </Box>

      {/* Quick Add Modal */}
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
      <MobileThemeProvider initialMode="dark" initialAccent="default">
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
    paddingHorizontal: 6,
    minWidth: 48,
  },
});
