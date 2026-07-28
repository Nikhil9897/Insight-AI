import re
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from backend.services.semantic_search_service import semantic_search_service

logger = logging.getLogger("insightai.query_planner")


class QueryPlan(BaseModel):
    intent: str  # AGGREGATION | FILTER | COMPARISON | TREND_ANALYSIS | FACT_RETRIEVAL | SCHEMA_QUESTION | CONVERSATIONAL
    target_metrics: List[str] = []
    target_dimensions: List[str] = []
    filter_conditions: List[Dict[str, Any]] = []
    sort_column: Optional[str] = None
    sort_order: str = "DESC"
    limit_val: Optional[int] = None
    semantic_mappings: Dict[str, str] = {}
    is_schema_question: bool = False
    is_conversational: bool = False
    plan_explanation: str = ""


class QueryPlannerService:
    """
    Query Planner & Intent Detection Engine.
    Pre-analyzes user queries into a structured plan before SQL synthesis.
    """

    def plan_query(
        self,
        query: str,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]] = None
    ) -> QueryPlan:
        q_lower = query.lower()

        # Step 1: Semantic Column Mapping
        mappings = semantic_search_service.resolve_column_mappings(query, column_names)
        mapped_dict = {k: v[0] for k, v in mappings.items()}

        # Step 2: Intent Classification
        is_schema_q = any(w in q_lower for w in ["what does", "define", "meaning of", "explain column", "schema", "what is"])

        # Conversational / exploratory signals — routed to /chat, not SQL
        _CONV_SIGNALS = [
            "summarize", "summary", "overview", "tell me about", "describe",
            "suitable for", "good for", "useful for", "is this dataset",
            "recommend", "any missing", "missing data", "null values",
            "unusual", "anomaly", "outlier", "what trend", "what pattern",
            "how many columns", "how many rows", "what columns", "list columns",
            "show columns", "what format", "explain", "what kind", "what type",
        ]
        is_conv = any(w in q_lower for w in _CONV_SIGNALS) or (
            is_schema_q and not any(w in q_lower for w in ["show", "get", "list", "total", "sum", "count", "top", "filter", "group"])
        )

        is_agg = any(w in q_lower for w in ["sum", "total", "average", "avg", "mean", "count", "max", "min", "highest", "lowest"])
        is_filter = any(w in q_lower for w in ["where", "only", "filter", "equal", "greater", "less", "top", "bottom", "for region", "in south"])
        is_trend = any(w in q_lower for w in ["trend", "month", "year", "date", "over time", "daily", "monthly", "quarterly"])
        is_comp = any(w in q_lower for w in ["compare", "versus", "vs", "by", "across", "group"])

        if is_conv:
            intent = "CONVERSATIONAL"
        elif is_schema_q:
            intent = "SCHEMA_QUESTION"
        elif is_trend:
            intent = "TREND_ANALYSIS"
        elif is_agg or is_comp:
            intent = "AGGREGATION"
        elif is_filter:
            intent = "FILTER"
        else:
            intent = "FACT_RETRIEVAL"

        # Step 3: Identify metrics vs dimensions
        num_cols = []
        cat_cols = []
        if column_profiles:
            for cp in column_profiles:
                cname = cp.get("name", "")
                ctype = cp.get("type", "string")
                if ctype in ["number", "float", "int", "integer"]:
                    num_cols.append(cname)
                else:
                    cat_cols.append(cname)
        else:
            numeric_keywords = ["sales", "profit", "amount", "revenue", "price", "count", "quantity", "discount", "fare", "age", "val", "val_"]
            num_cols = [c for c in column_names if any(k in c.lower() for k in numeric_keywords)]
            cat_cols = [c for c in column_names if c not in num_cols]
            if not num_cols:
                num_cols = column_names
            if not cat_cols:
                cat_cols = column_names

        # Exclude high-cardinality identifiers (Name, ID, Email, Ticket) from default dimension fallback
        id_keywords = ["id", "name", "email", "ticket", "ssn", "phone", "uuid"]
        non_id_cat_cols = [c for c in cat_cols if not any(k in c.lower() for k in id_keywords)]
        fallback_dim = non_id_cat_cols[0] if non_id_cat_cols else (cat_cols[0] if cat_cols else None)

        target_metrics = list(set([mapped_dict[k] for k in mapped_dict if mapped_dict[k] in num_cols]))
        target_dimensions = list(set([mapped_dict[k] for k in mapped_dict if mapped_dict[k] in cat_cols]))

        # Special check for 'survived' or 'survival' in query
        for col in column_names:
            if "surviv" in col.lower() and col not in target_dimensions and col not in target_metrics:
                if col in cat_cols or any(cp.get("name") == col for cp in (column_profiles or []) if cp.get("type") != "number"):
                    target_dimensions.append(col)
                else:
                    target_metrics.append(col)

        if not target_metrics and num_cols:
            target_metrics = [num_cols[0]]
        if not target_dimensions and fallback_dim:
            target_dimensions = [fallback_dim]

        # Step 4: Extract limit value
        limit_match = re.search(r'\b(top|limit|first)\s+(\d+)\b', q_lower)
        limit_val = int(limit_match.group(2)) if limit_match else (5 if ("top" in q_lower or "best" in q_lower) else None)

        sort_column = target_metrics[0] if target_metrics else (column_names[0] if column_names else None)
        sort_order = "ASC" if ("lowest" in q_lower or "bottom" in q_lower or "least" in q_lower) else "DESC"

        explanation = (
            f"Query Planner identified intent '{intent}'. "
            f"Mapped metrics: {target_metrics}, dimensions: {target_dimensions}. "
            f"Limit: {limit_val or 'all rows'}."
        )

        plan = QueryPlan(
            intent=intent,
            target_metrics=target_metrics,
            target_dimensions=target_dimensions,
            sort_column=sort_column,
            sort_order=sort_order,
            limit_val=limit_val,
            semantic_mappings=mapped_dict,
            is_schema_question=is_schema_q,
            is_conversational=is_conv,
            plan_explanation=explanation
        )

        logger.info(f"[Query Planner] Generated plan: {plan.model_dump()}")
        return plan


query_planner_service = QueryPlannerService()
