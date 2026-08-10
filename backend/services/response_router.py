"""
response_router.py — Capability-Based Query Response Router
===========================================================
Routes user queries using the output of QueryUnderstandingEngine:
1. Direct DatasetBrain / DatasetProfiler resolution for SCHEMA, PROFILE, QUALITY, SUMMARY, and HELP capabilities (No SQL needed, <2ms execution).
2. Grounded QueryPlanner & NL2SQLEngine SQL pipeline for QUERY and VISUALIZATION capabilities.
3. LLM-powered conceptual Q&A for OUT_OF_SCOPE / general dataset questions.
"""

import json
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
        Handles general/conceptual questions about the dataset using the LLM.
        Instead of refusing, generates a real, informed answer grounded in the
        DatasetBrain profile — e.g. 'what are the risks?', 'give me insights',
        'what challenges exist in this data?', 'summarise this dataset'.

        Falls back to a rule-based response if no LLM is available.
        """
        domain = brain_profile.get("domain", "Business Analytics")
        dataset_name = brain_profile.get("dataset_name", "Dataset")
        metrics: List[str] = brain_profile.get("metrics", [])
        dimensions: List[str] = brain_profile.get("dimensions", [])
        time_cols: List[str] = brain_profile.get("time_columns", [])
        row_count: int = brain_profile.get("row_count", 0)
        col_count: int = brain_profile.get("col_count", 0)
        col_meta: Dict[str, Any] = brain_profile.get("column_metadata", {})

        # Build a compact schema summary for the LLM
        schema_lines = []
        for col, meta in col_meta.items():
            role = meta.get("business_role", "Dimension")
            col_type = meta.get("type", "categorical")
            cardinality = meta.get("cardinality", 0)
            examples = meta.get("example_values", [])[:3]
            schema_lines.append(
                f"  - {col} ({col_type}, {role}) — {cardinality} distinct values, e.g. {examples}"
            )
        schema_block = "\n".join(schema_lines) if schema_lines else "  (no column metadata)"

        llm_answer: Optional[str] = None
        insights: List[str] = []

        # ── Try LLM-powered conceptual answer ─────────────────────────────────
        try:
            from backend.services.llm_service import generate_llm_content_with_fallback
            from backend.config import settings

            has_llm = bool(
                settings.LLM_PROVIDER == "ollama"
                or settings.GROQ_API_KEY
                or settings.GEMINI_API_KEY
            )

            if has_llm:
                prompt = f"""You are an expert Data Analyst and Chief Data Officer.

A user has asked a general or conceptual question about the following dataset.
Answer the question directly and helpfully using your knowledge of the dataset's structure and domain.
Do NOT say you cannot answer. Provide a substantive, structured answer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATASET: {dataset_name}
DOMAIN:  {domain}
SIZE:    {row_count:,} rows × {col_count} columns

COLUMN SCHEMA:
{schema_block}

METRICS  (numeric): {json.dumps(metrics)}
DIMENSIONS (categorical): {json.dumps(dimensions)}
TIME COLUMNS: {json.dumps(time_cols)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER QUESTION: "{query}"

Answer the question in a helpful, structured way:
- Use bullet points or numbered lists where appropriate.
- Ground your answer in the actual dataset schema above (mention real column names).
- Be specific — do not give generic advice.
- Keep your answer under 300 words.
- Do NOT suggest the user ask a different question — answer this one.

Return ONLY valid JSON with this structure:
{{
  "answer": "Your full structured answer here (plain text with \\n for line breaks)",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "suggested_follow_ups": ["Analytical question 1", "Analytical question 2", "Analytical question 3"]
}}"""

                raw = generate_llm_content_with_fallback(prompt)
                parsed = json.loads(raw)
                llm_answer = parsed.get("answer", "")
                insights = parsed.get("key_points", [])
                follow_ups = parsed.get("suggested_follow_ups", [])
                logger.info(f"[ResponseRouter] LLM answered conceptual query: '{query[:60]}'")

        except Exception as llm_err:
            logger.warning(f"[ResponseRouter] LLM conceptual Q&A failed: {llm_err}")
            llm_answer = None
            follow_ups = []

        # ── Rule-based fallback if LLM unavailable ────────────────────────────
        if not llm_answer:
            llm_answer = _rule_based_conceptual_answer(query, dataset_name, domain, metrics, dimensions, col_meta, row_count)
            insights = [
                f"Dataset domain: {domain} with {row_count:,} records.",
                f"Key metrics: {', '.join(metrics[:4]) or 'none detected'}.",
                f"Key dimensions: {', '.join(dimensions[:4]) or 'none detected'}.",
            ]
            follow_ups = [
                f"Show total {metrics[0]} by {dimensions[0]}" if metrics and dimensions else "Show me a summary of the data",
                f"What are the top 10 records by {metrics[0]}?" if metrics else "Show me the first 10 rows",
                f"Monthly trend of {metrics[0]}" if metrics and time_cols else "Show distribution of key metrics",
            ]

        return {
            "capability": Capability.OUT_OF_SCOPE.value,
            "query_type": "CONCEPTUAL_QA",
            "requires_sql": False,
            "query": query,
            "sql": "-- No SQL needed (Conceptual question answered via DatasetBrain + LLM)",
            "rows": [],
            "columns": [],
            "explanation": llm_answer,
            "chartConfig": {"type": "table", "xAxisKey": "", "yAxisKey": "", "title": "Dataset Insights"},
            "businessInsights": insights,
            "confidenceScore": int(understanding.confidence * 100),
            "executionPath": "LLM Conceptual Q&A — DatasetBrain Context (No SQL)",
            "followUpQuestions": follow_ups,
            "datasetMemory": brain_profile,
        }


def _rule_based_conceptual_answer(
    query: str,
    dataset_name: str,
    domain: str,
    metrics: List[str],
    dimensions: List[str],
    col_meta: Dict[str, Any],
    row_count: int,
) -> str:
    """
    Generates a structured conceptual answer without an LLM.
    Detects the question intent (risks, insights, summary, challenges, etc.)
    and builds a relevant response from the DatasetBrain profile.
    """
    q = query.lower()

    # Detect what kind of conceptual question this is
    is_risk = any(k in q for k in ["risk", "risks", "danger", "threat", "concern", "issue"])
    is_insight = any(k in q for k in ["insight", "insights", "pattern", "tell me", "what do"])
    is_challenge = any(k in q for k in ["challenge", "challenges", "problem", "difficulty"])
    is_summary = any(k in q for k in ["summary", "summarise", "summarize", "overview", "describe"])
    is_quality = any(k in q for k in ["quality", "clean", "missing", "null", "incomplete"])

    m_list = ", ".join(metrics[:4]) or "numerical measures"
    d_list = ", ".join(dimensions[:4]) or "categorical dimensions"

    if is_risk:
        return (
            f"**Risk Factors in the '{dataset_name}' Dataset ({domain}):**\n\n"
            f"Based on the dataset structure, here are potential risk considerations:\n\n"
            f"1. **Data Completeness Risk** — With {row_count:,} records, any missing values "
            f"in key metrics ({m_list}) could skew aggregate results.\n"
            f"2. **Outlier Sensitivity** — Metrics like {m_list} may contain extreme outliers "
            f"that distort averages and totals — always check MIN/MAX ranges.\n"
            f"3. **Dimension Cardinality Risk** — High-cardinality dimensions "
            f"(many unique values) can fragment analysis and produce thin segments.\n"
            f"4. **Temporal Coverage** — If the dataset has a narrow date range, "
            f"trend analysis may not represent long-term patterns reliably.\n"
            f"5. **Aggregation Mismatch** — Summing percentage-based columns (like discount rates) "
            f"rather than averaging them is a common analytical error.\n\n"
            f"*Tip: Ask me analytical questions to quantify these risks — e.g. "
            f"'Show missing value count per column' or 'What are the top outliers in {metrics[0] if metrics else 'Sales'}?'*"
        )

    if is_challenge:
        return (
            f"**Key Challenges with the '{dataset_name}' Dataset:**\n\n"
            f"1. **Cross-dimensional Analysis** — Combining metrics ({m_list}) "
            f"across multiple dimensions ({d_list}) simultaneously can become complex.\n"
            f"2. **Time-based Comparison** — Period-over-period comparisons require "
            f"careful date range alignment to avoid misleading results.\n"
            f"3. **Attribution** — Determining which dimension drives the most "
            f"impact on a metric often requires multi-variable analysis.\n"
            f"4. **Data Granularity** — Row-level data with {row_count:,} records may need "
            f"grouping/aggregation to surface meaningful patterns."
        )

    if is_quality:
        return (
            f"**Data Quality Assessment for '{dataset_name}':**\n\n"
            f"To fully assess data quality, I recommend asking:\n"
            f"- 'Show null/missing value count per column'\n"
            f"- 'Show duplicate record count'\n"
            f"- 'What are the minimum and maximum values of {metrics[0] if metrics else 'each metric'}?'\n\n"
            f"From the schema analysis:\n"
            f"- {len(metrics)} numeric metric columns detected: {m_list}\n"
            f"- {len(dimensions)} categorical dimension columns: {d_list}\n"
            f"- {row_count:,} total records loaded\n\n"
            f"*Ask me 'show data quality report' for a detailed breakdown.*"
        )

    if is_insight or is_summary:
        return (
            f"**'{dataset_name}' Dataset Overview ({domain}):**\n\n"
            f"- **Size:** {row_count:,} records\n"
            f"- **Key Metrics (numeric):** {m_list}\n"
            f"- **Key Dimensions (categorical):** {d_list}\n\n"
            f"**What this dataset can tell you:**\n"
            f"- Performance rankings (e.g. top segments by {metrics[0] if metrics else 'value'})\n"
            f"- Trend analysis over time\n"
            f"- Cross-dimensional breakdowns and comparisons\n"
            f"- Distribution and outlier detection\n\n"
            f"*Ask me any analytical question to start exploring.*"
        )

    # Generic fallback
    return (
        f"**About the '{dataset_name}' Dataset:**\n\n"
        f"Domain: {domain} | Records: {row_count:,}\n"
        f"Metrics: {m_list}\n"
        f"Dimensions: {d_list}\n\n"
        f"This is a {domain.lower()} dataset. You can ask me analytical questions about "
        f"trends, totals, rankings, and breakdowns across these columns.\n\n"
        f"*For conceptual questions about risks, challenges, or insights, I can provide "
        f"a dataset-aware analysis — just ask!*"
    )
