import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  accentColor?: 'blue' | 'emerald' | 'amber' | 'slate';
  badge?: string;
  className?: string;
}

/**
 * Premium KPI Card — landing page philosophy.
 * 
 * Design rules:
 * - White card, single shadow, one clean border
 * - Icon has a tiny colored background (the only accent)  
 * - Number is always large + black (never colored)
 * - Label is small muted uppercase
 * - No top color bar, no glow borders
 */

const ACCENT = {
  blue: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    dot: 'bg-blue-500',
  },
  emerald: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    dot: 'bg-amber-400',
  },
  slate: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    dot: 'bg-slate-400',
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor = 'blue',
  badge,
  className = '',
}) => {
  const a = ACCENT[accentColor] ?? ACCENT.blue;

  const TrendIcon =
    trend?.isNeutral ? Minus : trend?.isPositive !== false ? TrendingUp : TrendingDown;
  const trendColor =
    trend?.isNeutral ? 'text-slate-500' :
    trend?.isPositive !== false ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div
      className={`relative bg-white rounded-xl border border-[#e5e5e5] shadow-soft-xs p-5 animate-fade-in-up transition-shadow duration-200 hover:shadow-soft-sm ${className}`}
    >
      {/* Header: icon + title */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            {title}
          </p>
          {badge && (
            <span className="mt-1 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
              {badge}
            </span>
          )}
        </div>

        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconColor}`}>
            {icon}
          </div>
        )}
      </div>

      {/* Big metric — always black */}
      <div className="animate-number-pop">
        <span className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-400 font-normal leading-relaxed">
          {subtitle}
        </p>
      )}

      {/* Trend */}
      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center space-x-1">
          <TrendIcon className={`h-3 w-3 shrink-0 ${trendColor}`} />
          <span className={`text-xs font-semibold ${trendColor}`}>{trend.value}</span>
        </div>
      )}
    </div>
  );
};
