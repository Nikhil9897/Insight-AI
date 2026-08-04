import duckdb
import pandas as pd
import re
from typing import List, Dict, Any, Tuple

def execute_sql_on_data(sql: str, dataset_rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Executes an SQL query over in-memory dataset rows using DuckDB.
    Replaces AlaSQL with native high-performance DuckDB query execution over Pandas DataFrames.
    """
    if not dataset_rows:
        return [], []

    # 1. Convert dataset dictionary list to Pandas DataFrame
    df = pd.DataFrame(dataset_rows)

    # 2. Sanitize and normalize table references (convert ?, SalesData, Titanic, dataset -> df)
    normalized_sql = sql.strip()

    # Security check: Ensure SQL contains read-only querying (SELECT / WITH) and block dangerous system calls
    forbidden_keywords = [r"\bCOPY\b", r"\bATTACH\b", r"\bDETACH\b", r"\bINSTALL\b", r"\bLOAD\b", r"\bPRAGMA\b", r"\bEXPORT\b", r"\bDROP\b", r"\bDELETE\b", r"\bUPDATE\b", r"\bINSERT\b", r"\bALTER\b", r"\bCREATE\b"]
    for kw in forbidden_keywords:
        if re.search(kw, normalized_sql, flags=re.IGNORECASE):
            clean_kw = kw.replace(r"\b", "")
            raise ValueError(f"Security Alert: Execution of prohibited SQL statement containing '{clean_kw}' is blocked.")
    
    # Replace table names like FROM ? or FROM dataset or FROM SalesData with FROM df
    normalized_sql = re.sub(r'FROM\s+[\?`\'"]?(?:SalesData|Titanic|dataset|table|\?)[\?`\'"]?', 'FROM df', normalized_sql, flags=re.IGNORECASE)
    if 'FROM df' not in normalized_sql and 'from df' not in normalized_sql.lower():
        # Fallback regex if table name had quotes or backticks
        normalized_sql = re.sub(r'FROM\s+([`\'"]?\S+[`\'"]?)', 'FROM df', normalized_sql, flags=re.IGNORECASE)

    # 3. Create fresh in-memory DuckDB connection & register DataFrame
    con = duckdb.connect(database=':memory:')
    con.register('df', df)

    try:
        # Execute query and fetch Pandas result
        result_df = con.execute(normalized_sql).df()

        # Handle NaNs / nulls / infinities cleanly for JSON response
        result_df = result_df.replace([float('inf'), float('-inf')], None)
        result_df = result_df.where(pd.notnull(result_df), None)

        rows = result_df.to_dict(orient='records')
        for r in rows:
            for k, v in r.items():
                if isinstance(v, float) and (v != v or v == float('inf') or v == float('-inf')):
                    r[k] = None
        columns = list(result_df.columns)
        return rows, columns
    finally:
        con.close()
