"""
ir_sql_generator.py — Intermediate Representation → SQL Generator
=================================================================
Consumes ONLY a QueryIR object. Never reads the original NL query.
Never calls the LLM. Generates valid DuckDB-compatible SQL for all intent types.

Intent → SQL mapping:
  aggregation  → SELECT {agg}({metric}) [GROUP BY dims] [WHERE ...] [ORDER BY ...] [LIMIT ...]
  ranking      → ORDER BY + LIMIT
  filter       → WHERE clause with operator mapping
  trend        → GROUP BY date trunc / SUBSTR with time granularity
  distribution → Histogram-style bucket query
  statistical  → DuckDB statistical functions (MEDIAN, CORR, STDDEV_POP, etc.)
  comparison   → Multi-group aggregation
  metadata     → Returns metadata dict (no SQL)
  data_quality → NULL count / duplicate / unique queries
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from backend.services.intent_parser import FilterCondition, QueryIR

logger = logging.getLogger("insightai.ir_sql_generator")

# ---------------------------------------------------------------------------
# DuckDB statistical function map
# ---------------------------------------------------------------------------
_DUCKDB_STAT_FN: Dict[str, str] = {
    "MEDIAN":      "MEDIAN",
    "MODE":        "MODE",
    "STDDEV":      "STDDEV_POP",
    "VARIANCE":    "VAR_POP",
    "PERCENTILE":  "APPROX_QUANTILE",
    "QUARTILE":    "APPROX_QUANTILE",
    "CORRELATION": "CORR",
}

_AGG_SQL_FN: Dict[str, str] = {
    "SUM":            "SUM",
    "AVG":            "AVG",
    "COUNT":          "COUNT",
    "MIN":            "MIN",
    "MAX":            "MAX",
    "COUNT_DISTINCT": "COUNT(DISTINCT",   # special — closed separately
}

TABLE = "df"


def _q(col: str) -> str:
    """Double-quote a column name unconditionally."""
    return f'"{col}"'


def _alias(col: str, prefix: str = "") -> str:
    safe = col.replace(" ", "_").replace("-", "_")
    return f"{prefix}_{safe}" if prefix else safe


def _build_where(filters: List[FilterCondition]) -> str:
    """Convert filter list → SQL WHERE clause (without the WHERE keyword)."""
    clauses: List[str] = []
    for f in filters:
        col = _q(f.column)
        op = f.operator
        v = f.value

        if op == "is_null":
            clauses.append(f"{col} IS NULL")
        elif op == "is_not_null":
            clauses.append(f"{col} IS NOT NULL")
        elif op == "eq":
            if isinstance(v, str):
                clauses.append(f"LOWER({col}) = LOWER('{v.replace(chr(39), chr(39)*2)}')")
            else:
                clauses.append(f"{col} = {v}")
        elif op == "gt":
            clauses.append(f"{col} > {v}")
        elif op == "lt":
            clauses.append(f"{col} < {v}")
        elif op == "gte":
            clauses.append(f"{col} >= {v}")
        elif op == "lte":
            clauses.append(f"{col} <= {v}")
        elif op == "between":
            clauses.append(f"{col} BETWEEN {f.value} AND {f.value2}")
        elif op == "contains":
            clauses.append(f"LOWER({col}) LIKE LOWER('%{v}%')")
        elif op == "starts_with":
            clauses.append(f"LOWER({col}) LIKE LOWER('{v}%')")
        elif op == "ends_with":
            clauses.append(f"LOWER({col}) LIKE LOWER('%{v}')")
        elif op == "in":
            if isinstance(v, list):
                quoted = ", ".join(
                    f"'{str(x).replace(chr(39), chr(39)*2)}'" for x in v
                )
                clauses.append(f"LOWER({col}) IN ({quoted})")
        elif op == "not_in":
            if isinstance(v, list):
                quoted = ", ".join(
                    f"'{str(x).replace(chr(39), chr(39)*2)}'" for x in v
                )
                clauses.append(f"LOWER({col}) NOT IN ({quoted})")
        elif op == "year_eq":
            clauses.append(f"CAST(SUBSTR(CAST({col} AS VARCHAR), 1, 4) AS INT) = {v}")
        else:
            # Generic fallback — equality
            if isinstance(v, str):
                clauses.append(f"{col} = '{v}'")
            elif v is not None:
                clauses.append(f"{col} = {v}")

    return " AND ".join(clauses)


class IRSQLGenerator:
    """
    Deterministic SQL generator that consumes only a QueryIR.
    Returns (sql, explanation) — never touches NL query or LLM.
    """

    def generate(
        self,
        ir: QueryIR,
        column_names: Optional[List[str]] = None,
    ) -> Tuple[str, str]:
        """
        Main entry point.
        Returns (sql_string, explanation_string).
        Raises ValueError for unsupported/metadata intents — caller should handle.
        """
        intent = ir.intent

        if intent in ("metadata", "data_quality"):
            # Caller must handle metadata responses; return a structural query
            return self._generate_data_quality(ir, column_names or [])

        if intent == "statistical":
            return self._generate_statistical(ir)

        if intent in ("trend",):
            return self._generate_trend(ir)

        if intent == "distribution":
            return self._generate_distribution(ir)

        if intent in ("aggregation", "ranking", "comparison", "filter", "fact_retrieval"):
            return self._generate_aggregation(ir)

        # Safe fallback
        return self._generate_fallback(ir, column_names or [])

    # ------------------------------------------------------------------
    # Aggregation / Ranking / Comparison / Filter
    # ------------------------------------------------------------------

    def _generate_aggregation(self, ir: QueryIR) -> Tuple[str, str]:
        metric = ir.metric
        dims = ir.dimensions
        agg = ir.aggregation
        # Default to SUM when groupby is present but no explicit aggregation
        if not agg and dims and metric:
            agg = "SUM"
        filters = ir.filters
        sort = ir.sort
        limit = ir.limit

        select_parts: List[str] = []
        explanation_parts: List[str] = []

        # Dimension columns in SELECT
        for d in dims:
            select_parts.append(_q(d))

        # Metric / aggregation expression
        if agg:
            if agg == "COUNT":
                if hasattr(ir, "count_type") and ir.count_type == "distinct" and metric:
                    agg_expr = f"COUNT(DISTINCT {_q(metric)})"
                    alias = f"Count_Distinct_{_alias(metric)}"
                elif hasattr(ir, "count_type") and ir.count_type == "records":
                    agg_expr = "COUNT(*)"
                    alias = "Record_Count"
                elif metric:
                    agg_expr = f"COUNT({_q(metric)})"
                    alias = f"COUNT_{_alias(metric)}"
                else:
                    agg_expr = "COUNT(*)"
                    alias = "Record_Count"
                
                # COUNT is an integer, no need for ROUND()
                select_parts.append(f'{agg_expr} AS "{alias}"')
                explanation_parts.append(f"{agg}({metric or '*'})")
                metric_alias = alias

            elif agg == "COUNT_DISTINCT" and metric: # Fallback just in case
                agg_expr = f"COUNT(DISTINCT {_q(metric)})"
                alias = f"Count_Distinct_{_alias(metric)}"
                select_parts.append(f'{agg_expr} AS "{alias}"')
                explanation_parts.append(f"{agg}({metric})")
                metric_alias = alias
                
            elif metric:
                fn = _AGG_SQL_FN.get(agg, "SUM")
                agg_expr = f"{fn}({_q(metric)})"
                alias = f"{agg}_{_alias(metric)}"
                select_parts.append(f'ROUND({agg_expr}, 2) AS "{alias}"')
                explanation_parts.append(f"{agg}({metric})")
                metric_alias = alias
            else:
                # Should be unreachable for well-formed IR
                select_parts.append("*")
                metric_alias = None

        elif metric and not agg:
            # No explicit aggregation — just select the metric
            select_parts.append(_q(metric))
            metric_alias = metric
        else:
            select_parts.append("*")
            metric_alias = None

        # COUNT(*) alongside if no explicit metric and just filtering
        if not select_parts or select_parts == []:
            select_parts = ["*"]

        select_str = ", ".join(select_parts)

        # WHERE
        where_str = ""
        if filters:
            where_clause = _build_where(filters)
            if where_clause:
                where_str = f" WHERE {where_clause}"

        # GROUP BY
        group_str = ""
        if dims and agg:
            group_cols = ", ".join(_q(d) for d in dims)
            group_str = f" GROUP BY {group_cols}"

        # ORDER BY
        order_str = ""
        if sort:
            order_col = metric_alias if metric_alias else sort.column
            order_str = f' ORDER BY "{order_col}" {sort.direction}'
        elif agg and dims and metric_alias:
            order_str = f' ORDER BY "{metric_alias}" DESC'

        # LIMIT
        limit_str = f" LIMIT {limit}" if limit else ""

        sql = (
            f"SELECT {select_str} FROM {TABLE}"
            f"{where_str}{group_str}{order_str}{limit_str}"
        )

        explanation = (
            f"Generated deterministic {agg or 'SELECT'} SQL"
            + (f" on '{metric}'" if metric else "")
            + (f" grouped by {dims}" if dims else "")
            + (f" with {len(filters)} filter(s)" if filters else "")
            + (f" ordered {sort.direction}" if sort else "")
            + (f" limited to {limit}" if limit else "")
            + "."
        )

        logger.info(f"[IRSQLGen] Generated aggregation SQL: {sql}")
        return sql, explanation

    # ------------------------------------------------------------------
    # Trend / Time-series
    # ------------------------------------------------------------------

    def _generate_trend(self, ir: QueryIR) -> Tuple[str, str]:
        metric = ir.metric
        dims = ir.dimensions
        agg = ir.aggregation or "SUM"
        gran = ir.time_granularity
        filters = ir.filters
        sort = ir.sort

        # Find the date dimension
        date_dim = next(
            (d for d in dims if any(k in d.lower() for k in ["date", "month", "year", "time", "timestamp"])),
            dims[0] if dims else None,
        )
        non_date_dims = [d for d in dims if d != date_dim]

        select_parts: List[str] = []
        group_parts: List[str] = []

        # Date expression
        date_alias = gran.title() if gran else "Period"
        if date_dim:
            gran_sql = self._granularity_expr(date_dim, gran)
            select_parts.append(f"{gran_sql} AS \"{date_alias}\"")
            group_parts.append(gran_sql)

        # Extra categorical dims (only include if explicitly in query)
        for d in non_date_dims:
            select_parts.append(_q(d))
            group_parts.append(_q(d))

        # Metric aggregation
        if metric:
            fn = _AGG_SQL_FN.get(agg, "SUM")
            metric_alias = f"{agg}_{_alias(metric)}"
            select_parts.append(f"ROUND({fn}({_q(metric)}), 2) AS \"{metric_alias}\"")
        else:
            metric_alias = "Record_Count"
            select_parts.append('COUNT(*) AS "Record_Count"')

        select_str = ", ".join(select_parts)
        group_str = " GROUP BY " + ", ".join(group_parts) if group_parts else ""
        where_str = ""
        if filters:
            wc = _build_where(filters)
            if wc:
                where_str = f" WHERE {wc}"
        # ORDER BY alias, not raw expression
        order_str = f' ORDER BY "{date_alias}" ASC' if date_dim else ""

        sql = f"SELECT {select_str} FROM {TABLE}{where_str}{group_str}{order_str}"
        explanation = (
            f"Generated trend SQL grouping '{metric or 'record count'}' "
            f"by {gran or 'date'} over {date_dim or 'date column'}."
        )
        return sql, explanation

    def _granularity_expr(self, col: str, gran: Optional[str]) -> str:
        """Return DuckDB expression for date truncation.
        Works with both DATE/TIMESTAMP columns and VARCHAR columns that contain ISO dates.
        Uses SUBSTR-based approach which works reliably on both types.
        """
        qcol = _q(col)
        # Use SUBSTR on string representation — avoids STRFTIME type issues
        if gran == "year":
            return f"SUBSTR(CAST({qcol} AS VARCHAR), 1, 4)"
        elif gran == "quarter":
            # Extract YYYY and calculate quarter from month digit
            return (
                f"CONCAT("
                f"SUBSTR(CAST({qcol} AS VARCHAR), 1, 4), "
                f"'-Q', "
                f"CAST((CAST(SUBSTR(CAST({qcol} AS VARCHAR), 6, 2) AS INT) + 2) / 3 AS VARCHAR)"
                f")"
            )
        elif gran == "month":
            return f"SUBSTR(CAST({qcol} AS VARCHAR), 1, 7)"
        elif gran == "week":
            # ISO week is tricky with SUBSTR — approximate with 7-day buckets
            return f"SUBSTR(CAST({qcol} AS VARCHAR), 1, 7)"
        elif gran == "day":
            return f"SUBSTR(CAST({qcol} AS VARCHAR), 1, 10)"
        else:
            # Default: month
            return f"SUBSTR(CAST({qcol} AS VARCHAR), 1, 7)"

    # ------------------------------------------------------------------
    # Distribution
    # ------------------------------------------------------------------

    def _generate_distribution(self, ir: QueryIR) -> Tuple[str, str]:
        metric = ir.metric
        if not metric:
            return self._generate_fallback(ir, [])

        sql = (
            f"SELECT "
            f"FLOOR({_q(metric)} / (SELECT (MAX({_q(metric)}) - MIN({_q(metric)})) / 10 "
            f"FROM {TABLE})) * (SELECT (MAX({_q(metric)}) - MIN({_q(metric)})) / 10 FROM {TABLE}) "
            f"AS \"Bucket_Start\", "
            f"COUNT(*) AS \"Frequency\" "
            f"FROM {TABLE} "
            f"WHERE {_q(metric)} IS NOT NULL "
            f"GROUP BY 1 ORDER BY 1"
        )
        explanation = f"Generated distribution histogram SQL for '{metric}'."
        return sql, explanation

    # ------------------------------------------------------------------
    # Statistical Functions
    # ------------------------------------------------------------------

    def _generate_statistical(self, ir: QueryIR) -> Tuple[str, str]:
        fn = ir.statistical_function
        metric = ir.metric
        dims = ir.dimensions
        filters = ir.filters

        if not fn or not metric:
            return self._generate_fallback(ir, [])

        duck_fn = _DUCKDB_STAT_FN.get(fn, fn)
        where_str = ""
        if filters:
            wc = _build_where(filters)
            if wc:
                where_str = f" WHERE {wc}"

        select_parts: List[str] = []
        for d in dims:
            select_parts.append(_q(d))

        if fn == "CORRELATION" and ir.metrics and len(ir.metrics) >= 1:
            # CORR(metric1, metric2)
            m2 = ir.metrics[0]
            alias = f"Correlation_{_alias(metric)}_{_alias(m2)}"
            select_parts.append(f"ROUND(CORR({_q(metric)}, {_q(m2)}), 4) AS \"{alias}\"")
        elif fn in ("PERCENTILE", "QUARTILE"):
            # Use APPROX_QUANTILE with 0.5 default
            alias = f"{fn}_{_alias(metric)}"
            select_parts.append(
                f"APPROX_QUANTILE({_q(metric)}, 0.5) AS \"{alias}\""
            )
        elif fn == "MODE":
            # DuckDB: MODE() WITHIN GROUP (ORDER BY col)
            alias = f"Mode_{_alias(metric)}"
            select_parts.append(f"MODE() WITHIN GROUP (ORDER BY {_q(metric)}) AS \"{alias}\"")
        else:
            alias = f"{fn}_{_alias(metric)}"
            select_parts.append(
                f"ROUND({duck_fn}({_q(metric)}), 4) AS \"{alias}\""
            )

        group_str = ""
        if dims:
            group_str = " GROUP BY " + ", ".join(_q(d) for d in dims)

        sql = f"SELECT {', '.join(select_parts)} FROM {TABLE}{where_str}{group_str}"
        explanation = f"Generated statistical SQL: {fn}({metric})."
        return sql, explanation

    # ------------------------------------------------------------------
    # Data Quality
    # ------------------------------------------------------------------

    def _generate_data_quality(
        self, ir: QueryIR, column_names: List[str]
    ) -> Tuple[str, str]:
        dq = ir.data_quality_type

        if dq == "missing":
            # Count nulls per column — one unified UNION ALL query
            if column_names:
                parts = [
                    f"SELECT '{c}' AS \"Column\", COUNT(*) - COUNT({_q(c)}) AS \"Null_Count\" FROM {TABLE}"
                    for c in column_names
                ]
                sql = " UNION ALL ".join(parts) + ' ORDER BY "Null_Count" DESC'
            else:
                sql = f"SELECT * FROM {TABLE} LIMIT 5"
            explanation = "Generated data quality SQL counting NULL values per column."

        elif dq == "duplicates":
            if column_names:
                cols_str = ", ".join(_q(c) for c in column_names[:8])
                sql = (
                    f"SELECT {cols_str}, COUNT(*) AS \"Duplicate_Count\" "
                    f"FROM {TABLE} GROUP BY {cols_str} HAVING COUNT(*) > 1 "
                    f'ORDER BY "Duplicate_Count" DESC LIMIT 50'
                )
            else:
                sql = f"SELECT COUNT(*) AS \"Total_Rows\", COUNT(*) - COUNT(DISTINCT *) AS \"Duplicates\" FROM {TABLE}"
            explanation = "Generated duplicate detection SQL."

        elif dq in ("schema", "summary"):
            # Return a simple preview; actual schema info comes from metadata
            sql = f"SELECT * FROM {TABLE} LIMIT 5"
            explanation = "Schema/summary query — returning sample rows and schema metadata."

        elif dq == "row_count":
            sql = f'SELECT COUNT(*) AS "Total_Rows" FROM {TABLE}'
            explanation = "Generated row count SQL."

        elif dq == "col_count":
            sql = f'SELECT COUNT(*) AS "Total_Rows" FROM {TABLE}'
            explanation = f"Dataset has {len(column_names)} columns."

        elif dq == "unique":
            if ir.metric:
                sql = f'SELECT COUNT(DISTINCT {_q(ir.metric)}) AS "Distinct_Values" FROM {TABLE}'
            elif column_names:
                sql = f'SELECT COUNT(DISTINCT {_q(column_names[0])}) AS "Distinct_Values" FROM {TABLE}'
            else:
                sql = f'SELECT COUNT(*) AS "Total_Rows" FROM {TABLE}'
            explanation = "Generated distinct value count SQL."

        else:
            sql = f"SELECT * FROM {TABLE} LIMIT 10"
            explanation = "Generated preview SQL for data quality inspection."

        return sql, explanation

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    def _generate_fallback(
        self, ir: QueryIR, column_names: List[str]
    ) -> Tuple[str, str]:
        cols = column_names[:8]
        select_str = ", ".join(_q(c) for c in cols) if cols else "*"
        sql = f"SELECT {select_str} FROM {TABLE} LIMIT 20"
        explanation = "Generated fallback preview SQL (low confidence or unsupported intent)."
        return sql, explanation


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

ir_sql_generator = IRSQLGenerator()
