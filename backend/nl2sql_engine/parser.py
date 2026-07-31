import re
from typing import List, Dict, Any, Optional
from backend.nl2sql_engine.ir import QueryIR
from backend.nl2sql_engine.resolver import SchemaResolver

class IntentParser:
    """
    Deterministic Query Intent Parser & Entity Extractor.
    Extracts metrics, dimensions, aggregations, date granularity, filters, limits, and chart type.
    """

    @classmethod
    def parse_query(cls, query: str, available_columns: List[str], column_types: Dict[str, str]) -> QueryIR:
        q_lower = query.lower()
        ir = QueryIR(raw_query=query)

        # 1. Stat Function Detection
        if re.search(r'\b(average|avg|mean)\b', q_lower):
            ir.stat_fn = 'AVG'
        elif re.search(r'\b(count|number of|total number|how many)\b', q_lower):
            ir.stat_fn = 'COUNT'
        elif re.search(r'\b(max|maximum|highest|top|most)\b', q_lower):
            ir.stat_fn = 'MAX'
        elif re.search(r'\b(min|minimum|lowest|least|bottom)\b', q_lower):
            ir.stat_fn = 'MIN'
        else:
            ir.stat_fn = 'SUM'

        # 2. Date Granularity Detection
        if re.search(r'\b(monthly|by month|per month)\b', q_lower):
            ir.time_granularity = 'month'
        elif re.search(r'\b(yearly|by year|per year|annually)\b', q_lower):
            ir.time_granularity = 'year'
        elif re.search(r'\b(daily|by day|per day)\b', q_lower):
            ir.time_granularity = 'day'
        elif re.search(r'\b(quarterly|by quarter)\b', q_lower):
            ir.time_granularity = 'quarter'

        # 3. Limit Detection
        limit_match = re.search(r'\b(top|first|limit)\s+(\d+)\b', q_lower)
        if limit_match:
            ir.limit = int(limit_match.group(2))

        # 4. Chart Intent Detection
        if re.search(r'\bdonut\b', q_lower):
            ir.chart = 'donut'
        elif re.search(r'\bpie\b', q_lower):
            ir.chart = 'pie'
        elif re.search(r'\bbubble\b', q_lower):
            ir.chart = 'bubble'
        elif re.search(r'\bbox\s*plot\b|\bboxplot\b|\boutliers?\b', q_lower):
            ir.chart = 'box_plot'
        elif re.search(r'\bstacked\s*area\b', q_lower):
            ir.chart = 'area_stacked'
        elif re.search(r'\bstacked\s*bar\b|\bstacked\b', q_lower):
            ir.chart = 'bar_stacked'
        elif re.search(r'\barea\b', q_lower):
            ir.chart = 'area'
        elif re.search(r'\btreemap\b|\bhierarchy\b', q_lower):
            ir.chart = 'treemap'
        elif re.search(r'\bscatter\b', q_lower):
            ir.chart = 'scatter'
        elif re.search(r'\bline\b|\btrend\b', q_lower):
            ir.chart = 'line'
        elif re.search(r'\bbar\b', q_lower):
            ir.chart = 'bar'

        # 5. Extract Candidate Tokens and Fuzzy Grounding against Available Columns
        tokens = [t.strip(',.?!') for t in q_lower.split() if len(t.strip(',.?!')) > 2]
        
        raw_metrics = []
        raw_dims = []

        # Find potential metric & dimension column candidates
        num_cols = [c for c, t in column_types.items() if any(nt in str(t).lower() for nt in ('int', 'float', 'double', 'number', 'decimal', 'numeric'))]
        cat_cols = [c for c in available_columns if c not in num_cols]
        date_cols = [c for c in available_columns if any(dk in c.lower() for dk in ('date', 'time', 'year', 'month', 'timestamp'))]

        for token in tokens:
            resolved = SchemaResolver.resolve_column(token, available_columns)
            if resolved:
                if resolved in date_cols:
                    if resolved not in ir.date_cols:
                        ir.date_cols.append(resolved)
                elif resolved in num_cols:
                    if resolved not in raw_metrics:
                        raw_metrics.append(resolved)
                else:
                    is_id = any(id_k in resolved.lower() for id_k in ('id', 'uuid', 'code', 'number'))
                    if resolved not in raw_dims and not is_id:
                        raw_dims.append(resolved)

        # Fallback defaults if no direct column mentioned
        if not raw_metrics and num_cols:
            raw_metrics.append(num_cols[0])
        
        has_grouping = bool(re.search(r'\b(by|per|each|across|breakdown)\b', q_lower))
        if not raw_dims and cat_cols and has_grouping:
            # Pick non-identifier categorical column
            clean_cats = [c for c in cat_cols if not any(id_k in c.lower() for id_k in ('id', 'uuid', 'code', 'number'))]
            if clean_cats:
                raw_dims.append(clean_cats[0])

        ir.metrics = raw_metrics
        ir.dimensions = raw_dims

        return ir
