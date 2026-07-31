import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Award,
  BarChart3,
  Users,
  Package,
  Calendar,
  Percent,
  Layers,
} from 'lucide-react';

interface Capability {
  id: string;
  title: string;
  description: string;
}

interface CapabilityDiscoveryCardProps {
  domain: string;
  confidence: number;
  capabilities: Capability[];
  onSelectCapabilityPrompt?: (prompt: string) => void;
}

const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
  revenue: <TrendingUp className="h-4 w-4 text-blue-600" />,
  profitability: <Award className="h-4 w-4 text-amber-600" />,
  geography: <BarChart3 className="h-4 w-4 text-emerald-600" />,
  customer: <Users className="h-4 w-4 text-violet-600" />,
  product: <Package className="h-4 w-4 text-pink-600" />,
  time_series: <Calendar className="h-4 w-4 text-teal-600" />,
  discount: <Percent className="h-4 w-4 text-orange-600" />,
  volume: <Layers className="h-4 w-4 text-indigo-600" />,
};

export const CapabilityDiscoveryCard: React.FC<CapabilityDiscoveryCardProps> = ({
  domain,
  confidence,
  capabilities,
}) => {
  if (!capabilities || capabilities.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-soft-md border border-slate-800 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Sparkles className="h-4 w-4 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-300">
              Dataset Intelligence Engine
            </h3>
            <p className="text-sm font-bold text-white mt-0.5">
              Detected Domain: <span className="text-blue-400 font-extrabold">{domain}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
            {confidence}% Confidence Match
          </span>
        </div>
      </div>

      {/* Capabilities List */}
      <div className="mt-3.5 space-y-1.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Supported Analytical Business Capabilities:
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {capabilities.map((cap) => (
            <div
              key={cap.id}
              className="flex items-center space-x-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <div className="shrink-0 p-1.5 rounded-lg bg-slate-900">
                {CAPABILITY_ICONS[cap.id] || <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-100 truncate">{cap.title}</div>
                <div className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  <span>Ready</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
