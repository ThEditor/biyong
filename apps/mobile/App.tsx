import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Box, Text, HStack } from '@gluestack-ui/themed';
import { MobileThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { LedgerProvider, useLedger } from './src/context/LedgerContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { QuickAddModal } from './src/components/QuickAddModal';

type TabType = 'home' | 'accounts' | 'transactions' | 'reports' | 'settings';

interface TabItem {
  id: TabType;
  label: string;
  icon: string;
}

const TABS: TabItem[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'accounts', label: 'Accounts', icon: '💳' },
  { id: 'transactions', label: 'Ledger', icon: '⇄' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

function MainNavigator() {
  const { colors, tokens, resolvedMode } = useAppTheme();
  const { isReady } = useLedger();
  const [activeTab, setActiveTab] = useState<TabType>('home');

  if (!isReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text color={colors.textSecondary} fontSize={14} mt={14} fontWeight="600">
          Initializing offline financial ledger...
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
      case 'reports':
        return <ReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />

      {/* Screen Content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Tab Bar */}
      <Box
        backgroundColor={colors.surface}
        borderTopWidth={1}
        borderTopColor={colors.border}
        px={6}
        py={4}
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
                <Text fontSize={18} mb={2}>
                  {tab.icon}
                </Text>
                <Text
                  color={isActive ? colors.accentPrimary : colors.textSecondary}
                  fontSize={10}
                  fontWeight={isActive ? '700' : '500'}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </HStack>
      </Box>

      {/* Global QuickAddModal (Available everywhere) */}
      <QuickAddModal />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <MobileThemeProvider initialMode="dark" initialAccent="default">
      <LedgerProvider>
        <MainNavigator />
      </LedgerProvider>
    </MobileThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    minWidth: 60,
  },
});
