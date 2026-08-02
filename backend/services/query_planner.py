import re
from typing import Dict, Any, Optional, List
from backend.nl2sql_engine.resolver import SchemaResolver

class QueryPlanner:
    """
    Layer 2: Deterministic Query Planner.
    Converts (User Query + Dataset Profile JSON) into a Structured Execution Plan:
    {
       "intent": "ranking",
       "metric": "Sales",
       "aggregation": "SUM",
       "dimension": "CustomerName",
       "sort": "DESC",
       "limit": 10
    }
    SQL generation becomes 100% deterministic and grounded on this Execution Plan.
    Domain classification is metadata only and never influences SQL logic.
    """

    @classmethod
    def plan_query(cls, query: str, brain_profile: Dict[str, Any]) -> Dict[str, Any]:
        q_lower = query.lower()
        
        available_cols = brain_profile.get('columns', [])
        metrics = brain_profile.get('metrics', [])
        dimensions = brain_profile.get('dimensions', [])
        time_cols = brain_profile.get('time_columns', [])

        # 1. Aggregation Function Extraction
        aggregation = "SUM"
        if re.search(r'\b(average|avg|mean)\b', q_lower):
            aggregation = "AVG"
        elif re.search(r'\b(count|number of|how many)\b', q_lower):
            aggregation = "COUNT"
        elif re.search(r'\b(max|maximum|highest|most)\b', q_lower) and not re.search(r'\btop\s+\d+\b', q_lower):
            aggregation = "MAX"
        elif re.search(r'\b(min|minimum|lowest|least|bottom)\b', q_lower):
            aggregation = "MIN"

        # 2. Intent & Sort & Limit & Time Granularity Extraction
        intent = "aggregation"
        sort = "DESC"
        limit = None
        time_granularity = None
        time_dimension = time_cols[0] if time_cols else None

        if re.search(r'\b(monthly|by month|per month)\b', q_lower):
            time_granularity = "month"
        elif re.search(r'\b(yearly|by year|annually)\b', q_lower):
            time_granularity = "year"
        elif re.search(r'\b(daily|by day)\b', q_lower):
            time_granularity = "day"
        elif re.search(r'\b(quarterly|by quarter)\b', q_lower):
            time_granularity = "quarter"

        if re.search(r'\b(top|highest|rank|best|lowest|bottom|worst)\b', q_lower):
            intent = "ranking"
            sort = "ASC" if re.search(r'\b(lowest|bottom|worst|least)\b', q_lower) else "DESC"
            limit_match = re.search(r'\b(top|first|limit|bottom)\s+(\d+)\b', q_lower)
            limit = int(limit_match.group(2)) if limit_match else 10

        elif time_cols and (re.search(r'\b(trend|over time|monthly|yearly|daily)\b', q_lower) or time_granularity):
            intent = "trend"

        elif re.search(r'\b(distribution|range|spread|histogram)\b', q_lower):
            intent = "distribution"

        # 3. Ground Metric & Dimension via SchemaResolver & Knowledge Graph
        # 3. Value-to-Column Filter Detection (Step 3 & 4 of Semantic ExecutionPlan)
        tokens = [t.strip(',.?!') for t in q_lower.split() if len(t.strip(',.?!')) > 2]
        filters: List[Dict[str, Any]] = []
        filtered_cols = set()

        value_index = brain_profile.get('value_index', {})
        column_metadata = brain_profile.get('column_metadata', {})

        # Detect value equality filters from tokens
        for token in tokens:
            val_res = SchemaResolver.resolve_value(token, value_index, column_metadata)
            if val_res:
                f_col, f_val = val_res
                if not any(f['column'] == f_col and f['value'] == f_val for f in filters):
                    filters.append({
                        "column": f_col,
                        "operator": "=",
                        "value": f_val
                    })
                    filtered_cols.add(f_col)

        # Detect numeric / date filters via regex
        gt_match = re.search(r'\b(above|greater than|over|more than|>)\s*([\d,\.]+)', q_lower)
        if gt_match:
            num_val = float(gt_match.group(2).replace(',', ''))
            metric_target = metrics[0] if metrics else 'Sales'
            filters.append({"column": metric_target, "operator": ">", "value": num_val})

        lt_match = re.search(r'\b(below|less than|under|<)\s*([\d,\.]+)', q_lower)
        if lt_match:
            num_val = float(lt_match.group(2).replace(',', ''))
            metric_target = metrics[0] if metrics else 'Sales'
            filters.append({"column": metric_target, "operator": "<", "value": num_val})

        year_match = re.search(r'\b(in|for|after|during|year)\s+(20\d{2}|19\d{2})\b', q_lower)
        if year_match:
            year_val = int(year_match.group(2))
            date_col = time_cols[0] if time_cols else None
            if date_col:
                op = ">" if "after" in q_lower else "="
                filters.append({"column": date_col, "operator": op, "value": year_val})

        # 4. Ground Metric & Dimension via SchemaResolver & Knowledge Graph
        target_metric: Optional[str] = None
        target_dimension: Optional[str] = None
        has_explicit_grouping = bool(re.search(r'\b(by|per|across|grouped by|for each)\b', q_lower))

        for token in tokens:
            resolved = SchemaResolver.resolve_column(token, available_cols)
            if resolved:
                if resolved in metrics and not target_metric:
                    target_metric = resolved
                elif (resolved in dimensions or resolved in time_cols) and not target_dimension:
                    # Do NOT pick resolved column as target_dimension if it was filtered and no explicit "by <col>" phrase
                    if resolved not in filtered_cols or (has_explicit_grouping and re.search(rf'\b(by|per)\s+{token}\b', q_lower)):
                        target_dimension = resolved

        # Fallback metric
        if not target_metric and metrics:
            target_metric = metrics[0]

        # Dimension fallback: pick first non-filtered categorical dimension if target_dimension is still empty
        if not target_dimension and dimensions:
            candidate_dims = [d for d in dimensions if d not in filtered_cols]
            if candidate_dims:
                target_dimension = candidate_dims[0]
            elif dimensions:
                target_dimension = dimensions[0]

        # Fix Fallback: For trend queries, fallback to time_column, NOT arbitrary categorical dimensions!
        if intent == "trend":
            if not target_dimension or target_dimension not in time_cols:
                if time_cols:
                    target_dimension = time_cols[0]
                    time_dimension = time_cols[0]

        # Infer Analytical Shape
        if intent == "trend" or time_granularity or (target_dimension and target_dimension in time_cols):
            analysis_shape = "TIME_SERIES"
        elif intent == "ranking" or limit or re.search(r'\b(driving|top|highest|best|worst|rank)\b', q_lower):
            analysis_shape = "TOP_N"
            if intent == "aggregation":
                intent = "ranking"
        elif re.search(r'\b(percentage|share|proportion|ratio|composition)\b', q_lower):
            analysis_shape = "COMPOSITION"
        elif intent == "distribution":
            analysis_shape = "DISTRIBUTION"
        elif target_dimension:
            analysis_shape = "CATEGORICAL"
        else:
            analysis_shape = "SINGLE_VALUE"

        return {
            'intent': intent,
            'metric': target_metric,
            'metrics': [target_metric] if target_metric else [],
            'aggregation': aggregation,
            'dimension': target_dimension,
            'group_by': [target_dimension] if target_dimension else [],
            'filters': filters,
            'time_dimension': time_dimension,
            'time_granularity': time_granularity,
            'analysis_shape': analysis_shape,
            'sort': sort,
            'limit': limit,
            'confidence': 0.95,
            'raw_query': query,
        }


