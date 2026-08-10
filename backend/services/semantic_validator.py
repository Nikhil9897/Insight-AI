"""
semantic_validator.py — Pre-SQL Semantic Validation Gate
=========================================================
Validates a QueryIR against the DatasetBrain before any SQL is compiled.
Catches semantic errors (wrong column names, bad aggregations, non-existent
filter values) that would silently produce incorrect SQL.

Validation pipeline:
  1. Metric exists in schema?           → ERROR if not
  2. Metric is numeric?                 → ERROR if not
  3. Aggregation valid for metric type? → ERROR (e.g. SUM on string)
  4. All dimensions exist in schema?    → ERROR if not
  5. Filter columns exist in schema?    → ERROR if not
  6. Filter values exist in value_index?→ WARNING (auto-corrects case)
  7. Limit is reasonable (1–5000)?      → WARNING if out of range
  8. time_granularity without time_dim? → WARNING, auto-fills if possible

Returns ValidationResult with:
  - is_valid (bool) — False means do NOT compile SQL
  - errors   (List[str]) — hard failures
  - warnings (List[str]) — soft issues, execution can continue
  - corrected_ir — an auto-corrected QueryIR if any fields were fixed
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from backend.services.intent_parser import FilterCondition, QueryIR

logger = logging.getLogger("insightai.semantic_validator")

# Aggregation functions that require a numeric metric
_NUMERIC_AGGS = {"SUM", "AVG", "MIN", "MAX"}

# Aggregation functions that can operate on any column
_ANY_COL_AGGS = {"COUNT", "COUNT_DISTINCT"}


class ValidationResult:
    """Result of semantic validation of a QueryIR."""

    def __init__(
        self,
        is_valid: bool,
        errors: List[str],
        warnings: List[str],
        corrected_ir: Optional[QueryIR] = None,
    ):
        self.is_valid = is_valid
        self.errors = errors
        self.warnings = warnings
        self.corrected_ir = corrected_ir

    def summary(self) -> str:
        parts = []
        if self.errors:
            parts.append("ERRORS: " + "; ".join(self.errors))
        if self.warnings:
            parts.append("WARNINGS: " + "; ".join(self.warnings))
        if not parts:
            return "✓ Validation passed"
        return " | ".join(parts)


class SemanticValidator:
    """
    Pre-SQL Semantic Validation Gate.

    Usage:
        result = SemanticValidator.validate(ir, brain_profile)
        if not result.is_valid:
            # escalate to LLM IR Refiner
        elif result.corrected_ir:
            ir = result.corrected_ir  # use auto-corrected version
    """

    @classmethod
    def validate(
        cls,
        ir: QueryIR,
        brain_profile: Dict[str, Any],
    ) -> ValidationResult:
        errors: List[str] = []
        warnings: List[str] = []
        corrections: Dict[str, Any] = {}

        all_cols: List[str] = brain_profile.get("columns", [])
        num_cols: List[str] = brain_profile.get("metrics", [])
        dim_cols: List[str] = brain_profile.get("dimensions", [])
        time_cols: List[str] = brain_profile.get("time_columns", [])
        value_index: Dict[str, str] = brain_profile.get("value_index", {})
        col_meta: Dict[str, Any] = brain_profile.get("column_metadata", {})

        all_cols_lower = {c.lower(): c for c in all_cols}

        # ── 1. Metric validation ─────────────────────────────────────────────
        if ir.metric:
            if ir.metric not in all_cols:
                # Try case-insensitive correction
                corrected = all_cols_lower.get(ir.metric.lower())
                if corrected:
                    warnings.append(
                        f"Metric '{ir.metric}' corrected to '{corrected}' (case fix)."
                    )
                    corrections["metric"] = corrected
                else:
                    errors.append(
                        f"Metric '{ir.metric}' does not exist in schema. "
                        f"Valid metrics: {num_cols[:5]}"
                    )
            else:
                # Check that the metric is actually numeric for numeric aggs
                if ir.aggregation in _NUMERIC_AGGS:
                    meta = col_meta.get(ir.metric, {})
                    if meta.get("type") not in ("numeric", "currency", "float", "int", "integer", "number"):
                        if ir.metric not in num_cols:
                            errors.append(
                                f"Aggregation '{ir.aggregation}' requires a numeric metric "
                                f"but '{ir.metric}' is non-numeric (type: {meta.get('type', 'unknown')})."
                            )

        elif ir.aggregation in _NUMERIC_AGGS and not ir.metric:
            # No metric but SUM/AVG/MIN/MAX requested — find a default
            if num_cols:
                warnings.append(
                    f"No metric specified for '{ir.aggregation}' — defaulting to '{num_cols[0]}'."
                )
                corrections["metric"] = num_cols[0]
            else:
                errors.append(
                    f"Aggregation '{ir.aggregation}' requires a numeric metric but none is available."
                )

        # ── 2. Dimension validation ──────────────────────────────────────────
        if ir.dimensions:
            corrected_dims = []
            for dim in ir.dimensions:
                if dim in all_cols:
                    corrected_dims.append(dim)
                else:
                    fixed = all_cols_lower.get(dim.lower())
                    if fixed:
                        warnings.append(f"Dimension '{dim}' corrected to '{fixed}' (case fix).")
                        corrected_dims.append(fixed)
                    else:
                        errors.append(
                            f"Dimension '{dim}' does not exist in schema. "
                            f"Valid dimensions: {(dim_cols + time_cols)[:5]}"
                        )
                        corrected_dims.append(dim)  # keep original for error reporting
            if corrected_dims != ir.dimensions:
                corrections["dimensions"] = corrected_dims

        # ── 3. Filter validation ─────────────────────────────────────────────
        corrected_filters: List[FilterCondition] = []
        filters_changed = False

        for f in ir.filters:
            corrected_f = f
            # Column exists?
            if f.column not in all_cols:
                fixed_col = all_cols_lower.get(f.column.lower())
                if fixed_col:
                    warnings.append(
                        f"Filter column '{f.column}' corrected to '{fixed_col}' (case fix)."
                    )
                    corrected_f = FilterCondition(
                        column=fixed_col,
                        operator=f.operator,
                        value=f.value,
                        value2=f.value2,
                    )
                    filters_changed = True
                else:
                    errors.append(
                        f"Filter column '{f.column}' does not exist in schema."
                    )
                    corrected_filters.append(corrected_f)
                    continue

            # Value grounding — check categorical values exist
            if f.operator == "eq" and isinstance(f.value, str):
                col_to_check = corrected_f.column
                meta = col_meta.get(col_to_check, {})
                distinct_vals: List[str] = meta.get("distinct_values", [])
                distinct_lower = {v.lower(): v for v in distinct_vals if isinstance(v, str)}

                if distinct_vals:
                    if f.value.lower() not in distinct_lower:
                        # Try to find a close match
                        canonical = _find_closest_value(f.value, distinct_vals)
                        if canonical:
                            warnings.append(
                                f"Filter value '{f.value}' for '{col_to_check}' corrected to "
                                f"'{canonical}' (closest match in data)."
                            )
                            corrected_f = FilterCondition(
                                column=corrected_f.column,
                                operator=corrected_f.operator,
                                value=canonical,
                                value2=corrected_f.value2,
                            )
                            filters_changed = True
                        else:
                            warnings.append(
                                f"Filter value '{f.value}' not found in column '{col_to_check}'. "
                                f"Known values: {distinct_vals[:5]}"
                            )
                    else:
                        # Normalise to the canonical casing from the data
                        canonical_case = distinct_lower[f.value.lower()]
                        if canonical_case != f.value:
                            corrected_f = FilterCondition(
                                column=corrected_f.column,
                                operator=corrected_f.operator,
                                value=canonical_case,
                                value2=corrected_f.value2,
                            )
                            filters_changed = True

            corrected_filters.append(corrected_f)

        if filters_changed:
            corrections["filters"] = [
                {"column": f.column, "operator": f.operator, "value": f.value, "value2": f.value2}
                for f in corrected_filters
            ]

        # ── 4. Limit sanity ──────────────────────────────────────────────────
        if ir.limit is not None:
            if ir.limit < 1:
                warnings.append(f"Limit {ir.limit} is < 1 — clamped to 1.")
                corrections["limit"] = 1
            elif ir.limit > 5000:
                warnings.append(f"Limit {ir.limit} is very large — clamped to 5000.")
                corrections["limit"] = 5000

        # ── 5. Time granularity without time dimension ────────────────────────
        if ir.time_granularity and not ir.time_dimension:
            if time_cols:
                warnings.append(
                    f"time_granularity='{ir.time_granularity}' without time_dimension — "
                    f"auto-set to '{time_cols[0]}'."
                )
                corrections["time_dimension"] = time_cols[0]
                # Also ensure it's in dimensions
                current_dims = corrections.get("dimensions", list(ir.dimensions))
                if time_cols[0] not in current_dims:
                    current_dims = [time_cols[0]] + current_dims
                    corrections["dimensions"] = current_dims
            else:
                warnings.append(
                    "time_granularity specified but no date columns found in schema."
                )

        # ── Build corrected IR if needed ──────────────────────────────────────
        corrected_ir: Optional[QueryIR] = None
        if corrections and not errors:
            try:
                current_data = ir.model_dump()
                current_data.update(corrections)
                # Reconstruct filters properly if changed
                if "filters" in corrections:
                    current_data["filters"] = corrected_filters
                corrected_ir = QueryIR(**current_data)
                logger.info(
                    f"[SemanticValidator] Auto-corrected IR. Changes: {list(corrections.keys())}"
                )
            except Exception as e:
                warnings.append(f"Auto-correction failed: {e}")
                corrected_ir = None

        is_valid = len(errors) == 0
        result = ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            corrected_ir=corrected_ir,
        )

        if errors:
            logger.warning(
                f"[SemanticValidator] INVALID IR — {len(errors)} error(s): {'; '.join(errors)}"
            )
        elif warnings:
            logger.info(
                f"[SemanticValidator] Valid with {len(warnings)} warning(s): {'; '.join(warnings)}"
            )
        else:
            logger.debug("[SemanticValidator] IR passed all checks.")

        return result


def _find_closest_value(target: str, candidates: List[str]) -> Optional[str]:
    """
    Finds the closest matching value from a list of candidates using
    case-insensitive prefix matching and similarity ratio.
    Returns None if no close match (ratio < 0.75).
    """
    from difflib import SequenceMatcher

    target_lower = target.lower()
    best_match: Optional[str] = None
    best_score = 0.0

    for c in candidates:
        c_lower = c.lower()
        # Exact case-insensitive match
        if c_lower == target_lower:
            return c
        # Prefix match
        if c_lower.startswith(target_lower) or target_lower.startswith(c_lower):
            score = 0.85
        else:
            score = SequenceMatcher(None, target_lower, c_lower).ratio()

        if score > best_score:
            best_score = score
            best_match = c

    return best_match if best_score >= 0.75 else None


# Module-level singleton
semantic_validator = SemanticValidator()
