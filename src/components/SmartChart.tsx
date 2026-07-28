import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
} from 'recharts';
import { ChartConfig, ChartType } from '../types';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Activity,
  Pin,
  Table as TableIcon,
  Award,
  Hash,
  Flame,
  TrendingUp,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import { detectCurrency } from '../lib/currencyDetector';
import { determineOptimalChartType } from '../lib/chartAutoSelector';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface SmartChartProps {
  data: Record<string, any>[];
  config: ChartConfig;
  onPinToDashboard?: (title: string, config: ChartConfig) => void;
  isPinned?: boolean;
  headerActions?: React.ReactNode;
  insight?: string;
  queryText?: string;
  hideControls?: boolean;
}

const COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
];

// Gradient pairs for bar charts [solid, lighter]
const GRADIENT_PAIRS = [
  ['#3b82f6', '#93c5fd'],
  ['#06b6d4', '#67e8f9'],
  ['#10b981', '#6ee7b7'],
  ['#f59e0b', '#fcd34d'],
  ['#8b5cf6', '#c4b5fd'],
  ['#ec4899', '#f9a8d4'],
  ['#6366f1', '#a5b4fc'],
  ['#14b8a6', '#5eead4'],
];

const TOOLTIP_STYLE = {
  backgroundColor: '#0d1424',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#f1f5f9',
  fontSize: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '10px 14px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
};

const AXIS_STYLE = { stroke: '#94a3b8', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' };
const GRID_STROKE = '#f1f5f9';

export const SmartChart: React.FC<SmartChartProps> = ({
  data,
  config: initialConfig,
  onPinToDashboard,
  isPinned = false,
  headerActions,
  insight,
  queryText,
  hideControls = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs shadow-xs font-medium">
        No dataset records available for visualization.
      </div>
    );
  }

  // Automatic Chart Recommendation based on dataset & query title
  const autoRecommendation = determineOptimalChartType(data, initialConfig?.title);

  const columns = Object.keys(data[0] || {});
  const rawX = initialConfig?.xAxisKey && columns.includes(initialConfig.xAxisKey) ? initialConfig.xAxisKey : autoRecommendation.xAxisKey || columns[0];
  const rawY = (Array.isArray(initialConfig?.yAxisKey) ? initialConfig.yAxisKey[0] : initialConfig?.yAxisKey) || autoRecommendation.yAxisKey || columns[1] || columns[0];

  const defaultType: ChartType = initialConfig?.type ? initialConfig.type : autoRecommendation.type;

  const [chartType, setChartType] = useState<ChartType>(defaultType);
  const [xAxisKey, setXAxisKey] = useState<string>(rawX);
  const [yAxisKey, setYAxisKey] = useState<string>(rawY);

  const actualXKey = xAxisKey && columns.includes(xAxisKey) ? xAxisKey : columns[0];
  const actualYKey = yAxisKey && columns.includes(yAxisKey) ? yAxisKey : columns[1] || columns[0];

  // Currency detection
  const currencyInfo = detectCurrency(initialConfig?.title, columns, data);
  const currencySymbol = currencyInfo.symbol;

  const formatValue = (val: any) => {
    if (typeof val === 'number') {
      const prefix = currencySymbol || '';
      if (Math.abs(val) >= 1000000) return prefix + (val / 1000000).toFixed(1) + 'M';
      if (Math.abs(val) >= 1000) {
        const kVal = val / 1000;
        return prefix + (Number.isInteger(kVal) ? kVal.toString() : kVal.toFixed(1)) + 'K';
      }
      return prefix + (Number.isInteger(val) ? val.toString() : val.toFixed(2));
    }
    return String(val ?? '');
  };

  const formatTooltip = (val: any) => {
    if (typeof val === 'number') {
      const prefix = currencySymbol ? `${currencySymbol} ` : '';
      return prefix + val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return String(val ?? '');
  };

  const currentConfig: ChartConfig = {
    ...initialConfig,
    type: chartType,
    xAxisKey: actualXKey,
    yAxisKey: actualYKey,
  };

  // Helper for Histogram Data Preparation
  const getHistogramData = () => {
    const numericVals = data
      .map((r) => Number(r[actualYKey]))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    if (numericVals.length === 0) return [];

    const min = numericVals[0];
    const max = numericVals[numericVals.length - 1];
    const binCount = Math.min(8, Math.max(4, Math.floor(Math.sqrt(numericVals.length))));
    const binWidth = (max - min) / binCount || 1;

    const bins: { range: string; count: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const bMin = Math.round(min + i * binWidth);
      const bMax = Math.round(min + (i + 1) * binWidth);
      bins.push({
        range: `${bMin} - ${bMax}`,
        count: 0,
      });
    }

    numericVals.forEach((val) => {
      let idx = Math.floor((val - min) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      if (bins[idx]) bins[idx].count++;
    });

    return bins;
  };

  // Helper for Heatmap Matrix Data Preparation
  const getHeatmapData = () => {
    const catCols = columns.filter((c) => data.some((r) => typeof r[c] === 'string'));
    const dim1 = catCols[0] || columns[0];
    const dim2 = catCols[1] || columns[1] || columns[0];
    const metricCol = columns.find((c) => data.some((r) => typeof r[c] === 'number')) || actualYKey;

    const rowVals: string[] = Array.from(new Set(data.map((r) => String(r[dim1] || 'Unknown')))).slice(0, 6).map(String);
    const colVals: string[] = Array.from(new Set(data.map((r) => String(r[dim2] || 'Unknown')))).slice(0, 6).map(String);

    const matrix: Record<string, Record<string, number>> = {};
    rowVals.forEach((r: string) => {
      matrix[r] = {};
      colVals.forEach((c: string) => {
        matrix[r][c] = 0;
      });
    });

    let maxVal = 0;
    data.forEach((row) => {
      const r = String(row[dim1] || '');
      const c = String(row[dim2] || '');
      const val = Number(row[metricCol]) || 1;
      if (matrix[r] && matrix[r][c] !== undefined) {
        matrix[r][c] += val;
        if (matrix[r][c] > maxVal) maxVal = matrix[r][c];
      }
    });

    return { rowVals, colVals, matrix, maxVal, dim1, dim2, metricCol };
  };

  const isRechartsChart = ['bar', 'bar_horizontal', 'line', 'area', 'pie', 'donut', 'scatter', 'histogram'].includes(chartType);

  const renderChartContent = () => {
    switch (chartType) {
      // 1. Vertical Bar Chart
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <defs>
              {data.map((_, i) => (
                <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][0]} stopOpacity={1} />
                  <stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][1]} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={actualXKey} {...AXIS_STYLE} tickLine={false} axisLine={false} angle={-18} textAnchor="end" dy={4} />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#60a5fa' }}
              formatter={(value: any) => [formatTooltip(value), actualYKey.replace(/_/g, ' ')]}
            />
            <Bar dataKey={actualYKey} radius={[8, 8, 0, 0]} maxBarSize={52}>
              {data.map((_, index) => (
                <Cell key={`bar-${index}`} fill={`url(#barGrad${index})`} />
              ))}
            </Bar>
          </BarChart>
        );

      // 2. Horizontal Bar Chart
      case 'bar_horizontal':
        return (
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 44, bottom: 8 }}>
            <defs>
              {data.map((_, i) => (
                <linearGradient key={i} id={`hbarGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][0]} stopOpacity={1} />
                  <stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][1]} stopOpacity={0.75} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <YAxis type="category" dataKey={actualXKey} {...AXIS_STYLE} tickLine={false} axisLine={false} width={108} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => [formatTooltip(value), actualYKey.replace(/_/g, ' ')]}
            />
            <Bar dataKey={actualYKey} radius={[0, 8, 8, 0]} maxBarSize={36}>
              {data.map((_, index) => (
                <Cell key={`hbar-${index}`} fill={`url(#hbarGrad${index})`} />
              ))}
            </Bar>
          </BarChart>
        );

      // 3. Line Chart
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <defs>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={actualXKey} {...AXIS_STYLE} tickLine={false} axisLine={false} angle={-18} textAnchor="end" dy={4} />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#60a5fa' }}
              formatter={(value: any) => [formatTooltip(value), actualYKey.replace(/_/g, ' ')]}
            />
            <Line
              type="monotone"
              dataKey={actualYKey}
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ fill: '#fff', stroke: '#3b82f6', strokeWidth: 2.5, r: 4 }}
              activeDot={{ r: 7, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2.5, filter: 'url(#lineGlow)' }}
            />
          </LineChart>
        );

      // Area Chart
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id="areaGradMain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.28} />
                <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.06} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <filter id="areaGlow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={actualXKey} {...AXIS_STYLE} tickLine={false} axisLine={false} angle={-18} textAnchor="end" dy={4} />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => [formatTooltip(value), actualYKey.replace(/_/g, ' ')]}
            />
            <Area
              type="monotone"
              dataKey={actualYKey}
              stroke="#3b82f6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#areaGradMain)"
              dot={{ fill: '#fff', stroke: '#3b82f6', strokeWidth: 2, r: 3.5 }}
              activeDot={{ r: 6.5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        );

      // 4. Pie / Donut Chart
      case 'pie':
      case 'donut': {
        const isDonut = chartType === 'donut';
        return (
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              {data.map((_, i) => (
                <radialGradient key={i} id={`pieGrad${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][0]} stopOpacity={1} />
                </radialGradient>
              ))}
            </defs>
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => [formatTooltip(value), actualYKey.replace(/_/g, ' ')]}
            />
            <Legend verticalAlign="bottom" height={38} wrapperStyle={{ fontSize: '11px', color: '#64748b', fontFamily: 'Inter, sans-serif' }} />
            <Pie
              data={data}
              dataKey={actualYKey}
              nameKey={actualXKey}
              cx="50%"
              cy="50%"
              innerRadius={isDonut ? 58 : 0}
              outerRadius={90}
              paddingAngle={isDonut ? 4 : 2}
              strokeWidth={2}
              stroke="#ffffff"
              label={({ name, percent }) => `${String(name).slice(0,10)} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            >
              {data.map((_, index) => (
                <Cell key={`pie-${index}`} fill={`url(#pieGrad${index})`} />
              ))}
            </Pie>
          </PieChart>
        );
      }

      // 5. Table View
      case 'table':
        return (
          <div className="h-full w-full overflow-auto border border-slate-200 rounded-xl bg-white shadow-inner">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-slate-800 uppercase tracking-wider font-extrabold">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 font-mono text-slate-700">
                        {typeof row[col] === 'number' ? formatTooltip(row[col]) : String(row[col] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      // 6. KPI / Metric Card
      case 'kpi': {
        const metricVal = data[0][actualYKey] !== undefined ? data[0][actualYKey] : data[0][actualXKey];
        const formattedVal = formatTooltip(metricVal);
        const isNumeric = typeof metricVal === 'number';

        return (
          <div className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden rounded-2xl min-h-[240px] p-8" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #f5f3ff 100%)' }}>
            {/* Decorative ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full border border-blue-200/40" />
              <div className="absolute w-64 h-64 rounded-full border border-blue-100/30" />
            </div>

            <div className="relative z-10 flex flex-col items-center space-y-3">
              <div className="flex items-center space-x-1.5 text-[11px] font-extrabold text-blue-600/80 uppercase tracking-widest">
                <Hash className="h-3.5 w-3.5" />
                <span>{actualYKey.replace(/_/g, ' ')}</span>
              </div>

              <div className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 font-mono animate-number-pop">
                {isNumeric ? formattedVal : String(metricVal)}
              </div>

              <div className="flex items-center space-x-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Verified Aggregated Result</span>
              </div>

              <p className="text-[11px] text-slate-400 font-medium">
                Grounded on {data.length} record{data.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        );
      }

      // 7. Scatter Plot
      case 'scatter': {
        const numCols = columns.filter((c) => data.some((r) => typeof r[c] === 'number'));
        const scatterX = numCols[0] || actualXKey;
        const scatterY = numCols[1] || actualYKey;

        const scatterData = data.map((r) => ({
          x: Number(r[scatterX]) || 0,
          y: Number(r[scatterY]) || 0,
          name: String(r[columns[0]] || ''),
        }));

        return (
          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" name={scatterX} stroke="#64748b" fontSize={11} tickFormatter={formatValue} />
            <YAxis type="number" dataKey="y" name={scatterY} stroke="#64748b" fontSize={11} tickFormatter={formatValue} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '10px', color: '#f8fafc', fontSize: '12px' }}
              formatter={(value: any, name: any) => [formatTooltip(value), String(name).replace(/_/g, ' ')]}
            />
            <Scatter name="Data Points" data={scatterData} fill="#3b82f6" />
          </ScatterChart>
        );
      }

      // 8. Histogram
      case 'histogram': {
        const binData = getHistogramData();
        return (
          <BarChart data={binData} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="range" {...AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => [`${value} records`, 'Frequency']}
            />
            <Bar dataKey="count" fill="url(#histGrad)" radius={[8, 8, 0, 0]} maxBarSize={60} />
          </BarChart>
        );
      }

      // 9. Heatmap / Matrix
      case 'heatmap': {
        const { rowVals, colVals, matrix, maxVal, dim1, dim2 } = getHeatmapData();
        return (
          <div className="h-full w-full overflow-auto flex flex-col justify-center p-2 min-h-[240px]">
            <div className="text-[11px] font-bold text-slate-500 mb-2 text-center uppercase tracking-wider">
              {dim1} (Rows) × {dim2} (Columns) Intensity Matrix
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-700">
                      {dim1} \ {dim2}
                    </th>
                    {colVals.map((c) => (
                      <th key={c} className="p-2 border border-slate-200 bg-slate-100 font-bold text-slate-700">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowVals.map((r) => (
                    <tr key={r}>
                      <td className="p-2 border border-slate-200 font-bold text-slate-800 bg-slate-50">
                        {r}
                      </td>
                      {colVals.map((c) => {
                        const val = matrix[r][c] || 0;
                        const opacity = maxVal > 0 ? Math.max(0.1, val / maxVal) : 0.1;
                        return (
                          <td
                            key={c}
                            style={{ backgroundColor: `rgba(59, 130, 246, ${opacity})` }}
                            className={`p-2 border border-slate-200 font-mono font-bold ${
                              opacity > 0.5 ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {formatValue(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // 10. 🏆 Insight Card (AI Summary)
      case 'insight_card': {
        const firstRow = data[0] || {};
        const primaryCatVal = String(firstRow[actualXKey] || firstRow[columns[0]] || 'Top Record');
        const primaryNumVal = Number(firstRow[actualYKey] !== undefined ? firstRow[actualYKey] : firstRow[columns[1]]);

        return (
          <div className="h-full w-full flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 min-h-[240px]">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    🏆 AI Summary Highlight
                  </h4>
                  <p className="text-xs text-slate-300 font-semibold mt-0.5">{actualXKey}: <span className="text-white font-bold">{primaryCatVal}</span></p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full shrink-0">
                Insight Card
              </span>
            </div>

            <div className="my-3 space-y-1">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">{actualYKey.replace(/_/g, ' ')}</div>
              {!isNaN(primaryNumVal) ? (
                <div className="text-4xl font-black text-blue-400 font-mono tracking-tight">
                  {formatTooltip(primaryNumVal)}
                </div>
              ) : (
                <div className="text-2xl font-bold text-white tracking-tight">{primaryCatVal}</div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center space-x-1 font-semibold text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Top Performing Record</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {data.length} row(s) evaluated
              </span>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Selector toolbar items with explicit labels and icons (including both Vertical & Horizontal Bar options)
  const SELECTOR_ITEMS: { type: ChartType; label: string; icon: React.ReactNode }[] = [
    { type: 'bar', label: 'Bar (Vert)', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { type: 'bar_horizontal', label: 'Bar (Hort)', icon: <BarChart2 className="h-3.5 w-3.5 rotate-90 shrink-0" /> },
    { type: 'line', label: 'Line', icon: <LineChartIcon className="h-3.5 w-3.5" /> },
    { type: 'pie', label: 'Pie', icon: <PieChartIcon className="h-3.5 w-3.5" /> },
    { type: 'kpi', label: 'KPI', icon: <Hash className="h-3.5 w-3.5" /> },
    { type: 'table', label: 'Table', icon: <TableIcon className="h-3.5 w-3.5" /> },
    { type: 'scatter', label: 'Scatter', icon: <Activity className="h-3.5 w-3.5" /> },
    { type: 'histogram', label: 'Hist', icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { type: 'heatmap', label: 'Heatmap', icon: <Flame className="h-3.5 w-3.5" /> },
    { type: 'insight_card', label: 'Insight', icon: <Award className="h-3.5 w-3.5 text-amber-400" /> },
  ];

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-soft-xs overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 pt-4 pb-4 border-b border-[#f0f0ef] gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 truncate" title={initialConfig?.title}>
            {initialConfig?.title || 'Interactive Visualization'}
          </h3>
          {initialConfig?.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{initialConfig.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Dimension selectors */}
          {!hideControls && (
            <div className="flex items-center gap-1.5">
              <select
                value={actualXKey}
                onChange={(e) => setXAxisKey(e.target.value)}
                className="bg-[#fafafa] text-slate-700 border border-[#e5e5e5] rounded-lg px-2 py-1.5 focus:outline-none text-xs max-w-[110px] truncate cursor-pointer"
                title={`X Axis: ${actualXKey}`}
              >
                {columns.map((col) => (
                  <option key={col} value={col}>X: {col}</option>
                ))}
              </select>
              <select
                value={actualYKey}
                onChange={(e) => setYAxisKey(e.target.value)}
                className="bg-[#fafafa] text-slate-700 border border-[#e5e5e5] rounded-lg px-2 py-1.5 focus:outline-none text-xs max-w-[110px] truncate cursor-pointer"
                title={`Y Axis: ${actualYKey}`}
              >
                {columns.map((col) => (
                  <option key={col} value={col}>Y: {col}</option>
                ))}
              </select>
            </div>
          )}
          {headerActions}
          {onPinToDashboard && (
            <Button
              variant={isPinned ? 'success' : 'primary'}
              size="sm"
              leftIcon={<Pin className="h-3.5 w-3.5" />}
              onClick={() => onPinToDashboard(initialConfig?.title || 'Chart', currentConfig)}
            >
              {isPinned ? 'Pinned' : 'Pin'}
            </Button>
          )}
        </div>
      </div>

      {/* Chart type selector — compact pill row */}
      {!hideControls && (
        <div className="px-5 pb-1 pt-3 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider shrink-0 mr-1">Type:</span>
          {SELECTOR_ITEMS.map((item) => {
            const isSelected = chartType === item.type;
            const isRecommended = autoRecommendation.type === item.type;
            return (
              <button
                key={item.type}
                onClick={() => setChartType(item.type)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-[#fafafa] text-slate-600 border-[#e5e5e5] hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {isRecommended && !isSelected && (
                  <span className="text-[9px] text-amber-500">★</span>
                )}
              </button>
            );
          })}

          {/* Alternative rankings */}
          {initialConfig?.chartRankings && initialConfig.chartRankings.length > 1 && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#f0f0ef]">
              <span className="text-[10px] text-slate-400">Also:</span>
              {initialConfig.chartRankings.slice(1, 3).map((rank) => {
                const chartKey = rank.chart as ChartType;
                const item = SELECTOR_ITEMS.find((s) => s.type === chartKey);
                if (!item) return null;
                return (
                  <button
                    key={chartKey}
                    onClick={() => setChartType(chartKey)}
                    title={`Score: ${rank.score}/100`}
                    className="px-2 py-1 rounded-md border border-[#e5e5e5] text-[11px] text-slate-500 hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chart canvas — taller for better visual impact */}
      <div className="h-[340px] w-full px-2 pb-2 pt-1">
        {isRechartsChart ? (
          <ResponsiveContainer width="100%" height="100%">
            {(renderChartContent() ?? <g />) as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          renderChartContent() ?? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Chart type not available.
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-2 border-t border-[#f0f0ef]">
        {insight ? (
          <p className="text-xs text-slate-600 flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-700">Takeaway:</strong> {insight}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400">{autoRecommendation.explanation}</p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-slate-400 font-mono truncate pr-2">
            {queryText ? `> ${queryText}` : `${data.length} records`}
          </span>
          <span className="text-[10px] text-slate-400 bg-[#f5f5f4] border border-[#ebebeb] px-2 py-0.5 rounded font-sans shrink-0">
            {autoRecommendation.intent}
          </span>
        </div>
      </div>
    </div>
  );
};
