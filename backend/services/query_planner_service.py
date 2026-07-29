"""
query_planner_service.py — Query Planner (IR-orchestrator)
==========================================================
Thin orchestrator that:
  1. Calls IntentParser.parse() → QueryIR
  2. Wraps the QueryIR back into the legacy QueryPlan model for backwards
     compatibility with existing callers that still reference QueryPlan fields.
  3. Exposes both the QueryPlan and the raw QueryIR to downstream consumers.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from backend.services.intent_parser import intent_parser, QueryIR

logger = logging.getLogger("insightai.query_planner")


class QueryPlan(BaseModel):
    """
    Legacy plan model — kept intact for backwards compatibility.
    All fields are now populated from the QueryIR produced by IntentParser.
    """
    intent: str  # AGGREGATION | FILTER | COMPARISON | TREND_ANALYSIS | FACT_RETRIEVAL | SCHEMA_QUESTION | CONVERSATIONAL | STATISTICAL | RANKING | DISTRIBUTION | DATA_QUALITY
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
    # Extended fields — populated from QueryIR
    query_ir: Optional[Dict[str, Any]] = None
    aggregation_fn: Optional[str] = None
    time_granularity: Optional[str] = None
    statistical_function: Optional[str] = None
    chart_recommendation: Optional[str] = None
    confidence: float = 1.0


# Map QueryIR intent → legacy plan intent labels
_INTENT_MAP: Dict[str, str] = {
    "aggregation":  "AGGREGATION",
    "ranking":      "AGGREGATION",
    "filter":       "FILTER",
    "trend":        "TREND_ANALYSIS",
    "distribution": "DISTRIBUTION",
    "statistical":  "STATISTICAL",
    "comparison":   "COMPARISON",
    "metadata":     "SCHEMA_QUESTION",
    "data_quality": "DATA_QUALITY",
}

_CONVERSATIONAL_SIGNALS = [
    "summarize", "summary", "overview", "tell me about", "describe",
    "suitable for", "good for", "useful for", "is this dataset",
    "recommend", "any missing", "missing data", "unusual", "anomaly",
    "outlier", "what trend", "what pattern", "how many columns",
    "how many rows", "what columns", "list columns", "show columns",
    "explain", "what kind", "what type",
]


class QueryPlannerService:
    """
    Query Planner — orchestrates IntentParser and wraps results into QueryPlan.
    All SQL generation logic has been moved to IRSQLGenerator.
    """

    def plan_query(
        self,
        query: str,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]] = None,
    ) -> QueryPlan:
        """
        Parse the query via IntentParser and return a QueryPlan wrapping the QueryIR.
        """
        q_lower = query.lower()

        # Detect purely conversational intent first (non-SQL questions)
        is_conv = any(sig in q_lower for sig in _CONVERSATIONAL_SIGNALS)
        # Heuristic: very short queries with no SQL-like structure
        if len(query.split()) <= 4 and not any(
            w in q_lower for w in ["show", "get", "list", "total", "sum", "count", "top", "group", "by"]
        ):
            is_conv = True

        if is_conv:
            logger.info("[QueryPlanner] Conversational intent detected, routing to /chat.")
            return QueryPlan(
                intent="CONVERSATIONAL",
                is_conversational=True,
                plan_explanation="Conversational query — routed to /chat endpoint.",
                semantic_mappings={},
            )

        # Parse via IntentParser
        ir: QueryIR = intent_parser.parse(query, column_names, column_profiles)

        # Build legacy QueryPlan from IR
        intent_label = _INTENT_MAP.get(ir.intent, "AGGREGATION")

        filter_conditions = []
        for f in ir.filters:
            filter_conditions.append({
                "column": f.column,
                "operator": f.operator,
                "value": f.value,
                "value2": f.value2,
            })

        plan = QueryPlan(
            intent=intent_label,
            target_metrics=[ir.metric] if ir.metric else [],
            target_dimensions=ir.dimensions,
            filter_conditions=filter_conditions,
            sort_column=ir.sort.column if ir.sort else (ir.metric or None),
            sort_order=ir.sort.direction if ir.sort else "DESC",
            limit_val=ir.limit,
            semantic_mappings=ir.matched_columns,
            is_schema_question=(ir.intent == "metadata"),
            is_conversational=False,
            plan_explanation=(
                f"QueryIR: intent={ir.intent}, agg={ir.aggregation}, "
                f"metric={ir.metric}, dims={ir.dimensions}, "
                f"confidence={ir.confidence:.2f}."
            ),
            # Extended fields
            query_ir=ir.model_dump(),
            aggregation_fn=ir.aggregation,
            time_granularity=ir.time_granularity,
            statistical_function=ir.statistical_function,
            chart_recommendation=ir.chart,
            confidence=ir.confidence,
        )

        logger.info(f"[QueryPlanner] Plan: {plan.intent} | conf={ir.confidence:.2f} | metric={ir.metric} | dims={ir.dimensions}")
        return plan


query_planner_service = QueryPlannerService()
