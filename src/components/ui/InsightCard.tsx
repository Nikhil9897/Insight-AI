import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';

export interface InsightCardProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  accent?: string;
  category?: string;
  metricValue?: string | number;
  contributionPct?: string | number;
  runnerUpDiff?: string | number;
  icon?: React.ReactNode;
  duckdbVerified?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  title,
  subtitle,
  badgeText,
  accent,
  category,
  metricValue,
  contributionPct,
  runnerUpDiff,
  icon,
  duckdbVerified = true,
  className = '',
  children,
}) => {
  return (
    <Card hoverable className={`relative bg-gradient-to-br from-white via-white to-slate-50/50 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center space-x-2">
          {icon && <div className="text-amber-500">{icon}</div>}
          <div>
            <span className="text-xs font-bold text-slate-800 tracking-tight block">{title}</span>
            {subtitle && <span className="text-[10px] text-slate-400 font-medium block">{subtitle}</span>}
          </div>
        </div>

        {badgeText ? (
          <Badge variant="emerald" size="sm">
            {badgeText}
          </Badge>
        ) : duckdbVerified ? (
          <Badge variant="emerald" size="sm">
            Verified by DuckDB
          </Badge>
        ) : null}
      </div>

      {children ? (
        children
      ) : (
        <div className="space-y-1">
          {category && (
            <div className="text-sm font-extrabold text-blue-600 truncate">{category}</div>
          )}

          {metricValue !== undefined && (
            <div className="text-2xl font-black text-slate-900">{metricValue}</div>
          )}

          <div className="flex items-center space-x-3 text-xs pt-2">
            {contributionPct !== undefined && (
              <span className="font-semibold text-slate-600">
                <strong className="text-slate-900 font-bold">{contributionPct}%</strong> contribution
              </span>
            )}

            {runnerUpDiff !== undefined && (
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                ↑ {typeof runnerUpDiff === 'number' ? `+${runnerUpDiff}%` : runnerUpDiff} vs 2nd place
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
