import sqlite3
import os
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
            db_port = (port or 3306)
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
            db_port = (port or 5432)
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
                row = cur.fetchone()
                count = row[0] if row else 0
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
        db_port = (port or 3306)
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
                    row = cur.fetchone()
                    count = row[0] if row else 0
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
        db_port = (port or 5432)
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
                row = cur.fetchone()
                count = row[0] if row else 0
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
            port=(port or 3306),
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
            port=(port or 5432),
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
    df = df.astype(object).where(pd.notnull(df), None)

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


def introspect_full_schema(
    source_type: str,
    sqlite_path: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generic full-schema introspection for any supported database type.
    Returns tables, columns with types, primary keys, foreign keys,
    row counts, and estimated DB size — fully database-agnostic.

    Supports: SQLite, PostgreSQL, MySQL
    """
    source_type = source_type.lower()
    tables_data: List[Dict[str, Any]] = []
    relationships: List[Dict[str, Any]] = []
    db_name = database or (os.path.basename(sqlite_path).replace(".db", "").replace(".sqlite", "") if sqlite_path else "Database")
    file_size_bytes: Optional[int] = None

    # ── SQLite ──────────────────────────────────────────────────────────────
    if source_type == "sqlite" and sqlite_path:
        try:
            file_size_bytes = os.path.getsize(sqlite_path)
        except Exception:
            file_size_bytes = None

        con = sqlite3.connect(sqlite_path)
        cur = con.cursor()

        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        table_names = [r[0] for r in cur.fetchall()]

        for table in table_names:
            # Row count
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                row = cur.fetchone()
                row_count = row[0] if row else 0
            except Exception:
                row_count = 0

            # Columns: name, type, isPrimaryKey, isNullable
            cur.execute(f'PRAGMA table_info("{table}")')
            pragma_cols = cur.fetchall()
            # pragma columns: cid, name, type, notnull, dflt_value, pk
            columns = []
            pk_cols = []
            for row in pragma_cols:
                col_name = row[1]
                col_type = (row[2] or "TEXT").upper()
                is_pk = row[5] > 0
                is_nullable = row[3] == 0  # notnull=0 means nullable
                if is_pk:
                    pk_cols.append(col_name)
                columns.append({
                    "name": col_name,
                    "sqlType": col_type,
                    "isPrimaryKey": is_pk,
                    "isForeignKey": False,  # updated below after FK scan
                    "isNullable": is_nullable,
                })

            # Foreign keys for this table
            cur.execute(f'PRAGMA foreign_key_list("{table}")')
            fk_rows = cur.fetchall()
            # fk columns: id, seq, table, from, to, on_update, on_delete, match
            fk_col_names = set()
            for fk in fk_rows:
                from_col = fk[3]
                to_table = fk[2]
                to_col = fk[4]
                fk_col_names.add(from_col)
                relationships.append({
                    "fromTable": table,
                    "fromColumn": from_col,
                    "toTable": to_table,
                    "toColumn": to_col,
                })

            # Mark FK columns
            for col in columns:
                if col["name"] in fk_col_names:
                    col["isForeignKey"] = True

            tables_data.append({
                "name": table,
                "rowCount": row_count,
                "columns": columns,
                "primaryKeys": pk_cols,
            })

        con.close()

    # ── PostgreSQL ───────────────────────────────────────────────────────────
    elif source_type == "postgres":
        try:
            import psycopg2
            con = psycopg2.connect(
                host=host or "localhost",
                port=(port or 5432),
                dbname=database or "postgres",
                user=username or "postgres",
                password=password or "",
                connect_timeout=8,
            )
            cur = con.cursor()

            # Tables
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            table_names = [r[0] for r in cur.fetchall()]

            # Columns
            cur.execute("""
                SELECT table_name, column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position;
            """)
            col_rows = cur.fetchall()
            cols_by_table: Dict[str, List] = {}
            for r in col_rows:
                cols_by_table.setdefault(r[0], []).append({
                    "name": r[1],
                    "sqlType": r[2].upper(),
                    "isPrimaryKey": False,
                    "isForeignKey": False,
                    "isNullable": r[3] == "YES",
                })

            # Primary Keys
            cur.execute("""
                SELECT tc.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
            """)
            for r in cur.fetchall():
                for col in cols_by_table.get(r[0], []):
                    if col["name"] == r[1]:
                        col["isPrimaryKey"] = True

            # Foreign Keys
            cur.execute("""
                SELECT
                    kcu.table_name, kcu.column_name,
                    ccu.table_name AS ref_table, ccu.column_name AS ref_col
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
            """)
            for r in cur.fetchall():
                relationships.append({
                    "fromTable": r[0], "fromColumn": r[1],
                    "toTable": r[2], "toColumn": r[3],
                })
                for col in cols_by_table.get(r[0], []):
                    if col["name"] == r[1]:
                        col["isForeignKey"] = True

            for table in table_names:
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                    row = cur.fetchone()
                    row_count = row[0] if row else 0
                except Exception:
                    row_count = 0
                cols = cols_by_table.get(table, [])
                pk_cols = [c["name"] for c in cols if c["isPrimaryKey"]]
                tables_data.append({
                    "name": table,
                    "rowCount": row_count,
                    "columns": cols,
                    "primaryKeys": pk_cols,
                })
            con.close()
        except Exception as e:
            raise RuntimeError(f"PostgreSQL schema introspection failed: {e}")

    # ── MySQL ────────────────────────────────────────────────────────────────
    elif source_type == "mysql":
        try:
            import pymysql
            con = pymysql.connect(
                host=host or "localhost",
                port=(port or 3306),
                user=username or "root",
                password=password or "",
                database=database or "",
                connect_timeout=8,
            )
            cur = con.cursor()

            cur.execute(f"""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = '{database}' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            table_names = [r[0] for r in cur.fetchall()]

            cur.execute(f"""
                SELECT table_name, column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = '{database}'
                ORDER BY table_name, ordinal_position;
            """)
            col_rows = cur.fetchall()
            cols_by_table: Dict[str, List] = {}
            for r in col_rows:
                cols_by_table.setdefault(r[0], []).append({
                    "name": r[1],
                    "sqlType": r[2].upper(),
                    "isPrimaryKey": False,
                    "isForeignKey": False,
                    "isNullable": r[3] == "YES",
                })

            cur.execute(f"""
                SELECT table_name, column_name FROM information_schema.key_column_usage
                WHERE constraint_name = 'PRIMARY' AND table_schema = '{database}';
            """)
            for r in cur.fetchall():
                for col in cols_by_table.get(r[0], []):
                    if col["name"] == r[1]:
                        col["isPrimaryKey"] = True

            cur.execute(f"""
                SELECT kcu.table_name, kcu.column_name, kcu.referenced_table_name, kcu.referenced_column_name
                FROM information_schema.key_column_usage kcu
                JOIN information_schema.referential_constraints rc
                  ON kcu.constraint_name = rc.constraint_name AND kcu.constraint_schema = rc.constraint_schema
                WHERE kcu.table_schema = '{database}' AND kcu.referenced_table_name IS NOT NULL;
            """)
            for r in cur.fetchall():
                relationships.append({
                    "fromTable": r[0], "fromColumn": r[1],
                    "toTable": r[2], "toColumn": r[3],
                })
                for col in cols_by_table.get(r[0], []):
                    if col["name"] == r[1]:
                        col["isForeignKey"] = True

            for table in table_names:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM `{table}`")
                    row = cur.fetchone()
                    row_count = row[0] if row else 0
                except Exception:
                    row_count = 0
                cols = cols_by_table.get(table, [])
                pk_cols = [c["name"] for c in cols if c["isPrimaryKey"]]
                tables_data.append({
                    "name": table,
                    "rowCount": row_count,
                    "columns": cols,
                    "primaryKeys": pk_cols,
                })
            con.close()
        except Exception as e:
            raise RuntimeError(f"MySQL schema introspection failed: {e}")

    return {
        "dbName": db_name,
        "dbType": source_type,
        "fileSizeBytes": file_size_bytes,
        "tables": tables_data,
        "relationships": relationships,
    }
