import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  View,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
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
  const {
    stats,
    seedDemoData,
    clearAllData,
    resetOnboarding,
    user,
    deviceId,
    isGuest,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    openAuthModal,
    logout,
    syncNow,
    apiUrl,
    setApiUrl,
    testApiConnection,
  } = useLedger();

  const [inputUrl, setInputUrl] = React.useState(apiUrl);
  const [isTestingApi, setIsTestingApi] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [isSavingUrl, setIsSavingUrl] = React.useState(false);

  React.useEffect(() => {
    setInputUrl(apiUrl);
  }, [apiUrl]);

  const handleTestConnection = async () => {
    setIsTestingApi(true);
    setTestResult(null);
    try {
      const res = await testApiConnection(inputUrl);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || 'Connection failed' });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSaveApiUrl = async () => {
    setIsSavingUrl(true);
    setTestResult(null);
    try {
      await setApiUrl(inputUrl);
      Alert.alert('Server URL Saved', `Backend API URL set to ${inputUrl.trim().replace(/\/+$/, '')}`);
    } catch (err: any) {
      Alert.alert('Invalid URL', err?.message || 'Failed to save backend URL.');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handlePresetSelect = (preset: string) => {
    setInputUrl(preset);
    setTestResult(null);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your financial records remain securely stored on this device in guest mode.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to sign out.');
            }
          },
        },
      ]
    );
  };

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
        {/* Account & Cloud Sync Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            ACCOUNT & CLOUD SYNC
          </Text>

          {isGuest ? (
            <Card
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius={tokens.radius.md}
              p={tokens.spacing.md}
            >
              <HStack space="md" alignItems="center" mb={12}>
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="cloud-offline-outline" size={22} color={colors.textSecondary} />
                </View>
                <VStack flex={1}>
                  <Text color={colors.textPrimary} fontSize={15} fontWeight="700">
                    Guest Mode (100% Offline)
                  </Text>
                  <Text color={colors.textMuted} fontSize={11} mt={1}>
                    Device ID: {deviceId ? `${deviceId.slice(0, 16)}...` : 'Local Device'}
                  </Text>
                </VStack>
              </HStack>

              <Text color={colors.textSecondary} fontSize={13} lineHeight={18} mb={14}>
                Your financial ledger is saved on this device. Sign in or register to sync across devices.
              </Text>

              <TouchableOpacity
                onPress={() => openAuthModal()}
                style={[
                  styles.authActionBtn,
                  {
                    backgroundColor: colors.accentPrimary,
                    borderRadius: tokens.radius.md,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name="log-in-outline" size={18} color={colors.accentForeground} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.accentForeground, fontSize: 14, fontWeight: '700' }}>
                  Sign In or Register
                </Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <>
              {/* User Profile Card */}
              <Card
                backgroundColor={colors.surface}
                borderColor={colors.border}
                borderWidth={1}
                borderRadius={tokens.radius.md}
                p={tokens.spacing.md}
              >
                <HStack space="md" alignItems="center">
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: colors.accentSubtle, borderColor: colors.accentPrimary },
                    ]}
                  >
                    <Ionicons name="person" size={22} color={colors.accentPrimary} />
                  </View>
                  <VStack flex={1}>
                    <Text color={colors.textPrimary} fontSize={16} fontWeight="700">
                      {user?.name || 'User'}
                    </Text>
                    <Text color={colors.textSecondary} fontSize={13} mt={1}>
                      {user?.email}
                    </Text>
                    <View
                      style={[
                        styles.deviceIdBadge,
                        { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                      ]}
                    >
                      <Ionicons name="hardware-chip-outline" size={11} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>
                        {deviceId ? deviceId.slice(0, 18) : 'device'}
                      </Text>
                    </View>
                  </VStack>
                </HStack>
              </Card>

              {/* Cloud Sync Card */}
              <Card
                backgroundColor={colors.surface}
                borderColor={colors.border}
                borderWidth={1}
                borderRadius={tokens.radius.md}
                p={tokens.spacing.md}
              >
                <HStack justifyContent="space-between" alignItems="center" mb={12}>
                  <Text color={colors.textSecondary} fontSize={12} fontWeight="bold" letterSpacing={0.5}>
                    CLOUD SYNCHRONIZATION
                  </Text>
                  {/* Sync status badge */}
                  {syncStatus === 'syncing' ? (
                    <Badge
                      backgroundColor={colors.accentPrimary}
                      borderRadius={tokens.radius.sm}
                      px="$2"
                      py="$0.5"
                    >
                      <BadgeText color={colors.accentForeground} fontSize={10} fontWeight="700">
                        Syncing
                      </BadgeText>
                    </Badge>
                  ) : pendingSyncCount > 0 ? (
                    <Badge
                      backgroundColor={colors.warning}
                      borderRadius={tokens.radius.sm}
                      px="$2"
                      py="$0.5"
                    >
                      <BadgeText color={colors.background} fontSize={10} fontWeight="700">
                        Pending Changes
                      </BadgeText>
                    </Badge>
                  ) : (
                    <Badge
                      backgroundColor={colors.success}
                      borderRadius={tokens.radius.sm}
                      px="$2"
                      py="$0.5"
                    >
                      <BadgeText color={colors.accentForeground} fontSize={10} fontWeight="700">
                        Synced
                      </BadgeText>
                    </Badge>
                  )}
                </HStack>

                <VStack space="xs" mb={14}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text color={colors.textSecondary} fontSize={13}>
                      Pending Changes:
                    </Text>
                    <Text color={colors.textPrimary} fontSize={13} fontWeight="700">
                      {pendingSyncCount === 0
                        ? '0 waiting to sync'
                        : `${pendingSyncCount} ${pendingSyncCount === 1 ? 'change' : 'changes'} waiting to sync`}
                    </Text>
                  </HStack>

                  <HStack justifyContent="space-between" alignItems="center" mt={4}>
                    <Text color={colors.textSecondary} fontSize={13}>
                      Last Synced:
                    </Text>
                    <Text color={colors.textMuted} fontSize={12}>
                      {lastSyncedAt
                        ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Never'}
                    </Text>
                  </HStack>
                </VStack>

                {/* Sync Now Button */}
                <TouchableOpacity
                  onPress={() => syncNow()}
                  disabled={syncStatus === 'syncing'}
                  style={[
                    styles.authActionBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: tokens.radius.md,
                      opacity: syncStatus === 'syncing' ? 0.6 : 1,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  {syncStatus === 'syncing' ? (
                    <ActivityIndicator size="small" color={colors.accentPrimary} style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="sync-outline" size={16} color={colors.accentPrimary} style={{ marginRight: 6 }} />
                  )}
                  <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '700' }}>
                    {syncStatus === 'syncing' ? 'Syncing Now...' : 'Sync Now'}
                  </Text>
                </TouchableOpacity>
              </Card>

              {/* Sign Out Button */}
              <TouchableOpacity
                onPress={handleSignOut}
                style={[
                  styles.signOutBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: tokens.radius.md,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700' }}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </>
          )}
        </VStack>

        {/* Server & Network Configuration Section */}
        <VStack space="sm">
          <Text color={colors.textPrimary} fontSize={12} fontWeight="bold" letterSpacing={0.8}>
            SERVER & NETWORK CONFIGURATION
          </Text>

          <Card
            backgroundColor={colors.surface}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius={tokens.radius.md}
            p={tokens.spacing.md}
          >
            <HStack justifyContent="space-between" alignItems="center" mb={10}>
              <Text color={colors.textSecondary} fontSize={12} fontWeight="bold" letterSpacing={0.5}>
                BACKEND API URL
              </Text>
              <View
                style={[
                  styles.devicePill,
                  { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
              >
                <Ionicons name="server-outline" size={11} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>
                  {apiUrl}
                </Text>
              </View>
            </HStack>

            <TextInput
              value={inputUrl}
              onChangeText={(text) => {
                setInputUrl(text);
                setTestResult(null);
              }}
              placeholder="http://localhost:3000"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.urlInput,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  borderRadius: tokens.radius.sm,
                },
              ]}
            />

            {/* Quick Presets */}
            <VStack space="xs" mt={10} mb={12}>
              <Text color={colors.textMuted} fontSize={11} fontWeight="600">
                QUICK PRESETS
              </Text>
              <HStack space="xs" flexWrap="wrap">
                <TouchableOpacity
                  onPress={() => handlePresetSelect('http://localhost:3000')}
                  activeOpacity={0.7}
                  style={[
                    styles.presetPill,
                    {
                      backgroundColor: inputUrl === 'http://localhost:3000' ? colors.accentSubtle : colors.surfaceSubtle,
                      borderColor: inputUrl === 'http://localhost:3000' ? colors.accentPrimary : colors.border,
                      borderRadius: tokens.radius.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      {
                        color: inputUrl === 'http://localhost:3000' ? colors.accentPrimary : colors.textSecondary,
                        fontWeight: inputUrl === 'http://localhost:3000' ? '700' : '500',
                      },
                    ]}
                  >
                    Localhost:3000
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePresetSelect('http://10.0.2.2:3000')}
                  activeOpacity={0.7}
                  style={[
                    styles.presetPill,
                    {
                      backgroundColor: inputUrl === 'http://10.0.2.2:3000' ? colors.accentSubtle : colors.surfaceSubtle,
                      borderColor: inputUrl === 'http://10.0.2.2:3000' ? colors.accentPrimary : colors.border,
                      borderRadius: tokens.radius.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      {
                        color: inputUrl === 'http://10.0.2.2:3000' ? colors.accentPrimary : colors.textSecondary,
                        fontWeight: inputUrl === 'http://10.0.2.2:3000' ? '700' : '500',
                      },
                    ]}
                  >
                    Android Emulator (10.0.2.2:3000)
                  </Text>
                </TouchableOpacity>
              </HStack>
            </VStack>

            {/* Test result status pill */}
            {testResult && (
              <View
                style={[
                  styles.testResultPill,
                  {
                    backgroundColor: testResult.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    borderColor: testResult.ok ? colors.success : colors.danger,
                    borderRadius: tokens.radius.sm,
                  },
                ]}
              >
                <Ionicons
                  name={testResult.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={14}
                  color={testResult.ok ? colors.success : colors.danger}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    color: testResult.ok ? colors.success : colors.danger,
                    fontSize: 12,
                    fontWeight: '600',
                    flex: 1,
                  }}
                >
                  {testResult.message}
                </Text>
              </View>
            )}

            {/* Action Row */}
            <HStack space="xs" mt={8}>
              <TouchableOpacity
                onPress={handleTestConnection}
                disabled={isTestingApi}
                style={[
                  styles.networkActionBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: tokens.radius.md,
                    flex: 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                {isTestingApi ? (
                  <ActivityIndicator size="small" color={colors.accentPrimary} style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="flash-outline" size={14} color={colors.accentPrimary} style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: colors.accentPrimary, fontSize: 12, fontWeight: '700' }}>
                  {isTestingApi ? 'Testing...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveApiUrl}
                disabled={isSavingUrl || inputUrl.trim().replace(/\/+$/, '') === apiUrl}
                style={[
                  styles.networkActionBtn,
                  {
                    backgroundColor: colors.accentPrimary,
                    borderRadius: tokens.radius.md,
                    flex: 1,
                    opacity: isSavingUrl || inputUrl.trim().replace(/\/+$/, '') === apiUrl ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                {isSavingUrl ? (
                  <ActivityIndicator size="small" color={colors.accentForeground} style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="save-outline" size={14} color={colors.accentForeground} style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: colors.accentForeground, fontSize: 12, fontWeight: '700' }}>
                  Save URL
                </Text>
              </TouchableOpacity>
            </HStack>
          </Card>
        </VStack>

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
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
    gap: 4,
  },
  authActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  urlInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  presetPillText: {
    fontSize: 11,
  },
  testResultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  networkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  devicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
});
