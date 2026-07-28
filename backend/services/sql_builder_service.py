import logging
from typing import Dict, Any, List, Optional, Tuple
from backend.services.query_planner_service import QueryPlan

logger = logging.getLogger("insightai.sql_builder")


class SQLBuilderService:
    """
    Deterministic SQL Builder.
    Constructs ANSI SQL directly from a structured QueryPlan without LLM inference,
    delivering sub-5ms query generation for high-confidence intents.
    """

    def build_sql(
        self,
        plan: QueryPlan,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]] = None,
        user_query: str = ""
    ) -> Tuple[str, float, str]:
        """
        Returns (sql_string, confidence_score, builder_explanation).
        """
        table_name = "df"

        # Safe column double-quoting
        def quote_col(col: str) -> str:
            if " " in col or "-" in col or col.isupper() or not col.isidentifier():
                return f'"{col}"'
            return f'"{col}"'

        metrics = plan.target_metrics
        dimensions = plan.target_dimensions
        limit_str = f" LIMIT {plan.limit_val}" if plan.limit_val else ""

        # Check if query has comparison, relationship, correlation, impact, affect, or trend indicators
        plan_exp_lower = plan.plan_explanation.lower()
        query_lower = (user_query or "").lower()
        relationship_keywords = [
            "above", "below", "greater", "less", "over", "under", "exceed", "rating",
            "affect", "effect", "impact", "relationship", "correlation", "influence",
            "depend", "survival", "survived", "rate", "versus", "vs", "compare"
        ]
        has_comparison = any(w in plan_exp_lower or w in query_lower for w in relationship_keywords)
        if has_comparison or plan.intent in ["TREND_ANALYSIS", "COMPARISON"]:
            select_cols = [quote_col(c) for c in column_names[:6]]
            cols_str = ", ".join(select_cols) if select_cols else "*"
            sql = f"SELECT {cols_str} FROM {table_name}{limit_str or ' LIMIT 50'}"
            confidence = 0.50
            explanation = "Query requires relationship, statistical correlation, or multi-variable synthesis; delegating to LLM Synthesizer."
            return sql, confidence, explanation

        # Case 1: AGGREGATION, FACT_RETRIEVAL, DISTRIBUTION, COMPARISON
        if plan.intent in ["AGGREGATION", "COMPARISON", "FACT_RETRIEVAL", "DISTRIBUTION"]:
            if metrics and dimensions:
                dim_col = quote_col(dimensions[0])
                metric_col = quote_col(metrics[0])
                alias = f"Total_{metrics[0].replace(' ', '_')}"

                sql = f"SELECT {dim_col}, SUM({metric_col}) AS \"{alias}\" FROM {table_name} GROUP BY {dim_col} ORDER BY \"{alias}\" {plan.sort_order}{limit_str}"
                confidence = 0.96
                explanation = f"Built deterministic AGGREGATION SQL summing '{metrics[0]}' grouped by '{dimensions[0]}'."
                return sql, confidence, explanation

            elif metrics and not dimensions:
                metric_col = quote_col(metrics[0])
                alias = f"Total_{metrics[0].replace(' ', '_')}"
                sql = f"SELECT SUM({metric_col}) AS \"{alias}\", AVG({metric_col}) AS \"Avg_{metrics[0].replace(' ', '_')}\" FROM {table_name}"
                confidence = 0.95
                explanation = f"Built deterministic metric summary SQL for '{metrics[0]}'."
                return sql, confidence, explanation

            elif dimensions and not metrics:
                dim_col = quote_col(dimensions[0])
                sql = f"SELECT {dim_col}, COUNT(*) AS \"Record_Count\" FROM {table_name} GROUP BY {dim_col} ORDER BY \"Record_Count\" {plan.sort_order}{limit_str}"
                confidence = 0.94
                explanation = f"Built deterministic category count SQL for '{dimensions[0]}'."
                return sql, confidence, explanation

        # Case 2: FILTER Intent
        if plan.intent == "FILTER":
            matched_where_clauses = []
            if column_profiles:
                import re
                plan_exp_lower = plan.plan_explanation.lower()
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
                confidence = 0.96
                explanation = f"Built deterministic FILTER SQL with exact value groundings: {where_str}"
                return sql, confidence, explanation

            # If no exact value could be matched deterministically, delegate to LLM Agent (Confidence 0.50)
            select_cols = [quote_col(c) for c in column_names[:6]]
            cols_str = ", ".join(select_cols) if select_cols else "*"
            sql = f"SELECT {cols_str} FROM {table_name}{limit_str or ' LIMIT 50'}"
            confidence = 0.50
            explanation = "Filter query contains complex NLP literals; delegating to LLM Synthesizer for exact WHERE clause generation."
            return sql, confidence, explanation

        # Case 3: Default SELECT ALL / Preview fallback
        select_cols = [quote_col(c) for c in column_names[:6]]
        cols_str = ", ".join(select_cols) if select_cols else "*"
        sql = f"SELECT {cols_str} FROM {table_name}{limit_str or ' LIMIT 20'}"
        confidence = 0.70
        explanation = "Built fallback SELECT query."
        return sql, confidence, explanation


sql_builder_service = SQLBuilderService()
