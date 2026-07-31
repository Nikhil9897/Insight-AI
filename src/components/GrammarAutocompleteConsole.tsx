import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  ArrowRight,
  Star,
  Mic,
  CornerDownLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui/Button';

interface Suggestion {
  prompt: string;
  metric?: string;
  dimension?: string;
  category?: string;
  stars: number;
  rating_label: string;
}

interface GrammarAutocompleteConsoleProps {
  onExecuteQuery: (query: string) => void;
  isExecuting: boolean;
  suggestions?: Suggestion[];
  datasetRows?: Record<string, any>[];
}

export const GrammarAutocompleteConsole: React.FC<GrammarAutocompleteConsoleProps> = ({
  onExecuteQuery,
  isExecuting,
  suggestions = [],
  datasetRows = [],
}) => {
  const [query, setQuery] = useState('');
  const [completions, setCompletions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch completions from /api/intelligence/autocomplete as user types
  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setCompletions([]);
      return;
    }

    const fetchCompletions = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/intelligence/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            datasetRows: datasetRows.slice(0, 100)
          })
        });
        if (res.ok) {
          const data = await res.json();
          setCompletions(data.completions || []);
        }
      } catch (err) {
        // Fallback local autocomplete logic
        const qLower = query.toLowerCase();
        if (qLower === 'show') setCompletions(['show total', 'show average', 'show top 10']);
        else if (qLower.endsWith('by')) setCompletions([`${query} Region`, `${query} Category`, `${query} Month`]);
      }
    };

    const timer = setTimeout(fetchCompletions, 120);
    return () => clearTimeout(timer);
  }, [query, datasetRows]);

  // Click outside to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isExecuting) {
      setShowDropdown(false);
      onExecuteQuery(query.trim());
    }
  };

  const handleSelectCompletion = (completionText: string) => {
    setQuery(completionText);
    setShowDropdown(false);
    onExecuteQuery(completionText);
  };

  return (
    <div className="w-full space-y-4">
      {/* 🚀 Copilot Grammar-Aware Search Bar */}
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <div className="absolute left-4 text-blue-600">
            <Search className="h-5 w-5" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Ask anything about your data... (e.g. 'Show total revenue by region' or 'Top 10 customers by sales')"
            className="w-full bg-white border-2 border-slate-200 focus:border-blue-600 rounded-2xl pl-12 pr-28 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-soft-xs transition-all"
          />

          <div className="absolute right-3 flex items-center gap-1.5">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isExecuting}
              disabled={!query.trim() || isExecuting}
              rightIcon={<CornerDownLeft className="h-3.5 w-3.5" />}
            >
              Analyze
            </Button>
          </div>
        </form>

        {/* Real-time Copilot Autocomplete Dropdown */}
        {showDropdown && completions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-600" />
              <span>Copilot Grammar Autocomplete:</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {completions.map((comp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectCompletion(comp)}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
                    <span>{comp}</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">Select ↵</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ⭐ Algorithmic Star-Ranked Suggestions Grid */}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>Algorithmic Dataset Suggestions (Ranked):</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Generated from Dataset Brain</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {suggestions.slice(0, 9).map((sugg, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectCompletion(sugg.prompt)}
                disabled={isExecuting}
                className="p-3 bg-white hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all shadow-2xs group flex items-start justify-between gap-2 cursor-pointer"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                    {sugg.prompt}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <span className="text-amber-500 font-black">{sugg.rating_label}</span>
                    <span>·</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded uppercase text-[9px] font-bold">
                      {sugg.category || 'Analysis'}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
