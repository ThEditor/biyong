import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Box, Text, HStack, VStack, Card } from '@gluestack-ui/themed';
import { formatMoney } from '@biyong/domain';
import type {
  NaturalLanguageQueryResponse,
  PeerDebt,
  ReimbursementClaim,
  SubscriptionItem,
} from '@biyong/schemas';
import { useAppTheme } from '../theme/ThemeContext';
import { useLedger } from '../context/LedgerContext';
import { AddPeerDebtModal } from '../components/AddPeerDebtModal';
import { RepayPeerDebtModal } from '../components/RepayPeerDebtModal';
import { AddReimbursementModal } from '../components/AddReimbursementModal';
import { AddSubscriptionModal } from '../components/AddSubscriptionModal';

interface IntelligenceScreenProps {
  onBack: () => void;
}

const SAMPLE_QUESTIONS = [
  'Why did I spend more this month?',
  'Who owes me money?',
  'How much did I invest this year?',
  'Can I afford a ₹70,000 laptop?',
  'Why did my net worth increase?',
];

type IntelligenceTab = 'query' | 'forecast' | 'anomalies' | 'workflows';

export const IntelligenceScreen: React.FC<IntelligenceScreenProps> = ({ onBack }) => {
  const { colors, tokens } = useAppTheme();
  const {
    queryIntelligence,
    anomalies,
    cashFlowForecast,
    peerDebts,
    peerDebtSummary,
    deletePeerDebt,
    reimbursements,
    reimbursementSummary,
    updateReimbursementStatus,
    deleteReimbursement,
    subscriptions,
    subscriptionBurnRate,
    deleteSubscription,
    detectSubscriptions,
  } = useLedger();

  const [activeTab, setActiveTab] = useState<IntelligenceTab>('query');
  const [question, setQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResponse, setQueryResponse] = useState<NaturalLanguageQueryResponse | null>(null);

  // Modals state
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [repayingDebt, setRepayingDebt] = useState<PeerDebt | null>(null);
  const [isAddReimbursementOpen, setIsAddReimbursementOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isScanningSubs, setIsScanningSubs] = useState(false);

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk ?? question).trim();
    if (!q) return;

    setQuestion(q);
    setIsQuerying(true);
    try {
      const res = await queryIntelligence(q);
      setQueryResponse(res);
    } catch (err: any) {
      console.error('Failed to run query:', err);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleScanSubscriptions = async () => {
    setIsScanningSubs(true);
    try {
      await detectSubscriptions();
    } finally {
      setIsScanningSubs(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Navigation Bar */}
      <HStack justifyContent="space-between" alignItems="center" px={16} py={12}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HStack alignItems="center">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            <Text color={colors.textPrimary} fontSize={16} fontWeight="600" ml={4}>
              Back
            </Text>
          </HStack>
        </TouchableOpacity>
        <Text fontSize={18} fontWeight="bold" color={colors.textPrimary}>
          Financial Intelligence
        </Text>
        <Box width={40} />
      </HStack>

      {/* Segmented Tab Controls */}
      <HStack px={16} py={8} space="xs">
        {(
          [
            { id: 'query', label: 'AI Query', icon: 'sparkles-outline' },
            { id: 'forecast', label: 'Cash Flow', icon: 'trending-up-outline' },
            { id: 'anomalies', label: `Alerts (${anomalies.length})`, icon: 'shield-alert-outline' },
            { id: 'workflows', label: 'Workflows', icon: 'git-network-outline' },
          ] as const
        ).map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isSelected ? colors.accentPrimary : colors.surfaceSubtle,
                  borderColor: isSelected ? colors.accentPrimary : colors.border,
                },
              ]}
            >
              <Text
                fontSize={12}
                fontWeight="700"
                color={isSelected ? colors.accentForeground : colors.textSecondary}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </HStack>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ==================================================== */}
        {/* 1. Natural Language AI Query Tab                     */}
        {/* ==================================================== */}
        {activeTab === 'query' && (
          <VStack space="lg">
            {/* Input Bar */}
            <VStack space="xs">
              <Text color={colors.textSecondary} fontSize={11} fontWeight="bold" letterSpacing={0.5}>
                ASK BIYONG (LOCAL DETERMINISTIC FINANCIAL ENGINE)
              </Text>
              <HStack space="xs" alignItems="center">
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  onSubmitEditing={() => handleAsk()}
                  placeholder="Ask anything about your money..."
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.queryInput,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                />
                <TouchableOpacity
                  onPress={() => handleAsk()}
                  disabled={isQuerying}
                  style={[
                    styles.askButton,
                    {
                      backgroundColor: colors.accentPrimary,
                      opacity: isQuerying ? 0.7 : 1,
                    },
                  ]}
                >
                  {isQuerying ? (
                    <ActivityIndicator size="small" color={colors.accentForeground} />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color={colors.accentForeground} />
                  )}
                </TouchableOpacity>
              </HStack>
            </VStack>

            {/* Prompt Chips */}
            <VStack space="xs">
              <Text color={colors.textMuted} fontSize={11} fontWeight="600">
                SUGGESTED QUESTIONS
              </Text>
              <HStack space="xs" flexWrap="wrap">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleAsk(q)}
                    style={[
                      styles.sampleChip,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text fontSize={12} color={colors.textPrimary} fontWeight="500">
                      {q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </HStack>
            </VStack>

            {/* Answer Display Card */}
            {queryResponse && (
              <Box
                p={16}
                borderRadius={12}
                backgroundColor={colors.surface}
                borderWidth={1}
                borderColor={colors.border}
                style={styles.shadow}
              >
                <HStack justifyContent="space-between" alignItems="center" mb={10}>
                  <Box
                    px={8}
                    py={3}
                    borderRadius={12}
                    backgroundColor={colors.accentPrimary + '20'}
                  >
                    <Text fontSize={11} fontWeight="bold" color={colors.accentPrimary}>
                      {queryResponse.matchedIntent.toUpperCase().replace(/_/g, ' ')}
                    </Text>
                  </Box>
                </HStack>

                <Text fontSize={16} fontWeight="bold" color={colors.textPrimary} mb={8}>
                  {queryResponse.headline}
                </Text>

                <Text fontSize={14} color={colors.textSecondary} lineHeight={20} mb={12}>
                  {queryResponse.explanation}
                </Text>
              </Box>
            )}
          </VStack>
        )}

        {/* ==================================================== */}
        {/* 2. Cash Flow Runway Projection Tab                   */}
        {/* ==================================================== */}
        {activeTab === 'forecast' && (
          <VStack space="md">
            <Box p={16} borderRadius={12} backgroundColor={colors.surface} borderWidth={1} borderColor={colors.border}>
              <Text fontSize={16} fontWeight="bold" color={colors.textPrimary} mb={4}>
                60-Day Runway Projection
              </Text>
              <Text fontSize={13} color={colors.textSecondary} mb={12}>
                Simulates liquid cash flow runway incorporating deterministic recurring bills, subscriptions, debt repayments, and liabilities.
              </Text>

              {cashFlowForecast.length > 0 && (
                <HStack justifyContent="space-between" pt={8} borderTopWidth={1} borderColor={colors.border}>
                  <VStack>
                    <Text fontSize={11} color={colors.textMuted}>Current Liquid</Text>
                    <Text fontSize={14} fontWeight="bold" color={colors.textPrimary}>
                      {formatMoney(cashFlowForecast[0].projectedBalanceMinor)}
                    </Text>
                  </VStack>
                  <VStack alignItems="flex-end">
                    <Text fontSize={11} color={colors.textMuted}>Day 60 Balance</Text>
                    <Text
                      fontSize={14}
                      fontWeight="bold"
                      color={
                        cashFlowForecast[cashFlowForecast.length - 1].projectedBalanceMinor >= 0
                          ? colors.success
                          : colors.danger
                      }
                    >
                      {formatMoney(cashFlowForecast[cashFlowForecast.length - 1].projectedBalanceMinor)}
                    </Text>
                  </VStack>
                </HStack>
              )}
            </Box>

            {/* Projection Schedule Sample */}
            <VStack space="xs">
              <Text fontSize={12} fontWeight="bold" color={colors.textMuted} letterSpacing={0.5}>
                PROJECTED TRAJECTORY (WEEKLY INTERVALS)
              </Text>
              {cashFlowForecast
                .filter((_, idx) => idx % 7 === 0 || idx === cashFlowForecast.length - 1)
                .map((point) => (
                  <Box
                    key={point.date}
                    p={12}
                    borderRadius={8}
                    backgroundColor={colors.surfaceSubtle}
                    borderWidth={1}
                    borderColor={colors.border}
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack>
                        <Text fontSize={13} fontWeight="bold" color={colors.textPrimary}>
                          {point.date}
                        </Text>
                        <Text fontSize={11} color={colors.textSecondary}>
                          Inflow: +{formatMoney(point.expectedIncomeMinor)} | Outflow: -{formatMoney(point.expectedOutflowMinor)}
                        </Text>
                      </VStack>
                      <Text
                        fontSize={14}
                        fontWeight="bold"
                        color={point.projectedBalanceMinor >= 0 ? colors.textPrimary : colors.danger}
                      >
                        {formatMoney(point.projectedBalanceMinor)}
                      </Text>
                    </HStack>
                  </Box>
                ))}
            </VStack>
          </VStack>
        )}

        {/* ==================================================== */}
        {/* 3. Financial Anomalies & Alerts Tab                 */}
        {/* ==================================================== */}
        {activeTab === 'anomalies' && (
          <VStack space="md">
            <Text fontSize={15} fontWeight="bold" color={colors.textPrimary}>
              Detected Financial Anomalies ({anomalies.length})
            </Text>

            {anomalies.length === 0 ? (
              <Box p={24} borderRadius={12} backgroundColor={colors.surface} alignItems="center" borderWidth={1} borderColor={colors.border}>
                <Ionicons name="checkmark-done-circle" size={40} color={colors.success} />
                <Text fontSize={15} fontWeight="bold" color={colors.textPrimary} mt={10}>
                  Ledger is in Great Health
                </Text>
                <Text fontSize={13} color={colors.textSecondary} textAlign="center" mt={4}>
                  No duplicate charges, irregular spikes, or overdue liabilities detected.
                </Text>
              </Box>
            ) : (
              anomalies.map((a) => (
                <Box
                  key={a.id}
                  p={14}
                  borderRadius={10}
                  backgroundColor={colors.surface}
                  borderWidth={1}
                  borderColor={
                    a.type === 'duplicate_charge' || a.type === 'spending_spike'
                      ? colors.danger
                      : colors.warning
                  }
                >
                  <HStack justifyContent="space-between" alignItems="center" mb={6}>
                    <HStack space="xs" alignItems="center">
                      <Ionicons
                        name="alert-circle"
                        size={16}
                        color={
                          a.type === 'duplicate_charge' || a.type === 'spending_spike'
                            ? colors.danger
                            : colors.warning
                        }
                      />
                      <Text fontSize={14} fontWeight="bold" color={colors.textPrimary}>
                        {a.title}
                      </Text>
                    </HStack>
                    <Text fontSize={11} color={colors.textMuted}>
                      {a.detectedAt.slice(0, 10)}
                    </Text>
                  </HStack>
                  <Text fontSize={13} color={colors.textSecondary} lineHeight={18}>
                    {a.description}
                  </Text>
                  {a.amountMinor !== undefined && (
                    <Text fontSize={13} fontWeight="bold" color={colors.textPrimary} mt={6}>
                      Amount: {formatMoney(a.amountMinor)}
                    </Text>
                  )}
                </Box>
              ))
            )}
          </VStack>
        )}

        {/* ==================================================== */}
        {/* 4. Advanced Money Workflows Tab                      */}
        {/* ==================================================== */}
        {activeTab === 'workflows' && (
          <VStack space="xl">
            {/* Section A: Peer Lending & Borrowing */}
            <VStack space="sm">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text fontSize={16} fontWeight="bold" color={colors.textPrimary}>
                    Peer Lending & Borrowing
                  </Text>
                  <Text fontSize={12} color={colors.textSecondary}>
                    Lent: {formatMoney(peerDebtSummary?.totalLentMinor ?? 0)} | Borrowed: {formatMoney(peerDebtSummary?.totalBorrowedMinor ?? 0)}
                  </Text>
                </VStack>
                <TouchableOpacity
                  onPress={() => setIsAddDebtOpen(true)}
                  style={[styles.smallActionBtn, { backgroundColor: colors.accentPrimary }]}
                >
                  <Ionicons name="add" size={16} color={colors.accentForeground} />
                  <Text fontSize={12} fontWeight="bold" color={colors.accentForeground} ml={2}>
                    Add
                  </Text>
                </TouchableOpacity>
              </HStack>

              {peerDebts.length === 0 ? (
                <Box p={16} borderRadius={8} backgroundColor={colors.surfaceSubtle} borderWidth={1} borderColor={colors.border}>
                  <Text fontSize={13} color={colors.textMuted} textAlign="center">
                    No peer lending or borrowing records active.
                  </Text>
                </Box>
              ) : (
                peerDebts.map((d) => (
                  <Box
                    key={d.id}
                    p={12}
                    borderRadius={8}
                    backgroundColor={colors.surface}
                    borderWidth={1}
                    borderColor={colors.border}
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        <HStack space="xs" alignItems="center">
                          <Text fontSize={14} fontWeight="bold" color={colors.textPrimary}>
                            {d.personName}
                          </Text>
                          <Box
                            px={6}
                            py={2}
                            borderRadius={10}
                            backgroundColor={d.type === 'lent' ? colors.success + '20' : colors.danger + '20'}
                          >
                            <Text
                              fontSize={10}
                              fontWeight="bold"
                              color={d.type === 'lent' ? colors.success : colors.danger}
                            >
                              {d.type === 'lent' ? 'OWES YOU' : 'YOU OWE'}
                            </Text>
                          </Box>
                        </HStack>
                        <Text fontSize={12} color={colors.textSecondary} mt={2}>
                          Balance: {formatMoney(d.remainingAmountMinor)} (Orig: {formatMoney(d.originalAmountMinor)})
                        </Text>
                        {d.dueDate && (
                          <Text fontSize={11} color={colors.textMuted}>
                            Due: {d.dueDate}
                          </Text>
                        )}
                      </VStack>

                      <HStack space="xs" alignItems="center">
                        {d.status === 'active' && (
                          <TouchableOpacity
                            onPress={() => setRepayingDebt(d)}
                            style={[styles.miniBtn, { backgroundColor: colors.accentPrimary }]}
                          >
                            <Text fontSize={11} fontWeight="bold" color={colors.accentForeground}>
                              Repay
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => deletePeerDebt(d.id)}
                          style={[styles.miniBtn, { backgroundColor: colors.surfaceSubtle }]}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      </HStack>
                    </HStack>
                  </Box>
                ))
              )}
            </VStack>

            {/* Section B: Reimbursements */}
            <VStack space="sm">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text fontSize={16} fontWeight="bold" color={colors.textPrimary}>
                    Reimbursement Claims
                  </Text>
                  <Text fontSize={12} color={colors.textSecondary}>
                    Pending: {formatMoney(reimbursementSummary?.pendingMinor ?? 0)}
                  </Text>
                </VStack>
                <TouchableOpacity
                  onPress={() => setIsAddReimbursementOpen(true)}
                  style={[styles.smallActionBtn, { backgroundColor: colors.accentPrimary }]}
                >
                  <Ionicons name="add" size={16} color={colors.accentForeground} />
                  <Text fontSize={12} fontWeight="bold" color={colors.accentForeground} ml={2}>
                    New Claim
                  </Text>
                </TouchableOpacity>
              </HStack>

              {reimbursements.length === 0 ? (
                <Box p={16} borderRadius={8} backgroundColor={colors.surfaceSubtle} borderWidth={1} borderColor={colors.border}>
                  <Text fontSize={13} color={colors.textMuted} textAlign="center">
                    No expense claims recorded yet.
                  </Text>
                </Box>
              ) : (
                reimbursements.map((c) => (
                  <Box
                    key={c.id}
                    p={12}
                    borderRadius={8}
                    backgroundColor={colors.surface}
                    borderWidth={1}
                    borderColor={colors.border}
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        <HStack space="xs" alignItems="center">
                          <Text fontSize={14} fontWeight="bold" color={colors.textPrimary}>
                            {c.title}
                          </Text>
                          <Box
                            px={6}
                            py={2}
                            borderRadius={10}
                            backgroundColor={
                              c.status === 'reimbursed'
                                ? colors.success + '20'
                                : colors.warning + '20'
                            }
                          >
                            <Text
                              fontSize={10}
                              fontWeight="bold"
                              color={
                                c.status === 'reimbursed' ? colors.success : colors.warning
                              }
                              textTransform="capitalize"
                            >
                              {c.status}
                            </Text>
                          </Box>
                        </HStack>
                        <Text fontSize={12} color={colors.textSecondary} mt={2}>
                          {formatMoney(c.amountMinor)} • {c.category} • {c.createdAt.slice(0, 10)}
                        </Text>
                      </VStack>

                      <HStack space="xs" alignItems="center">
                        {c.status !== 'reimbursed' && (
                          <TouchableOpacity
                            onPress={() => updateReimbursementStatus(c.id, 'reimbursed')}
                            style={[styles.miniBtn, { backgroundColor: colors.success }]}
                          >
                            <Text fontSize={11} fontWeight="bold" color={colors.accentForeground}>
                              Settle
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => deleteReimbursement(c.id)}
                          style={[styles.miniBtn, { backgroundColor: colors.surfaceSubtle }]}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      </HStack>
                    </HStack>
                  </Box>
                ))
              )}
            </VStack>

            {/* Section C: Subscriptions & Recurring */}
            <VStack space="sm">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text fontSize={16} fontWeight="bold" color={colors.textPrimary}>
                    Subscriptions & Recurring
                  </Text>
                  <Text fontSize={12} color={colors.textSecondary}>
                    Monthly Burn: {formatMoney(subscriptionBurnRate?.monthlyBurnRateMinor ?? 0)}
                  </Text>
                </VStack>
                <HStack space="xs">
                  <TouchableOpacity
                    onPress={handleScanSubscriptions}
                    disabled={isScanningSubs}
                    style={[styles.smallActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                  >
                    {isScanningSubs ? (
                      <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="scan-outline" size={14} color={colors.textPrimary} />
                        <Text fontSize={11} fontWeight="bold" color={colors.textPrimary} ml={2}>
                          Auto-Scan
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsAddSubOpen(true)}
                    style={[styles.smallActionBtn, { backgroundColor: colors.accentPrimary }]}
                  >
                    <Ionicons name="add" size={16} color={colors.accentForeground} />
                    <Text fontSize={12} fontWeight="bold" color={colors.accentForeground} ml={2}>
                      Add
                    </Text>
                  </TouchableOpacity>
                </HStack>
              </HStack>

              {subscriptions.length === 0 ? (
                <Box p={16} borderRadius={8} backgroundColor={colors.surfaceSubtle} borderWidth={1} borderColor={colors.border}>
                  <Text fontSize={13} color={colors.textMuted} textAlign="center">
                    No recurring subscriptions active. Tap Auto-Scan to detect recurring expenses.
                  </Text>
                </Box>
              ) : (
                subscriptions.map((s) => (
                  <Box
                    key={s.id}
                    p={12}
                    borderRadius={8}
                    backgroundColor={colors.surface}
                    borderWidth={1}
                    borderColor={colors.border}
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        <HStack space="xs" alignItems="center">
                          <Text fontSize={14} fontWeight="bold" color={colors.textPrimary}>
                            {s.name}
                          </Text>
                          {s.isAutoDetected && (
                            <Box px={6} py={2} borderRadius={10} backgroundColor={colors.accentPrimary + '15'}>
                              <Text fontSize={9} fontWeight="bold" color={colors.accentPrimary}>
                                AUTO-DETECTED
                              </Text>
                            </Box>
                          )}
                        </HStack>
                        <Text fontSize={12} color={colors.textSecondary} mt={2}>
                          {formatMoney(s.amountMinor)} / {s.cadence} • Next: {s.nextBillingDate}
                        </Text>
                      </VStack>

                      <TouchableOpacity
                        onPress={() => deleteSubscription(s.id)}
                        style={[styles.miniBtn, { backgroundColor: colors.surfaceSubtle }]}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </TouchableOpacity>
                    </HStack>
                  </Box>
                ))
              )}
            </VStack>
          </VStack>
        )}
      </ScrollView>

      {/* Modals */}
      <AddPeerDebtModal isOpen={isAddDebtOpen} onClose={() => setIsAddDebtOpen(false)} />
      <RepayPeerDebtModal
        debt={repayingDebt}
        isOpen={Boolean(repayingDebt)}
        onClose={() => setRepayingDebt(null)}
      />
      <AddReimbursementModal
        isOpen={isAddReimbursementOpen}
        onClose={() => setIsAddReimbursementOpen(false)}
      />
      <AddSubscriptionModal isOpen={isAddSubOpen} onClose={() => setIsAddSubOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  queryInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  askButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  miniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
