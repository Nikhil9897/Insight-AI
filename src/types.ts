export type DataType = 'number' | 'string' | 'datetime' | 'boolean';

export interface ColumnProfile {
  name: string;
  type: DataType;
  sampleValues: (string | number | boolean | null)[];
  nullCount: number;
  distinctCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  topValue?: string | number;
  topCount?: number;
}

export interface HealthCheckItem {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DatasetSummary {
  rowCount: number;
  columnCount: number;
  missingCellsCount: number;
  duplicateRowsCount: number;
  columns: ColumnProfile[];
  healthScore?: number;
  healthChecks?: HealthCheckItem[];
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  currencyCode?: string;
  data: Record<string, any>[];
  summary: DatasetSummary;
  aiProfile?: {
    overview: string;
    businessDomain: string;
    suggestedQuestions: string[];
    keyMetrics: string[];
    executiveSummary?: {
      keyGrowthDrivers: string[];
      operationalRisks: string[];
      topPerformingSegments: string[];
      strategicRecommendations: string[];
    };
  };
  uploadedAt: string;
  isSample?: boolean;
}

export type ChartType =
  | 'bar'
  | 'bar_horizontal'
  | 'bar_stacked'
  | 'line'
  | 'area'
  | 'area_stacked'
  | 'pie'
  | 'donut'
  | 'treemap'
  | 'box_plot'
  | 'bubble'
  | 'table'
  | 'kpi'
  | 'scatter'
  | 'histogram'
  | 'heatmap'
  | 'insight_card';

export interface ChartConfig {
  type: ChartType;
  xAxisKey: string;
  yAxisKey: string | string[];
  title: string;
  description?: string;
  groupBy?: string;
  subTitle?: string;
  delta?: string;
  badge?: string;
  alternativeCharts?: string[];
  chartRankings?: { chart: string; score: number }[];
}

export interface AgenticAttempt {
  attemptNumber: number;
  generatedSql: string;
  status: 'success' | 'error';
  errorMessage?: string;
  reflectionNote?: string;
}

export interface PerformanceBreakdown {
  plannerMs?: number;
  semanticSearchMs?: number;
  sqlBuildMs?: number;
  duckdbMs?: number;
  insightMs?: number;
  llmMs: number;
  sqlMs?: number;
  vizMs: number;
  totalMs: number;
}

export interface DeterministicStats {
  peakCategory?: string;
  peakValue?: number;
  peakSharePct?: number | string;
  runnerUpCategory?: string;
  runnerUpValue?: number;
  differenceFromRunnerUpPct?: number | string;
  totalSum?: number;
  average?: number;
}

/** Structured Intermediate Representation produced by the IntentParser */
export interface QueryIR {
  intent: string;
  aggregation: string | null;
  count_type: string | null;
  metric: string | null;
  metrics: string[];
  dimensions: string[];
  filters: Array<{
    column: string;
    operator: string;
    value?: any;
    value2?: any;
  }>;
  sort: { column: string; direction: 'ASC' | 'DESC' } | null;
  limit: number | null;
  time_filter: { type: string; unit: string; offset: number } | null;
  time_granularity: string | null;
  statistical_function: string | null;
  is_data_quality: boolean;
  is_metadata: boolean;
  data_quality_type: string | null;
  chart: string | null;
  confidence: number;
  confidence_flags: string[];
  raw_query: string;
  matched_columns: Record<string, string>;
}

export interface QueryResult {
  query: string;
  sql: string;
  rows: Record<string, any>[];
  columns: string[];
  explanation: string;
  chartConfig?: ChartConfig;
  businessInsights: string[];
  executionTimeMs: number;
  agenticLog: AgenticAttempt[];
  timestamp: string;
  // Enhanced features
  confidenceScore?: number;
  confidenceReasons?: string[];
  querySteps?: string[];
  followUpQuestions?: string[];
  performanceBreakdown?: PerformanceBreakdown;
  chartExplanation?: string;
  executionPath?: string;
  deterministicStats?: DeterministicStats;
  /** Structured IR produced by the deterministic IntentParser */
  queryIR?: QueryIR;
}

/** Response from the conversational /api/analytics/chat endpoint */
export interface ChatResult {
  query: string;
  answer: string;
  queryType: 'conversational' | 'schema' | 'exploratory';
  followUpQuestions: string[];
  executionTimeMs: number;
  timestamp: string;
}

export interface QueryHistoryItem {
  id: string;
  datasetId: string;
  datasetName: string;
  userQuery: string;
  sql: string;
  resultRowCount: number;
  status: 'success' | 'error';
  timestamp: string;
  executionTimeMs: number;
  explanation: string;
}

export interface PinnedDashboardItem {
  id: string;
  datasetId?: string;
  datasetName?: string;
  title: string;
  query: string;
  sql: string;
  chartConfig: ChartConfig;
  rows: Record<string, any>[];
  insights: string[];
  width?: 'full' | 'half';
}

export type ConnectorType = 'csv' | 'excel' | 'postgres' | 'mysql' | 'sqlite';

export interface ConnectorConfig {
  sourceType: ConnectorType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}


