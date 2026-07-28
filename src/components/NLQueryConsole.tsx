import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, AlertTriangle, ArrowRight, ChevronRight,
  BookOpen, Search, MessageSquare, Clock, Lightbulb,
} from 'lucide-react';
import { Dataset, QueryResult, ChatResult } from '../types';
import { Button } from './ui/Button';

interface NLQueryConsoleProps {
  dataset: Dataset;
  onExecuteQuery: (query: string) => void;
  isExecuting: boolean;
  activeQueryResult: QueryResult | null;
  activeChatResult?: ChatResult | null;
  error: string | null;
}

const QUERY_TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  schema: { label: 'Schema', icon: <BookOpen className="h-3 w-3" /> },
  exploratory: { label: 'Exploratory', icon: <Search className="h-3 w-3" /> },
  conversational: { label: 'Q&A', icon: <MessageSquare className="h-3 w-3" /> },
};

export const NLQueryConsole: React.FC<NLQueryConsoleProps> = ({
  dataset,
  onExecuteQuery,
  isExecuting,
  activeChatResult,
  error,
}) => {
  const [promptInput, setPromptInput] = useState('');

  const colNames = dataset.summary?.columns?.map((c) => c.name) || [];
  const numCols = dataset.summary?.columns?.filter((c) => c.type === 'number').map((c) => c.name) || [];
  const strCols = dataset.summary?.columns?.filter((c) => c.type === 'string' || c.distinctCount <= 10).map((c) => c.name) || [];
  const mainNum = numCols[0] || colNames[0] || 'metric';
  const mainCat = strCols[0] || colNames[0] || 'group';

  const getSmarterSuggestions = (): string[] => {
    if (dataset.aiProfile?.suggestedQuestions && dataset.aiProfile.suggestedQuestions.length > 0) {
      return dataset.aiProfile.suggestedQuestions;
    }
    const nameLower = dataset.name.toLowerCase();
    if (nameLower.includes('titanic') || colNames.includes('Sex') || colNames.includes('Survived')) {
      return [
        'Survival count by passenger class',
        'Compare survival between males and females',
        'Average fare by survival status',
        'Top 10 passengers by highest fare',
      ];
    }
    if ((colNames.includes('Sales') || colNames.includes('Profit')) && (colNames.includes('Region') || colNames.includes('Category'))) {
      return [
        'Monthly sales trend',
        'Revenue by category',
        'Profit by region',
        'Top customers by sales',
        'Average discount by segment',
      ];
    }
    const suggestions: string[] = [];
    if (strCols[0] && numCols[0]) {
      suggestions.push(`Total ${numCols[0]} by ${strCols[0]}`);
      suggestions.push(`Average ${numCols[0]} by ${strCols[0]}`);
    }
    if (strCols[0]) suggestions.push(`Record count by ${strCols[0]}`);
    if (strCols[1] && numCols[0]) suggestions.push(`Top 10 ${strCols[1]} by ${numCols[0]}`);
    if (numCols[1]) suggestions.push(`Compare ${numCols[0]} vs ${numCols[1]}`);
    return suggestions.length >= 3
      ? suggestions
      : [
          `Breakdown by ${mainCat}`,
          `Highest average ${mainNum} by ${mainCat}`,
          `Top 5 ${mainCat} by total ${mainNum}`,
          `Count by ${mainCat}`,
        ];
  };

  // Combined suggestions — SQL + conversational, same visual style
  const allSuggestions = [
    ...getSmarterSuggestions(),
    'Summarize this dataset',
    'What columns are available?',
    'Are there any missing values?',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isExecuting) return;
    onExecuteQuery(promptInput.trim());
  };

  const typeMeta = activeChatResult
    ? QUERY_TYPE_META[activeChatResult.queryType] ?? QUERY_TYPE_META.conversational
    : null;

  return (
    <div className="space-y-5">

      {/* ── Query Input ─────────────────────────────────── */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 shadow-soft-xs">
        {/* Heading */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">NL2SQL Explorer</h2>
          </div>
          <p className="text-xs text-slate-400">
            Ask any question in plain English — get SQL, charts, and business insights instantly.
          </p>
        </div>

        {/* Input bar */}
        <form onSubmit={handleSubmit} className="relative mb-4">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder={`Ask about ${dataset.name}...`}
            className="w-full bg-[#fafafa] focus:bg-white text-slate-800 text-sm pl-4 pr-32 py-3.5 rounded-lg border border-[#e5e5e5] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 placeholder:text-slate-400 font-normal transition-all"
          />
          <div className="absolute right-1.5 top-1.5 bottom-1.5">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isExecuting || !promptInput.trim()}
              isLoading={isExecuting}
              rightIcon={!isExecuting ? <ArrowRight className="h-3.5 w-3.5" /> : undefined}
            >
              {isExecuting ? 'Thinking...' : 'Ask'}
            </Button>
          </div>

          {/* Progress bar */}
          {isExecuting && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-slate-300 to-blue-500 rounded-full origin-left"
            />
          )}
        </form>

        {/* Suggestion chips — unified, no section labels */}
        <div className="flex flex-wrap gap-1.5">
          {allSuggestions.map((q, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setPromptInput(q); onExecuteQuery(q); }}
              disabled={isExecuting}
              className="text-xs bg-[#f5f5f4] hover:bg-slate-100 text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-[#e8e8e7] hover:border-slate-300 transition-colors font-normal disabled:opacity-50 cursor-pointer"
            >
              {q}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── AI Chat Answer Bubble ────────────────────────── */}
      <AnimatePresence>
        {activeChatResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden shadow-soft-xs"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0ef]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Lightbulb className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">AI Answer</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-xs">{activeChatResult.query}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {typeMeta && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    {typeMeta.icon}
                    {typeMeta.label}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <Clock className="h-3 w-3" />
                  {activeChatResult.executionTimeMs}ms
                </span>
              </div>
            </div>

            {/* Answer */}
            <div className="px-5 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeChatResult.answer}
              </p>
            </div>

            {/* Follow-ups */}
            {activeChatResult.followUpQuestions && activeChatResult.followUpQuestions.length > 0 && (
              <div className="px-5 pb-4 pt-2 border-t border-[#f0f0ef]">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Follow-up questions
                </p>
                <div className="space-y-1.5">
                  {activeChatResult.followUpQuestions.map((fq, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setPromptInput(fq); onExecuteQuery(fq); }}
                      disabled={isExecuting}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 font-normal text-left group disabled:opacity-50 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" />
                      <span>{fq}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ───────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs flex items-start gap-3">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-700 mb-0.5">Query failed</p>
            <p className="text-rose-600 leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
