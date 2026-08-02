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
    def parse_query(
        cls,
        query: str,
        available_columns: List[str],
        column_types: Dict[str, str],
        brain_profile: Optional[Dict[str, Any]] = None,
        df_data: Optional[Any] = None
    ) -> QueryIR:
        q_lower = query.lower()

        # Step 0: Try DatasetBrain + QueryUnderstandingEngine if DataFrame or brain_profile available
        if df_data is not None and not brain_profile:
            try:
                import pandas as pd
                from backend.services.dataset_brain import DatasetBrain
                if isinstance(df_data, pd.DataFrame):
                    df_obj = df_data
                else:
                    df_obj = pd.DataFrame(df_data)
                brain_profile = DatasetBrain.build_brain_profile(df_obj)
            except Exception:
                brain_profile = None

        if brain_profile:
            try:
                from backend.services.query_understanding_engine import QueryUnderstandingEngine
                understanding = QueryUnderstandingEngine.understand(query, brain_profile)
                plan = understanding.execution_plan

                ir = QueryIR(raw_query=query)
                ir.intent = plan.intent
                ir.metrics = plan.metrics
                ir.dimensions = plan.group_by
                ir.filters = plan.filters
                ir.limit = plan.limit_val
                ir.analysis_shape = plan.analysis_shape
                ir.time_dimension = plan.time_dimension
                ir.time_granularity = plan.time_granularity
                if plan.time_dimension:
                    ir.date_cols = [plan.time_dimension]
                if re.search(r'\b(average|avg|mean)\b', q_lower):

                    ir.stat_fn = 'AVG'
                elif re.search(r'\b(count|number of|total number|how many)\b', q_lower):
                    ir.stat_fn = 'COUNT'
                elif re.search(r'\b(max|maximum|highest|most)\b', q_lower) and not re.search(r'\btop\b', q_lower):
                    ir.stat_fn = 'MAX'
                elif re.search(r'\b(min|minimum|lowest|least|bottom)\b', q_lower):
                    ir.stat_fn = 'MIN'
                else:
                    ir.stat_fn = 'SUM'

                return ir

            except Exception:
                pass

        ir = QueryIR(raw_query=query)


        # 1. Stat Function Detection
        if re.search(r'\b(average|avg|mean)\b', q_lower):
            ir.stat_fn = 'AVG'
        elif re.search(r'\b(count|number of|total number|how many)\b', q_lower):
            ir.stat_fn = 'COUNT'
        elif re.search(r'\b(max|maximum|highest|most)\b', q_lower) and not re.search(r'\btop\b', q_lower):
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
        elif re.search(r'\btop\b', q_lower):
            ir.limit = 10  # default top 10 for ranking queries

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
        num_cols = [c for c, t in column_types.items() if any(nt in (t if isinstance(t, str) else str(t)).lower() for nt in ('int', 'float', 'double', 'number', 'decimal', 'numeric'))]
        cat_cols = [c for c in available_columns if c not in num_cols]
        date_cols = [c for c, t in column_types.items() if any(dk in (t if isinstance(t, str) else str(t)).lower() or dk in c.lower() for dk in ('date', 'time', 'year', 'month', 'timestamp', 'created', 'dt'))]

        if not date_cols:
            date_cols = [c for c in available_columns if any(dk in c.lower() for dk in ('date', 'time', 'year', 'month', 'timestamp', 'created', 'dt'))]

        user_wants_id = any(id_k in q_lower for id_k in ('id', 'uuid', 'code', 'number'))

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
                    if resolved not in raw_dims:
                        if not is_id or user_wants_id or (len(cat_cols) == 1 and cat_cols[0] == resolved):
                            raw_dims.append(resolved)


        # Fallback defaults if no direct column mentioned
        if not raw_metrics and num_cols:
            raw_metrics.append(num_cols[0])

        has_grouping = bool(re.search(r'\b(by|per|each|across|breakdown|grouped by)\b', q_lower))
        has_ranking = bool(ir.limit or re.search(r'\b(top|first|highest|best|worst|rank)\b', q_lower))

        if not raw_dims and cat_cols and (has_grouping or has_ranking):
            clean_cats = [c for c in cat_cols if not any(id_k in c.lower() for id_k in ('id', 'uuid', 'code', 'number'))]
            if clean_cats:
                raw_dims.append(clean_cats[0])
            elif cat_cols:
                raw_dims.append(cat_cols[0])


        ir.metrics = raw_metrics
        ir.dimensions = raw_dims

        # Populate time_dimension & analysis_shape
        if not ir.date_cols and date_cols:
            ir.date_cols = date_cols[:]

        if ir.date_cols:
            ir.time_dimension = ir.date_cols[0]

        if ir.time_granularity or re.search(r'\b(trend|over time|monthly|daily|yearly)\b', q_lower):
            ir.intent = "trend"
            ir.analysis_shape = "TIME_SERIES"
            if date_cols and not any(c in ir.dimensions for c in date_cols):
                ir.dimensions.insert(0, date_cols[0])
                if not ir.date_cols:
                    ir.date_cols = [date_cols[0]]
                    ir.time_dimension = date_cols[0]

        elif ir.limit or re.search(r'\b(top|first|highest|best|worst|rank)\b', q_lower):
            ir.intent = "ranking"
            ir.analysis_shape = "TOP_N"
            # Ensure ranking query has a grouping dimension
            if not ir.dimensions and cat_cols:
                ir.dimensions = [cat_cols[0]]
        elif re.search(r'\b(percentage|share|proportion|ratio|composition)\b', q_lower):
            ir.analysis_shape = "COMPOSITION"

        elif re.search(r'\b(distribution|histogram|boxplot|spread)\b', q_lower):
            ir.intent = "distribution"
            ir.analysis_shape = "DISTRIBUTION"
        elif re.search(r'\b(scatter|correlation|vs|versus)\b', q_lower):
            ir.intent = "correlation"
            ir.analysis_shape = "CORRELATION"
        elif ir.dimensions:
            ir.analysis_shape = "CATEGORICAL"
        else:
            ir.analysis_shape = "SINGLE_VALUE"

        return ir

