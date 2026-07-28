import React, { useState } from 'react';
import { QueryHistoryItem } from '../types';
import { History, Play, Terminal, Clock, Trash2, CheckCircle2, Copy, Check, ArrowUpRight } from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface QueryHistoryViewProps {
  history: QueryHistoryItem[];
  onRerunQuery: (item: QueryHistoryItem) => void;
  onClearHistory?: () => void;
}

/**
 * Query Audit Log — keeps useful metadata (time, rows, latency).
 * Design: clean table-style list without heavy card nesting per item.
 */
export const QueryHistoryView: React.FC<QueryHistoryViewProps> = ({
  history,
  onRerunQuery,
  onClearHistory,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCopySql = (id: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Query Audit Log</h1>
          <p className="text-sm text-slate-400 mt-1">
            {history.length} executed {history.length === 1 ? 'query' : 'queries'} · NL-to-SQL execution history
          </p>
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onClearHistory}
            className="text-slate-400 hover:text-rose-600"
          >
            Clear history
          </Button>
        )}
      </div>

      {/* History list */}
      {history.length > 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden shadow-soft-xs divide-y divide-[#f5f5f5]">
          {history.map((item) => (
            <div key={item.id} className="group">
              {/* Main row */}
              <div className="flex items-start gap-4 px-5 py-4 hover:bg-[#fafafa] transition-colors">
                {/* Terminal icon */}
                <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Query text */}
                  <p className="text-sm font-medium text-slate-900 leading-snug truncate">
                    "{item.userQuery}"
                  </p>

                  {/* Metadata row — the useful stuff */}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                    <span className="font-medium text-slate-500">{item.datasetName}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.executionTimeMs}ms
                    </span>
                    <span>·</span>
                    <span>{item.resultRowCount} rows returned</span>
                    <span>·</span>
                    {item.status === 'success' ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                      </span>
                    ) : (
                      <span className="text-rose-500">Failed</span>
                    )}
                  </div>

                  {/* SQL preview (expandable) */}
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 font-mono flex items-center gap-1 transition-colors"
                  >
                    {expandedId === item.id ? '▲ Hide SQL' : '▼ Show SQL'}
                  </button>

                  {expandedId === item.id && (
                    <div className="mt-2 bg-slate-950 rounded-lg p-3.5 font-mono text-xs text-blue-300 overflow-x-auto border border-slate-800">
                      <code>{item.sql}</code>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopySql(item.id, item.sql)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
                    title="Copy SQL"
                  >
                    {copiedId === item.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onRerunQuery(item)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg transition-colors"
                  >
                    <Play className="h-3 w-3 fill-white" />
                    Re-run
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No query history yet"
          description="Natural language queries executed in the NL Explorer will appear here with full SQL and execution metadata."
          icon={<History className="h-7 w-7 text-slate-400" />}
        />
      )}
    </div>
  );
};
