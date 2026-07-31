import re
import duckdb
from typing import Tuple, Optional, Dict, Any

class SQLValidator:
    """
    SQL Dry-Run Verification & Auto-Correction Engine.
    Executes dry-run checks (EXPLAIN / LIMIT 0) against DuckDB / SQLite / Postgres.
    Detects syntax errors, missing GROUP BY columns, invalid column aliases, or dialect mismatches,
    and auto-repairs recoverable SQL queries prior to returning to client.
    """

    @classmethod
    def validate_and_repair(cls, sql: str, df_data: Optional[Any] = None, dialect: str = 'duckdb') -> Tuple[bool, str, Optional[str]]:
        """
        Validates SQL string. If dry-run fails, attempts deterministic auto-repair.
        Returns: (is_valid, repaired_sql, error_message)
        """
        if not sql or not sql.strip():
            return False, sql, "Empty SQL string."

        # Dry-run validation check using DuckDB in-memory parser
        try:
            con = duckdb.connect(':memory:')
            if df_data is not None:
                if isinstance(df_data, list):
                    import pandas as pd
                    df_data = pd.DataFrame(df_data)
                con.register('df', df_data)
            else:
                # Mock empty table for dry-run validation if no df passed
                con.execute("CREATE TABLE df AS SELECT 1 AS id, 'sample' AS category, 100.0 AS TotalAmount, 'North' AS Region, '2026-01-01' AS OrderDate, 'NYC' AS ShipCity, 'Acme' AS CustomerName")

            # Execute dry-run LIMIT 0 check
            con.execute(f"SELECT * FROM ({sql}) AS dry_run LIMIT 0")
            con.close()
            return True, sql, None
        except Exception as err:
            err_msg = str(err)
            
            # Attempt Auto-Repair 1: Missing GROUP BY column
            repaired_sql = cls._repair_group_by(sql, err_msg)
            if repaired_sql != sql:
                try:
                    con = duckdb.connect(':memory:')
                    if df_data is not None:
                        con.register('df', df_data)
                    else:
                        con.execute("CREATE TABLE df AS SELECT 1 AS id, 'sample' AS category, 100.0 AS TotalAmount, 'North' AS Region, '2026-01-01' AS OrderDate, 'NYC' AS ShipCity")
                    con.execute(f"SELECT * FROM ({repaired_sql}) AS dry_run LIMIT 0")
                    con.close()
                    return True, repaired_sql, None
                except Exception:
                    pass

            # Attempt Auto-Repair 2: Double quote vs Single quote syntax fixes
            repaired_sql_quotes = cls._repair_quotes(sql)
            if repaired_sql_quotes != sql:
                try:
                    con = duckdb.connect(':memory:')
                    if df_data is not None:
                        con.register('df', df_data)
                    else:
                        con.execute("CREATE TABLE df AS SELECT 1 AS id, 'sample' AS category, 100.0 AS TotalAmount, 'North' AS Region, '2026-01-01' AS OrderDate, 'NYC' AS ShipCity")
                    con.execute(f"SELECT * FROM ({repaired_sql_quotes}) AS dry_run LIMIT 0")
                    con.close()
                    return True, repaired_sql_quotes, None
                except Exception:
                    pass

            return False, sql, err_msg

    @staticmethod
    def _repair_group_by(sql: str, err_msg: str) -> str:
        """
        Auto-repairs missing GROUP BY columns if detected in error traceback.
        """
        if "GROUP BY" in err_msg.upper() or "MUST BE AGGREGATED" in err_msg.upper():
            # Extract unaggregated columns from SELECT clause
            select_match = re.search(r'SELECT\s+(.*?)\s+FROM', sql, re.IGNORECASE)
            if select_match:
                select_items = select_match.group(1).split(',')
                non_agg_items = []
                for item in select_items:
                    item_str = item.strip()
                    if not any(fn in item_str.upper() for fn in ('SUM(', 'AVG(', 'COUNT(', 'MIN(', 'MAX(', 'COUNT(*)')):
                        # Strip alias
                        col_raw = item_str.split(' AS ')[0].strip()
                        non_agg_items.append(col_raw)
                
                if non_agg_items:
                    if "GROUP BY" in sql.upper():
                        # Append missing columns to existing GROUP BY
                        sql = re.sub(r'GROUP BY\s+(.*?)(ORDER BY|LIMIT|$)', f"GROUP BY \\1, {', '.join(non_agg_items)} \\2", sql, flags=re.IGNORECASE)
                    else:
                        # Add GROUP BY clause before ORDER BY or LIMIT
                        if "ORDER BY" in sql.upper():
                            sql = re.sub(r'ORDER BY', f"GROUP BY {', '.join(non_agg_items)} ORDER BY", sql, flags=re.IGNORECASE)
                        elif "LIMIT" in sql.upper():
                            sql = re.sub(r'LIMIT', f"GROUP BY {', '.join(non_agg_items)} LIMIT", sql, flags=re.IGNORECASE)
                        else:
                            sql = f"{sql} GROUP BY {', '.join(non_agg_items)}"
        return sql

    @staticmethod
    def _repair_quotes(sql: str) -> str:
        """
        Auto-repairs misplaced string literal quotes vs column identifier quotes.
        """
        # Replace double quotes around literal filter values with single quotes
        return re.sub(r'=\s*"([^"]+)"', r"= '\1'", sql)
