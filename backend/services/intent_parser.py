"""
intent_parser.py — Deterministic Rule-Based Query Intent Parser
================================================================
Converts every natural language query into a structured QueryIR (Intermediate
Representation) before any SQL is generated. The LLM is NEVER consulted here.

Capabilities (14):
  1.  Aggregation detection        (SUM/AVG/COUNT/MIN/MAX/COUNT_DISTINCT)
  2.  GroupBy detection            (by/per/grouped by/for each/…)
  3.  Filter detection             (18 operators)
  4.  Sort detection               (ASC / DESC)
  5.  Limit detection              (top N / first N / last N)
  6.  Time filter detection        (today / last week / this month / …)
  7.  Time granularity             (daily / weekly / monthly / …)
  8.  Statistical function         (median / std_dev / correlation / …)
  9.  Data quality queries         (missing values / duplicates / schema)
  10. Chart intent inference       (KPI / Bar / Line / Scatter / …)
  11. Semantic column matching     (fuzzy + synonym dictionary)
  12. Confidence scoring           (validates metric/dimension/agg existence)
  13. Intent classification        (Aggregation/Ranking/Filter/Trend/…)
  14. IR output                    (QueryIR structured JSON)
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from difflib import SequenceMatcher

from pydantic import BaseModel, Field

logger = logging.getLogger("insightai.intent_parser")

# ---------------------------------------------------------------------------
# QueryIR — Intermediate Representation
# ---------------------------------------------------------------------------

class FilterCondition(BaseModel):
    column: str
    operator: str          # eq / gt / lt / gte / lte / between / contains / starts_with /
                           # ends_with / in / not_in / is_null / is_not_null
    value: Optional[Any] = None
    value2: Optional[Any] = None   # used by BETWEEN


class SortSpec(BaseModel):
    column: str
    direction: str = "DESC"   # ASC | DESC


class QueryIR(BaseModel):
    # Core intent
    intent: str = "aggregation"   # aggregation | ranking | filter | trend | distribution |
                                   # statistical | comparison | metadata | data_quality
    # Aggregation
    aggregation: Optional[str] = None     # SUM | AVG | COUNT | MIN | MAX | COUNT_DISTINCT
    metric: Optional[str] = None          # primary numeric column
    metrics: List[str] = []               # multiple metrics when present

    # Dimensions / grouping
    dimensions: List[str] = []

    # Filters
    filters: List[FilterCondition] = []

    # Sort & limit
    sort: Optional[SortSpec] = None
    limit: Optional[int] = None

    # Time
    time_filter: Optional[Dict[str, Any]] = None
    time_granularity: Optional[str] = None   # daily | weekly | monthly | quarterly | yearly

    # Statistical
    statistical_function: Optional[str] = None   # MEDIAN | MODE | STDDEV | VARIANCE |
                                                   # PERCENTILE | QUARTILE | CORRELATION

    # Data quality / metadata flags
    is_data_quality: bool = False
    is_metadata: bool = False
    data_quality_type: Optional[str] = None   # missing | duplicates | schema | row_count | col_count

    # Visualization
    chart: Optional[str] = None   # kpi | bar | line | scatter | pie | histogram | heatmap | treemap

    # Confidence
    confidence: float = 1.0
    confidence_flags: List[str] = []

    # Raw info (for explainability)
    raw_query: str = ""
    matched_columns: Dict[str, str] = {}   # {user_term: actual_column}


# ---------------------------------------------------------------------------
# Internal keyword tables
# ---------------------------------------------------------------------------

_AGG_KEYWORDS: Dict[str, List[str]] = {
    "SUM":            ["sum", "total", "overall", "combined", "aggregate", "gross", "add up"],
    "AVG":            ["average", "avg", "mean", "on average", "typical", "per average"],
    "COUNT":          ["count", "number of", "how many", "frequency", "records", "how much", "headcount"],
    "MIN":            ["minimum", "lowest", "least", "smallest", "bottom value"],
    "MAX":            ["maximum", "highest", "largest", "greatest", "top value", "peak"],
    "COUNT_DISTINCT": ["unique", "distinct", "different", "deduplicated"],
}

# Ordered so more specific multi-word phrases are checked first
_AGG_ORDER = ["COUNT_DISTINCT", "AVG", "MIN", "MAX", "COUNT", "SUM"]

_GROUPBY_PHRASES: List[str] = [
    "broken down by", "split by", "grouped by", "for each", "by each",
    "group by", "per", "across", "by",
]

_SORT_DESC_KEYWORDS = [
    "highest", "largest", "maximum", "descending", "top", "best",
    "leading", "greatest", "most", "ranked", "ranking",
]
_SORT_ASC_KEYWORDS = [
    "lowest", "least", "smallest", "ascending", "bottom", "worst",
    "minimum", "fewest", "trailing",
]

_TIME_PATTERNS: Dict[str, Dict[str, Any]] = {
    "today":          {"type": "relative", "unit": "day",     "offset": 0},
    "yesterday":      {"type": "relative", "unit": "day",     "offset": -1},
    "this week":      {"type": "relative", "unit": "week",    "offset": 0},
    "last week":      {"type": "relative", "unit": "week",    "offset": -1},
    "this month":     {"type": "relative", "unit": "month",   "offset": 0},
    "last month":     {"type": "relative", "unit": "month",   "offset": -1},
    "this quarter":   {"type": "relative", "unit": "quarter", "offset": 0},
    "last quarter":   {"type": "relative", "unit": "quarter", "offset": -1},
    "this year":      {"type": "relative", "unit": "year",    "offset": 0},
    "last year":      {"type": "relative", "unit": "year",    "offset": -1},
    "past year":      {"type": "relative", "unit": "year",    "offset": -1},
    "past month":     {"type": "relative", "unit": "month",   "offset": -1},
    "past week":      {"type": "relative", "unit": "week",    "offset": -1},
}

_TIME_GRANULARITY: Dict[str, str] = {
    "daily":     "day",
    "per day":   "day",
    "by day":    "day",
    "weekly":    "week",
    "per week":  "week",
    "by week":   "week",
    "monthly":   "month",
    "per month": "month",
    "by month":  "month",
    "quarterly": "quarter",
    "per quarter": "quarter",
    "by quarter": "quarter",
    "yearly":    "year",
    "annually":  "year",
    "per year":  "year",
    "by year":   "year",
}

_STAT_FUNCTIONS: Dict[str, List[str]] = {
    "MEDIAN":      ["median", "middle value", "50th percentile"],
    "MODE":        ["mode", "most frequent", "most common value"],
    "STDDEV":      ["std deviation", "standard deviation", "stddev", "std dev"],
    "VARIANCE":    ["variance", "variability", "spread"],
    "PERCENTILE":  ["percentile", "quantile"],
    "QUARTILE":    ["quartile", "q1", "q2", "q3", "q4"],
    "CORRELATION": ["correlation", "corr", "correlate", "relationship between"],
}

_DATA_QUALITY_PATTERNS: Dict[str, List[str]] = {
    "missing":    ["missing values", "null values", "blank values", "empty values",
                   "missing data", "nulls", "na values", "not available"],
    "duplicates": ["duplicates", "duplicate rows", "duplicate records",
                   "repeated rows", "redundant rows"],
    "schema":     ["schema", "column types", "data types", "field types",
                   "what columns", "list columns", "show columns"],
    "row_count":  ["row count", "number of rows", "how many rows", "total rows",
                   "record count", "how many records"],
    "col_count":  ["column count", "number of columns", "how many columns",
                   "total columns", "total fields"],
    "summary":    ["dataset summary", "data summary", "overall summary",
                   "describe dataset", "profile"],
    "unique":     ["unique values", "distinct values", "cardinality"],
}

# Chart intent mapping: (has_date, num_numerics, num_categories, n_rows)
# Will be evaluated as rules in order

_SYNONYM_DICTIONARY: Dict[str, List[str]] = {
    # Revenue / Sales
    "revenue":      ["sales", "total_sales", "salesamount", "amount", "gross_sales",
                     "income", "turnover", "netsales", "grossrevenue"],
    "sales":        ["revenue", "amount", "price", "subtotal", "total", "salesamount"],
    "earnings":     ["profit", "net_profit", "sales", "revenue", "margin", "income"],
    "income":       ["revenue", "sales", "earnings", "profit", "amount"],

    # Customer / Client
    "client":       ["customer", "customername", "clientname", "buyer", "customer_id", "company"],
    "customer":     ["client", "customername", "buyer", "user", "clientname", "purchaser"],
    "buyer":        ["customer", "client", "customername", "purchaser"],

    # Profit / Margin
    "profit":       ["margin", "net_profit", "earnings", "gross_margin", "profitamount",
                     "return", "netprofit"],
    "margin":       ["profit", "net_profit", "gross_margin", "profitamount"],
    "loss":         ["deficit", "negative_profit", "net_loss"],

    # Geography
    "location":     ["region", "country", "city", "state", "territory", "area", "address",
                     "zone", "nation"],
    "region":       ["location", "territory", "zone", "state", "country", "area", "district"],
    "country":      ["nation", "countryname", "territory", "location"],
    "nation":       ["country", "countryname"],
    "city":         ["town", "municipality", "metro", "location"],
    "state":        ["province", "territory", "region"],

    # Product
    "product":      ["item", "product_name", "sku", "category", "merchandise",
                     "description", "productname", "productcategory"],
    "item":         ["product", "product_name", "sku", "merchandise"],

    # Time / Date
    "date":         ["order_date", "timestamp", "created_at", "time", "day",
                     "transaction_date", "month", "year", "orderdate", "saledate"],
    "month":        ["date", "order_date", "orderdate", "saledate", "timestamp"],
    "year":         ["date", "order_date", "orderdate", "saledate", "timestamp"],

    # Quantity
    "quantity":     ["units", "qty", "count", "items_sold", "volume", "amount",
                     "quantityordered", "units_sold"],
    "units":        ["quantity", "qty", "count", "volume"],
    "volume":       ["quantity", "units", "qty", "amount"],

    # Cost / Price
    "cost":         ["price", "discount", "expense", "fee", "unitprice"],
    "price":        ["cost", "unitprice", "listprice", "amount", "fee"],
    "discount":     ["discountpercent", "disc", "rebate", "percent", "discountamount"],
    "expense":      ["cost", "expenditure", "fee", "amount"],

    # HR Domain
    "employee":     ["staff", "worker", "personnel", "emp", "associate"],
    "salary":       ["pay", "wage", "compensation", "remuneration", "income"],
    "department":   ["dept", "division", "team", "unit", "group"],
    "attrition":    ["churn", "turnover", "resignation", "departure"],
    "gender":       ["sex"],
    "age":          ["tenure", "experience", "years"],
    "hire":         ["joining", "start_date", "employment_date"],

    # Finance Domain
    "budget":       ["forecast", "plan", "target", "allocation"],
    "expense":      ["expenditure", "cost", "fee", "outflow"],
    "cashflow":     ["cash_flow", "cash", "flow"],

    # Healthcare Domain
    "patient":      ["subject", "case", "person", "individual"],
    "diagnosis":    ["condition", "disease", "illness", "ailment"],
    "treatment":    ["procedure", "intervention", "therapy"],
    "admission":    ["visit", "encounter", "hospitalization"],

    # Education Domain
    "student":      ["learner", "pupil", "candidate", "enrollee"],
    "marks":        ["score", "grade", "result", "points"],
    "attendance":   ["presence", "participation"],
    "course":       ["subject", "module", "class"],

    # Manufacturing
    "production":   ["output", "yield", "manufacturing"],
    "defect":       ["fault", "error", "reject", "failure"],
    "downtime":     ["idle_time", "stoppage", "outage"],

    # Generic analytics
    "count":        ["frequency", "occurrences", "records", "number"],
    "rating":       ["score", "stars", "review", "rank"],
    "status":       ["state", "condition", "flag", "indicator"],
    "returned":     ["refunded", "return", "returned_flag"],
    "segment":      ["group", "cluster", "tier", "class"],
    "category":     ["type", "group", "classification", "segment"],
    "order":        ["transaction", "purchase", "sale", "deal"],
}


def _similarity_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


# ---------------------------------------------------------------------------
# IntentParser
# ---------------------------------------------------------------------------

class IntentParser:
    """
    Deterministic rule-based Query Intent Parser.

    Usage:
        parser = IntentParser()
        ir = parser.parse("Show average quantity per customer", column_names, column_profiles)
    """

    def __init__(self, fuzzy_threshold: float = 0.72, confidence_threshold: float = 0.75):
        self.fuzzy_threshold = fuzzy_threshold
        self.confidence_threshold = confidence_threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse(
        self,
        query: str,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]] = None,
    ) -> QueryIR:
        """
        Main entry point. Returns a fully populated QueryIR.
        """
        q = query.strip()
        q_lower = q.lower()

        # 1. Semantic column matching
        matched_columns, num_cols, cat_cols, date_cols = self._match_columns(
            q_lower, column_names, column_profiles
        )

        # Check for groupby trigger phrases
        has_groupby = any(phrase in q_lower for phrase in _GROUPBY_PHRASES)

        # 2. Data quality / metadata (short-circuits everything else)
        dq_type = self._detect_data_quality(q_lower)
        
        # If it's a row count but it has grouping, it's actually an aggregation, not a simple metadata query!
        if dq_type == "row_count" and has_groupby:
            dq_type = None

        if dq_type:
            is_meta = dq_type in ("schema", "row_count", "col_count", "summary", "unique")
            ir = QueryIR(
                intent="metadata" if is_meta else "data_quality",
                is_data_quality=not is_meta,
                is_metadata=is_meta,
                data_quality_type=dq_type,
                chart="table",
                confidence=1.0,
                raw_query=q,
                matched_columns=matched_columns,
            )
            logger.info(f"[IntentParser] Data quality intent: {dq_type}")
            return ir

        # 3. Statistical function
        stat_fn = self._detect_statistical_function(q_lower)

        # 4. Aggregation
        aggregation = self._detect_aggregation(q_lower)

        # 5. Metric column
        metric, extra_metrics = self._detect_metric(
            q_lower, matched_columns, num_cols, column_names
        )

        # 6. Group by / dimensions
        dimensions = self._detect_dimensions(
            q_lower, matched_columns, cat_cols, date_cols, column_names, column_profiles, has_groupby
        )

        # 7. Filters
        filters = self._detect_filters(
            q_lower, column_names, matched_columns, column_profiles
        )

        # 8. Sort
        sort_spec = self._detect_sort(q_lower, metric, dimensions)

        # 9. Limit
        limit = self._detect_limit(q_lower)

        # 10. Time filter
        time_filter = self._detect_time_filter(q_lower)

        # 11. Time granularity
        time_granularity = self._detect_time_granularity(q_lower)
        if time_granularity and date_cols:
            # Add date column to dimensions if not already there
            if not any(c in dimensions for c in date_cols):
                dimensions = [date_cols[0]] + dimensions

        # 12. Intent classification
        intent = self._classify_intent(
            q_lower, aggregation, stat_fn, dimensions, filters,
            time_filter, time_granularity, limit, sort_spec
        )

        # 13. Confidence Scoring
        confidence, flags = self._score_confidence(
            intent, aggregation, metric, dimensions, filters, column_names, num_cols, cat_cols, q_lower
        )

        # 14. Chart inference
        chart = self._infer_chart(
            intent, aggregation, metric, dimensions, date_cols,
            time_granularity, stat_fn, limit, q_lower
        )

        # Default aggregation: if we have dimensions + metric but no explicit agg keyword,
        # default to SUM (most common analytical intent)
        effective_aggregation = aggregation
        if (
            not aggregation
            and not stat_fn
            and dimensions
            and metric
            and intent in ("aggregation", "ranking", "comparison")
        ):
            effective_aggregation = "SUM"

        ir = QueryIR(
            intent=intent,
            aggregation=effective_aggregation,
            metric=metric,
            metrics=extra_metrics,
            dimensions=dimensions,
            filters=filters,
            sort=sort_spec,
            limit=limit,
            time_filter=time_filter,
            time_granularity=time_granularity,
            statistical_function=stat_fn,
            chart=chart,
            confidence=round(confidence, 3),
            confidence_flags=flags,
            raw_query=q,
            matched_columns=matched_columns,
        )
        logger.info(
            f"[IntentParser] intent={intent} agg={aggregation} metric={metric} "
            f"dims={dimensions} conf={confidence:.2f} chart={chart}"
        )
        return ir

    # ------------------------------------------------------------------
    # 1. Semantic Column Matching
    # ------------------------------------------------------------------

    def _match_columns(
        self,
        q_lower: str,
        column_names: List[str],
        column_profiles: Optional[List[Dict[str, Any]]],
    ) -> Tuple[Dict[str, str], List[str], List[str], List[str]]:
        """
        Returns (matched_columns, num_cols, cat_cols, date_cols).
        matched_columns maps user terms → actual column names.
        """
        # Categorise columns by type from profiles
        num_cols: List[str] = []
        cat_cols: List[str] = []
        date_cols: List[str] = []

        if column_profiles:
            for cp in column_profiles:
                cname = cp.get("name", "")
                ctype = cp.get("type", "string")
                if ctype in ("number", "float", "int", "integer"):
                    num_cols.append(cname)
                elif ctype in ("datetime", "date"):
                    date_cols.append(cname)
                else:
                    cat_cols.append(cname)
        else:
            # Heuristic classification from column names
            for col in column_names:
                cl = col.lower()
                if any(k in cl for k in ["date", "month", "year", "day", "time", "timestamp"]):
                    date_cols.append(col)
                elif any(k in cl for k in [
                    "sales", "amount", "price", "cost", "revenue", "profit",
                    "quantity", "count", "salary", "score", "rate", "margin",
                    "discount", "age", "fare", "fee", "budget", "expense",
                    "marks", "grade", "production", "units", "volume",
                ]):
                    num_cols.append(col)
                else:
                    cat_cols.append(col)
            if not num_cols:
                num_cols = column_names[:]

        # Tokenise query
        words = re.findall(r"[a-zA-Z0-9_]+", q_lower)
        matched: Dict[str, str] = {}

        for word in words:
            if len(word) < 3:
                continue
            best_col, best_score = self._find_best_column(word, column_names)
            if best_col and best_score >= self.fuzzy_threshold:
                matched[word] = best_col

        # Multi-word phrase matching (e.g. "customer name", "order date")
        for phrase_len in (3, 2):
            for i in range(len(words) - phrase_len + 1):
                phrase = " ".join(words[i: i + phrase_len])
                if len(phrase) < 4:
                    continue
                best_col, best_score = self._find_best_column(phrase, column_names)
                if best_col and best_score >= self.fuzzy_threshold:
                    # Only add if individual words haven't already matched this column
                    if phrase not in matched:
                        matched[phrase] = best_col

        return matched, num_cols, cat_cols, date_cols

    def _find_best_column(
        self, term: str, column_names: List[str]
    ) -> Tuple[Optional[str], float]:
        best_col: Optional[str] = None
        best_score: float = 0.0
        term_clean = term.replace("_", "").replace("-", "").replace(" ", "").lower()

        for col in column_names:
            col_clean = col.lower().replace("_", "").replace("-", "").replace(" ", "")

            # Exact match
            if term_clean == col_clean:
                return col, 1.0

            # Substring
            if term_clean in col_clean and len(term_clean) >= 3:
                score = 0.85
                if score > best_score:
                    best_col, best_score = col, score
            elif col_clean in term_clean and len(col_clean) >= 4:
                score = 0.85
                if score > best_score:
                    best_col, best_score = col, score

            # Synonym dictionary
            synonyms = _SYNONYM_DICTIONARY.get(term_clean, []) + _SYNONYM_DICTIONARY.get(term, [])
            for syn in synonyms:
                syn_clean = syn.replace("_", "").replace("-", "").replace(" ", "")
                if syn_clean == col_clean or syn_clean in col_clean or col_clean in syn_clean:
                    score = 0.91
                    if score > best_score:
                        best_col, best_score = col, score

            # Fuzzy ratio
            ratio = _similarity_ratio(term, col)
            if ratio > best_score:
                best_col, best_score = col, ratio

        return best_col, best_score

    # ------------------------------------------------------------------
    # 2. Data Quality Detection
    # ------------------------------------------------------------------

    def _detect_data_quality(self, q: str) -> Optional[str]:
        for dq_type, patterns in _DATA_QUALITY_PATTERNS.items():
            for pat in patterns:
                if pat in q:
                    return dq_type
        return None

    # ------------------------------------------------------------------
    # 3. Statistical Function Detection
    # ------------------------------------------------------------------

    def _detect_statistical_function(self, q: str) -> Optional[str]:
        for fn, keywords in _STAT_FUNCTIONS.items():
            for kw in keywords:
                if kw in q:
                    return fn
        return None

    # ------------------------------------------------------------------
    # 4. Aggregation Detection
    # ------------------------------------------------------------------

    def _detect_aggregation(self, q: str) -> Optional[str]:
        for agg in _AGG_ORDER:
            for kw in _AGG_KEYWORDS[agg]:
                if re.search(rf"\b{re.escape(kw)}\b", q):
                    return agg
        return None

    # ------------------------------------------------------------------
    # 5. Metric Detection
    # ------------------------------------------------------------------

    def _detect_metric(
        self,
        q: str,
        matched: Dict[str, str],
        num_cols: List[str],
        all_cols: List[str],
    ) -> Tuple[Optional[str], List[str]]:
        # Prefer columns that appear in the query via matched_columns
        hits = [col for col in matched.values() if col in num_cols]
        if hits:
            return hits[0], hits[1:]

        # Try direct substring match
        for col in num_cols:
            if col.lower() in q or col.lower().replace("_", " ") in q:
                return col, []

        # Fallback to first numeric column
        if num_cols:
            return num_cols[0], num_cols[1:]
        return None, []

    # ------------------------------------------------------------------
    # 6. Dimension / GroupBy Detection
    # ------------------------------------------------------------------

    def _detect_dimensions(
        self,
        q: str,
        matched: Dict[str, str],
        cat_cols: List[str],
        date_cols: List[str],
        all_cols: List[str],
        column_profiles: Optional[List[Dict[str, Any]]],
        has_groupby: bool,
    ) -> List[str]:
        dims: List[str] = []

        # Matched categorical columns
        for col in matched.values():
            if col in cat_cols and col not in dims:
                dims.append(col)

        # Try explicit column name presence in query
        if not dims or has_groupby:
            for col in cat_cols:
                col_lower = col.lower().replace("_", " ")
                if col.lower() in q or col_lower in q:
                    if col not in dims:
                        dims.append(col)

        # Date columns for trend/time intents
        for col in date_cols:
            col_lower = col.lower().replace("_", " ")
            if col.lower() in q or col_lower in q:
                if col not in dims:
                    dims.append(col)

        return dims

    # ------------------------------------------------------------------
    # 7. Filter Detection
    # ------------------------------------------------------------------

    def _detect_filters(
        self,
        q: str,
        all_cols: List[str],
        matched: Dict[str, str],
        column_profiles: Optional[List[Dict[str, Any]]],
    ) -> List[FilterCondition]:
        filters: List[FilterCondition] = []

        # IS NULL / IS NOT NULL
        for col in all_cols:
            col_lower = col.lower().replace("_", " ")
            if col.lower() in q or col_lower in q:
                if "is null" in q or "missing" in q or "null" in q:
                    filters.append(FilterCondition(column=col, operator="is_null"))
                elif "is not null" in q or "not null" in q:
                    filters.append(FilterCondition(column=col, operator="is_not_null"))

        # BETWEEN — "between X and Y"
        between_match = re.search(
            r"\bbetween\s+([\d,\.]+)\s+and\s+([\d,\.]+)", q
        )
        if between_match:
            v1 = float(between_match.group(1).replace(",", ""))
            v2 = float(between_match.group(2).replace(",", ""))
            target_col = self._guess_numeric_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(
                    column=target_col, operator="between", value=v1, value2=v2
                ))

        # GREATER THAN / ABOVE / OVER / MORE THAN
        gt_match = re.search(
            r"\b(greater than|more than|above|over|exceeds?|at least|older than|higher than|taller than)"
            r"\s*([\d,\.]+)",
            q,
        )
        if gt_match:
            val = float(gt_match.group(2).replace(",", ""))
            target_col = self._guess_numeric_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(
                    column=target_col, operator="gt", value=val
                ))

        # LESS THAN / BELOW / UNDER
        lt_match = re.search(
            r"\b(less than|fewer than|below|under|at most|younger than|lower than|smaller than|<)"
            r"\s*([\d,\.]+)",
            q,
        )
        if lt_match:
            val = float(lt_match.group(2).replace(",", ""))
            target_col = self._guess_numeric_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(
                    column=target_col, operator="lt", value=val
                ))

        # CONTAINS / STARTS WITH / ENDS WITH
        contains_m = re.search(r'\bcontains?\s+"?([^"]+)"?', q)
        if contains_m:
            val = contains_m.group(1).strip().strip('"').strip("'")
            target_col = self._guess_string_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(column=target_col, operator="contains", value=val))

        starts_m = re.search(r'\bstarts with\s+"?([^"]+)"?', q)
        if starts_m:
            val = starts_m.group(1).strip().strip('"').strip("'")
            target_col = self._guess_string_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(column=target_col, operator="starts_with", value=val))

        ends_m = re.search(r'\bends with\s+"?([^"]+)"?', q)
        if ends_m:
            val = ends_m.group(1).strip().strip('"').strip("'")
            target_col = self._guess_string_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(column=target_col, operator="ends_with", value=val))

        # IN list — "in (A, B, C)" or "in ['A', 'B']"
        in_match = re.search(r"\bin\s*[\(\[]\s*([^\)\]]+)\s*[\)\]]", q)
        if in_match:
            vals = [v.strip().strip("'\"") for v in in_match.group(1).split(",")]
            target_col = self._guess_string_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(column=target_col, operator="in", value=vals))

        # NOT IN
        not_in_match = re.search(r"\bnot in\s*[\(\[]\s*([^\)\]]+)\s*[\)\]]", q)
        if not_in_match:
            vals = [v.strip().strip("'\"") for v in not_in_match.group(1).split(",")]
            target_col = self._guess_string_filter_col(q, all_cols, matched)
            if target_col:
                filters.append(FilterCondition(column=target_col, operator="not_in", value=vals))

        # Equality from sample values (grounding against actual data)
        if column_profiles:
            seen_cols = {f.column for f in filters}
            for cp in column_profiles:
                cname = cp.get("name", "")
                if cname in seen_cols:
                    continue
                samples = cp.get("sampleValues") or []
                for s in samples:
                    if s is None:
                        continue
                    s_str = str(s).strip()
                    if len(s_str) < 2 or s_str.isdigit():
                        continue
                    if s_str.lower() in q:
                        filters.append(FilterCondition(
                            column=cname, operator="eq", value=s_str
                        ))
                        seen_cols.add(cname)
                        break

        # Year / number equality: "in 2023", "for 2022"
        year_match = re.search(r"\b(in|for|during|year)\s+(20\d{2}|19\d{2})\b", q)
        if year_match:
            year_val = int(year_match.group(2))
            date_col = next((c for c in all_cols if any(k in c.lower() for k in
                             ["date", "year", "time", "month", "timestamp"])), None)
            if date_col:
                filters.append(FilterCondition(column=date_col, operator="year_eq", value=year_val))

        return filters

    def _guess_numeric_filter_col(
        self, q: str, all_cols: List[str], matched: Dict[str, str]
    ) -> Optional[str]:
        _NUM_KEYWORDS = [
            "sales", "amount", "price", "cost", "revenue", "profit",
            "quantity", "count", "salary", "score", "rate", "margin",
            "discount", "age", "fare", "fee", "budget", "value", "marks",
            "attendance", "volume", "downtime", "treatment", "defect",
        ]
        # 1. From matched columns (direct column references in query)
        for term, col in matched.items():
            if any(k in col.lower() for k in _NUM_KEYWORDS):
                return col
        # 2. Any column whose lowercase name appears as a word in the query
        for col in all_cols:
            if re.search(rf"\b{re.escape(col.lower())}\b", q):
                if any(k in col.lower() for k in _NUM_KEYWORDS):
                    return col
        # 3. First numeric-sounding column in schema
        for col in all_cols:
            if any(k in col.lower() for k in _NUM_KEYWORDS):
                return col
        return None


    def _guess_string_filter_col(
        self, q: str, all_cols: List[str], matched: Dict[str, str]
    ) -> Optional[str]:
        for term, col in matched.items():
            if any(k in col.lower() for k in [
                "name", "category", "region", "status", "type",
                "department", "gender", "city", "country",
            ]):
                return col
        for col in all_cols:
            if any(k in col.lower() for k in [
                "name", "category", "region", "status", "type",
            ]):
                return col
        return None

    # ------------------------------------------------------------------
    # 8. Sort Detection
    # ------------------------------------------------------------------

    def _detect_sort(
        self,
        q: str,
        metric: Optional[str],
        dimensions: List[str],
    ) -> Optional[SortSpec]:
        sort_col = metric or (dimensions[0] if dimensions else None)
        if not sort_col:
            return None

        for kw in _SORT_DESC_KEYWORDS:
            if re.search(rf"\b{re.escape(kw)}\b", q):
                return SortSpec(column=sort_col, direction="DESC")

        for kw in _SORT_ASC_KEYWORDS:
            if re.search(rf"\b{re.escape(kw)}\b", q):
                return SortSpec(column=sort_col, direction="ASC")

        # Aggregation queries default to DESC
        if self._detect_aggregation(q):
            return SortSpec(column=sort_col, direction="DESC")

        return None

    # ------------------------------------------------------------------
    # 9. Limit Detection
    # ------------------------------------------------------------------

    def _detect_limit(self, q: str) -> Optional[int]:
        # "top 10", "first 20", "last 5", "highest 3", "lowest 5"
        m = re.search(
            r"\b(top|first|last|highest|lowest|bottom|best|worst)\s+(\d+|one|two|three|four|five|"
            r"six|seven|eight|nine|ten|twenty|fifty|hundred)\b",
            q,
        )
        if m:
            raw = m.group(2)
            word_map = {
                "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
                "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
                "twenty": 20, "fifty": 50, "hundred": 100,
            }
            return word_map.get(raw, int(raw) if raw.isdigit() else None)

        # Plain "limit N"
        lm = re.search(r"\blimit\s+(\d+)\b", q)
        if lm:
            return int(lm.group(1))

        # "top" without a number → default 10
        if re.search(r"\b(top|best|worst|leading|trailing)\b", q) and not re.search(r"\d+", q):
            return 10

        return None

    # ------------------------------------------------------------------
    # 10. Time Filter Detection
    # ------------------------------------------------------------------

    def _detect_time_filter(self, q: str) -> Optional[Dict[str, Any]]:
        for phrase, info in sorted(_TIME_PATTERNS.items(), key=lambda x: -len(x[0])):
            if phrase in q:
                return info

        # "in 2023", "for 2022", etc. handled in filter detection as year_eq
        return None

    # ------------------------------------------------------------------
    # 11. Time Granularity Detection
    # ------------------------------------------------------------------

    def _detect_time_granularity(self, q: str) -> Optional[str]:
        for phrase, gran in sorted(_TIME_GRANULARITY.items(), key=lambda x: -len(x[0])):
            if phrase in q:
                return gran
        return None

    # ------------------------------------------------------------------
    # 12. Intent Classification
    # ------------------------------------------------------------------

    def _classify_intent(
        self,
        q: str,
        aggregation: Optional[str],
        stat_fn: Optional[str],
        dimensions: List[str],
        filters: List[FilterCondition],
        time_filter: Optional[Dict],
        time_granularity: Optional[str],
        limit: Optional[int],
        sort_spec: Optional[SortSpec],
    ) -> str:
        if stat_fn:
            return "statistical"
        if time_granularity:
            return "trend"
        if time_filter and not aggregation:
            return "trend"
        if aggregation:
            if limit and sort_spec:
                return "ranking"
            return "aggregation"
        # Implicit aggregation when groupby detected but no keyword — default to aggregation
        if dimensions and any(phrase in q for phrase in ["by", "per", "grouped by", "for each", "across", "split by", "broken down by"]):
            return "aggregation"
        if filters and not aggregation:
            return "filter"
        if limit and sort_spec:
            return "ranking"
        if re.search(r"\b(distribution|spread|frequency|histogram|range|how.*distributed)\b", q):
            return "distribution"
        if re.search(r"\b(compare|versus|vs\.?|compared to|difference between)\b", q):
            return "comparison"
        return "aggregation"  # default

    # ------------------------------------------------------------------
    # 13. Confidence Scoring
    # ------------------------------------------------------------------

    def _score_confidence(
        self,
        intent: str,
        aggregation: Optional[str],
        metric: Optional[str],
        dimensions: List[str],
        filters: List[FilterCondition],
        all_cols: List[str],
        num_cols: List[str],
        cat_cols: List[str],
        q_lower: str,
    ) -> Tuple[float, List[str]]:
        score = 1.0
        flags: List[str] = []

        # Validate metric exists in schema
        if metric and metric not in all_cols:
            score -= 0.20
            flags.append(f"metric '{metric}' not found in schema")

        # Validate dimensions exist
        for dim in dimensions:
            if dim not in all_cols:
                score -= 0.10
                flags.append(f"dimension '{dim}' not found in schema")

        # Explicit grouping intent but no dimensions resolved
        has_groupby = any(phrase in q_lower for phrase in _GROUPBY_PHRASES)
        if has_groupby and not dimensions:
            score -= 0.30
            flags.append("groupby keyword detected but no dimension resolved")

        # Aggregation without metric
        if aggregation and aggregation != "COUNT" and not metric:
            score -= 0.15
            flags.append("aggregation specified but no numeric metric resolved")

        # Filter column validation
        for f in filters:
            if f.column not in all_cols:
                score -= 0.10
                flags.append(f"filter column '{f.column}' not found in schema")

        # Intent-specific checks
        if intent == "aggregation" and not aggregation and not metric:
            score -= 0.15
            flags.append("aggregation intent but no agg function or metric resolved")

        if intent == "trend" and not any(
            any(k in c.lower() for k in ["date", "month", "year", "time"]) for c in all_cols
        ):
            score -= 0.20
            flags.append("trend intent but no date column found in schema")

        return max(0.0, round(score, 3)), flags

    # ------------------------------------------------------------------
    # 14. Chart Inference
    # ------------------------------------------------------------------

    def _infer_chart(
        self,
        intent: str,
        aggregation: Optional[str],
        metric: Optional[str],
        dimensions: List[str],
        date_cols: List[str],
        time_granularity: Optional[str],
        stat_fn: Optional[str],
        limit: Optional[int],
        q: str,
    ) -> str:
        # Explicit intent keywords
        if re.search(r"\bpie\b", q):
            return "pie"
        if re.search(r"\bscatter\b", q):
            return "scatter"
        if re.search(r"\bheatmap\b", q):
            return "heatmap"
        if re.search(r"\btreemap\b", q):
            return "treemap"
        if re.search(r"\bhistogram\b", q):
            return "histogram"
        if re.search(r"\bline\b|\btrend\b", q):
            return "line"

        # Rule-based inference
        if intent == "statistical":
            if stat_fn == "CORRELATION":
                return "scatter"
            return "table"

        if intent in ("metadata", "data_quality"):
            return "table"

        if intent == "distribution":
            return "histogram"

        # Single aggregation value with no grouping → KPI
        if aggregation and not dimensions and metric:
            return "kpi"

        # Date dimension → line chart
        if date_cols and dimensions and any(d in date_cols for d in dimensions):
            return "line"
        if time_granularity:
            return "line"

        # Category + numeric → bar
        if dimensions and metric:
            # Small number of categories or ranking → bar
            if limit and limit <= 10:
                return "bar"
            return "bar"

        # Two metrics, no category → scatter
        if not dimensions and metric:
            return "kpi"

        # Percentage / composition intent → pie
        if re.search(r"\b(percentage|share|proportion|ratio|composition)\b", q):
            return "pie"

        return "bar"  # safe default


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

intent_parser = IntentParser()
