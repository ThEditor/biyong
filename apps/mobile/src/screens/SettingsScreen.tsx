import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
import {
  PALETTES,
  type AccentTheme,
  type ThemeMode,
} from '@biyong/ui';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';

const ACCENT_LIST: Array<{ id: AccentTheme; label: string; previewColor: string }> = [
  { id: 'default', label: 'Default Emerald', previewColor: '#10B981' },
  { id: 'ocean', label: 'Ocean Blue', previewColor: '#38BDF8' },
  { id: 'forest', label: 'Forest Green', previewColor: '#22C55E' },
  { id: 'violet', label: 'Royal Violet', previewColor: '#A855F7' },
  { id: 'amber', label: 'Warm Amber', previewColor: '#F59E0B' },
  { id: 'rose', label: 'Crimson Rose', previewColor: '#FB7185' },
];

export const SettingsScreen: React.FC = () => {
  const { mode, accent, resolvedMode, colors, tokens, setMode, setAccent } = useAppTheme();
  const { stats, seedDemoData, clearAllData } = useLedger();

  const handleSeedDemo = () => {
    Alert.alert(
      'Seed Demo Ledger Data',
      'This will populate sample salary income, rent expense, grocery expenses, and an account transfer. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          onPress: async () => {
            try {
              await seedDemoData();
              Alert.alert('Success', 'Sample transactions and transfers created successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to seed demo data.');
            }
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Entire Local Database',
      'This will permanently delete all transactions and custom accounts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Database',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Database Reset', 'Ledger has been cleared and reset to pristine state.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to reset database.');
            }
          },
        },
      ]
    );
  };

  return (
    <Box flex={1} backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            APPEARANCE & THEME
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
              COLOR MODE
            </Text>

            <HStack space="sm">
              {(['dark', 'light', 'system'] as const).map((m) => {
                const isSelected = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMode(m)}
                    style={[
                      styles.modeBtn,
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
                      fontWeight="bold"
                    >
                      {m.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </HStack>
            <Text color={colors.textMuted} fontSize={11} mt={8}>
              Active resolved mode: {resolvedMode.toUpperCase()}
            </Text>
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
              ACCENT PALETTE PRESET
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
                        width={20}
                        height={20}
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
                      <Badge
                        backgroundColor={colors.accentPrimary}
                        borderRadius={tokens.radius.sm}
                        px={6}
                        py={2}
                      >
                        <BadgeText color={colors.accentForeground} fontSize={10} fontWeight="bold">
                          ACTIVE
                        </BadgeText>
                      </Badge>
                    )}
                  </TouchableOpacity>
                );
              })}
            </VStack>
          </Card>
        </VStack>

        {/* Database Statistics Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            OFFLINE SQLITE STATISTICS
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
                <Text color={colors.textPrimary} fontSize={13} fontWeight="bold">
                  {stats.dbEngine}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Architecture
                </Text>
                <Badge
                  backgroundColor={colors.accentSubtle}
                  borderRadius={tokens.radius.sm}
                  px={6}
                  py={2}
                >
                  <BadgeText color={colors.accentPrimary} fontSize={10} fontWeight="bold">
                    100% OFFLINE-FIRST
                  </BadgeText>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Local Accounts
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="bold">
                  {stats.accountsCount}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Transactions Recorded
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="bold">
                  {stats.transactionsCount}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize={13}>
                  Categories Loaded
                </Text>
                <Text color={colors.textPrimary} fontSize={13} fontWeight="bold">
                  {stats.categoriesCount}
                </Text>
              </HStack>
            </VStack>
          </Card>
        </VStack>

        {/* Data Utilities Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            DATA MANAGEMENT
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
                <Text color={colors.textPrimary} fontSize={14} fontWeight="600">
                  ✨ Seed Sample Demo Ledger
                </Text>
                <Text color={colors.textMuted} fontSize={11} mt={2}>
                  Adds realistic salary, rent, groceries, coffee, and ATM transfer.
                </Text>
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
                <Text color={colors.danger} fontSize={14} fontWeight="600">
                  🗑️ Reset All Ledger Data
                </Text>
                <Text color={colors.textMuted} fontSize={11} mt={2}>
                  Deletes all entries and restores default starter accounts.
                </Text>
              </TouchableOpacity>
            </VStack>
          </Card>
        </VStack>

        {/* Footer info */}
        <VStack alignItems="center" py={12}>
          <Text color={colors.textMuted} fontSize={12} fontWeight="600">
            biyong mobile • Phase 1 Part C
          </Text>
          <Text color={colors.textMuted} fontSize={11} mt={2}>
            Local Money Ledger • Zero cloud dependencies
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
    paddingVertical: 10,
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
