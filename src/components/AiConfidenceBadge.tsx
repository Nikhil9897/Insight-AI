import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';

interface AiConfidenceBadgeProps {
  score?: number;
  reasons?: string[];
}

export const AiConfidenceBadge: React.FC<AiConfidenceBadgeProps> = ({
  score = 96,
  reasons = [
    'Schema Validated',
    'SQL Executed',
    'No Missing Columns',
    'Visualization Generated',
  ],
}) => {
  const [expanded, setExpanded] = useState(true);
  const clampedScore = Math.min(100, Math.max(0, score));

  const getScoreBadge = (s: number) => {
    if (s >= 98) {
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        dot: 'bg-emerald-500',
        icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
        label: 'Strong Recommendation',
      };
    }
    if (s >= 90) {
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        dot: 'bg-emerald-500',
        icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
        label: 'Very High Confidence',
      };
    }
    if (s >= 75) {
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        dot: 'bg-amber-500',
        icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
        label: 'Medium Confidence',
      };
    }
    return {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      dot: 'bg-rose-500',
      icon: <AlertCircle className="h-4 w-4 text-rose-600" />,
      label: 'Low Confidence',
    };
  };

  const badgeInfo = getScoreBadge(clampedScore);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs transition-all space-y-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            {badgeInfo.icon}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-900">Confidence Score</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${badgeInfo.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dot} mr-1.5 animate-pulse`}></span>
                {clampedScore}% • {badgeInfo.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Explainable AI validation & execution audit checks
            </p>
          </div>
        </div>

        <button className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center space-x-1">
          <span className="hidden sm:inline">{expanded ? 'Hide Audits' : 'Explain Score'}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Explainable Audit Checklist */}
      {expanded && (
        <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {reasons.map((reason, idx) => (
            <div key={idx} className="flex items-center space-x-2 bg-emerald-50/60 border border-emerald-100 p-2 rounded-xl text-emerald-900 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-bold leading-tight">{reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
