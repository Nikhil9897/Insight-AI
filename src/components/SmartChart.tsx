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
  ZAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  Treemap,
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
  Layers,
  CircleDot,
  LayoutGrid,
  Sliders,
  Circle,
  Filter,
  ChevronDown,
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

export type ChartCategory = 'all' | 'comparison' | 'trends' | 'distribution' | 'correlation' | 'summary';

export interface SelectorItem {
  type: ChartType;
  label: string;
  category: ChartCategory;
  icon: React.ReactNode;
  description: string;
}

const COLOR_PALETTE = [
  '#2563eb', // Royal Blue
  '#0d9488', // Teal Accent
  '#7c3aed', // Deep Violet
  '#d97706', // Amber Gold
  '#059669', // Emerald Green
  '#db2777', // Magenta Pink
  '#4f46e5', // Indigo
  '#ea580c', // Coral Orange
  '#0284c7', // Sky Blue
  '#65a30d', // Lime
];

// Gradient pairs for bar charts [solid, lighter]
const GRADIENT_PAIRS = [
  ['#2563eb', '#60a5fa'], // Royal Blue
  ['#0d9488', '#2dd4bf'], // Teal
  ['#7c3aed', '#a78bfa'], // Deep Violet
  ['#d97706', '#fbbf24'], // Amber Gold
  ['#059669', '#34d399'], // Emerald Green
  ['#db2777', '#f472b6'], // Magenta Pink
  ['#4f46e5', '#818cf8'], // Indigo
  ['#ea580c', '#fb923c'], // Coral
];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '12px',
  color: '#f8fafc',
  fontSize: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '10px 14px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(8px)',
};

const AXIS_STYLE = { stroke: '#94a3b8', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' };
const GRID_STROKE = '#f1f5f9';

const CATEGORIES: { id: ChartCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Charts (17)', icon: <LayoutGrid className="h-3.5 w-3.5 text-blue-600" /> },
  { id: 'comparison', label: 'Comparison', icon: <BarChart3 className="h-3.5 w-3.5 text-indigo-600" /> },
  { id: 'trends', label: 'Trends', icon: <TrendingUp className="h-3.5 w-3.5 text-teal-600" /> },
  { id: 'distribution', label: 'Distribution & Share', icon: <CircleDot className="h-3.5 w-3.5 text-pink-600" /> },
  { id: 'correlation', label: 'Correlation', icon: <Activity className="h-3.5 w-3.5 text-rose-600" /> },
  { id: 'summary', label: 'Summary & Table', icon: <Hash className="h-3.5 w-3.5 text-amber-600" /> },
];

const SELECTOR_ITEMS: SelectorItem[] = [
  { type: 'bar', label: 'Bar (Vert)', category: 'comparison', icon: <BarChart3 className="h-3.5 w-3.5 text-blue-600" />, description: 'Vertical column comparison' },
  { type: 'bar_horizontal', label: 'Bar (Hort)', category: 'comparison', icon: <BarChart2 className="h-3.5 w-3.5 rotate-90 text-cyan-600 shrink-0" />, description: 'Horizontal ranked bar comparison' },
  { type: 'bar_stacked', label: 'Stacked Bar', category: 'comparison', icon: <Layers className="h-3.5 w-3.5 text-indigo-600" />, description: 'Multi-group segment contribution' },
  
  { type: 'line', label: 'Line', category: 'trends', icon: <LineChartIcon className="h-3.5 w-3.5 text-blue-600" />, description: 'Sequential time-series trajectory' },
  { type: 'area', label: 'Area', category: 'trends', icon: <TrendingUp className="h-3.5 w-3.5 text-teal-600" />, description: 'Continuous trend & volume magnitude' },
  { type: 'area_stacked', label: 'Stacked Area', category: 'trends', icon: <Layers className="h-3.5 w-3.5 text-violet-600" />, description: 'Multi-segment volume over time' },
  
  { type: 'pie', label: 'Pie', category: 'distribution', icon: <PieChartIcon className="h-3.5 w-3.5 text-pink-600" />, description: 'Proportional percentage share' },
  { type: 'donut', label: 'Donut', category: 'distribution', icon: <CircleDot className="h-3.5 w-3.5 text-sky-600" />, description: 'Enterprise hollow distribution pie' },
  { type: 'treemap', label: 'Treemap', category: 'distribution', icon: <LayoutGrid className="h-3.5 w-3.5 text-emerald-600" />, description: 'Hierarchical space-filling breakdown' },
  { type: 'histogram', label: 'Hist', category: 'distribution', icon: <BarChart2 className="h-3.5 w-3.5 text-purple-600" />, description: 'Continuous frequency bin distribution' },
  { type: 'box_plot', label: 'Box Plot', category: 'distribution', icon: <Sliders className="h-3.5 w-3.5 text-amber-600" />, description: 'Quartile spread & outlier detection' },
  
  { type: 'scatter', label: 'Scatter', category: 'correlation', icon: <Activity className="h-3.5 w-3.5 text-blue-600" />, description: '2D bivariate correlation plot' },
  { type: 'bubble', label: 'Bubble', category: 'correlation', icon: <Circle className="h-3.5 w-3.5 text-rose-600" />, description: 'Multi-variable 3D bubble correlation' },
  { type: 'heatmap', label: 'Heatmap', category: 'correlation', icon: <Flame className="h-3.5 w-3.5 text-orange-600" />, description: '2D cross-tabulation intensity matrix' },
  
  { type: 'kpi', label: 'KPI', category: 'summary', icon: <Hash className="h-3.5 w-3.5 text-emerald-600" />, description: 'Single aggregated scalar value card' },
  { type: 'table', label: 'Table', category: 'summary', icon: <TableIcon className="h-3.5 w-3.5 text-slate-600" />, description: 'Tabular data view' },
  { type: 'insight_card', label: 'Insight', category: 'summary', icon: <Award className="h-3.5 w-3.5 text-amber-500" />, description: 'AI Summary highlight card' },
];

// Custom Treemap node content renderer
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, index, name, value } = props;
  if (!width || !height || width < 24 || height < 18) return null;
  const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#ffffff',
          strokeWidth: 2,
          rx: 6,
          ry: 6,
          opacity: 0.92,
        }}
      />
      {width > 42 && height > 28 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (height > 45 ? 6 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={11}
          fontWeight="bold"
          fontFamily="Inter, sans-serif"
        >
          {String(name).length > 12 ? String(name).slice(0, 10) + '…' : name}
        </text>
      )}
      {width > 50 && height > 45 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.85)"
          fontSize={10}
          fontFamily="Inter, sans-serif"
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </text>
      )}
    </g>
  );
};

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
  const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('all');
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

  // Helper for Stacked Bar & Stacked Area Multi-Series Pivoting
  const getPivotedData = () => {
    const numCols = columns.filter((c) => data.some((r) => typeof r[c] === 'number' && !isNaN(r[c])));
    const catCols = columns.filter((c) => !numCols.includes(c));

    // If dataset has 2+ numeric columns, stack those metrics directly!
    if (numCols.length >= 2) {
      return {
        pivotedData: data,
        seriesKeys: numCols.slice(0, 5),
        primaryXKey: actualXKey,
      };
    }

    // If dataset has 2+ categorical columns and 1 numeric column, pivot by catCols[0] (X) and catCols[1] (Group)
    if (catCols.length >= 2 && numCols.length >= 1) {
      const xCol = catCols[0];
      const groupCol = catCols[1];
      const valCol = numCols[0];

      const groups = Array.from(new Set(data.map((r) => String(r[groupCol] || 'Other')))).slice(0, 5);
      const rowMap: Record<string, Record<string, any>> = {};

      data.forEach((r) => {
        const xVal = String(r[xCol] || 'Unknown');
        const grpVal = String(r[groupCol] || 'Other');
        const numVal = Number(r[valCol]) || 0;

        if (!rowMap[xVal]) {
          rowMap[xVal] = { [xCol]: xVal };
          groups.forEach((g) => (rowMap[xVal][g] = 0));
        }
        if (rowMap[xVal][grpVal] !== undefined) {
          rowMap[xVal][grpVal] += numVal;
        }
      });

      return {
        pivotedData: Object.values(rowMap),
        seriesKeys: groups,
        primaryXKey: xCol,
      };
    }

    // Fallback: single metric series
    return {
      pivotedData: data,
      seriesKeys: [actualYKey],
      primaryXKey: actualXKey,
    };
  };

  // Helper for Box Plot Stats Calculation
  const getBoxPlotStats = () => {
    const numericVals = data
      .map((r) => Number(r[actualYKey]))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    if (numericVals.length === 0) {
      return { min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0, outliers: [], count: 0 };
    }

    const getPercentile = (arr: number[], p: number) => {
      const idx = (arr.length - 1) * p;
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      const weight = idx - lower;
      if (lower === upper) return arr[lower];
      return arr[lower] * (1 - weight) + arr[upper] * weight;
    };

    const min = numericVals[0];
    const max = numericVals[numericVals.length - 1];
    const q1 = getPercentile(numericVals, 0.25);
    const median = getPercentile(numericVals, 0.5);
    const q3 = getPercentile(numericVals, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers = numericVals.filter((v) => v < lowerBound || v > upperBound);

    return { min, q1, median, q3, max, iqr, outliers, count: numericVals.length };
  };

  // Helper for Bubble Chart Multi-Variable Sizing Data Preparation
  const getBubbleData = () => {
    const numCols = columns.filter((c) => data.some((r) => typeof r[c] === 'number' && !isNaN(r[c])));
    const xCol = numCols[0] || actualXKey;
    const yCol = numCols[1] || actualYKey;
    const zCol = numCols[2] || numCols[0] || actualYKey;

    const bubblePoints = data.map((r, i) => ({
      x: Number(r[xCol]) || i + 1,
      y: Number(r[yCol]) || 0,
      z: Math.max(10, Math.abs(Number(r[zCol]) || 10)),
      name: String(r[actualXKey] || `Record ${i + 1}`),
    }));

    return { bubblePoints, xCol, yCol, zCol };
  };

  const isRechartsChart = [
    'bar',
    'bar_horizontal',
    'bar_stacked',
    'line',
    'area',
    'area_stacked',
    'pie',
    'donut',
    'scatter',
    'histogram',
    'bubble',
    'treemap',
  ].includes(chartType);

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

      // 3. Stacked Bar Chart
      case 'bar_stacked': {
        const { pivotedData, seriesKeys, primaryXKey } = getPivotedData();
        return (
          <BarChart data={pivotedData} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={primaryXKey} {...AXIS_STYLE} tickLine={false} axisLine={false} angle={-18} textAnchor="end" dy={4} />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => [formatTooltip(value), String(name).replace(/_/g, ' ')]} />
            <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
            {seriesKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="stackedGroup"
                fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                radius={idx === seriesKeys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        );
      }

      // 4. Line Chart
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
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ fill: '#fff', stroke: '#2563eb', strokeWidth: 2.5, r: 4 }}
              activeDot={{ r: 7, fill: '#2563eb', stroke: '#fff', strokeWidth: 2.5, filter: 'url(#lineGlow)' }}
            />
          </LineChart>
        );

      // 5. Area Chart
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id="areaGradMain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                <stop offset="60%" stopColor="#2563eb" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
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
              stroke="#2563eb"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#areaGradMain)"
              dot={{ fill: '#fff', stroke: '#2563eb', strokeWidth: 2, r: 3.5 }}
              activeDot={{ r: 6.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        );

      // 6. Stacked Area Chart
      case 'area_stacked': {
        const { pivotedData, seriesKeys, primaryXKey } = getPivotedData();
        return (
          <AreaChart data={pivotedData} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey={primaryXKey} {...AXIS_STYLE} tickLine={false} axisLine={false} angle={-18} textAnchor="end" dy={4} />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatValue} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => [formatTooltip(value), String(name).replace(/_/g, ' ')]} />
            <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
            {seriesKeys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="stackedAreaGroup"
                stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                fillOpacity={0.4}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );
      }

      // 7. Pie & Donut Chart
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
              label={({ name, percent }) => `${String(name).slice(0, 10)} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            >
              {data.map((_, index) => (
                <Cell key={`pie-${index}`} fill={`url(#pieGrad${index})`} />
              ))}
            </Pie>
          </PieChart>
        );
      }

      // 8. Treemap
      case 'treemap': {
        const catCol = columns.find((c) => data.some((r) => typeof r[c] === 'string')) || actualXKey;
        const numCol = columns.find((c) => data.some((r) => typeof r[c] === 'number')) || actualYKey;

        const treemapData = data.slice(0, 15).map((r, i) => ({
          name: String(r[catCol] || `Item ${i + 1}`),
          size: Math.max(1, Math.abs(Number(r[numCol]) || 1)),
          value: Number(r[numCol]) || 0,
        }));

        return (
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#ffffff"
            content={<CustomTreemapContent />}
          >
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => [formatTooltip(value), String(name).replace(/_/g, ' ')]}
            />
          </Treemap>
        );
      }

      // 9. Box Plot
      case 'box_plot': {
        const stats = getBoxPlotStats();
        return (
          <div className="h-full w-full flex flex-col justify-between p-4 bg-slate-50/60 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-violet-600 shrink-0" />
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Box Plot Distribution — {actualYKey.replace(/_/g, ' ')}
                </span>
              </div>
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                n = {stats.count}
              </span>
            </div>

            {/* Box & Whisker Visual Graphic */}
            <div className="relative flex-1 flex items-center justify-center my-2 min-h-[140px] px-6">
              <div className="w-full max-w-lg relative flex items-center justify-center py-6">
                {/* Whisker Line */}
                <div className="w-full h-1 bg-slate-300 rounded-full relative flex items-center">
                  {/* Min Tick */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 bg-slate-600 rounded-full" title={`Min: ${formatTooltip(stats.min)}`} />
                  {/* Max Tick */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1.5 bg-slate-600 rounded-full" title={`Max: ${formatTooltip(stats.max)}`} />

                  {/* Interquartile Box (Q1 to Q3) */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-16 bg-gradient-to-r from-blue-500 via-indigo-600 to-violet-600 border-2 border-blue-700 rounded-xl shadow-md flex items-center justify-center"
                    style={{ left: '20%', width: '60%' }}
                  >
                    {/* Median Line */}
                    <div className="w-1.5 h-full bg-amber-400 rounded-full shadow-sm" title={`Median: ${formatTooltip(stats.median)}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              {[
                { label: 'Min', val: stats.min, color: 'text-slate-700' },
                { label: 'Q1 (25%)', val: stats.q1, color: 'text-blue-600' },
                { label: 'Median', val: stats.median, color: 'text-amber-600 font-black' },
                { label: 'Q3 (75%)', val: stats.q3, color: 'text-blue-600' },
                { label: 'Max', val: stats.max, color: 'text-slate-700' },
                { label: 'Outliers', val: stats.outliers.length, color: stats.outliers.length > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600' },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-slate-200 rounded-lg p-2 shadow-xs">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</div>
                  <div className={`font-mono text-xs font-extrabold mt-0.5 ${m.color}`}>
                    {typeof m.val === 'number' ? formatValue(m.val) : String(m.val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // 10. Bubble Chart
      case 'bubble': {
        const { bubblePoints, xCol, yCol, zCol } = getBubbleData();
        return (
          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" name={xCol} stroke="#64748b" fontSize={11} tickFormatter={formatValue} />
            <YAxis type="number" dataKey="y" name={yCol} stroke="#64748b" fontSize={11} tickFormatter={formatValue} />
            <ZAxis type="number" dataKey="z" range={[120, 1200]} name={zCol} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '10px', color: '#f8fafc', fontSize: '12px' }}
              formatter={(value: any, name: any) => [formatTooltip(value), String(name).replace(/_/g, ' ')]}
            />
            <Scatter name="Bubble Data" data={bubblePoints} fill="#2563eb" fillOpacity={0.65} stroke="#1d4ed8" strokeWidth={1.5} />
          </ScatterChart>
        );
      }

      // 11. Table View
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

      // 12. KPI / Metric Card
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

      // 13. Scatter Plot
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
            <Scatter name="Data Points" data={scatterData} fill="#2563eb" />
          </ScatterChart>
        );
      }

      // 14. Histogram
      case 'histogram': {
        const binData = getHistogramData();
        return (
          <BarChart data={binData} margin={{ top: 12, right: 16, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={1} />
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

      // 15. Heatmap / Matrix
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
                            style={{ backgroundColor: `rgba(37, 99, 235, ${opacity})` }}
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

      // 16. 🏆 Insight Card (AI Summary)
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

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-soft-xs overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 pt-4 pb-3 border-b border-[#f0f0ef] gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 truncate" title={initialConfig?.title}>
            {initialConfig?.title || 'Interactive Visualization'}
          </h3>
          {initialConfig?.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{initialConfig.description}</p>
          )}
        </div>
        {headerActions && (
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
          </div>
        )}
      </div>

      {/* 🌟 Sleek, Uncluttered 1-Line Control Bar */}
      {!hideControls && (
        <div className="px-5 py-2.5 bg-[#fcfcfc] border-b border-[#f0f0ef] flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Active Chart Dropdown + AI Best Match + Alternatives */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Chart Selector Dropdown */}
            <div className="relative flex items-center">
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="bg-slate-900 text-white font-bold border border-slate-900 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-soft-xs cursor-pointer appearance-none pr-7"
              >
                {SELECTOR_ITEMS.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label} ({item.category.toUpperCase()})
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 pointer-events-none text-slate-300">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* AI Recommendation Badge */}
            {autoRecommendation.type === chartType && (
              <span className="flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg shrink-0">
                <Sparkles className="h-3 w-3 text-blue-600" />
                <span>AI Best Match</span>
              </span>
            )}

            {/* Recommended Alternatives (Pill Badges) */}
            {autoRecommendation.alternatives && autoRecommendation.alternatives.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Alternatives:</span>
                <div className="flex flex-wrap items-center gap-1">
                  {autoRecommendation.alternatives.slice(0, 3).map((alt) => {
                    const item = SELECTOR_ITEMS.find((s) => s.type === alt.type);
                    if (!item) return null;
                    const isSelected = chartType === alt.type;
                    return (
                      <button
                        key={alt.type}
                        onClick={() => setChartType(alt.type)}
                        title={alt.reason}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Axis Selectors + Pin Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <select
                value={actualXKey}
                onChange={(e) => setXAxisKey(e.target.value)}
                className="bg-white text-slate-700 font-semibold border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none max-w-[110px] truncate cursor-pointer shadow-2xs"
                title={`X Axis: ${actualXKey}`}
              >
                {columns.map((col) => (
                  <option key={col} value={col}>X: {col}</option>
                ))}
              </select>
              <select
                value={actualYKey}
                onChange={(e) => setYAxisKey(e.target.value)}
                className="bg-white text-slate-700 font-semibold border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none max-w-[110px] truncate cursor-pointer shadow-2xs"
                title={`Y Axis: ${actualYKey}`}
              >
                {columns.map((col) => (
                  <option key={col} value={col}>Y: {col}</option>
                ))}
              </select>
            </div>
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
      )}

      {/* Chart canvas — taller for better visual impact */}
      <div className="h-[350px] w-full px-2 pb-2 pt-1">
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
            <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span><strong className="text-slate-700">Takeaway:</strong> {insight}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-500 font-medium">{autoRecommendation.explanation}</p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-slate-400 font-mono truncate pr-2">
            {queryText ? `> ${queryText}` : `${data.length} records`}
          </span>
          <span className="text-[10px] text-slate-500 bg-[#f5f5f4] border border-[#ebebeb] px-2 py-0.5 rounded font-bold shrink-0">
            {autoRecommendation.intent}
          </span>
        </div>
      </div>
    </div>
  );
};
