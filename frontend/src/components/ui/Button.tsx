import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  pill = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2.5',
  };

  const roundedStyles = pill ? 'rounded-full' : 'rounded-lg';

  /**
   * Button variants — landing page philosophy:
   * - primary: near-black (like landing page CTA), not blue
   * - secondary: very light surface
   * - ghost: no background, subtle hover
   * - outline: clean bordered button
   * - danger: red
   * - success: emerald (used rarely)
   */
  const variantStyles = {
    primary:
      'bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-soft-xs border border-[#1e293b] active:bg-[#0a1220]',
    secondary:
      'bg-slate-100 hover:bg-slate-150 text-slate-800 border border-slate-200 active:bg-slate-200',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 active:bg-slate-150',
    outline:
      'bg-white hover:bg-slate-50 text-slate-700 border border-[#e5e5e5] shadow-soft-xs hover:border-slate-300',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-soft-xs border border-rose-700 active:bg-rose-800',
    success:
      'bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft-xs border border-emerald-700',
  };

  return (
    <motion.button
      whileHover={{ y: disabled ? 0 : -0.5 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`${baseStyles} ${sizeStyles[size]} ${roundedStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </motion.button>
  );
};
