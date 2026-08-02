import React, { useState } from 'react';
import { InsightLogo } from './ui/InsightLogo';
import {
  ArrowUpRight,
  Sparkles,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  Play,
  Code2,
  BrainCircuit,
  TrendingUp,
  BarChart3,
  Lightbulb,
  ShieldCheck,
  LayoutDashboard,
  Bot,
  Copy,
  Check,
  Server,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface LandingPageProps {
  onLaunchApp: () => void;
  onTryDemo: () => void;
  onOpenAuthModal?: () => void;
}

// Sample Sandbox Mock Data
const SANDBOX_QUERIES = [
  {
    id: 'q1',
    dataset: 'Global Enterprise Sales',
    question: 'What is total sales revenue by product category?',
    sql: 'SELECT Category, SUM(Sales) AS Total_Sales FROM SalesData GROUP BY Category ORDER BY Total_Sales DESC',
    chartType: 'bar',
    rows: [
      { Category: 'Technology', Total_Sales: 90200 },
      { Category: 'Furniture', Total_Sales: 47300 },
      { Category: 'Office Supplies', Total_Sales: 8500 },
    ],
    takeaway: 'Technology is the peak revenue segment, generating 90,200 in total sales (61.7% market share), representing the primary growth driver.',
  },
  {
    id: 'q2',
    dataset: 'Global Enterprise Sales',
    question: 'Which region generated the highest operating profit?',
    sql: 'SELECT Region, SUM(Profit) AS Total_Profit FROM SalesData GROUP BY Region ORDER BY Total_Profit DESC',
    chartType: 'bar',
    rows: [
      { Region: 'North America', Total_Profit: 14860 },
      { Region: 'Europe', Total_Profit: 11200 },
      { Region: 'Asia Pacific', Total_Profit: 6890 },
      { Region: 'Latin America', Total_Profit: 3100 },
    ],
    takeaway: 'North America leads operating profitability with 14,860 in net earnings.',
  },
  {
    id: 'q3',
    dataset: 'Titanic Passenger Demographics',
    question: 'Compare survival count between males and females',
    sql: 'SELECT Sex, COUNT(*) AS SurvivedCount FROM Titanic WHERE Survived = 1 GROUP BY Sex ORDER BY SurvivedCount DESC',
    chartType: 'bar',
    rows: [
      { Sex: 'female', SurvivedCount: 233 },
      { Sex: 'male', SurvivedCount: 109 },
    ],
    takeaway: 'Females had a significantly higher survival rate with 233 survivors compared to 109 male survivors, reflecting safety protocol priority.',
  },
];

const COLOR_PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b'];

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onLaunchApp, 
  onTryDemo,
  onOpenAuthModal,
}) => {
  const [activeQueryId, setActiveQueryId] = useState<string>('q1');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'sql' | 'takeaway'>('chart');

  const currentQuery = SANDBOX_QUERIES.find((q) => q.id === activeQueryId) || SANDBOX_QUERIES[0];

  const handleCopySql = () => {
    navigator.clipboard.writeText(currentQuery.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white relative">
      {/* Rotated Margin Indicator Badge */}
      <div className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-20 items-center space-x-2 text-slate-400 -rotate-90 origin-left tracking-widest text-[10px] font-mono uppercase pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>InsightAI v1.0 • Data Analytics</span>
      </div>

      {/* 1. Header Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#F6F6F4]/90 border-b border-slate-200/80 px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <InsightLogo size="lg" />
            <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
              Enterprise AI
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-xs font-bold text-slate-600">
            <button onClick={() => scrollToSection('sandbox')} className="hover:text-slate-950 transition-colors">
              Interactive Demo
            </button>
            <button onClick={() => scrollToSection('features')} className="hover:text-slate-950 transition-colors">
              Capabilities
            </button>
            <button onClick={() => scrollToSection('connectors')} className="hover:text-slate-950 transition-colors">
              Data Engines
            </button>
            <button onClick={() => scrollToSection('tech-stack')} className="hover:text-slate-950 transition-colors">
              Tech Stack
            </button>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={onLaunchApp}
              className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-full font-bold text-xs tracking-wide transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
            >
              <span>Launch Application</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section id="hero" className="relative w-full pt-12 pb-16 px-6 md:px-12 lg:px-16 flex flex-col justify-between overflow-hidden">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          {/* Left Hero Copy */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white border border-slate-200/90 shadow-xs text-xs font-semibold text-slate-800 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Natural Language Data Analytics Platform</span>
            </div>

            <div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-slate-950 font-sans leading-[0.95] select-none">
                Talk to your data.<br />
                <span className="text-slate-950">No SQL required.</span>
              </h1>
            </div>

            <p className="text-base sm:text-lg text-slate-700 font-normal leading-relaxed max-w-2xl">
              Upload CSV files or select sample datasets. Ask questions in plain English, and receive AI-generated SQL, smart visualizations, executive summaries, and business insights.
            </p>

            {/* Action Pill Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onLaunchApp}
                className="px-7 py-3.5 bg-slate-950 hover:bg-slate-800 text-white rounded-full font-bold text-xs tracking-wide transition-all duration-200 flex items-center space-x-2.5 shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
              >
                <span>Launch Application</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                onClick={() => scrollToSection('sandbox')}
                className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-full font-semibold text-xs transition-all duration-200 flex items-center space-x-2 shadow-xs active:scale-98 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                <span>Explore Interactive Demo</span>
              </button>
            </div>

            {/* Key Value Badges */}
            <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-xs font-mono text-slate-600 max-w-xl">
              <div className="flex items-center space-x-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Grounded SQL Generation</span>
              </div>
              <div className="flex items-center space-x-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Local Dataset Processing</span>
              </div>
              <div className="flex items-center space-x-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Auto-Schema Mapping</span>
              </div>
            </div>
          </div>

          {/* Right Hero Graphic: 3D Ribbon & Live Card Teaser */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <InsightLogo size="md" showText={false} />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-950">InsightAI Studio</h3>
                    <p className="text-[10px] text-slate-400 font-mono">FastAPI + DuckDB Engine</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Fast SQL Engine
                </span>

              </div>

              {/* Sample Query Input Mock */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                  <BrainCircuit className="h-3 w-3 text-blue-600" />
                  <span>Natural Language Query</span>
                </div>
                <div className="text-xs font-bold text-slate-900 font-mono">
                  "What is total sales revenue by product category?"
                </div>
              </div>

              {/* Sample Output Mini Card */}
              <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-4 space-y-2 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  <span>Top Performing Segment</span>
                  <span className="text-emerald-400">Validated SQL</span>
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono tracking-tight">$90,200</div>
                <div className="text-[11px] text-slate-300 font-medium">
                  Technology segment accounts for 61.7% of total revenue volume.
                </div>
              </div>

              <button
                onClick={onLaunchApp}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition-colors flex items-center justify-center space-x-2 shadow-sm"
              >
                <span>Try Workspace App Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Live Interactive Data Analytics Sandbox */}
      <section id="sandbox" className="w-full py-20 px-6 md:px-12 lg:px-16 border-t border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                <BrainCircuit className="w-4 h-4 text-emerald-600" />
                <span>Interactive Analytics Sandbox</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                Test natural language query synthesis live.
              </h2>
            </div>
            <p className="text-xs text-slate-600 max-w-md font-normal leading-relaxed">
              Click sample queries to observe how InsightAI executes validated SQL, selects optimal charts, and synthesizes executive insights.
            </p>
          </div>

          {/* Sample Query Switcher Chips */}
          <div className="bg-[#F6F6F4] p-4 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Select Sample Query:
            </div>
            <div className="flex flex-wrap gap-2">
              {SANDBOX_QUERIES.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setActiveQueryId(q.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center space-x-2 cursor-pointer ${
                    activeQueryId === q.id
                      ? 'bg-slate-950 text-white shadow-md'
                      : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className={`h-3.5 w-3.5 ${activeQueryId === q.id ? 'text-amber-400' : 'text-blue-600'}`} />
                  <span>"{q.question}"</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sandbox Live Execution Results Display Card */}
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-800">
            {/* Control Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
              <div>
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                  Executed Query • Grounded SQL Output
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">"{currentQuery.question}"</h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    activeTab === 'chart' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Chart Output
                </button>
                <button
                  onClick={() => setActiveTab('sql')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    activeTab === 'sql' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Generated SQL
                </button>
              </div>
            </div>

            {/* Tab 1: Recharts Display */}
            {activeTab === 'chart' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-8 h-72 w-full bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentQuery.rows as any[]} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey={Object.keys(currentQuery.rows[0])[0]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(val) => (val >= 1000 ? `${val / 1000}K` : val)}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '12px',
                          padding: '10px 14px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        }}
                        labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                        itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                        formatter={(value: any) => [
                          typeof value === 'number' ? value.toLocaleString() : value,
                          Object.keys(currentQuery.rows[0])[1].replace(/_/g, ' '),
                        ]}
                      />
                      <Bar dataKey={Object.keys(currentQuery.rows[0])[1]} radius={[6, 6, 0, 0]}>
                        {currentQuery.rows.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <Lightbulb className="h-4 w-4" />
                    <span>AI Key Takeaway</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {currentQuery.takeaway}
                  </p>
                  <div className="pt-2 text-[10px] font-mono text-slate-500 border-t border-slate-800">
                    Execution time: 0.2s • Grounded DuckDB SQL
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: SQL Display */}


            {activeTab === 'sql' && (
              <div className="relative bg-slate-900 p-5 rounded-2xl border border-slate-800 font-mono text-xs text-blue-300">
                <button
                  onClick={handleCopySql}
                  className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700 transition-colors"
                >
                  {copiedSql ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <div className="text-[10px] text-slate-500 font-sans uppercase font-bold mb-2">Validated DuckDB SQL Statement:</div>
                <pre className="whitespace-pre-wrap leading-relaxed">{currentQuery.sql}</pre>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* 4. Core Capabilities */}
      <section id="features" className="w-full py-20 px-6 md:px-12 lg:px-16 bg-[#F6F6F4] border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 font-mono">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight">
              Engineered for natural data exploration.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
                <Code2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Fast SQL Generation</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Generates clean SQL queries deterministically and executes them directly on DuckDB.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 w-fit">
                <Lightbulb className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Data Insights & Verification</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Calculates aggregated metrics, summary trends, and structured query explanations directly from data rows.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 w-fit">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Query Confidence Score</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Provides a clear 0–100% confidence rating based on schema matching and query validation.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="p-3 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 w-fit">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Interactive Dashboards</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Pin query results, charts, and summary statistics to your custom dataset dashboard.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="p-3 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-100 w-fit">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Schema Inspector</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                View column names, data types, row counts, and summary statistics for your uploaded dataset.
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
              <div className="p-3 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 w-fit">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">AI Provider Fallback</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Automatically handles API connection fallbacks to maintain uninterrupted query processing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Supported Real Connectors & Engines */}
      <section id="connectors" className="w-full py-16 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-6">
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 font-mono">
            Active Data Sources & Query Engines
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-bold text-slate-800">
            <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-slate-200/80 flex items-center justify-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>CSV & Excel Upload</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">Active</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-slate-200/80 flex items-center justify-center space-x-2">
              <Database className="h-4 w-4 text-blue-600" />
              <span>DuckDB WASM Engine</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">Active</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-slate-200/80 flex items-center justify-center space-x-2">
              <Server className="h-4 w-4 text-indigo-600" />
              <span>SQLite In-Memory</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">Active</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#F6F6F4] border border-slate-200/80 flex items-center justify-center space-x-2">
              <Code2 className="h-4 w-4 text-purple-600" />
              <span>DuckDB Engine</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Technology Stack Grid */}
      <section id="tech-stack" className="w-full py-20 px-6 md:px-12 lg:px-16 bg-[#F6F6F4] border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-10 text-center">
          <div className="space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500 font-mono">
              Real Powering Stack
            </span>
            <h2 className="text-3xl font-extrabold text-slate-950">Built with Real Production Technologies</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold text-slate-800">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center space-y-1">
              <span className="text-slate-950 font-extrabold">Groq LLaMA-3.3 70B</span>
              <span className="text-[9px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Live AI Engine</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center space-y-1">
              <span className="text-slate-950 font-extrabold">FastAPI + DuckDB</span>
              <span className="text-[9px] text-blue-700 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Execution Engine</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center space-y-1">
              <span className="text-slate-950 font-extrabold">React 18 & TS</span>
              <span className="text-[9px] text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Frontend Stack</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center space-y-1">
              <span className="text-slate-950 font-extrabold">Recharts & Tailwind</span>
              <span className="text-[9px] text-amber-700 font-extrabold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">UI & Data Charts</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer CTA */}
      <section className="py-20 max-w-5xl mx-auto px-6 text-center">
        <div className="bg-slate-950 text-white rounded-3xl p-10 sm:p-14 space-y-6 shadow-2xl">
          <InsightLogo size="xl" className="mx-auto" variant="dark" />
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-sans">
            Ready to explore your data?
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto font-medium">
            Launch InsightAI application to query datasets, view AI recommendations, and build executive dashboards.
          </p>
          <div className="pt-2">
            <button
              onClick={onLaunchApp}
              className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-100 rounded-full font-bold text-xs tracking-wide transition-all shadow-md active:scale-98 cursor-pointer inline-flex items-center space-x-2"
            >
              <span>Launch Application Now</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200/80 bg-white text-center text-xs text-slate-500 font-medium">
        InsightAI Analytics Platform • Enterprise AI Data Intelligence
      </footer>
    </div>
  );
};
