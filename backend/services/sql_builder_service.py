"""
sql_builder_service.py — SQL Builder (IR-first pipeline)
=========================================================
Builds SQL by consuming the QueryIR (via IRSQLGenerator).
Falls back to the legacy logic only when no QueryIR is available.

Returns (sql_string, confidence_score, builder_explanation) tuple —
the same interface as before, for full backwards compatibility.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from backend.services.query_planner_service import QueryPlan
from backend.services.ir_sql_generator import ir_sql_generator
from backend.services.intent_parser import QueryIR

logger = logging.getLogger("insightai.sql_builder")


class SQLBuilderService:
    """
    SQL Builder — delegates to IRSQLGenerator when a QueryIR is available.
    Preserves the legacy build_sql() interface for backwards compatibility.
    """

    def build_sql(
        self,
        plan: QueryPlan,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]] = None,
        user_query: str = "",
    ) -> Tuple[str, float, str]:
        """
        Returns (sql_string, confidence_score, builder_explanation).
        """
        table_name = "df"

        def quote_col(col: str) -> str:
            return f'"{col}"'

        # ── PATH A: IR-first pipeline ──────────────────────────────────────
        if plan.query_ir:
            try:
                ir = QueryIR(**plan.query_ir)

                # Data quality / metadata intents: return a structural query
                # with very high confidence so the route can handle metadata logic
                if ir.is_metadata or ir.is_data_quality:
                    sql, explanation = ir_sql_generator.generate(ir, column_names)
                    return sql, 0.99, explanation

                # Low confidence → delegate to LLM Recovery Loop
                if ir.confidence < 0.75:
                    select_cols = [quote_col(c) for c in column_names[:6]]
                    cols_str = ", ".join(select_cols) if select_cols else "*"
                    sql = f"SELECT {cols_str} FROM {table_name} LIMIT 50"
                    explanation = (
                        f"IR confidence {ir.confidence:.2f} below threshold. "
                        f"Flags: {ir.confidence_flags}. Delegating to LLM Refiner."
                    )
                    return sql, ir.confidence, explanation

                # High confidence → deterministic IR SQL generation
                sql, explanation = ir_sql_generator.generate(ir, column_names)
                return sql, ir.confidence, explanation

            except Exception as ir_err:
                logger.warning(f"[SQLBuilder] IR path failed ({ir_err}), using legacy path.")

        # ── PATH B: Legacy fallback (no QueryIR) ──────────────────────────
        return self._legacy_build_sql(plan, column_names, column_profiles, user_query)

    # ------------------------------------------------------------------
    # Legacy SQL builder — preserved for backwards compatibility
    # ------------------------------------------------------------------

    def _legacy_build_sql(
        self,
        plan: QueryPlan,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]],
        user_query: str,
    ) -> Tuple[str, float, str]:
        table_name = "df"

        def quote_col(col: str) -> str:
            return f'"{col}"'

        metrics = plan.target_metrics
        dimensions = plan.target_dimensions
        limit_str = f" LIMIT {plan.limit_val}" if plan.limit_val else ""

        plan_exp_lower = plan.plan_explanation.lower()
        query_lower = (user_query or "").lower()
        relationship_keywords = [
            "above", "below", "greater", "less", "over", "under", "exceed", "rating",
            "affect", "effect", "impact", "relationship", "correlation", "influence",
            "depend", "survival", "survived", "rate", "versus", "vs", "compare",
        ]
        has_comparison = any(w in plan_exp_lower or w in query_lower for w in relationship_keywords)
        if has_comparison or plan.intent in ["TREND_ANALYSIS", "COMPARISON"]:
            select_cols = [quote_col(c) for c in column_names[:6]]
            cols_str = ", ".join(select_cols) if select_cols else "*"
            sql = f"SELECT {cols_str} FROM {table_name}{limit_str or ' LIMIT 50'}"
            confidence = 0.50
            explanation = "Query requires relationship/statistical synthesis; delegating to LLM Refiner."
            return sql, confidence, explanation

        if plan.intent in ["AGGREGATION", "COMPARISON", "FACT_RETRIEVAL", "DISTRIBUTION"]:
            if metrics and dimensions:
                dim_col = quote_col(dimensions[0])
                metric_col = quote_col(metrics[0])
                alias = f"Total_{metrics[0].replace(' ', '_')}"
                sql = f"SELECT {dim_col}, SUM({metric_col}) AS \"{alias}\" FROM {table_name} GROUP BY {dim_col} ORDER BY \"{alias}\" {plan.sort_order}{limit_str}"
                confidence = 0.91
                explanation = f"Legacy AGGREGATION SQL: SUM('{metrics[0]}') by '{dimensions[0]}'."
                return sql, confidence, explanation

            elif metrics and not dimensions:
                metric_col = quote_col(metrics[0])
                alias = f"Total_{metrics[0].replace(' ', '_')}"
                sql = f"SELECT SUM({metric_col}) AS \"{alias}\", AVG({metric_col}) AS \"Avg_{metrics[0].replace(' ', '_')}\" FROM {table_name}"
                confidence = 0.90
                explanation = f"Legacy metric summary SQL for '{metrics[0]}'."
                return sql, confidence, explanation

            elif dimensions and not metrics:
                dim_col = quote_col(dimensions[0])
                sql = f"SELECT {dim_col}, COUNT(*) AS \"Record_Count\" FROM {table_name} GROUP BY {dim_col} ORDER BY \"Record_Count\" {plan.sort_order}{limit_str}"
                confidence = 0.89
                explanation = f"Legacy category count SQL for '{dimensions[0]}'."
                return sql, confidence, explanation

        if plan.intent == "FILTER":
            matched_where_clauses = []
            if column_profiles:
                import re
                for cp in column_profiles:
                    cname = cp.get("name", "")
                    samples = cp.get("sampleValues") or []
                    for s in samples:
                        if s and isinstance(s, str) and len(s) >= 2 and not s.isdigit():
                            s_lower = s.lower()
                            if s_lower in plan_exp_lower or any(word == s_lower for word in plan_exp_lower.split()):
                                quoted = quote_col(cname)
                                escaped_val = s.replace("'", "''")
                                matched_where_clauses.append(f"LOWER({quoted}) = LOWER('{escaped_val}')")
                                break

            if matched_where_clauses:
                where_str = " AND ".join(matched_where_clauses)
                if metrics and dimensions:
                    dim_col = quote_col(dimensions[0])
                    metric_col = quote_col(metrics[0])
                    alias = f"Total_{metrics[0].replace(' ', '_')}"
                    sql = f"SELECT {dim_col}, SUM({metric_col}) AS \"{alias}\" FROM {table_name} WHERE {where_str} GROUP BY {dim_col} ORDER BY \"{alias}\" {plan.sort_order}{limit_str}"
                else:
                    sql = f"SELECT * FROM {table_name} WHERE {where_str}{limit_str or ' LIMIT 50'}"
                confidence = 0.91
                explanation = f"Legacy FILTER SQL: {where_str}"
                return sql, confidence, explanation

            select_cols = [quote_col(c) for c in column_names[:6]]
            cols_str = ", ".join(select_cols) if select_cols else "*"
            sql = f"SELECT {cols_str} FROM {table_name}{limit_str or ' LIMIT 50'}"
            confidence = 0.50
            explanation = "Complex filter — delegating to LLM Refiner."
            return sql, confidence, explanation

        select_cols = [quote_col(c) for c in column_names[:6]]
        cols_str = ", ".join(select_cols) if select_cols else "*"
        sql = f"SELECT {cols_str} FROM {table_name}{limit_str or ' LIMIT 20'}"
        confidence = 0.70
        explanation = "Legacy fallback SELECT query."
        return sql, confidence, explanation


sql_builder_service = SQLBuilderService()
