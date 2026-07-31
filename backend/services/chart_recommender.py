import re
from typing import List, Dict, Any, Tuple, Optional

def classify_column(col_name: str, sample_values: List[Any]) -> str:
    """
    Classifies a column into one of: 'identifier', 'date', 'numeric', 'boolean', 'categorical', 'text'
    """
    col_lower = col_name.lower()

    # 1. Identifier detection
    if (col_lower.endswith('id') and col_lower != 'customerid') or col_lower in ('id', 'fips', 'code', 'ticket', 'ssn', 'uuid', 'key'):
        return 'identifier'
    if any(k in col_lower for k in ['_id', 'id_', 'number', 'num']) and any(k in col_lower for k in ['customer', 'order', 'emp', 'user', 'prod', 'account']):
        if not any(k in col_lower for k in ['amount', 'price', 'total', 'sales', 'cost', 'fare', 'rate']):
            return 'identifier'

    non_null_samples = [v for v in sample_values if v is not None]
    if non_null_samples:
        first_val = non_null_samples[0]

        # 2. Date/Time detection
        if any(k in col_lower for k in ['date', 'month', 'year', 'day', 'time', 'timestamp', 'created_at', 'updated_at']):
            return 'date'
        if isinstance(first_val, str) and re.match(r'^\d{4}[-/]\d{2}([-/]\d{2})?', first_val.strip()):
            return 'date'

        # 3. Numeric detection
        if isinstance(first_val, (int, float)) and not isinstance(first_val, bool):
            if all(isinstance(v, int) and v > 100000 and col_lower.endswith('id') for v in non_null_samples[:10]):
                return 'identifier'
            return 'numeric'

        # 4. Boolean detection
        if isinstance(first_val, bool) or all(str(v).lower() in ('true', 'false', '0', '1', 'yes', 'no') for v in non_null_samples[:10]):
            return 'boolean'

        # High cardinality text vs categorical
        distinct_count = len(set(non_null_samples))
        if distinct_count > min(50, len(non_null_samples) * 0.85) and any(len(str(v)) > 40 for v in non_null_samples[:5]):
            return 'text'

    return 'categorical'


def recommend_chart(
    user_query: str,
    rows: List[Dict[str, Any]],
    columns: List[str]
) -> Tuple[Dict[str, Any], str]:
    """
    Scoring-Based Visualization Recommendation Engine with Ranked Top 3 & Quality Checks.
    Scores every visualization type (0-100) based on column classifications, row cardinality,
    data shape, quality heuristics, and prompt intent keywords.
    """
    if not rows or not columns:
        default_config = {
            'type': 'table',
            'xAxisKey': columns[0] if columns else 'id',
            'yAxisKey': columns[1] if len(columns) > 1 else (columns[0] if columns else 'value'),
            'title': 'QueryResult Summary',
            'chartRankings': [{'chart': 'table', 'score': 100}],
            'alternativeCharts': []
        }
        return default_config, "Defaulting to Table view for empty result set."

    row_count = len(rows)
    col_count = len(columns)
    query_lower = user_query.lower()

    # Step 1: Detect Column Types
    col_types: Dict[str, str] = {}
    for col in columns:
        samples = [r.get(col) for r in rows[:20]]
        col_types[col] = classify_column(col, samples)

    date_cols = [c for c, t in col_types.items() if t == 'date']
    numeric_cols = [c for c, t in col_types.items() if t == 'numeric']
    categorical_cols = [c for c, t in col_types.items() if t == 'categorical']
    identifier_cols = [c for c, t in col_types.items() if t == 'identifier']
    boolean_cols = [c for c, t in col_types.items() if t == 'boolean']

    primary_x = date_cols[0] if date_cols else (categorical_cols[0] if categorical_cols else (identifier_cols[0] if identifier_cols else columns[0]))
    primary_y = numeric_cols[0] if numeric_cols else (numeric_cols[1] if len(numeric_cols) > 1 else (columns[1] if col_count > 1 else columns[0]))

    # Step 2 & 3: Prompt Intent Keywords
    has_time_intent = bool(re.search(r'\b(trend|over time|monthly|daily|yearly|time series|growth|history|by month|by date)\b', query_lower))
    has_area_intent = bool(re.search(r'\b(area|volume|cumulative|revenue over time|sales volume|profit trend)\b', query_lower))
    has_stacked_bar_intent = bool(re.search(r'\b(stacked|stacked bar|contribution|region and category|employee and year|sales contribution)\b', query_lower))
    has_stacked_area_intent = bool(re.search(r'\b(stacked area|market share over time|revenue contribution|growth by segment)\b', query_lower))
    has_pie_intent = bool(re.search(r'\b(percentage|share|proportion|ratio|composition|breakdown of total)\b', query_lower))
    has_donut_intent = bool(re.search(r'\b(donut|product mix|market share|category distribution|customer segment)\b', query_lower))
    has_treemap_intent = bool(re.search(r'\b(treemap|hierarchy|hierarchical|nested|product categories|supplier contribution|product hierarchy)\b', query_lower))
    has_box_plot_intent = bool(re.search(r'\b(box plot|boxplot|spread|variability|outlier|outliers|quartile|percentile|salary analysis|price distribution|freight distribution)\b', query_lower))
    has_bubble_intent = bool(re.search(r'\b(bubble|price vs quantity|profit vs sales|multi-variable|3-variable|three metrics)\b', query_lower))
    has_top_intent = bool(re.search(r'\b(top|rank|highest|lowest|ranking|best|worst)\b', query_lower))
    has_scatter_intent = bool(re.search(r'\b(relationship|correlation|versus|vs|scatter)\b', query_lower))
    has_hist_intent = bool(re.search(r'\b(distribution|frequency|range|histogram)\b', query_lower))
    has_table_intent = bool(re.search(r'\b(list|show records|raw|all columns|details|transactions|records|preview)\b', query_lower))

    # Step 4: Scoring Engine Matrix (0 - 100)
    scores: Dict[str, int] = {
        'kpi': 0,
        'line': 0,
        'area': 0,
        'area_stacked': 0,
        'bar': 0,
        'bar_horizontal': 0,
        'bar_stacked': 0,
        'pie': 0,
        'donut': 0,
        'treemap': 0,
        'box_plot': 0,
        'bubble': 0,
        'scatter': 0,
        'histogram': 0,
        'heatmap': 0,
        'table': 0,
    }

    # 1. Table Score
    if col_count >= 6:
        scores['table'] += 85
    if len(numeric_cols) == 0:
        scores['table'] += 85
    if len(identifier_cols) >= 1 and len(categorical_cols) == 0 and len(date_cols) == 0:
        scores['table'] += 95
    if has_table_intent:
        scores['table'] += 90
    if row_count > 25:
        scores['table'] += 20
    if not any(k in query_lower for k in ['sum', 'avg', 'count', 'max', 'min', 'by', 'group']):
        scores['table'] += 35

    # 2. KPI Score
    if row_count == 1 and len(numeric_cols) >= 1 and col_count <= 3:
        scores['kpi'] = 98

    # 3. Line, Area, Stacked Area Score
    if len(date_cols) >= 1 and len(numeric_cols) >= 1:
        if row_count >= 4:
            scores['line'] = 94
            scores['area'] = 88
            if has_area_intent:
                scores['area'] = 96
            if len(categorical_cols) >= 1 or len(numeric_cols) >= 2 or has_stacked_area_intent:
                scores['area_stacked'] = 92 if has_stacked_area_intent else 84
        elif 2 <= row_count <= 3:
            scores['line'] = 65
            scores['area'] = 55
        else:
            scores['line'] = 20
            scores['area'] = 15

        if has_time_intent:
            scores['line'] += 6
    else:
        scores['line'] = 5
        scores['area'] = 0
        scores['area_stacked'] = 0

    # 4. Bar, Horizontal Bar & Stacked Bar Score
    if len(categorical_cols) >= 1 and len(numeric_cols) >= 1 and row_count >= 2:
        if row_count <= 8:
            scores['bar'] = 90
            scores['bar_horizontal'] = 82
        elif 9 <= row_count <= 15:
            scores['bar'] = 55
            scores['bar_horizontal'] = 95
        else:
            scores['bar'] = 30
            scores['bar_horizontal'] = 92
            scores['table'] += 15

        if has_top_intent:
            scores['bar_horizontal'] += 10
        if has_stacked_bar_intent or (len(categorical_cols) >= 2 or len(numeric_cols) >= 2):
            scores['bar_stacked'] = 92 if has_stacked_bar_intent else 80
    elif len(columns) >= 2 and len(numeric_cols) >= 1 and row_count >= 2:
        scores['bar'] = 70
        scores['bar_horizontal'] = 75

    if primary_x in identifier_cols:
        scores['bar'] = max(10, scores['bar'] - 65)
        scores['bar_horizontal'] = max(10, scores['bar_horizontal'] - 65)

    # 5. Pie & Donut Score
    if len(categorical_cols) == 1 and len(numeric_cols) >= 1:
        if 2 <= row_count <= 8:
            scores['pie'] = 82
            scores['donut'] = 85
            if has_pie_intent or has_donut_intent:
                scores['donut'] = 95 if has_donut_intent else 90
                scores['pie'] = 90
        elif 9 <= row_count <= 12:
            scores['pie'] = 30
            scores['donut'] = 25
        else:
            scores['pie'] = 0
            scores['donut'] = 0

    if row_count > 12 or len(date_cols) > 0 or primary_x in identifier_cols:
        scores['pie'] = 0
        scores['donut'] = 0

    # 6. Treemap Score
    if len(categorical_cols) >= 1 and len(numeric_cols) >= 1 and row_count >= 3:
        if has_treemap_intent:
            scores['treemap'] = 98
        elif len(categorical_cols) >= 2 or row_count > 10:
            scores['treemap'] = 82
    else:
        scores['treemap'] = 0

    # 7. Box Plot Score
    if len(numeric_cols) >= 1 and row_count >= 5:
        if has_box_plot_intent:
            scores['box_plot'] = 96
        elif len(categorical_cols) == 0 and len(date_cols) == 0 and has_hist_intent:
            scores['box_plot'] = 85
    else:
        scores['box_plot'] = 0

    # 8. Scatter & Bubble Plot Score
    if len(numeric_cols) >= 2:
        scores['scatter'] = 85
        if has_scatter_intent:
            scores['scatter'] = 98
        if len(numeric_cols) >= 3 or has_bubble_intent:
            scores['bubble'] = 96 if has_bubble_intent else 88
    else:
        scores['scatter'] = 0
        scores['bubble'] = 0

    # 9. Histogram Score
    if len(numeric_cols) == 1 and len(categorical_cols) == 0 and len(date_cols) == 0 and row_count > 8:
        scores['histogram'] = 80
        if has_hist_intent:
            scores['histogram'] = 95
    else:
        scores['histogram'] = 0

    # 10. Heatmap Score
    if len(categorical_cols) >= 2 and len(numeric_cols) >= 1 and row_count >= 4:
        scores['heatmap'] = 88
    else:
        scores['heatmap'] = 0

    # Rank All Scores Descending and Clamp Max Score at 100
    clamped_scores = {k: min(100, v) for k, v in scores.items()}
    ranked_tuples = sorted(clamped_scores.items(), key=lambda x: x[1], reverse=True)
    best_chart, best_score = ranked_tuples[0]

    # Format top 3 rankings for UI presentation
    chart_rankings = [{'chart': item[0], 'score': item[1]} for item in ranked_tuples[:4] if item[1] > 0]
    alternative_charts = [item[0] for item in ranked_tuples[1:4] if item[1] > 20]

    # Resolve X & Y Axis Keys for Best Chart
    if best_chart in ('line', 'area', 'area_stacked'):
        x_key = date_cols[0] if date_cols else primary_x
        y_key = numeric_cols[0] if numeric_cols else primary_y
    elif best_chart in ('scatter', 'bubble'):
        x_key = numeric_cols[0] if numeric_cols else primary_x
        y_key = numeric_cols[1] if len(numeric_cols) > 1 else primary_y
    elif best_chart in ('bar', 'bar_horizontal', 'bar_stacked', 'pie', 'donut', 'treemap'):
        x_key = categorical_cols[0] if categorical_cols else (columns[0] if columns else 'category')
        y_key = numeric_cols[0] if numeric_cols else (columns[1] if len(columns) > 1 else 'value')
    elif best_chart in ('box_plot', 'histogram'):
        x_key = categorical_cols[0] if categorical_cols else (numeric_cols[0] if numeric_cols else primary_x)
        y_key = numeric_cols[0] if numeric_cols else primary_y
    elif best_chart == 'kpi':
        x_key = columns[0]
        y_key = numeric_cols[0] if numeric_cols else columns[0]
    else:  # Table
        x_key = columns[0]
        y_key = columns[1] if len(columns) > 1 else columns[0]

    chart_config = {
        'type': best_chart,
        'xAxisKey': x_key,
        'yAxisKey': y_key,
        'title': f"{user_query.capitalize()} Visualization",
        'description': f"Recommended {best_chart.upper()} chart (Confidence Score: {best_score}/100).",
        'chartRankings': chart_rankings,
        'alternativeCharts': alternative_charts
    }

    alt_str = f" Alternatives: {', '.join([c.replace('_', ' ').title() for c in alternative_charts[:2]])}." if alternative_charts else ""

    explanation = (
        f"⭐ AI Recommended {best_chart.replace('_', ' ').upper()} ({best_score}/100) based on "
        f"{len(categorical_cols)} categorical, {len(numeric_cols)} numeric, and {len(date_cols)} date attribute(s) across {row_count} rows.{alt_str}"
    )

    return chart_config, explanation
