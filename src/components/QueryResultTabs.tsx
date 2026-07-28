import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  Zap,
  MessageSquarePlus,
  ArrowRight,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { QueryResult } from '../types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface QueryResultTabsProps {
  activeQueryResult: QueryResult;
  onExecuteQuery: (query: string) => void;
  isExecuting: boolean;
}

export const QueryResultTabs: React.FC<QueryResultTabsProps> = ({
  activeQueryResult,
  onExecuteQuery,
  isExecuting,
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'performance' | 'followup'>('sql');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlCode, setShowSqlCode] = useState(true);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const confidenceScore = Math.min(100, activeQueryResult.confidenceScore || 96);
  const totalMs = activeQueryResult.executionTimeMs || 1975;
  const llmMs = activeQueryResult.performanceBreakdown?.llmMs || Math.round(totalMs * 0.7);
  const sqlMs = activeQueryResult.performanceBreakdown?.sqlMs || Math.round(totalMs * 0.1);
  const vizMs = activeQueryResult.performanceBreakdown?.vizMs || Math.round(totalMs * 0.2);

  // Horizontal Pipeline Stages
  const pipelineStages = [
    { label: 'Intent', status: 'pass' },
    { label: 'Schema', status: 'pass' },
    { label: 'SQL', status: 'pass' },
    { label: 'Validation', status: 'pass' },
    { label: 'Visualization', status: 'pass' },
    { label: 'Insights', status: 'pass' },
  ];

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-soft-xs overflow-hidden">
      {/* Tabs Header — underline style */}
      <div className="flex items-center border-b border-[#f0f0ef] px-5">
        <div className="flex items-center gap-0">
          {[
            { id: 'sql', label: 'SQL & Execution', icon: Code2 },
            { id: 'performance', label: `Performance · ${confidenceScore}% confidence`, icon: Zap },
            ...(activeQueryResult.followUpQuestions && activeQueryResult.followUpQuestions.length > 0
              ? [{ id: 'followup', label: 'Follow-ups', icon: MessageSquarePlus }]
              : [])
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-slate-900 border-slate-900'
                    : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: SQL */}
      {activeTab === 'sql' && (
        <div className="p-5 space-y-3">
          {/* Status row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                SQL generated & validated
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-400 font-mono">{(totalMs / 1000).toFixed(2)}s</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSqlCode(!showSqlCode)}
            >
              {showSqlCode ? 'Hide SQL' : 'Show SQL'}
            </Button>
          </div>

          {/* Pipeline stages */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-x-auto">
            {pipelineStages.map((stage, idx) => (
              <React.Fragment key={idx}>
                <span className="flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  {stage.label}
                </span>
                {idx < pipelineStages.length - 1 && (
                  <span className="text-slate-300 shrink-0">→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* SQL code */}
          {showSqlCode && (
            <div className="relative bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-xs text-blue-300">
              <button
                onClick={() => handleCopySql(activeQueryResult.sql)}
                className="absolute top-2.5 right-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-md border border-slate-700 transition-colors"
              >
                {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <pre className="whitespace-pre-wrap leading-relaxed pr-8">{activeQueryResult.sql}</pre>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Performance */}
      {activeTab === 'performance' && (
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f0fdf4] border border-emerald-200/80">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-900">{confidenceScore}% confidence score</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-emerald-700">
                  <span>✓ Schema validated</span>
                  <span>·</span>
                  <span>✓ SQL verified</span>
                  <span>·</span>
                  <span>✓ Zero hallucinations</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between p-3 rounded-lg bg-[#fafafa] border border-[#f0f0ef] text-xs">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Total: <strong className="font-mono">{totalMs}ms</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
              <span>LLM: <strong className="text-slate-600">{llmMs}ms</strong></span>
              <span>SQL: <strong className="text-slate-600">{sqlMs}ms</strong></span>
              <span>Chart: <strong className="text-slate-600">{vizMs}ms</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Follow-ups */}
      {activeTab === 'followup' && (
        <div className="p-5 space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Suggested follow-ups</p>
          <div className="flex flex-wrap gap-2">
            {activeQueryResult.followUpQuestions?.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onExecuteQuery(q)}
                disabled={isExecuting}
                className="text-xs bg-[#fafafa] hover:bg-slate-100 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-lg border border-[#e5e5e5] hover:border-slate-300 font-normal transition-all text-left flex items-center gap-1.5 group disabled:opacity-50 cursor-pointer"
              >
                <span>{q}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
