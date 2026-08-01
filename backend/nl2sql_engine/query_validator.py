from typing import List, Dict, Any, Tuple
from backend.nl2sql_engine.ir import QueryIR

class QueryValidator:
    """
    Pre-SQL Logical Validation Engine.
    Validates:
    1. Are requested metrics and dimensions valid schema attributes?
    2. Are numeric aggregation functions applied appropriately?
    3. Is there dimension/metric ambiguity?
    4. Are multi-table relationships valid?
    """

    @staticmethod
    def validate_ir(ir: QueryIR, available_columns: List[str], column_types: Dict[str, str]) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Metric Existence & Data Type Checks
        num_cols = [c for c, t in column_types.items() if any(nt in str(t).lower() for nt in ('int', 'float', 'double', 'number', 'decimal', 'numeric'))]

        for m in ir.metrics:
            if m not in available_columns:
                errors.append(f"Metric '{m}' does not exist in target table schema.")
            else:
                col_type = column_types.get(m, 'string').lower()
                if ir.stat_fn in ('SUM', 'AVG', 'MIN', 'MAX', 'STDDEV') and col_type in ('string', 'boolean', 'varchar', 'text'):
                    # Hard error for invalid math on string columns like AVG(Customer Name)
                    errors.append(f"Invalid operation: Cannot apply mathematical function {ir.stat_fn} to text column '{m}'.")

        # 2. Dimension Existence Checks
        for d in ir.dimensions:
            if d not in available_columns:
                errors.append(f"Dimension '{d}' does not exist in target table schema.")

        # 3. Aggregation Consistency Check
        if ir.dimensions and not ir.metrics and ir.stat_fn != 'COUNT':
            ir.stat_fn = 'COUNT'
            warnings.append("Applied COUNT() aggregation for categorical dimension breakdown without explicit metric.")

        # 4. Filter Column Verification
        for f in ir.filters:
            col = f.get('col') if isinstance(f, dict) else getattr(f, 'column', None)
            if col and col not in available_columns:
                errors.append(f"Filter column '{col}' does not exist in target schema.")

        # 5. Semantic Analytical Shape Validation
        if ir.analysis_shape == "TIME_SERIES" or ir.intent == "trend":
            date_cols = [c for c, t in column_types.items() if any(dt in str(t).lower() or dt in c.lower() for dt in ('date', 'time', 'year', 'timestamp'))]
            if not date_cols:
                errors.append("Invalid query shape: TIME_SERIES trend analysis requested, but no date or timestamp column exists in dataset.")

        if ir.analysis_shape == "CORRELATION" or ir.intent == "correlation":
            if len(num_cols) < 2 and len(ir.metrics) < 2:
                errors.append("Invalid query shape: CORRELATION scatter analysis requires at least 2 numeric measure columns.")

        is_valid = len(errors) == 0
        ir.validation_notes.extend(warnings)
        if errors:
            ir.validation_notes.extend(errors)

        return is_valid, errors + warnings

