import { ChartType } from '../types';

export interface AlternativeRecommendation {
  type: ChartType;
  label: string;
  reason: string;
}

export interface ChartRecommendation {
  type: ChartType;
  label: string;
  xAxisKey: string;
  yAxisKey: string;
  intent: string;
  explanation: string;
  alternatives: AlternativeRecommendation[];
}

/**
 * Intelligent Automatic Chart Selection Engine
 * Selects optimal visualization based on data shape, cardinality, column types, and query intent.
 */
export function determineOptimalChartType(
  data: Record<string, any>[],
  title?: string
): ChartRecommendation {
  if (!data || data.length === 0) {
    return {
      type: 'table',
      label: 'Table View',
      xAxisKey: '',
      yAxisKey: '',
      intent: 'No Data Available',
      explanation: 'No dataset records available for visualization.',
      alternatives: [],
    };
  }

  const columns = Object.keys(data[0]);
  const rowCount = data.length;
  const colCount = columns.length;

  const numCols = columns.filter((c) =>
    data.some((r) => typeof r[c] === 'number' && !isNaN(r[c]))
  );
  const catCols = columns.filter((c) => !numCols.includes(c));

  const isDateCol = (colName: string) => {
    const k = String(colName).toLowerCase();
    return (
      k.includes('month') ||
      k.includes('date') ||
      k.includes('year') ||
      k.includes('time') ||
      k.includes('timestamp') ||
      k.includes('day')
    );
  };

  const dateCol = columns.find(isDateCol);
  const titleLower = (title || '').toLowerCase();

  // Rule 1: Single numeric value total (1 row, 1 numeric col) -> KPI Card
  if (rowCount === 1 && numCols.length === 1 && colCount === 1) {
    return {
      type: 'kpi',
      label: 'KPI Metric Card',
      xAxisKey: columns[0],
      yAxisKey: columns[0],
      intent: 'Single Aggregated Scalar Value',
      explanation: 'Your query returned a single scalar total. A KPI Metric Card is optimal for presenting isolated KPI metrics cleanly.',
      alternatives: [
        { type: 'insight_card', label: 'AI Insight Card', reason: 'Provides a styled metric badge with takeaway subtext' },
        { type: 'table', label: 'Table View', reason: 'Shows raw scalar row' },
      ],
    };
  }

  // Rule 2: Single row result with multiple attributes -> Insight Card (AI Summary)
  if (rowCount === 1) {
    const mainNum = numCols[0] || columns[1] || columns[0];
    const mainCat = catCols[0] || columns[0];
    return {
      type: 'insight_card',
      label: 'AI Insight Card',
      xAxisKey: mainCat,
      yAxisKey: mainNum,
      intent: 'Single Entity / Top Benchmark Record',
      explanation: 'Your query returned a single top entity record. Rendered as a smart AI Insight Card to highlight key attributes.',
      alternatives: [
        { type: 'kpi', label: 'KPI Metric Card', reason: 'Emphasizes primary metric numeric value' },
        { type: 'table', label: 'Data Table', reason: 'Displays all record fields in tabular format' },
      ],
    };
  }

  // Rule 3: Time Series (Date column present or time trend requested) -> Line Chart
  if (dateCol || titleLower.includes('trend') || titleLower.includes('over time') || titleLower.includes('monthly') || titleLower.includes('daily')) {
    const xKey = dateCol || catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'line',
      label: 'Line Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Time-Series & Trajectory Analysis',
      explanation: `Sequential time dimension detected ('${xKey}'). A Line Chart is best suited to reveal growth trajectory over time.`,
      alternatives: [
        { type: 'bar', label: 'Bar Chart', reason: 'Best for comparing discrete period totals side-by-side' },
        { type: 'area', label: 'Area Chart', reason: 'Emphasizes cumulative volume beneath trend curve' },
        { type: 'table', label: 'Data Table', reason: 'Exact dated numeric rows' },
      ],
    };
  }

  // Rule 4: Two Categorical Dimensions + 1 Numeric Column -> Heatmap / Matrix
  if (
    catCols.length >= 2 &&
    numCols.length >= 1 &&
    (titleLower.includes('matrix') || titleLower.includes('heatmap') || titleLower.includes('by region and category') || titleLower.includes('cross'))
  ) {
    return {
      type: 'heatmap',
      label: 'Heatmap Matrix',
      xAxisKey: catCols[0],
      yAxisKey: numCols[0],
      intent: 'Two-Dimensional Cross Comparison',
      explanation: `Two categorical dimensions detected (${catCols[0]} × ${catCols[1]}). Visualized as a Heatmap Matrix for cross-pattern discovery.`,
      alternatives: [
        { type: 'bar', label: 'Bar Chart', reason: 'Category level aggregation' },
        { type: 'table', label: 'Grid Table', reason: 'Exact cross-tabulation numbers' },
      ],
    };
  }

  // Rule 5: Two Numeric Columns -> Scatter Plot
  if (
    numCols.length >= 2 &&
    (titleLower.includes('vs') || titleLower.includes('scatter') || titleLower.includes('correlation') || titleLower.includes('relationship'))
  ) {
    return {
      type: 'scatter',
      label: 'Scatter Plot',
      xAxisKey: numCols[0],
      yAxisKey: numCols[1],
      intent: 'Bivariate Correlation & Distribution',
      explanation: `Query analyzes relationship between '${numCols[0]}' and '${numCols[1]}'. Scatter Plot is ideal for discovering correlations.`,
      alternatives: [
        { type: 'line', label: 'Line Chart', reason: 'Continuous sequence view' },
        { type: 'table', label: 'Data Table', reason: 'Coordinate value pairs' },
      ],
    };
  }

  // Rule 6: Single Numeric Column Distribution -> Histogram
  if (numCols.length === 1 && catCols.length === 0 && rowCount > 5) {
    return {
      type: 'histogram',
      label: 'Frequency Histogram',
      xAxisKey: numCols[0],
      yAxisKey: numCols[0],
      intent: 'Frequency Distribution',
      explanation: `Continuous numerical values detected across attribute '${numCols[0]}'. Frequency Histogram bins range intervals cleanly.`,
      alternatives: [
        { type: 'bar', label: 'Bar Chart', reason: 'Discrete range frequency comparison' },
        { type: 'table', label: 'Data Table', reason: 'Raw frequency values' },
      ],
    };
  }

  // Rule 7: Percentage / Share / Part-of-whole -> Pie / Donut
  if (
    rowCount >= 2 &&
    rowCount <= 6 &&
    (titleLower.includes('share') || titleLower.includes('percentage') || titleLower.includes('split') || titleLower.includes('distribution') || titleLower.includes('proportion') || titleLower.includes('pie'))
  ) {
    const xKey = catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'pie',
      label: 'Pie / Donut Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Proportional Composition & Percentage Breakdown',
      explanation: `Proportional breakdown across ${rowCount} categories. Pie / Donut Chart best illustrates percentage market share.`,
      alternatives: [
        { type: 'bar', label: 'Bar Chart', reason: 'Compare exact numerical magnitudes' },
        { type: 'table', label: 'Data Table', reason: 'Precise share calculations' },
      ],
    };
  }

  // Rule 8: Categorical Comparisons
  const xKey = catCols[0] || columns[0];
  const yKey = numCols[0] || columns[1] || columns[0];

  // >10 categories -> Horizontal Bar Chart
  if (rowCount > 10) {
    return {
      type: 'bar_horizontal',
      label: 'Horizontal Bar Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'High-Cardinality Categorical Ranking',
      explanation: `Query returned ${rowCount} categories (> 10). Horizontal Bar Chart ensures category labels remain legible without truncation.`,
      alternatives: [
        { type: 'bar', label: 'Vertical Bar', reason: 'Standard vertical comparison' },
        { type: 'table', label: 'Sorted Table', reason: 'Ranked tabular list with pagination' },
      ],
    };
  }

  // 2-10 categories -> Vertical Bar Chart
  return {
    type: 'bar',
    label: 'Bar Chart',
    xAxisKey: xKey,
    yAxisKey: yKey,
    intent: 'Categorical Group Comparison',
    explanation: `Query compares '${yKey}' across discrete categories ('${xKey}'). Bar Chart is optimal for clear category contrast.`,
    alternatives: [
      { type: 'pie', label: 'Pie Chart', reason: 'View percentage contribution of each category' },
      { type: 'table', label: 'Data Table', reason: 'Exact numbers per group' },
    ],
  };
}
