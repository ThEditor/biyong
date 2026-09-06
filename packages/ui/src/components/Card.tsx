import React from 'react';
import { useTheme } from '../theme/ThemeContext.js';

export interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, className, onClick }) => {
  const { tokens } = useTheme();

  const cardStyle: React.CSSProperties = {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    ...style,
  };

  return (
    <div style={cardStyle} className={className} onClick={onClick}>
      {children}
    </div>
  );
};
