import React, { useState } from 'react';
import { Search, Database, Code2, CheckCircle2, Play, BarChart2, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';

interface ExecutionPipelineProps {
  currentStage?: number; // 1 to 7
}

export const ExecutionPipeline: React.FC<ExecutionPipelineProps> = ({ currentStage = 7 }) => {
  const stages = [
    { id: 1, label: 'Intent Detection', icon: <Search className="h-3.5 w-3.5" />, desc: 'User Question' },
    { id: 2, label: 'Schema Grounding', icon: <Database className="h-3.5 w-3.5" />, desc: 'Column Mapping' },
    { id: 3, label: 'SQL Generation', icon: <Code2 className="h-3.5 w-3.5" />, desc: 'Query Translation' },
    { id: 4, label: 'Validation', icon: <CheckCircle2 className="h-3.5 w-3.5" />, desc: 'Syntax & Grounding' },
    { id: 5, label: 'Execution', icon: <Play className="h-3.5 w-3.5" />, desc: 'Engine Execution' },
    { id: 6, label: 'Visualization', icon: <BarChart2 className="h-3.5 w-3.5" />, desc: 'Smart Charting' },
    { id: 7, label: 'Insight Generation', icon: <Lightbulb className="h-3.5 w-3.5" />, desc: 'Executive Insights' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            AI Query Processing Pipeline
          </h3>
        </div>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          Pipeline Completed
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {stages.map((stage) => {
          const isCompleted = stage.id <= currentStage;
          const isCurrent = stage.id === currentStage;

          return (
            <div
              key={stage.id}
              className={`relative p-2.5 rounded-lg border text-center transition-all ${
                isCurrent
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 text-blue-900'
                  : isCompleted
                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                  : 'bg-slate-50/50 border-slate-100 text-slate-400'
              }`}
            >
              <div
                className={`mx-auto w-6 h-6 rounded-full flex items-center justify-center mb-1.5 text-xs font-bold ${
                  isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : stage.id}
              </div>
              <div className="text-[11px] font-bold truncate leading-tight">{stage.label}</div>
              <div className="text-[9px] text-slate-500 truncate mt-0.5">{stage.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
