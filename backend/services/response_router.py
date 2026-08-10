"""
response_router.py — Capability-Based Query Response Router
===========================================================
Routes user queries using the output of QueryUnderstandingEngine:
1. Direct DatasetBrain / DatasetProfiler resolution for SCHEMA, PROFILE, QUALITY, SUMMARY, and HELP capabilities (No SQL needed, <2ms execution).
2. Grounded QueryPlanner & NL2SQLEngine SQL pipeline for QUERY and VISUALIZATION capabilities.
"""

import logging
import datetime
from typing import Dict, Any, List, Optional
import pandas as pd

from backend.services.query_understanding_engine import QueryUnderstandingEngine, Capability, QueryUnderstanding
from backend.services.dataset_brain import DatasetBrain

logger = logging.getLogger("insightai.response_router")


class ResponseRouter:
    """
    Capability-Based Response Router for InsightAI.
    """

    @classmethod
    def route_query(
        cls,
        user_query: str,
        df: pd.DataFrame,
        dataset_name: str = "Dataset"
    ) -> Dict[str, Any]:
        """
        Main entry point for routing and answering natural language queries.
        Returns a complete result payload dictionary ready for QueryResultResponse.
        """
        # Step 1: Build DatasetBrain Profile
        brain_profile = DatasetBrain.build_brain_profile(df, dataset_name=dataset_name)

        # Step 2: Unified Query Understanding Engine (Single Pass)
        understanding: QueryUnderstanding = QueryUnderstandingEngine.understand(user_query, brain_profile)
        cap = understanding.capability

        logger.info(
            f"[ResponseRouter] Query='{user_query}' -> Capability={cap.value} "
            f"conf={understanding.confidence:.2f} requires_sql={understanding.requires_sql}"
        )

        # Step 3: Route based on Capability
        if cap == Capability.HELP:
            return cls._handle_help(user_query, brain_profile, understanding)

        elif cap in (Capability.SCHEMA, Capability.PROFILE):
            return cls._handle_schema(user_query, brain_profile, understanding)

        elif cap == Capability.QUALITY:
            return cls._handle_quality(user_query, df, brain_profile, understanding)

        elif cap == Capability.SUMMARY:
            return cls._handle_summary(user_query, brain_profile, understanding)

        elif cap == Capability.OUT_OF_SCOPE:
            return cls._handle_out_of_scope(user_query, brain_profile, understanding)

        # Default: QUERY / VISUALIZATION (requires SQL execution via QueryPlanner / NL2SQLEngine)
        return {
            "capability": cap.value,
            "query_type": cap.value,
            "requires_sql": True,
            "understanding": understanding.model_dump(),
            "brain_profile": brain_profile,
            "execution_plan": understanding.execution_plan.model_dump(),
        }

    @classmethod
    def _handle_help(
        cls, query: str, brain_profile: Dict[str, Any], understanding: QueryUnderstanding
    ) -> Dict[str, Any]:
        domain = brain_profile.get("domain", "Business Analytics")
        dataset_name = brain_profile.get("dataset_name", "Dataset")
        metrics = brain_profile.get("metrics", [])
        dimensions = brain_profile.get("dimensions", [])

        explanation = (
            f"Hello! I am your AI Data Analytics Assistant for **{dataset_name}** ({domain}). "
            f"You can ask me questions about metrics ({', '.join(metrics[:3])}), "
            f"dimensions ({', '.join(dimensions[:3])}), dataset quality, or trends."
        )

        rows = [
            {"Domain": domain, "Total_Records": brain_profile.get("row_count", 0), "Total_Columns": brain_profile.get("col_count", 0)}
        ]
        columns = list(rows[0].keys())

        return {
            "capability": Capability.HELP.value,
            "query_type": Capability.HELP.value,
            "requires_sql": False,
            "query": query,
            "sql": "-- No SQL required (Conversational Greeting / Help)",
            "rows": rows,
            "columns": columns,
            "explanation": explanation,
            "chartConfig": {"type": "kpi", "xAxisKey": "Domain", "yAxisKey": "Total_Records", "title": "Dataset Ready"},
            "businessInsights": [
                f"Dataset '{dataset_name}' loaded successfully with {brain_profile.get('row_count', 0):,} records.",
                f"Detected Domain: {domain} ({brain_profile.get('domain_confidence', 90)}% confidence).",
                "Ask an analytical question below or pick a suggested query."
            ],
            "confidenceScore": int(understanding.confidence * 100),
            "executionPath": "DatasetBrain Direct Resolution — Help (No SQL Needed)",
            "followUpQuestions": understanding.clarification_suggestions,
            "datasetMemory": brain_profile,
        }

    @classmethod
    def _handle_schema(
        cls, query: str, brain_profile: Dict[str, Any], understanding: QueryUnderstanding
    ) -> Dict[str, Any]:
        col_meta = brain_profile.get("column_metadata", {})
        rows = []
        for col_name, meta in col_meta.items():
            rows.append({
                "Column_Name": col_name,
                "Business_Role": meta.get("business_role", "Dimension"),
                "Type": meta.get("type", "string"),
                "Default_Aggregation": meta.get("aggregation", "NONE"),
                "Filterable": "Yes" if meta.get("filterable") else "No",
                "Distinct_Count": len(meta.get("distinct_values", []))
            })

        columns = ["Column_Name", "Business_Role", "Type", "Default_Aggregation", "Filterable", "Distinct_Count"]
        col_count = len(rows)

        explanation = f"Dataset **{brain_profile.get('dataset_name', 'Dataset')}** contains **{col_count} columns** across metrics, dimensions, and time attributes."

        return {
            "capability": Capability.SCHEMA.value,
            "query_type": Capability.SCHEMA.value,
            "requires_sql": False,
            "query": query,
            "sql": "-- No SQL required (Schema provided via DatasetBrain)",
            "rows": rows,
            "columns": columns,
            "explanation": explanation,
            "chartConfig": {"type": "table", "title": "Dataset Schema & Field Profiles"},
            "businessInsights": [
                f"Total {col_count} columns profiled in active dataset.",
                f"Numerical Measures: {len(brain_profile.get('metrics', []))}",
                f"Categorical & Time Dimensions: {len(brain_profile.get('dimensions', [])) + len(brain_profile.get('time_columns', []))}"
            ],
            "confidenceScore": int(understanding.confidence * 100),
            "executionPath": "DatasetBrain Direct Resolution — Schema (No SQL Needed)",
            "followUpQuestions": understanding.clarification_suggestions,
            "datasetMemory": brain_profile,
        }

    @classmethod
    def _handle_quality(
        cls, query: str, df: pd.DataFrame, brain_profile: Dict[str, Any], understanding: QueryUnderstanding
    ) -> Dict[str, Any]:
        row_count = len(df)
        col_count = len(df.columns)
        
        rows = []
        total_nulls = 0
        for col in df.columns:
            null_c = int(df[col].isnull().sum())
            total_nulls += null_c
            null_pct = round((null_c / row_count) * 100, 2) if row_count > 0 else 0.0
            distinct_c = int(df[col].nunique())
            rows.append({
                "Column_Name": col,
                "Null_Count": null_c,
                "Null_Percentage": f"{null_pct}%",
                "Distinct_Values": distinct_c
            })

        columns = ["Column_Name", "Null_Count", "Null_Percentage", "Distinct_Values"]
        dup_count = int(df.duplicated().sum())

        explanation = f"Data quality check across {row_count:,} rows and {col_count} columns: found {total_nulls} total missing values and {dup_count} duplicate rows."

        return {
            "capability": Capability.QUALITY.value,
            "query_type": Capability.QUALITY.value,
            "requires_sql": False,
            "query": query,
            "sql": "-- No SQL required (Statistical profiling via DatasetProfiler)",
            "rows": rows,
            "columns": columns,
            "explanation": explanation,
            "chartConfig": {"type": "bar", "xAxisKey": "Column_Name", "yAxisKey": "Null_Count", "title": "Missing Value Distribution"},
            "businessInsights": [
                f"Total Records: {row_count:,} | Duplicate Rows: {dup_count}",
                f"Completeness Score: {round(((row_count * col_count - total_nulls) / (row_count * col_count)) * 100, 1)}%",
                f"Columns with 100% complete data: {len([r for r in rows if r['Null_Count'] == 0])} of {col_count}"
            ],
            "confidenceScore": int(understanding.confidence * 100),
            "executionPath": "DatasetProfiler Direct Resolution — Data Quality (No SQL Needed)",
            "followUpQuestions": understanding.clarification_suggestions,
            "datasetMemory": brain_profile,
        }

    @classmethod
    def _handle_summary(
        cls, query: str, brain_profile: Dict[str, Any], understanding: QueryUnderstanding
    ) -> Dict[str, Any]:
        domain = brain_profile.get("domain", "General Business Analytics")
        domain_conf = brain_profile.get("domain_confidence", 90)
        row_c = brain_profile.get("row_count", 0)
        col_c = brain_profile.get("col_count", 0)
        dataset_name = brain_profile.get("dataset_name", "Dataset")

        explanation = (
            f"**{dataset_name} Overview**: Classifying as **{domain}** ({domain_conf}% confidence). "
            f"The dataset contains **{row_c:,} rows** and **{col_c} attributes** covering "
            f"metrics ({', '.join(brain_profile.get('metrics', [])[:3])}) and dimensions ({', '.join(brain_profile.get('dimensions', [])[:3])})."
        )

        rows = [
            {"Attribute": "Dataset Name", "Details": dataset_name},
            {"Attribute": "Inferred Industry Domain", "Details": f"{domain} ({domain_conf}% confidence)"},
            {"Attribute": "Total Records", "Details": f"{row_c:,}"},
            {"Attribute": "Total Columns", "Details": str(col_c)},
            {"Attribute": "Primary Metrics", "Details": ", ".join(brain_profile.get("metrics", [])[:4])},
            {"Attribute": "Primary Dimensions", "Details": ", ".join(brain_profile.get("dimensions", [])[:4])},
        ]
        columns = ["Attribute", "Details"]

        return {
            "capability": Capability.SUMMARY.value,
            "query_type": Capability.SUMMARY.value,
            "requires_sql": False,
            "query": query,
            "sql": "-- No SQL required (Executive Summary via DatasetBrain)",
            "rows": rows,
            "columns": columns,
            "explanation": explanation,
            "chartConfig": {"type": "kpi", "xAxisKey": "Attribute", "yAxisKey": "Details", "title": "Dataset Executive Profile"},
            "businessInsights": [
                f"Domain: {domain}",
                f"Size: {row_c:,} rows x {col_c} columns",
                "Ready for natural language analytical queries & automated charting."
            ],
            "confidenceScore": int(understanding.confidence * 100),
            "executionPath": "DatasetBrain Direct Resolution — Executive Overview (No SQL Needed)",
            "followUpQuestions": understanding.clarification_suggestions,
            "datasetMemory": brain_profile,
        }

    @classmethod
    def _handle_out_of_scope(
        cls, query: str, brain_profile: Dict[str, Any], understanding: QueryUnderstanding
    ) -> Dict[str, Any]:
        """
        Handles general/conceptual questions that are not answerable via SQL —
        e.g. 'mention risks related to the dataset?', 'what are the challenges?'.
        Returns an explanatory response that guides the user toward data questions.
        """
        domain = brain_profile.get("domain", "Business Analytics")
        dataset_name = brain_profile.get("dataset_name", "Dataset")
        metrics = brain_profile.get("metrics", [])
        dimensions = brain_profile.get("dimensions", [])

        explanation = (
            f"Your question **'{query}'** appears to be a conceptual or general question that "
            f"I cannot answer directly from the **{dataset_name}** data. \n\n"
            f"I can help you explore the **{domain}** dataset analytically — for example, you can ask me about "
            f"trends, totals, averages, rankings, and breakdowns across metrics like "
            f"{', '.join(metrics[:3]) or 'your available metrics'} and dimensions like "
            f"{', '.join(dimensions[:3]) or 'your available dimensions'}."
        )

        return {
            "capability": Capability.OUT_OF_SCOPE.value,
            "query_type": Capability.OUT_OF_SCOPE.value,
            "requires_sql": False,
            "query": query,
            "sql": "-- No SQL generated (Question is conceptual / out-of-scope for data analytics)",
            "rows": [],
            "columns": [],
            "explanation": explanation,
            "chartConfig": {"type": "table", "title": "Out of Scope"},
            "businessInsights": [
                f"This question is not directly answerable from the '{dataset_name}' data.",
                "Try asking analytical questions like: 'What are the top customers by sales?' or 'Show monthly trends'.",
                f"Dataset domain: {domain} | Metrics: {', '.join(metrics[:3])}"
            ],
            "confidenceScore": int(understanding.confidence * 100),
            "executionPath": "Out-of-Scope Detection — No SQL Execution",
            "followUpQuestions": understanding.clarification_suggestions,
            "datasetMemory": brain_profile,
        }
