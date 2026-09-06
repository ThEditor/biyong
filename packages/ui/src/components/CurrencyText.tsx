import React from 'react';
import { formatMoney } from '@biyong/domain';
import { useTheme } from '../theme/ThemeContext.js';

export interface CurrencyTextProps {
  amountMinor: number;
  currency?: string;
  style?: React.CSSProperties;
  colorize?: boolean; // Green for positive, red for negative
}

export const CurrencyText: React.FC<CurrencyTextProps> = ({
  amountMinor,
  currency = 'INR',
  style,
  colorize = false,
}) => {
  const { tokens } = useTheme();
  const formatted = formatMoney(amountMinor, currency);

  let color = tokens.colors.textPrimary;
  if (colorize) {
    if (amountMinor > 0) color = tokens.colors.success;
    else if (amountMinor < 0) color = tokens.colors.danger;
  }

  return (
    <span style={{ color, fontFamily: 'monospace', fontWeight: 600, ...style }}>
      {formatted}
    </span>
  );
};
