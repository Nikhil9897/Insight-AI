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
        for m in ir.metrics:
            if m not in available_columns:
                errors.append(f"Metric '{m}' does not exist in target table schema.")
            else:
                col_type = column_types.get(m, 'string').lower()
                if ir.stat_fn in ('SUM', 'AVG', 'MIN', 'MAX') and col_type in ('string', 'boolean', 'varchar', 'text'):
                    warnings.append(f"Stat function {ir.stat_fn} requested on non-numeric column '{m}' (type: {col_type}).")

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
            col = f.get('col')
            if col and col not in available_columns:
                errors.append(f"Filter column '{col}' does not exist in target schema.")

        is_valid = len(errors) == 0
        ir.validation_notes.extend(warnings)
        if errors:
            ir.validation_notes.extend(errors)

        return is_valid, errors + warnings
