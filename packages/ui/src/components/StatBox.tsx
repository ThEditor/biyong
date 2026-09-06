import React from 'react';
import { useTheme } from '../theme/ThemeContext.js';
import { CurrencyText } from './CurrencyText.js';
import { Card } from './Card.js';

export interface StatBoxProps {
  label: string;
  amountMinor: number;
  currency?: string;
  subtitle?: string;
  colorize?: boolean;
}

export const StatBox: React.FC<StatBoxProps> = ({
  label,
  amountMinor,
  currency = 'INR',
  subtitle,
  colorize = false,
}) => {
  const { tokens } = useTheme();

  return (
    <Card style={{ flex: 1, minWidth: 200 }}>
      <div style={{ color: tokens.colors.textSecondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>
        <CurrencyText amountMinor={amountMinor} currency={currency} colorize={colorize} />
      </div>
      {subtitle && (
        <div style={{ marginTop: 4, color: tokens.colors.textMuted, fontSize: 12 }}>
          {subtitle}
        </div>
      )}
    </Card>
  );
};
