import sqlite3
import pandas as pd
from typing import List, Dict, Any, Optional

def test_db_connection(
    source_type: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    sqlite_bytes: Optional[bytes] = None
) -> Dict[str, Any]:
    """
    Tests database connectivity for PostgreSQL, MySQL, and SQLite.
    Returns success status, latency, and message.
    """
    source_type = source_type.lower()

    if source_type == 'sqlite':
        if not sqlite_bytes:
            return {"success": False, "message": "No SQLite database file provided."}
        try:
            # Write bytes to temporary connection
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
                tmp.write(sqlite_bytes)
                tmp_path = tmp.name

            con = sqlite3.connect(tmp_path)
            cur = con.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [r[0] for r in cur.fetchall() if not r[0].startswith('sqlite_')]
            con.close()

            return {
                "success": True,
                "message": f"SQLite connection successful. Discovered {len(tables)} table(s).",
                "tablesCount": len(tables),
                "tables": tables,
                "tmpPath": tmp_path
            }
        except Exception as e:
            return {"success": False, "message": f"SQLite connection error: {str(e)}"}

    elif source_type == 'mysql':
        try:
            import pymysql
            db_port = int(port or 3306)
            con = pymysql.connect(
                host=host or 'localhost',
                port=db_port,
                user=username or 'root',
                password=password or '',
                database=database or '',
                connect_timeout=5
            )
            with con.cursor() as cur:
                cur.execute("SHOW TABLES;")
                tables = [r[0] for r in cur.fetchall()]
            con.close()

            return {
                "success": True,
                "message": f"MySQL connection successful. Discovered {len(tables)} table(s).",
                "tablesCount": len(tables),
                "tables": tables
            }
        except ImportError:
            return {"success": False, "message": "PyMySQL driver is missing on backend server."}
        except Exception as e:
            return {"success": False, "message": f"MySQL connection error: {str(e)}"}

    elif source_type == 'postgres':
        try:
            import psycopg2
            db_port = int(port or 5432)
            con = psycopg2.connect(
                host=host or 'localhost',
                port=db_port,
                dbname=database or 'postgres',
                user=username or 'postgres',
                password=password or '',
                connect_timeout=5
            )
            cur = con.cursor()
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
            tables = [r[0] for r in cur.fetchall()]
            con.close()

            return {
                "success": True,
                "message": f"PostgreSQL connection successful. Discovered {len(tables)} table(s).",
                "tablesCount": len(tables),
                "tables": tables
            }
        except ImportError:
            return {"success": False, "message": "Psycopg2 driver is missing on backend server."}
        except Exception as e:
            return {"success": False, "message": f"PostgreSQL connection error: {str(e)}"}

    else:
        return {"success": False, "message": f"Unsupported database connector type '{source_type}'."}


def introspect_schema_details(
    source_type: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    sqlite_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Introspects tables, row counts, and column metadata.
    """
    source_type = source_type.lower()
    table_metadata = []

    if source_type == 'sqlite' and sqlite_path:
        con = sqlite3.connect(sqlite_path)
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in cur.fetchall() if not r[0].startswith('sqlite_')]

        for t in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM \"{t}\"")
                count = cur.fetchone()[0]
                df_sample = pd.read_sql_query(f"SELECT * FROM \"{t}\" LIMIT 5", con)
                cols = list(df_sample.columns)
                table_metadata.append({
                    "tableName": t,
                    "rowCount": count,
                    "columns": cols,
                    "columnCount": len(cols)
                })
            except Exception:
                continue
        con.close()

    elif source_type == 'mysql':
        import pymysql
        db_port = int(port or 3306)
        con = pymysql.connect(
            host=host or 'localhost',
            port=db_port,
            user=username or 'root',
            password=password or '',
            database=database or '',
            connect_timeout=5
        )
        with con.cursor() as cur:
            cur.execute("SHOW TABLES;")
            tables = [r[0] for r in cur.fetchall()]
            for t in tables:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM `{t}`;")
                    count = cur.fetchone()[0]
                    df_sample = pd.read_sql_query(f"SELECT * FROM `{t}` LIMIT 5", con)
                    cols = list(df_sample.columns)
                    table_metadata.append({
                        "tableName": t,
                        "rowCount": count,
                        "columns": cols,
                        "columnCount": len(cols)
                    })
                except Exception:
                    continue
        con.close()

    elif source_type == 'postgres':
        import psycopg2
        db_port = int(port or 5432)
        con = psycopg2.connect(
            host=host or 'localhost',
            port=db_port,
            dbname=database or 'postgres',
            user=username or 'postgres',
            password=password or '',
            connect_timeout=5
        )
        cur = con.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        tables = [r[0] for r in cur.fetchall()]
        for t in tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}";')
                count = cur.fetchone()[0]
                df_sample = pd.read_sql_query(f'SELECT * FROM "{t}" LIMIT 5', con)
                cols = list(df_sample.columns)
                table_metadata.append({
                    "tableName": t,
                    "rowCount": count,
                    "columns": cols,
                    "columnCount": len(cols)
                })
            except Exception:
                continue
        con.close()

    return table_metadata


def import_table_snapshot_rows(
    source_type: str,
    table_name: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    sqlite_path: Optional[str] = None,
    limit: int = 10000
) -> List[Dict[str, Any]]:
    """
    Fetches snapshot rows from selected database table.
    """
    source_type = source_type.lower()
    df = pd.DataFrame()

    if source_type == 'sqlite' and sqlite_path:
        con = sqlite3.connect(sqlite_path)
        df = pd.read_sql_query(f'SELECT * FROM "{table_name}" LIMIT {limit}', con)
        con.close()

    elif source_type == 'mysql':
        import pymysql
        con = pymysql.connect(
            host=host or 'localhost',
            port=int(port or 3306),
            user=username or 'root',
            password=password or '',
            database=database or ''
        )
        df = pd.read_sql_query(f'SELECT * FROM `{table_name}` LIMIT {limit}', con)
        con.close()

    elif source_type == 'postgres':
        import psycopg2
        con = psycopg2.connect(
            host=host or 'localhost',
            port=int(port or 5432),
            dbname=database or 'postgres',
            user=username or 'postgres',
            password=password or ''
        )
        df = pd.read_sql_query(f'SELECT * FROM "{table_name}" LIMIT {limit}', con)
        con.close()

    if df.empty:
        return []

    # Clean NaNs / Infinities / Datetimes
    df = df.replace([float('inf'), float('-inf')], None)
    df = df.where(pd.notnull(df), None)

    rows = df.to_dict(orient='records')
    clean_rows = []
    for r in rows:
        c_row = {}
        for k, v in r.items():
            if hasattr(v, 'isoformat'):
                c_row[k] = v.isoformat()
            elif isinstance(v, float) and (v != v or v == float('inf') or v == float('-inf')):
                c_row[k] = None
            elif pd.isna(v):
                c_row[k] = None
            else:
                c_row[k] = v
        clean_rows.append(c_row)

    return clean_rows
