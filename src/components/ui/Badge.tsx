import React from 'react';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate' | 'outline';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Badge — restrained usage.
 * 
 * Variants:
 * - default / slate: neutral — for metadata like "Sample Dataset"
 * - success / emerald: positive health states only
 * - warning / amber: data issues
 * - danger / rose: errors
 * - blue: primary informational (used sparingly)
 * - outline: text-only minimal
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  icon,
  children,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const variantStyles: Record<string, string> = {
    default:  'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
    slate:    'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
    success:  'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-semibold',
    emerald:  'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-semibold',
    warning:  'bg-amber-50 text-amber-700 border border-amber-200/80 font-semibold',
    amber:    'bg-amber-50 text-amber-700 border border-amber-200/80 font-semibold',
    danger:   'bg-rose-50 text-rose-700 border border-rose-200/80 font-semibold',
    rose:     'bg-rose-50 text-rose-700 border border-rose-200/80 font-semibold',
    blue:     'bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold',
    purple:   'bg-purple-50 text-purple-700 border border-purple-200/80 font-semibold',
    outline:  'bg-white text-slate-600 border border-[#e5e5e5] font-medium',
  };

  const styles = variantStyles[variant] ?? variantStyles.default;

  return (
    <span
      className={`inline-flex items-center rounded-full tracking-wide ${sizeStyles[size]} ${styles} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};
