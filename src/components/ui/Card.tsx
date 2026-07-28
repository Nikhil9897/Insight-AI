import React from 'react';
import { motion } from 'motion/react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  hoverable?: boolean;
  hoverEffect?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  glass = false,
  hoverable = false,
  onClick,
  padding = 'md',
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-7',
  };

  const bgStyles = glass
    ? 'glass-card'
    : 'bg-white border border-[#e5e5e5] shadow-soft-xs';
  const hoverStyles = hoverable
    ? 'hover:shadow-soft-md hover:border-slate-300 transition-all duration-200 cursor-pointer'
    : '';

  return (
    <motion.div
      whileHover={hoverable ? { y: -1 } : undefined}
      onClick={onClick}
      className={`rounded-xl ${bgStyles} ${paddingStyles[padding]} ${hoverStyles} ${className}`}
    >
      {children}
    </motion.div>
  );
};
