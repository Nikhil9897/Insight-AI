/**
 * QueryIRPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Displays the Query Intermediate Representation (IR) produced by the
 * deterministic IntentParser in two layers:
 *
 *   Default View  — human-readable summary cards (Intent, Metric, Agg, etc.)
 *   Developer Mode — collapsible raw JSON drawer for debugging
 *
 * Design principles:
 *   • Normal users see clean, labelled cards — no raw JSON by default
 *   • Developers can expand the JSON view with a single click
 *   • Confidence is displayed as a gradient progress bar
 *   • Low-confidence flags are highlighted in amber
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  ChevronRight,
  Code2,
  Copy,
  Check,
  Filter,
  BarChart3,
  ArrowUpDown,
  Hash,
  AlertTriangle,
  CheckCircle2,
  Sigma,
  TrendingUp,
  Database,
  Zap,
} from 'lucide-react';
import { QueryIR } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AGG_LABELS: Record<string, string> = {
  SUM: 'Sum',
  AVG: 'Average',
  COUNT: 'Count',
  MIN: 'Minimum',
  MAX: 'Maximum',
  COUNT_DISTINCT: 'Count Distinct',
};

const INTENT_LABELS: Record<string, string> = {
  aggregation: 'Aggregation',
  ranking: 'Ranking',
  filter: 'Filter',
  trend: 'Trend Analysis',
  distribution: 'Distribution',
  statistical: 'Statistical',
  comparison: 'Comparison',
  metadata: 'Metadata',
  data_quality: 'Data Quality',
};

const INTENT_COLORS: Record<string, string> = {
  aggregation: 'bg-violet-100 text-violet-700 border-violet-200',
  ranking: 'bg-amber-100 text-amber-700 border-amber-200',
  filter: 'bg-blue-100 text-blue-700 border-blue-200',
  trend: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  distribution: 'bg-pink-100 text-pink-700 border-pink-200',
  statistical: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  comparison: 'bg-orange-100 text-orange-700 border-orange-200',
  metadata: 'bg-slate-100 text-slate-700 border-slate-200',
  data_quality: 'bg-red-100 text-red-700 border-red-200',
};

const CHART_LABELS: Record<string, string> = {
  kpi: 'KPI Card',
  bar: 'Bar Chart',
  bar_horizontal: 'Horizontal Bar',
  line: 'Line Chart',
  area: 'Area Chart',
  pie: 'Pie Chart',
  donut: 'Donut Chart',
  scatter: 'Scatter Plot',
  histogram: 'Histogram',
  heatmap: 'Heatmap',
  treemap: 'Treemap',
  table: 'Data Table',
};

const OP_LABELS: Record<string, string> = {
  eq: '=',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  between: 'BETWEEN',
  contains: 'CONTAINS',
  starts_with: 'STARTS WITH',
  ends_with: 'ENDS WITH',
  in: 'IN',
  not_in: 'NOT IN',
  is_null: 'IS NULL',
  is_not_null: 'IS NOT NULL',
  year_eq: 'YEAR =',
};

function confColor(conf: number): string {
  if (conf >= 0.90) return 'bg-emerald-500';
  if (conf >= 0.75) return 'bg-amber-400';
  return 'bg-red-400';
}

function confLabel(conf: number): string {
  if (conf >= 0.90) return 'High Confidence';
  if (conf >= 0.75) return 'Medium Confidence';
  return 'Low Confidence — LLM Refiner invoked';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const IRChip: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className }) => (
  <div className={`flex flex-col gap-0.5 ${className}`}>
    <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
    <span className="text-xs font-semibold text-slate-800 leading-tight">{value}</span>
  </div>
);

const IRBadge: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>
    {text}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface QueryIRPanelProps {
  ir: QueryIR;
}

export const QueryIRPanel: React.FC<QueryIRPanelProps> = ({ ir }) => {
  const [devOpen, setDevOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const confPct = Math.round(ir.confidence * 100);
  const intentKey = ir.intent.toLowerCase();

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(ir, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white shadow-xs overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0ef] bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-100">
            <Brain className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Query Intent (IR)</p>
            <p className="text-[9px] text-slate-400 leading-none mt-0.5">Deterministic parser output · LLM never writes SQL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Confidence badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
            {confPct >= 90
              ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              : confPct >= 75
              ? <Zap className="h-3 w-3 text-amber-500" />
              : <AlertTriangle className="h-3 w-3 text-red-400" />
            }
            <span className="text-[10px] font-bold text-slate-700">{confPct}%</span>
          </div>
          {/* Execution path label */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 border border-violet-100">
            <Zap className="h-2.5 w-2.5 text-violet-500" />
            <span className="text-[9px] font-semibold text-violet-600">
              {confPct >= 75 ? 'Deterministic' : 'LLM Refined'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Confidence bar ───────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
            {confLabel(ir.confidence)}
          </span>
          <span className="text-[9px] font-mono text-slate-400">{confPct}/100</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${confColor(ir.confidence)}`}
          />
        </div>
        {ir.confidence_flags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ir.confidence_flags.map((flag, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-2.5 w-2.5" />
                {flag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Human-readable summary grid ──────────────────────────────────── */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">

        {/* Intent */}
        <div className="col-span-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Intent</span>
          <IRBadge
            text={INTENT_LABELS[intentKey] || intentKey}
            className={INTENT_COLORS[intentKey] || 'bg-slate-100 text-slate-700 border-slate-200'}
          />
        </div>

        {/* Metric */}
        {ir.metric && (
          <div className="col-span-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Metric</span>
            <div className="flex items-center gap-1">
              <Sigma className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-800">{ir.metric}</span>
            </div>
          </div>
        )}

        {/* Aggregation */}
        {ir.aggregation && (
          <div className="col-span-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Aggregation</span>
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-violet-400 shrink-0" />
              <span className="text-xs font-semibold text-violet-700">
                {AGG_LABELS[ir.aggregation] || ir.aggregation}
                {ir.count_type ? ` (${ir.count_type})` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Group By */}
        {ir.dimensions.length > 0 && (
          <div className="col-span-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Group By</span>
            <div className="flex flex-wrap gap-1">
              {ir.dimensions.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {ir.filters.length > 0 && (
          <div className="col-span-1 sm:col-span-2">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Filters</span>
            <div className="flex flex-wrap gap-1">
              {ir.filters.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-100">
                  <Filter className="h-2.5 w-2.5 shrink-0" />
                  {f.column} {OP_LABELS[f.operator] || f.operator}
                  {f.value !== undefined && f.value !== null ? ` ${String(f.value).substring(0, 20)}` : ''}
                  {f.value2 !== undefined && f.value2 !== null ? ` … ${f.value2}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* No filters */}
        {ir.filters.length === 0 && (
          <div className="col-span-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Filters</span>
            <span className="text-xs text-slate-400">None</span>
          </div>
        )}

        {/* Sort */}
        <div className="col-span-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Sort</span>
          {ir.sort ? (
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">
                {ir.sort.direction === 'DESC' ? 'Descending' : 'Ascending'}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">None</span>
          )}
        </div>

        {/* Limit */}
        <div className="col-span-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Limit</span>
          <span className={`text-xs font-semibold ${ir.limit ? 'text-slate-800' : 'text-slate-400'}`}>
            {ir.limit ? `Top ${ir.limit}` : 'All rows'}
          </span>
        </div>

        {/* Chart */}
        <div className="col-span-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Chart</span>
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 capitalize">
              {ir.chart ? (CHART_LABELS[ir.chart] || ir.chart) : 'Auto'}
            </span>
          </div>
        </div>

        {/* Time granularity */}
        {ir.time_granularity && (
          <div className="col-span-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Granularity</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-cyan-700 capitalize">{ir.time_granularity}</span>
            </div>
          </div>
        )}

        {/* Statistical function */}
        {ir.statistical_function && (
          <div className="col-span-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Stats Fn</span>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-indigo-700">{ir.statistical_function}</span>
            </div>
          </div>
        )}

        {/* Execution path */}
        <div className="col-span-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 block mb-1">Execution</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
            confPct >= 75
              ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
              : 'text-amber-700 bg-amber-50 border-amber-100'
          }`}>
            {confPct >= 75 ? 'Deterministic' : 'LLM Refined'}
          </span>
        </div>
      </div>

      {/* ── Developer Mode toggle ─────────────────────────────────────────── */}
      <div className="border-t border-[#f0f0ef]">
        <button
          onClick={() => setDevOpen(!devOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5" />
            <span>Developer Mode — Raw QueryIR JSON</span>
          </div>
          <motion.span animate={{ rotate: devOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
        </button>

        <AnimatePresence>
          {devOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="relative bg-slate-950 mx-4 mb-4 rounded-lg border border-slate-800">
                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className="absolute top-2.5 right-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-md border border-slate-700 transition-colors z-10"
                  title="Copy JSON"
                >
                  {copied
                    ? <Check className="h-3 w-3 text-emerald-400" />
                    : <Copy className="h-3 w-3" />
                  }
                </button>
                {/* Label */}
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-slate-800">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-[9px] font-mono text-slate-500">QueryIR.json</span>
                </div>
                {/* JSON */}
                <pre className="text-[10px] font-mono text-emerald-300 p-3 overflow-x-auto max-h-64 leading-relaxed whitespace-pre">
                  {JSON.stringify(ir, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
