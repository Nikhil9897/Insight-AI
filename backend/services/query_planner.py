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
        tokens = [t.strip(',.?!') for t in q_lower.split() if len(t.strip(',.?!')) > 2]
        
        target_metric: Optional[str] = None
        target_dimension: Optional[str] = None

        kg = brain_profile.get('knowledge_graph', {})

        for token in tokens:
            resolved = SchemaResolver.resolve_column(token, available_cols)
            if resolved:
                if resolved in metrics and not target_metric:
                    target_metric = resolved
                elif (resolved in dimensions or resolved in time_cols) and not target_dimension:
                    target_dimension = resolved

        # Fallback defaults grounded in metric knowledge_graph or brain_profile
        if not target_metric and metrics:
            target_metric = metrics[0]

        # Fix Fallback: For trend queries, fallback to time_column, NOT arbitrary categorical dimensions!
        if intent == "trend":
            if not target_dimension or target_dimension not in time_cols:
                if time_cols:
                    target_dimension = time_cols[0]
                    time_dimension = time_cols[0]
        else:
            if not target_dimension and dimensions:
                target_dimension = dimensions[0]

        # Infer Analytical Shape
        if intent == "trend" or time_granularity or (target_dimension and target_dimension in time_cols):
            analysis_shape = "TIME_SERIES"
        elif intent == "ranking" or limit:
            analysis_shape = "TOP_N"
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
            'aggregation': aggregation,
            'dimension': target_dimension,
            'time_dimension': time_dimension,
            'time_granularity': time_granularity,
            'analysis_shape': analysis_shape,
            'sort': sort,
            'limit': limit,
            'confidence': 0.95,
            'raw_query': query,
        }

