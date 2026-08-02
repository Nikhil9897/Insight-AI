from typing import Dict, Any, Optional, Tuple, List
import pandas as pd

from backend.nl2sql_engine.ir import QueryIR
from backend.nl2sql_engine.parser import IntentParser
from backend.nl2sql_engine.resolver import SchemaResolver
from backend.nl2sql_engine.query_validator import QueryValidator
from backend.nl2sql_engine.sql_generator import SQLGenerator
from backend.nl2sql_engine.sql_validator import SQLValidator
from backend.nl2sql_engine.schema_cache import SchemaCache

class NL2SQLEngine:
    """
    Public Orchestrator Interface for InsightAI NL2SQL Engine.
    Executes:
    1. Deterministic Intent Parser (parser.py)
    2. Fuzzy Schema Grounding (resolver.py)
    3. Pre-SQL Logical Validation (query_validator.py)
    4. Dialect SQL Generation (sql_generator.py)
    5. SQL Dry-Run Validation & Auto-Repair (sql_validator.py)
    """

    @classmethod
    def process(
        cls,
        query: str,
        available_columns: List[str],
        column_types: Dict[str, str],
        df_data: Optional[Any] = None,
        table_name: str = "df",
        dialect: str = "duckdb"
    ) -> Dict[str, Any]:
        
        # Step 1: Intent Parsing & Entity Extraction (with DatasetBrain value index lookup if df_data available)
        ir: QueryIR = IntentParser.parse_query(query, available_columns, column_types, df_data=df_data)


        # Step 2: Multi-Tier Fuzzy Schema Grounding
        resolved_metrics, resolved_dims, grounding_notes = SchemaResolver.resolve_query_columns(
            ir.metrics, ir.dimensions, available_columns
        )
        if resolved_metrics:
            ir.metrics = resolved_metrics
        if resolved_dims:
            ir.dimensions = resolved_dims
        ir.validation_notes.extend(grounding_notes)

        # Step 3: Pre-SQL Logical Validation
        is_logical_valid, validation_msgs = QueryValidator.validate_ir(ir, available_columns, column_types)

        # Step 4: Dialect SQL String Generation
        raw_sql = SQLGenerator.generate_sql(ir, table_name=table_name, dialect=dialect)

        # Step 5: Dry-Run Verification & Auto-Repair
        is_sql_valid, final_sql, err_msg = SQLValidator.validate_and_repair(raw_sql, df_data=df_data, dialect=dialect)

        if not is_sql_valid:
            ir.validation_notes.append(f"Dry-run warning: {err_msg}")
            ir.confidence = 0.75

        return {
            'ir': ir,
            'sql': final_sql,
            'is_valid': is_sql_valid,
            'error': err_msg if not is_sql_valid else None,
            'validation_notes': ir.validation_notes,
            'confidence': ir.confidence,
        }
