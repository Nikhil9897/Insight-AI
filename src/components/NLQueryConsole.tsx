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
    // Extract actual columns present in active dataset
    const availableCols = dataset.summary?.columns?.map((c) => c.name) ||
      (dataset.data && dataset.data[0] ? Object.keys(dataset.data[0]) : []);

    if (!availableCols || availableCols.length === 0) {
      return ['Summarize this dataset', 'What columns are available?', 'Are there any missing values?'];
    }

    const isIdCol = (name: string) => {
      const n = name.toLowerCase();
      return (n.endsWith('id') && n !== 'customerid') || n === 'id' || n.includes('uuid') || n.includes('code');
    };

    const numCols = dataset.summary?.columns
      ?.filter((c) => c.type === 'number' && !isIdCol(c.name))
      .map((c) => c.name) ||
      availableCols.filter((c) => typeof dataset.data?.[0]?.[c] === 'number' && !isIdCol(c));

    const catCols = dataset.summary?.columns
      ?.filter((c) => (c.type === 'string' || c.distinctCount <= 15) && !isIdCol(c.name))
      .map((c) => c.name) ||
      availableCols.filter((c) => typeof dataset.data?.[0]?.[c] === 'string' && !isIdCol(c));

    const dateCols = dataset.summary?.columns
      ?.filter((c) => c.type === 'datetime' || ['date', 'time', 'year', 'month', 'created', 'dt'].some((dk) => c.name.toLowerCase().includes(dk)))
      .map((c) => c.name) ||
      availableCols.filter((c) => ['date', 'time', 'year', 'month', 'created', 'dt'].some((dk) => c.toLowerCase().includes(dk)));

    const findCol = (terms: string[]) => availableCols.find((c) => terms.some((t) => c.toLowerCase().includes(t)));

    const suggestions: string[] = [];

    // 1. Time-Series Trend (ONLY IF a Date column and Numeric column exist in dataset)
    if (dateCols.length > 0 && numCols.length > 0) {
      const primaryMetric = numCols[0].replace(/_/g, ' ');
      suggestions.push(`Monthly ${primaryMetric} trend`);
    }

    // 2. Metric by Categorical Dimension Breakdown
    const mainCat = catCols.find((c) => !c.toLowerCase().includes('name')) || catCols[0];
    const mainNum = numCols[0];

    if (mainCat && mainNum) {
      suggestions.push(`${mainNum.replace(/_/g, ' ')} by ${mainCat.replace(/_/g, ' ')}`);
    }

    // 3. Region / Geography (ONLY IF Region/State/City column exists in dataset)
    const regionCol = findCol(['region', 'state', 'territory', 'zone', 'country', 'city']);
    if (regionCol && mainNum && regionCol !== mainCat) {
      suggestions.push(`${mainNum.replace(/_/g, ' ')} by ${regionCol.replace(/_/g, ' ')}`);
    }

    // 4. Customer / Entity Ranking (ONLY IF Customer/Client column exists in dataset)
    const customerCol = findCol(['customer', 'client', 'buyer']);
    if (customerCol && mainNum) {
      suggestions.push(`Top ${customerCol.replace(/_/g, ' ')}s by ${mainNum.replace(/_/g, ' ')}`);
    } else if (catCols[1] && mainNum) {
      suggestions.push(`Top 10 ${catCols[1].replace(/_/g, ' ')} by ${mainNum.replace(/_/g, ' ')}`);
    }

    // 5. Average Secondary Metric (ONLY IF a secondary numeric column and category column exist)
    const secNum = numCols.find((c) => c !== mainNum);
    const segmentCol = findCol(['segment', 'category', 'department', 'type', 'group']);
    if (secNum && segmentCol) {
      suggestions.push(`Average ${secNum.replace(/_/g, ' ')} by ${segmentCol.replace(/_/g, ' ')}`);
    } else if (secNum && mainCat) {
      suggestions.push(`Average ${secNum.replace(/_/g, ' ')} by ${mainCat.replace(/_/g, ' ')}`);
    }

    // Fallback if dataset has minimal columns
    if (suggestions.length === 0 && mainCat) {
      suggestions.push(`Record count by ${mainCat.replace(/_/g, ' ')}`);
    }

    // Deduplicate & return strictly grounded suggestions
    return Array.from(new Set(suggestions));
  };

  // Combined suggestions — dataset-grounded SQL prompts + generic dataset inspection
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
