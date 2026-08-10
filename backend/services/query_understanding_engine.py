"""
query_understanding_engine.py — Unified Query Understanding Engine
===================================================================
Single-pass Query Understanding Engine that combines:
1. Multi-Signal Capability Detection (Scoring-based, scalable Enum)
2. DatasetBrain-Aware Entity & Value Extraction (Metrics, Dimensions, Filters)
3. Single-Pass ExecutionPlan Construction
"""

import re
import logging
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field

from backend.nl2sql_engine.resolver import SchemaResolver

logger = logging.getLogger("insightai.query_understanding")


class Capability(str, Enum):
    SCHEMA = "SCHEMA"           # Columns, schema, field names
    PROFILE = "PROFILE"         # Column data types & cardinality profiles
    QUALITY = "QUALITY"         # Missing values, nulls, duplicate records
    SUMMARY = "SUMMARY"         # Dataset overview, business domain description
    QUERY = "QUERY"             # Data analytics query requiring SQL execution
    VISUALIZATION = "VISUALIZATION" # Explicit chart/graph generation
    HELP = "HELP"               # Conversational greetings & assistant capabilities
    OUT_OF_SCOPE = "OUT_OF_SCOPE"   # Conceptual/general questions not answerable via SQL
    # Extensible for future: EXPORT, DASHBOARD, FORECAST, ANOMALY_DETECTION


class FilterEntity(BaseModel):
    column: str
    operator: str = "="          # =, >, <, >=, <=, between, contains, year_eq, is_null
    value: Any
    value2: Optional[Any] = None


class QueryEntity(BaseModel):
    metrics: List[str] = []
    dimensions: List[str] = []
    filters: List[FilterEntity] = []
    time_dimension: Optional[str] = None
    time_granularity: Optional[str] = None


class ExecutionPlan(BaseModel):
    intent: str = "aggregation"        # ranking, trend, aggregation, distribution, comparison
    metric: Optional[str] = None
    metrics: List[str] = []
    aggregation: str = "SUM"           # SUM, AVG, COUNT, MAX, MIN
    dimension: Optional[str] = None
    group_by: List[str] = []
    filters: List[Dict[str, Any]] = []
    sort_column: Optional[str] = None
    sort_direction: str = "DESC"
    limit_val: Optional[int] = None
    time_dimension: Optional[str] = None
    time_granularity: Optional[str] = None
    chart_hint: Optional[str] = None
    analysis_shape: str = "CATEGORICAL" # TIME_SERIES, TOP_N, CATEGORICAL, SINGLE_VALUE, DISTRIBUTION
    confidence: float = 1.0



class QueryUnderstanding(BaseModel):
    query: str
    capability: Capability
    confidence: float = 1.0
    requires_sql: bool = True
    entities: QueryEntity
    execution_plan: ExecutionPlan
    reasoning: List[str] = []
    clarification_suggestions: List[str] = []


_ANALYTICAL_VERBS = [
    "show", "compare", "trend", "highest", "top", "average", "avg", "mean",
    "sum", "total", "count", "group", "rank", "distribution", "correlation",
    "growth", "forecast", "drove", "driving", "by", "per", "across", "breakdown",
    "bottom", "lowest", "least", "most", "proportion", "percentage", "share",
    "monthly", "yearly", "daily", "quarterly", "over time", "vs", "versus"
]

_SCHEMA_TERMS = ["columns", "schema", "tables", "fields", "available columns", "field names"]
_QUALITY_TERMS = ["missing", "null", "blank", "duplicates", "quality", "data quality", "nulls"]
_SUMMARY_TERMS = ["explain", "describe", "summarize", "overview", "what is this dataset"]
_HELP_TERMS = ["hello", "hi", "hey", "help", "thanks", "thank you", "who are you"]
_VIZ_TERMS = ["chart", "graph", "plot", "pie", "bar chart", "line chart", "histogram", "scatter plot", "donut"]

# Signals that a question is conceptual/general — NOT a data query answerable by SQL.
# These are intentionally specific to avoid false positives on real analytics queries.
_OUT_OF_SCOPE_SIGNALS = [
    "risk", "risks", "advice", "suggest", "recommendation", "predict", "forecast",
    "opinion", "why", "what should", "how should", "what do you think",
    "tell me about", "explain to me", "can you explain", "what are the",
    "disadvantages", "advantages", "pros", "cons", "best practice",
    "limitation", "limitations", "concern", "concerns", "issue", "issues",
    "problem", "problems", "challenge", "challenges",
]


class QueryUnderstandingEngine:
    """
    Unified Query Understanding Engine.
    Executes capability scoring, DatasetBrain entity grounding, filter detection, and ExecutionPlan creation in one pass.
    """

    @classmethod
    def understand(cls, query: str, brain_profile: Optional[Dict[str, Any]] = None) -> QueryUnderstanding:
        q = query.strip()
        q_lower = q.lower()
        reasoning: List[str] = []

        available_cols = brain_profile.get('columns', []) if brain_profile else []
        metrics_schema = brain_profile.get('metrics', []) if brain_profile else []
        dims_schema = brain_profile.get('dimensions', []) if brain_profile else []
        time_cols_schema = brain_profile.get('time_columns', []) if brain_profile else []
        value_index = brain_profile.get('value_index', {}) if brain_profile else {}
        column_metadata = brain_profile.get('column_metadata', {}) if brain_profile else {}

        tokens = [t.strip(',.?!') for t in q_lower.split() if len(t.strip(',.?!')) > 2]

        # ── STEP 1: DATASET-AWARE ENTITY & FILTER DETECTION ────────────────────
        detected_metrics: List[str] = []
        detected_dims: List[str] = []
        detected_filters: List[FilterEntity] = []
        filtered_cols = set()

        # 1a. Value-to-Column Lookup via DatasetBrain
        for token in tokens:
            val_res = SchemaResolver.resolve_value(token, value_index, column_metadata)
            if val_res:
                f_col, f_val = val_res
                if not any(f.column == f_col and f.value == f_val for f in detected_filters):
                    detected_filters.append(FilterEntity(column=f_col, operator="=", value=f_val))
                    filtered_cols.add(f_col)
                    reasoning.append(f"Bound filter '{f_col} = {f_val}' via DatasetBrain categorical value index.")

        # 1b. Numeric & Date Filters via Regex
        gt_m = re.search(r'\b(above|greater than|over|more than|>)\s*([\d,\.]+)', q_lower)
        if gt_m:
            num_v = float(gt_m.group(2).replace(',', ''))
            m_target = metrics_schema[0] if metrics_schema else "Sales"
            detected_filters.append(FilterEntity(column=m_target, operator=">", value=num_v))
            reasoning.append(f"Detected numeric filter '{m_target} > {num_v}'.")

        lt_m = re.search(r'\b(below|less than|under|<)\s*([\d,\.]+)', q_lower)
        if lt_m:
            num_v = float(lt_m.group(2).replace(',', ''))
            m_target = metrics_schema[0] if metrics_schema else "Sales"
            detected_filters.append(FilterEntity(column=m_target, operator="<", value=num_v))
            reasoning.append(f"Detected numeric filter '{m_target} < {num_v}'.")

        yr_m = re.search(r'\b(in|for|after|during|year)\s+(20\d{2}|19\d{2})\b', q_lower)
        if yr_m:
            yr_v = int(yr_m.group(2))
            dt_col = time_cols_schema[0] if time_cols_schema else None
            if dt_col:
                op = ">" if "after" in q_lower else "year_eq"
                detected_filters.append(FilterEntity(column=dt_col, operator=op, value=yr_v))
                reasoning.append(f"Detected date filter '{dt_col} {op} {yr_v}'.")

        # 1c. Column Entity Resolution (Metrics, Dimensions, Time)
        has_explicit_grouping = bool(re.search(r'\b(by|per|across|grouped by|for each)\b', q_lower))

        for token in tokens:
            res_col = SchemaResolver.resolve_column(token, available_cols)
            if res_col:
                if res_col in metrics_schema:
                    if res_col not in detected_metrics:
                        detected_metrics.append(res_col)
                        reasoning.append(f"Mapped metric '{res_col}'.")
                elif res_col in dims_schema or res_col in time_cols_schema:
                    if res_col not in detected_dims:
                        # Omit if column has single-value equality filter unless explicitly grouped
                        if res_col not in filtered_cols or (has_explicit_grouping and re.search(rf'\b(by|per)\s+{token}\b', q_lower)):
                            detected_dims.append(res_col)
                            reasoning.append(f"Mapped dimension '{res_col}'.")

        has_ranking = bool(re.search(r'\b(top|first|highest|best|worst|rank|driving)\b', q_lower))

        # Metric & Dimension Fallbacks — only inject defaults when there is clear analytical intent.
        # Unconditional injection previously caused conceptual questions to score as QUERY.
        has_clear_analytical_intent = has_explicit_grouping or has_ranking or bool(
            re.search(r'\b(show|compare|total|sum|average|count|trend|distribution)\b', q_lower)
        )
        if not detected_metrics and metrics_schema and has_clear_analytical_intent:
            detected_metrics.append(metrics_schema[0])
            reasoning.append(f"Defaulted primary metric to '{metrics_schema[0]}'.")

        if not detected_dims and dims_schema and (has_explicit_grouping or has_ranking):
            cand = [d for d in dims_schema if d not in filtered_cols]
            if cand:
                detected_dims.append(cand[0])
                reasoning.append(f"Grounded primary dimension to '{cand[0]}'.")
            elif dims_schema:
                detected_dims.append(dims_schema[0])


        time_dim = time_cols_schema[0] if time_cols_schema else None
        time_gran = None
        if re.search(r'\b(monthly|by month|per month)\b', q_lower):
            time_gran = "month"
        elif re.search(r'\b(yearly|by year|annually)\b', q_lower):
            time_gran = "year"
        elif re.search(r'\b(daily|by day)\b', q_lower):
            time_gran = "day"
        elif re.search(r'\b(quarterly|by quarter)\b', q_lower):
            time_gran = "quarter"

        entities = QueryEntity(
            metrics=detected_metrics,
            dimensions=detected_dims,
            filters=detected_filters,
            time_dimension=time_dim,
            time_granularity=time_gran
        )

        # ── STEP 2: MULTI-SIGNAL CAPABILITY SCORING ────────────────────────────
        scores: Dict[Capability, float] = {
            Capability.SCHEMA: 0.0,
            Capability.PROFILE: 0.0,
            Capability.QUALITY: 0.0,
            Capability.SUMMARY: 0.0,
            Capability.HELP: 0.0,
            Capability.VISUALIZATION: 0.0,
            Capability.QUERY: 0.0,
            Capability.OUT_OF_SCOPE: 0.0,
        }

        # Signal A: Schema / Columns terms
        if any(kw in q_lower for kw in _SCHEMA_TERMS):
            scores[Capability.SCHEMA] += 0.85

        # Signal B: Quality terms
        if any(kw in q_lower for kw in _QUALITY_TERMS) and not has_explicit_grouping:
            scores[Capability.QUALITY] += 0.85

        # Signal C: Summary / Overview terms
        if any(kw in q_lower for kw in _SUMMARY_TERMS):
            scores[Capability.SUMMARY] += 0.85

        # Signal D: Help / Greeting terms
        if len(tokens) <= 2 and any(kw in q_lower for kw in _HELP_TERMS):
            scores[Capability.HELP] += 0.95

        # Signal E: Visualization terms
        if any(kw in q_lower for kw in _VIZ_TERMS):
            scores[Capability.VISUALIZATION] += 0.70

        # Signal F: QUERY (Analytical multi-signal score accumulation)
        # Only counts metrics/dims that were explicitly mentioned in the query (no fallback defaults).
        query_score = 0.0
        if detected_metrics:
            query_score += 0.35
        if detected_dims:
            query_score += 0.25
        if any(re.search(rf'\b{re.escape(v)}\b', q_lower) for v in _ANALYTICAL_VERBS):
            query_score += 0.20
        if detected_filters:
            query_score += 0.15
        if time_gran:
            query_score += 0.15
        scores[Capability.QUERY] = min(0.99, query_score)

        # Signal G: OUT_OF_SCOPE — conceptual / general question, not answerable via SQL.
        # Boost if out-of-scope terms are present AND no strong column grounding found.
        oos_keyword_hit = any(kw in q_lower for kw in _OUT_OF_SCOPE_SIGNALS)
        has_column_grounding = bool(detected_metrics or detected_dims or detected_filters)
        if oos_keyword_hit and not has_column_grounding:
            scores[Capability.OUT_OF_SCOPE] += 0.80
            reasoning.append("Out-of-scope signal detected with no column grounding — routing to OUT_OF_SCOPE.")
        elif oos_keyword_hit:
            # Conceptual word present but some column grounding exists — penalise QUERY slightly
            scores[Capability.QUERY] = max(0.0, scores[Capability.QUERY] - 0.15)
            reasoning.append("Out-of-scope signal present alongside column grounding — QUERY score penalised.")

        # Select Winner Capability based on maximum score
        winner_cap = max(scores.keys(), key=lambda k: scores[k])
        win_score = round(scores[winner_cap], 2)

        # If winner score is too low, default to OUT_OF_SCOPE (safer than blindly running SQL)
        if win_score < 0.30:
            winner_cap = Capability.OUT_OF_SCOPE
            win_score = 0.50
            reasoning.append("Low overall confidence — defaulting to OUT_OF_SCOPE (no SQL execution).")

        requires_sql = winner_cap in (Capability.QUERY, Capability.VISUALIZATION)
        reasoning.append(f"Capability scoring winner: {winner_cap.value} (score={win_score:.2f}).")

        # Build adaptive clarification suggestions if confidence is low
        suggestions: List[str] = []
        if win_score < 0.70 or winner_cap == Capability.HELP:
            suggestions = cls._build_adaptive_suggestions(brain_profile)

        # ── STEP 3: CONSTRUCT GROUNDED EXECUTION PLAN ──────────────────────────
        intent = "aggregation"
        limit_val = None
        sort_col = detected_metrics[0] if detected_metrics else None
        sort_dir = "DESC"

        if re.search(r'\b(top|highest|rank|best|lowest|bottom|worst|driving)\b', q_lower):
            intent = "ranking"
            sort_dir = "ASC" if re.search(r'\b(lowest|bottom|worst|least)\b', q_lower) else "DESC"
            lim_m = re.search(r'\b(top|first|limit|bottom)\s+(\d+)\b', q_lower)
            limit_val = int(lim_m.group(2)) if lim_m else 10

        elif time_cols_schema and (re.search(r'\b(trend|over time|monthly|yearly|daily)\b', q_lower) or time_gran):
            intent = "trend"
            sort_dir = "ASC"

        elif re.search(r'\b(distribution|range|spread|histogram)\b', q_lower):
            intent = "distribution"

        # Shape inference
        if intent == "trend" or time_gran or (detected_dims and detected_dims[0] in time_cols_schema):
            shape = "TIME_SERIES"
        elif intent == "ranking" or limit_val or re.search(r'\b(driving|top|highest|best|worst|rank)\b', q_lower):
            shape = "TOP_N"
        elif re.search(r'\b(percentage|share|proportion|ratio|composition)\b', q_lower):
            shape = "COMPOSITION"
        elif intent == "distribution":
            shape = "DISTRIBUTION"
        elif detected_dims:
            shape = "CATEGORICAL"
        else:
            shape = "SINGLE_VALUE"

        # Aggregate function detection
        agg_fn = "SUM"
        if re.search(r'\b(average|avg|mean)\b', q_lower):
            agg_fn = "AVG"
        elif re.search(r'\b(count|number of|total number|how many)\b', q_lower):
            agg_fn = "COUNT"
        elif re.search(r'\b(max|maximum|highest|most)\b', q_lower) and not re.search(r'\btop\b', q_lower):
            agg_fn = "MAX"
        elif re.search(r'\b(min|minimum|lowest|least|bottom)\b', q_lower):
            agg_fn = "MIN"

        # Chart hint inference
        chart_hint = "bar"
        if shape == "TIME_SERIES":
            chart_hint = "line"
        elif shape == "TOP_N":
            chart_hint = "bar"
        elif shape == "SINGLE_VALUE":
            chart_hint = "kpi"
        elif re.search(r'\b(pie|donut)\b', q_lower):
            chart_hint = "pie"

        execution_plan = ExecutionPlan(
            intent=intent,
            metric=detected_metrics[0] if detected_metrics else None,
            metrics=detected_metrics,
            aggregation=agg_fn,
            dimension=detected_dims[0] if detected_dims else None,
            group_by=detected_dims,
            filters=[{"column": f.column, "operator": f.operator, "value": f.value} for f in detected_filters],
            sort_column=sort_col,
            sort_direction=sort_dir,
            limit_val=limit_val,
            time_dimension=time_dim,
            time_granularity=time_gran,
            chart_hint=chart_hint,
            analysis_shape=shape,
            confidence=win_score
        )


        return QueryUnderstanding(
            query=query,
            capability=winner_cap,
            confidence=win_score,
            requires_sql=requires_sql,
            entities=entities,
            execution_plan=execution_plan,
            reasoning=reasoning,
            clarification_suggestions=suggestions
        )

    @classmethod
    def _build_adaptive_suggestions(cls, brain_profile: Optional[Dict[str, Any]]) -> List[str]:
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
