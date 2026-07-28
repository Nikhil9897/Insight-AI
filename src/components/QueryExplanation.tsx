import React from 'react';
import { ListChecks, Code } from 'lucide-react';

interface QueryExplanationProps {
  explanation: string;
  querySteps?: string[];
}

export const QueryExplanation: React.FC<QueryExplanationProps> = ({ explanation, querySteps }) => {
  const steps = querySteps || [
    'Parsed natural language question intent & identified dimensions',
    'Applied column grounding and sanitized SQL query parameters',
    'Executed aggregation query over in-memory table',
    'Formatted resulting data table and generated visual chart configuration',
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-center space-x-2">
        <ListChecks className="h-4 w-4 text-blue-600" />
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Query Execution Step Breakdown
        </h3>
      </div>

      <p className="text-xs text-slate-600 font-medium leading-relaxed">
        {explanation}
      </p>

      <div className="space-y-1.5 pt-1">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start space-x-2 text-xs text-slate-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <span className="font-medium">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
