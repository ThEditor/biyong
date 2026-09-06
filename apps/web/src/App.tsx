import React, { useState } from 'react';
import { useTheme, Card, StatBox, CurrencyText, type AccentTheme, type ThemeMode } from '@biyong/ui';
import { calculateSplit, simplifyDebts } from '@biyong/domain';

const ACCENTS: AccentTheme[] = ['default', 'ocean', 'forest', 'violet', 'amber', 'rose'];
const MODES: ThemeMode[] = ['dark', 'light', 'system'];

export default function App() {
  const { tokens, mode, accent, setMode, setAccent } = useTheme();

  // Interactive local demo calculation
  const [splitMethod, setSplitMethod] = useState<'equal' | 'percentage'>('equal');
  const totalAmountMinor = 450000; // ₹4,500

  const calculatedSplits = calculateSplit({
    totalAmountMinor,
    method: splitMethod,
    allocations:
      splitMethod === 'equal'
        ? [{ memberId: 'Nikhil' }, { memberId: 'Rahul' }, { memberId: 'Arjun' }]
        : [
            { memberId: 'Nikhil', percentage: 50 },
            { memberId: 'Rahul', percentage: 30 },
            { memberId: 'Arjun', percentage: 20 },
          ],
  });

  return (
    <div
      style={{
        backgroundColor: tokens.colors.background,
        color: tokens.colors.textPrimary,
        minHeight: '100vh',
        padding: '32px 24px',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header & Theme Switcher */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
            borderBottom: `1px solid ${tokens.colors.border}`,
            paddingBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
              biyong
            </h1>
            <p style={{ margin: '4px 0 0', color: tokens.colors.textSecondary, fontSize: 14 }}>
              Financial Source of Truth • Local-First Architecture
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Mode Picker */}
            <div style={{ display: 'flex', gap: 6, background: tokens.colors.surface, padding: 4, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border}` }}>
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: tokens.radius.sm,
                    border: 'none',
                    backgroundColor: mode === m ? tokens.colors.accentPrimary : 'transparent',
                    color: mode === m ? tokens.colors.accentForeground : tokens.colors.textSecondary,
                    fontWeight: mode === m ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: 12,
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Accent Picker */}
            <div style={{ display: 'flex', gap: 6, background: tokens.colors.surface, padding: 4, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border}` }}>
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAccent(a)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: tokens.radius.sm,
                    border: 'none',
                    backgroundColor: accent === a ? tokens.colors.accentPrimary : 'transparent',
                    color: accent === a ? tokens.colors.accentForeground : tokens.colors.textSecondary,
                    fontWeight: accent === a ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: 12,
                    textTransform: 'capitalize',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Wealth Summary Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatBox label="Net Worth" amountMinor={184000000} subtitle="Assets - Liabilities" colorize />
          <StatBox label="Cash & Bank Assets" amountMinor={224000000} subtitle="3 Accounts Connected" />
          <StatBox label="Active Liabilities" amountMinor={40000000} subtitle="Credit & Loans" />
          <StatBox label="Monthly Budget Remaining" amountMinor={3800000} subtitle="62% spent so far" />
        </section>

        {/* Offline Engine Verification */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, color: tokens.colors.textPrimary }}>
              Phase 0 Verification Matrix
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0, color: tokens.colors.textSecondary, lineHeight: 1.8 }}>
              <li>✅ <strong>Monorepo & Turborepo:</strong> Configured and orchestrated</li>
              <li>✅ <strong>Domain Engine:</strong> Pure integer minor unit arithmetic (zero float errors)</li>
              <li>✅ <strong>SQLite Local DB:</strong> Full schema v1 & offline outbox operations</li>
              <li>✅ <strong>Drizzle / PostgreSQL:</strong> Multi-user shared state tables ready</li>
              <li>✅ <strong>Hono API:</strong> Modular monolith with health, auth & sync push/pull</li>
              <li>✅ <strong>Theme System:</strong> 6 accent palettes + Light / Dark / System</li>
            </ul>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: tokens.colors.textPrimary }}>
                Interactive Split Simulation
              </h3>
              <select
                value={splitMethod}
                onChange={(e) => setSplitMethod(e.target.value as any)}
                style={{
                  background: tokens.colors.surfaceSubtle,
                  color: tokens.colors.textPrimary,
                  border: `1px solid ${tokens.colors.border}`,
                  padding: '4px 8px',
                  borderRadius: tokens.radius.sm,
                }}
              >
                <option value="equal">Equal (1/3 each)</option>
                <option value="percentage">Percentage (50/30/20)</option>
              </select>
            </div>
            <p style={{ margin: '0 0 16px', color: tokens.colors.textSecondary, fontSize: 13 }}>
              Total bill: <CurrencyText amountMinor={totalAmountMinor} />
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {calculatedSplits.map((split) => (
                <div
                  key={split.memberId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: tokens.radius.sm,
                    background: tokens.colors.surfaceSubtle,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{split.memberId}</span>
                  <CurrencyText amountMinor={split.owedMinor} />
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
