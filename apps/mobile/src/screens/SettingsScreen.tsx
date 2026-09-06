import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
import {
  type AccentTheme,
} from '@biyong/ui';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

const ACCENT_LIST: Array<{ id: AccentTheme; label: string; previewColor: string }> = [
  { id: 'default', label: 'Emerald', previewColor: '#10B981' },
  { id: 'ocean', label: 'Ocean', previewColor: '#38BDF8' },
  { id: 'forest', label: 'Forest', previewColor: '#22C55E' },
  { id: 'violet', label: 'Violet', previewColor: '#A855F7' },
  { id: 'amber', label: 'Amber', previewColor: '#F59E0B' },
  { id: 'rose', label: 'Rose', previewColor: '#FB7185' },
];

export const SettingsScreen: React.FC = () => {
  const { mode, accent, resolvedMode, colors, tokens, setMode, setAccent } = useAppTheme();
  const { stats, seedDemoData, clearAllData, resetOnboarding } = useLedger();

  const handleSeedDemo = () => {
    Alert.alert(
      'Load Sample Financial Data',
      'This will create sample bank accounts, salary income, rent expense, and everyday grocery transactions to help you test the ledger. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Data',
          onPress: async () => {
            try {
              await seedDemoData();
              Alert.alert('Success', 'Sample financial records created.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to populate sample data.');
            }
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Clear All Ledger Data',
      'This will permanently erase all accounts, transactions, and preferences from your device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Ledger Reset', 'All data has been cleared. You have a fresh blank ledger.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  const handleReplayOnboarding = () => {
    resetOnboarding();
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            APPEARANCE & DISPLAY
          </Text>

          {/* Theme Mode Card */}
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.md}
          >
            <Text color={colors.textSecondary} fontSize={12} fontWeight="bold" mb={10}>
              THEME MODE
            </Text>

            <HStack space="sm">
              {(
                [
                  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
                  { id: 'light', label: 'Light', icon: 'sunny-outline' },
                  { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
                ] as const
              ).map((m) => {
                const isSelected = mode === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setMode(m.id)}
                    style={[
                      styles.modeBtn,
                      {
                        backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                        borderColor: isSelected ? colors.accentPrimary : colors.border,
                        borderRadius: tokens.radius.sm,
                      },
                    ]}
                  >
                    <Ionicons
                      name={m.icon}
                      size={16}
                      color={isSelected ? colors.accentForeground : colors.textSecondary}
                    />
                    <Text
                      color={isSelected ? colors.accentForeground : colors.textSecondary}
                      fontSize={12}
                      fontWeight="bold"
                      mt={4}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </HStack>
          </Card>

          {/* Accent Theme Presets Card */}
          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.md}
          >
            <Text color={colors.textSecondary} fontSize={12} fontWeight="bold" mb={10}>
              ACCENT COLOR
            </Text>

            <VStack space="sm">
              {ACCENT_LIST.map((item) => {
                const isSelected = accent === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setAccent(item.id)}
                    style={[
                      styles.accentRow,
                      {
                        backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceSubtle,
                        borderColor: isSelected ? colors.accentPrimary : colors.border,
                        borderRadius: tokens.radius.sm,
                      },
                    ]}
                  >
                    <HStack alignItems="center" space="sm">
                      <Box
                        width={18}
                        height={18}
                        borderRadius={tokens.radius.full}
                        backgroundColor={item.previewColor}
                      />
                      <Text
                        color={isSelected ? colors.accentPrimary : colors.textPrimary}
                        fontSize={14}
                        fontWeight="600"
                      >
                        {item.label}
                      </Text>
                    </HStack>

                    {isSelected && (
                      <Feather name="check" size={16} color={colors.accentPrimary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </VStack>
          </Card>
        </VStack>

        {/* Data & Guide Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            DATA & PREFERENCES
          </Text>

          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.md}
          >
            <VStack space="md">
              <TouchableOpacity
                onPress={handleReplayOnboarding}
                style={[
                  styles.mgmtBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <HStack space="sm" alignItems="center">
                  <Feather name="help-circle" size={18} color={colors.accentPrimary} />
                  <VStack flex={1}>
                    <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                      View Welcome Guide
                    </Text>
                    <Text color={colors.textMuted} fontSize={11} mt={1}>
                      Review features and intro screens anytime.
                    </Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSeedDemo}
                style={[
                  styles.mgmtBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <HStack space="sm" alignItems="center">
                  <Feather name="download" size={18} color={colors.accentPrimary} />
                  <VStack flex={1}>
                    <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                      Load Sample Ledger Data
                    </Text>
                    <Text color={colors.textMuted} fontSize={11} mt={1}>
                      Populates sample accounts and transactions for quick exploration.
                    </Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResetData}
                style={[
                  styles.mgmtBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.danger,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <HStack space="sm" alignItems="center">
                  <Feather name="trash-2" size={18} color={colors.danger} />
                  <VStack flex={1}>
                    <Text color={colors.danger} fontSize={14} fontWeight="600">
                      Clear All Ledger Data
                    </Text>
                    <Text color={colors.textMuted} fontSize={11} mt={1}>
                      Permanently wipes all accounts and records back to an empty ledger.
                    </Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>
            </VStack>
          </Card>
        </VStack>

        {/* Technical Diagnostics Section (Only in Settings) */}
        <VStack space="sm">
          <Text color={colors.textMuted} fontSize={11} fontWeight="bold" letterSpacing={0.8}>
            TECHNICAL DIAGNOSTICS & STORAGE
          </Text>

          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.md}
          >
            <VStack space="sm">
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Storage Engine
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                  {stats.dbEngine}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Network State
                </Text>
                <Badge
                  backgroundColor={colors.accentSubtle}
                  borderRadius={tokens.radius.sm}
                  px={6}
                  py={2}
                >
                  <BadgeText color={colors.accentPrimary} fontSize={10} fontWeight="bold">
                    OFFLINE ONLY
                  </BadgeText>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Local Accounts Stored
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                  {stats.accountsCount}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Local Transactions Stored
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                  {stats.transactionsCount}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Local Taxonomy Categories
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="600">
                  {stats.categoriesCount}
                </Text>
              </HStack>
            </VStack>
          </Card>
        </VStack>

        {/* App Version Info */}
        <VStack alignItems="center" py={16}>
          <Text color={colors.textMuted} fontSize={12} fontWeight="600">
            Biyong v0.1.0
          </Text>
          <Text color={colors.textMuted} fontSize={11} mt={2}>
            Deterministic Local Financial Ledger
          </Text>
        </VStack>
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
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  accentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  mgmtBtn: {
    padding: 12,
    borderWidth: 1,
  },
});
