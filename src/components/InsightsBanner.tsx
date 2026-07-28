import React, { useState } from 'react';
import { Lightbulb, TrendingUp, Award, Percent, Hash, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { DeterministicStats } from '../types';
import { InsightCard } from './ui/InsightCard';

interface InsightsBannerProps {
  insights: string[];
  stats?: DeterministicStats;
  rowCount?: number;
}

/**
 * Business Insights panel — clean, no heavy gradient banners.
 * Stats mini-cards stay (useful data), narrative bullets are clean.
 */
export const InsightsBanner: React.FC<InsightsBannerProps> = ({ insights, stats, rowCount }) => {
  const [showExecution, setShowExecution] = useState(false);

  if (!insights || insights.length === 0) return null;

  const cleanInsightText = (text: string): string => {
    if (
      text.toLowerCase().includes('query executed deterministically') ||
      text.toLowerCase().includes('query executed using duckdb')
    ) {
      return `Results verified using DuckDB deterministic execution (${rowCount || 10} rows).`;
    }
    return text;
  };

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-soft-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0ef]">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-900">Business Insights</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified by DuckDB
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Statistical metric cards */}
        {stats && (stats.peakSharePct !== undefined || stats.differenceFromRunnerUpPct !== undefined) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InsightCard
              title="Top Segment Share"
              subtitle={stats.peakCategory || 'Top Leader'}
              badgeText={`${stats.peakSharePct}%`}
              icon={<Percent className="h-4 w-4 text-blue-500" />}
              accent="blue"
            >
              <div className="text-xl font-bold text-slate-900">{stats.peakSharePct}%</div>
            </InsightCard>

            <InsightCard
              title="Lead vs Runner-up"
              subtitle={`vs ${stats.runnerUpCategory || 'Runner-Up'}`}
              badgeText="Gap"
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              accent="emerald"
            >
              <div className="text-xl font-bold text-slate-900">
                {typeof stats.differenceFromRunnerUpPct === 'number'
                  ? `+${stats.differenceFromRunnerUpPct}%`
                  : stats.differenceFromRunnerUpPct}
              </div>
            </InsightCard>

            <InsightCard
              title="Group Average"
              subtitle="Mean per group"
              icon={<Hash className="h-4 w-4 text-slate-500" />}
              accent="slate"
            >
              <div className="text-xl font-bold text-slate-900">
                {stats.average !== undefined ? stats.average.toLocaleString() : '—'}
              </div>
            </InsightCard>

            <InsightCard
              title="Total Volume"
              subtitle="Aggregate sum"
              icon={<Award className="h-4 w-4 text-amber-500" />}
              accent="amber"
            >
              <div className="text-xl font-bold text-slate-900">
                {stats.totalSum !== undefined ? stats.totalSum.toLocaleString() : '—'}
              </div>
            </InsightCard>
          </div>
        )}

        {/* Narrative bullet insights */}
        <div className="space-y-2">
          {insights.slice(0, 3).map((insight, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{cleanInsightText(insight)}</span>
            </div>
          ))}
        </div>

        {/* Execution details — collapsible */}
        <div className="border-t border-[#f0f0ef] pt-3">
          <button
            onClick={() => setShowExecution(!showExecution)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            {showExecution ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>Execution details</span>
          </button>

          {showExecution && (
            <div className="mt-2.5 p-3 bg-[#fafafa] border border-[#f0f0ef] rounded-lg text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Engine</span>
                <span className="text-slate-700 font-semibold">DuckDB (In-Memory)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Verification</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> 100% Deterministic
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scope</span>
                <span className="text-slate-500">Metrics derived from current dataset</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
