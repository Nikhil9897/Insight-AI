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

        # 2. Intent & Sort & Limit Extraction
        intent = "aggregation"
        sort = "DESC"
        limit = None

        if re.search(r'\b(top|highest|rank|best|lowest|bottom|worst)\b', q_lower):
            intent = "ranking"
            if re.search(r'\b(lowest|bottom|worst|least)\b', q_lower):
                sort = "ASC"
            else:
                sort = "DESC"
            
            # Extract limit (e.g. "top 10")
            limit_match = re.search(r'\b(top|first|limit|bottom)\s+(\d+)\b', q_lower)
            limit = int(limit_match.group(2)) if limit_match else 10

        elif time_cols and re.search(r'\b(trend|over time|monthly|yearly|daily)\b', q_lower):
            intent = "trend"

        elif re.search(r'\b(distribution|range|spread|histogram)\b', q_lower):
            intent = "distribution"

        # 3. Ground Metric & Dimension via SchemaResolver & Semantic Roles
        tokens = [t.strip(',.?!') for t in q_lower.split() if len(t.strip(',.?!')) > 2]
        
        target_metric: Optional[str] = None
        target_dimension: Optional[str] = None

        for token in tokens:
            resolved = SchemaResolver.resolve_column(token, available_cols)
            if resolved:
                if resolved in metrics and not target_metric:
                    target_metric = resolved
                elif (resolved in dimensions or resolved in time_cols) and not target_dimension:
                    target_dimension = resolved

        # Fallback defaults if unspecified
        if not target_metric and metrics:
            target_metric = metrics[0]
        if not target_dimension and dimensions:
            target_dimension = dimensions[0]

        return {
            'intent': intent,
            'metric': target_metric,
            'aggregation': aggregation,
            'dimension': target_dimension,
            'sort': sort,
            'limit': limit,
            'raw_query': query,
        }
