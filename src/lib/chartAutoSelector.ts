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
 * Supports 7 Enterprise Chart Types: Area, Stacked Bar, Stacked Area, Donut, Treemap, Box Plot, Bubble.
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

  // Rule 3: Box Plot (Distribution, spread, salary, price distribution, freight, outliers)
  if (
    titleLower.includes('box plot') ||
    titleLower.includes('boxplot') ||
    titleLower.includes('outlier') ||
    titleLower.includes('spread') ||
    titleLower.includes('variability') ||
    titleLower.includes('quartile') ||
    titleLower.includes('salary analysis') ||
    titleLower.includes('price distribution') ||
    titleLower.includes('freight distribution')
  ) {
    const yKey = numCols[0] || columns[1] || columns[0];
    const xKey = catCols[0] || columns[0];
    return {
      type: 'box_plot',
      label: 'Box Plot',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Statistical Metric Spread & Outlier Detection',
      explanation: `Box Plot selected because query evaluates continuous metric variability, quartile distribution, and outlier detection for '${yKey}'.`,
      alternatives: [
        { type: 'histogram', label: 'Frequency Histogram', reason: 'Fallback to frequency binning' },
        { type: 'bar', label: 'Bar Chart', reason: 'Compare aggregated mean or median per group' },
        { type: 'table', label: 'Data Table', reason: 'Raw metric distribution values' },
      ],
    };
  }

  // Rule 4: Bubble Chart (3 numeric columns or multi-variable correlation prompt)
  if (
    numCols.length >= 3 ||
    titleLower.includes('bubble') ||
    titleLower.includes('price vs quantity') ||
    titleLower.includes('profit vs sales vs discount') ||
    (numCols.length >= 2 && titleLower.includes('3-variable'))
  ) {
    const xKey = numCols[0] || columns[0];
    const yKey = numCols[1] || columns[1] || columns[0];
    const zKey = numCols[2] || numCols[0];
    return {
      type: 'bubble',
      label: 'Bubble Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Multi-Variable Correlation (X, Y, Size)',
      explanation: `Bubble Chart selected because multi-variable correlation across three numeric metrics ('${xKey}', '${yKey}', and '${zKey}') was detected.`,
      alternatives: [
        { type: 'scatter', label: 'Scatter Plot', reason: 'Fallback to 2D scatter plot without bubble sizing' },
        { type: 'line', label: 'Line Chart', reason: 'Sequential trend view' },
        { type: 'table', label: 'Data Table', reason: 'Tabular view of all variables' },
      ],
    };
  }

  // Rule 5: Treemap (Hierarchical categories, nested entities, supplier contribution, treemap keyword)
  if (
    titleLower.includes('treemap') ||
    titleLower.includes('hierarchy') ||
    titleLower.includes('hierarchical') ||
    titleLower.includes('product hierarchy') ||
    titleLower.includes('supplier contribution') ||
    (catCols.length >= 2 && (titleLower.includes('nested') || titleLower.includes('by category and subcategory') || rowCount > 12))
  ) {
    const xKey = catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'treemap',
      label: 'Treemap',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Hierarchical Categorical Composition',
      explanation: `Treemap selected because the query compares hierarchical product categories.`,
      alternatives: [
        { type: 'bar', label: 'Bar Chart', reason: 'Fallback to standard categorical comparison' },
        { type: 'bar_horizontal', label: 'Horizontal Bar', reason: 'Ranked bar layout' },
        { type: 'table', label: 'Data Table', reason: 'Exact numbers per hierarchical node' },
      ],
    };
  }

  // Rule 6: Stacked Area Chart (Time-series with multiple categories or cumulative composition over time)
  if (
    (dateCol || titleLower.includes('trend') || titleLower.includes('over time')) &&
    (titleLower.includes('stacked area') || titleLower.includes('market share over time') || titleLower.includes('revenue contribution') || titleLower.includes('growth by segment') || numCols.length >= 2)
  ) {
    const xKey = dateCol || catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'area_stacked',
      label: 'Stacked Area Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Multi-Segment Cumulative Volume over Time',
      explanation: `Stacked Area Chart selected because time-series with multi-segment category composition detected ('${xKey}').`,
      alternatives: [
        { type: 'area', label: 'Area Chart', reason: 'Fallback to single series area chart' },
        { type: 'line', label: 'Line Chart', reason: 'Individual trend lines' },
        { type: 'bar_stacked', label: 'Stacked Bar Chart', reason: 'Discrete stacked period totals' },
      ],
    };
  }

  // Rule 7: Area Chart (Revenue over time, monthly sales, profit trends, continuous time-series)
  if (
    (dateCol || titleLower.includes('over time') || titleLower.includes('monthly') || titleLower.includes('daily')) &&
    (titleLower.includes('area') || titleLower.includes('revenue over time') || titleLower.includes('sales volume') || titleLower.includes('profit trend') || titleLower.includes('volume'))
  ) {
    const xKey = dateCol || catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'area',
      label: 'Area Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Continuous Volume & Trajectory Analysis',
      explanation: `Area Chart selected because continuous time dimension detected ('${xKey}') with focus on cumulative volume magnitude over time.`,
      alternatives: [
        { type: 'line', label: 'Line Chart', reason: 'Standard continuous line view' },
        { type: 'bar', label: 'Bar Chart', reason: 'Discrete period comparison' },
        { type: 'table', label: 'Data Table', reason: 'Dated tabular rows' },
      ],
    };
  }

  // Rule 8: Standard Line Chart (Time Series)
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
        { type: 'area', label: 'Area Chart', reason: 'Emphasizes cumulative volume beneath trend curve' },
        { type: 'bar', label: 'Bar Chart', reason: 'Best for comparing discrete period totals side-by-side' },
        { type: 'table', label: 'Data Table', reason: 'Exact dated numeric rows' },
      ],
    };
  }

  // Rule 9: Stacked Bar Chart (Category + Group / Region + Category / Employee + Year)
  if (
    titleLower.includes('stacked') ||
    titleLower.includes('revenue by region and category') ||
    titleLower.includes('orders by employee and year') ||
    titleLower.includes('sales contribution') ||
    (catCols.length >= 2 && (titleLower.includes('contribution') || titleLower.includes('by region') || titleLower.includes('by category')))
  ) {
    const xKey = catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'bar_stacked',
      label: 'Stacked Bar Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Multi-Group Segment Contribution',
      explanation: `Stacked Bar Chart selected because query compares multi-group categorical breakdown ('${xKey}' by category).`,
      alternatives: [
        { type: 'bar', label: 'Bar Chart', reason: 'Fallback to standard bar chart' },
        { type: 'heatmap', label: 'Heatmap Matrix', reason: 'Matrix intensity view' },
        { type: 'table', label: 'Data Table', reason: 'Grouped breakdown rows' },
      ],
    };
  }

  // Rule 10: Donut Chart (Category distribution, market share, customer segments, product mix, <=8 categories)
  if (
    rowCount >= 2 &&
    rowCount <= 8 &&
    (titleLower.includes('donut') || titleLower.includes('product mix') || titleLower.includes('market share') || titleLower.includes('category distribution') || titleLower.includes('customer segment') || titleLower.includes('proportion'))
  ) {
    const xKey = catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'donut',
      label: 'Donut Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Category Share & Donut Distribution',
      explanation: `Donut Chart selected because query compares percentage distribution across ${rowCount} discrete categories.`,
      alternatives: [
        { type: 'pie', label: 'Pie Chart', reason: 'Fallback to standard pie layout' },
        { type: 'bar', label: 'Bar Chart', reason: 'Compare exact numerical magnitudes' },
        { type: 'table', label: 'Data Table', reason: 'Precise share calculations' },
      ],
    };
  }

  // Rule 11: Two Categorical Dimensions + 1 Numeric Column -> Heatmap / Matrix
  if (
    catCols.length >= 2 &&
    numCols.length >= 1 &&
    (titleLower.includes('matrix') || titleLower.includes('heatmap') || titleLower.includes('cross'))
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

  // Rule 12: Two Numeric Columns -> Scatter Plot
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

  // Rule 13: Single Numeric Column Distribution -> Histogram
  if (numCols.length === 1 && catCols.length === 0 && rowCount > 5) {
    return {
      type: 'histogram',
      label: 'Frequency Histogram',
      xAxisKey: numCols[0],
      yAxisKey: numCols[0],
      intent: 'Frequency Distribution',
      explanation: `Continuous numerical values detected across attribute '${numCols[0]}'. Frequency Histogram bins range intervals cleanly.`,
      alternatives: [
        { type: 'box_plot', label: 'Box Plot', reason: 'Quartile distribution and outlier detection' },
        { type: 'bar', label: 'Bar Chart', reason: 'Discrete range frequency comparison' },
        { type: 'table', label: 'Data Table', reason: 'Raw frequency values' },
      ],
    };
  }

  // Rule 14: Percentage / Share / Part-of-whole -> Pie / Donut
  if (
    rowCount >= 2 &&
    rowCount <= 6 &&
    (titleLower.includes('share') || titleLower.includes('percentage') || titleLower.includes('split') || titleLower.includes('distribution') || titleLower.includes('pie'))
  ) {
    const xKey = catCols[0] || columns[0];
    const yKey = numCols[0] || columns[1] || columns[0];
    return {
      type: 'pie',
      label: 'Pie Chart',
      xAxisKey: xKey,
      yAxisKey: yKey,
      intent: 'Proportional Composition & Percentage Breakdown',
      explanation: `Proportional breakdown across ${rowCount} categories. Pie Chart best illustrates percentage market share.`,
      alternatives: [
        { type: 'donut', label: 'Donut Chart', reason: 'Hollow center distribution view' },
        { type: 'bar', label: 'Bar Chart', reason: 'Compare exact numerical magnitudes' },
        { type: 'table', label: 'Data Table', reason: 'Precise share calculations' },
      ],
    };
  }

  // Rule 15: Categorical Comparisons
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
        { type: 'treemap', label: 'Treemap', reason: 'Hierarchical space-filling breakdown' },
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
      { type: 'donut', label: 'Donut Chart', reason: 'View donut percentage distribution' },
      { type: 'table', label: 'Data Table', reason: 'Exact numbers per group' },
    ],
  };
}

