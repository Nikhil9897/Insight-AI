"""
query_classifier.py — Query Classification & Pre-Execution Intent Classifier
=============================================================================
Evaluates natural language questions BEFORE SQL generation to determine whether
the query can be answered directly via DatasetBrain metadata, DatasetProfiler statistics,
or Dataset summaries (no SQL needed), or if it requires analytical data retrieval and SQL execution.
"""

import re
import logging
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("insightai.query_classifier")


class QueryType(str, Enum):
    SCHEMA = "schema"
    METADATA = "metadata"
    DATA_QUALITY = "data_quality"
    EXPLANATION = "explanation"
    GREETING = "greeting"
    ANALYTICS = "analytics"


class ClassificationResult(BaseModel):
    query_type: QueryType
    confidence: float = 1.0
    reasoning: str = ""
    requires_sql: bool = True
    clarification_suggestions: List[str] = []


_ANALYTICAL_VERBS = [
    "show", "compare", "trend", "highest", "top", "average", "avg", "mean",
    "sum", "total", "count", "group", "rank", "distribution", "correlation",
    "growth", "forecast", "drove", "driving", "by", "per", "across", "breakdown",
    "bottom", "lowest", "least", "most", "proportion", "percentage", "share",
    "monthly", "yearly", "daily", "quarterly", "over time", "vs", "versus"
]

_SCHEMA_KEYWORDS = [
    "columns", "schema", "tables", "dataset columns", "available columns",
    "column names", "field names", "what columns", "list columns", "show columns",
    "fields", "attributes", "what fields", "available fields"
]

_METADATA_KEYWORDS = [
    "what metrics", "metrics available", "available metrics", "dimensions",
    "what dimensions", "available dimensions", "date columns", "time columns",
    "data type", "types of columns", "relationships", "column types"
]

_DATA_QUALITY_KEYWORDS = [
    "missing values", "null values", "blank values", "empty values",
    "missing data", "nulls", "na values", "duplicates", "duplicate rows",
    "duplicate records", "data quality", "row count", "how many rows",
    "column count", "how many columns", "dataset size", "unique values"
]

_EXPLANATION_KEYWORDS = [
    "explain this dataset", "describe dataset", "dataset overview",
    "dataset summary", "what is this dataset", "summarize data",
    "summarize dataset", "overview of data", "tell me about this dataset",
    "what does this dataset contain", "dataset scope"
]

_GREETING_KEYWORDS = [
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon",
    "help", "what can you do", "who are you", "thanks", "thank you"
]


class QueryClassifier:
    """
    First-stage Query Classifier.
    Decides whether a question is SCHEMA, METADATA, DATA_QUALITY, EXPLANATION, GREETING, or ANALYTICS.
    """

    @classmethod
    def classify(cls, query: str, brain_profile: Optional[Dict[str, Any]] = None) -> ClassificationResult:
        q = query.strip()
        q_lower = q.lower()
        
        metrics = brain_profile.get('metrics', []) if brain_profile else []
        dimensions = brain_profile.get('dimensions', []) if brain_profile else []
        time_cols = brain_profile.get('time_columns', []) if brain_profile else []

        # 1. GREETING check
        words = re.findall(r'\b[a-z]+\b', q_lower)
        if len(words) <= 3 and any(w in _GREETING_KEYWORDS for w in words):
            return ClassificationResult(
                query_type=QueryType.GREETING,
                confidence=0.99,
                reasoning="Conversational greeting or assistance prompt.",
                requires_sql=False,
                clarification_suggestions=cls._build_adaptive_suggestions(brain_profile)
            )

        # 2. EXPLANATION check
        if any(kw in q_lower for kw in _EXPLANATION_KEYWORDS):
            return ClassificationResult(
                query_type=QueryType.EXPLANATION,
                confidence=0.98,
                reasoning="Explanatory dataset overview request resolved via DatasetBrain profile.",
                requires_sql=False,
                clarification_suggestions=cls._build_adaptive_suggestions(brain_profile)
            )

        # 3. SCHEMA & METADATA check
        if any(kw in q_lower for kw in _SCHEMA_KEYWORDS):
            return ClassificationResult(
                query_type=QueryType.SCHEMA,
                confidence=0.99,
                reasoning="Dataset schema / column list inquiry resolved directly via DatasetBrain.",
                requires_sql=False,
                clarification_suggestions=cls._build_adaptive_suggestions(brain_profile)
            )

        if any(kw in q_lower for kw in _METADATA_KEYWORDS):
            return ClassificationResult(
                query_type=QueryType.METADATA,
                confidence=0.97,
                reasoning="Dataset metrics & dimensions metadata query resolved via DatasetBrain.",
                requires_sql=False,
                clarification_suggestions=cls._build_adaptive_suggestions(brain_profile)
            )

        # 4. DATA_QUALITY check
        has_groupby = any(kw in q_lower for kw in ["by", "per", "grouped by", "for each", "across"])
        if any(kw in q_lower for kw in _DATA_QUALITY_KEYWORDS) and not has_groupby:
            return ClassificationResult(
                query_type=QueryType.DATA_QUALITY,
                confidence=0.96,
                reasoning="Data quality / statistical profiling request resolved via DatasetProfiler.",
                requires_sql=False,
                clarification_suggestions=cls._build_adaptive_suggestions(brain_profile)
            )

        # 5. ANALYTICS check — contains analytical verbs, column names, or aggregations
        has_analytical_verb = any(re.search(rf'\b{re.escape(v)}\b', q_lower) for v in _ANALYTICAL_VERBS)
        has_column_mention = False
        if brain_profile:
            all_cols = brain_profile.get('columns', [])
            has_column_mention = any(c.lower() in q_lower for c in all_cols)

        if has_analytical_verb or has_column_mention or len(words) > 3:
            confidence = 0.95 if (has_analytical_verb or has_column_mention) else 0.65
            suggestions = []
            if confidence < 0.70:
                suggestions = cls._build_adaptive_suggestions(brain_profile)

            return ClassificationResult(
                query_type=QueryType.ANALYTICS,
                confidence=confidence,
                reasoning="Analytical data query requiring grounded ExecutionPlan and SQL execution.",
                requires_sql=True,
                clarification_suggestions=suggestions
            )

        # Default fallback: ANALYTICS with adaptive clarification suggestions
        return ClassificationResult(
            query_type=QueryType.ANALYTICS,
            confidence=0.60,
            reasoning="Uncertain intent — defaulting to analytics with clarifying suggestions.",
            requires_sql=True,
            clarification_suggestions=cls._build_adaptive_suggestions(brain_profile)
        )

    @classmethod
    def _build_adaptive_suggestions(cls, brain_profile: Optional[Dict[str, Any]]) -> List[str]:
        """
        Builds domain-adaptive query suggestions based on DatasetBrain profile.
        """
        if not brain_profile:
            return [
                "Show total summary metrics",
                "What columns are available?",
                "Are there any missing values?",
                "Describe this dataset"
            ]

        domain = brain_profile.get('domain', 'General Business Analytics')
        metrics = brain_profile.get('metrics', [])
        dimensions = brain_profile.get('dimensions', [])
        time_cols = brain_profile.get('time_columns', [])

        m1 = metrics[0] if metrics else "Sales"
        d1 = dimensions[0] if dimensions else "Category"
        t1 = time_cols[0] if time_cols else "Date"

        if "Sales" in domain or "Retail" in domain or "E-Commerce" in domain:
            return [
                f"Top 10 {d1}s by {m1}",
                f"Monthly {m1} trend",
                f"Total {m1} breakdown by {d1}",
                "What columns are available in this dataset?"
            ]
        elif "Healthcare" in domain:
            return [
                f"Total {m1} by {d1}",
                f"Monthly {m1} trend over {t1}",
                "Are there any missing or null values?",
                "Explain this dataset"
            ]
        elif "HR" in domain:
            return [
                f"Average {m1} by {d1}",
                f"Top {d1}s by {m1}",
                "Show dataset summary and schema",
                "Check data quality and duplicates"
            ]
        else:
            return [
                f"Top {d1}s by {m1}",
                f"Total {m1} grouped by {d1}",
                "What metrics and dimensions are available?",
                "Describe this dataset"
            ]
