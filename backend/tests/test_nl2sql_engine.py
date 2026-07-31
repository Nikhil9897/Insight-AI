import pytest
from backend.nl2sql_engine import NL2SQLEngine, SchemaResolver, SQLValidator

RETAIL_COLS = ["OrderID", "CustomerName", "TotalAmount", "ShipCity", "ShipCountry", "OrderDate", "Category"]
RETAIL_TYPES = {
    "OrderID": "integer",
    "CustomerName": "varchar",
    "TotalAmount": "float",
    "ShipCity": "varchar",
    "ShipCountry": "varchar",
    "OrderDate": "date",
    "Category": "varchar",
}

def test_fuzzy_schema_grounding():
    # Test fuzzy column name matching
    assert SchemaResolver.resolve_column("revenue", RETAIL_COLS) == "TotalAmount"
    assert SchemaResolver.resolve_column("customer", RETAIL_COLS) == "CustomerName"
    assert SchemaResolver.resolve_column("city", RETAIL_COLS) == "ShipCity"
    assert SchemaResolver.resolve_column("country", RETAIL_COLS) == "ShipCountry"
    assert SchemaResolver.resolve_column("date", RETAIL_COLS) == "OrderDate"

def test_sql_dry_run_validation():
    valid_sql = 'SELECT "ShipCity", SUM("TotalAmount") AS "SUM_TotalAmount" FROM df GROUP BY "ShipCity"'
    is_valid, sql, err = SQLValidator.validate_and_repair(valid_sql)
    assert is_valid is True
    assert err is None

def test_sql_auto_repair_missing_group_by():
    # Missing GROUP BY column "ShipCity"
    broken_sql = 'SELECT "ShipCity", SUM("TotalAmount") AS "SUM_TotalAmount" FROM df'
    is_valid, repaired_sql, err = SQLValidator.validate_and_repair(broken_sql)
    assert is_valid is True
    assert "GROUP BY" in repaired_sql.upper()

def test_orchestrator_process():
    res = NL2SQLEngine.process("Total revenue by city", RETAIL_COLS, RETAIL_TYPES)
    assert res['is_valid'] is True
    assert "TotalAmount" in res['sql']
    assert "ShipCity" in res['sql']
