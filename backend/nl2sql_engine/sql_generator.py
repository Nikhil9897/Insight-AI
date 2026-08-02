from typing import List, Dict, Any, Optional
from backend.nl2sql_engine.ir import QueryIR

class SQLGenerator:
    """
    Dialect-Aware SQL String Generator.
    Supports DuckDB, SQLite, PostgreSQL, and MySQL syntax rules.
    """

    @staticmethod
    def generate_sql(ir: QueryIR, table_name: str = "df", dialect: str = "duckdb") -> str:
        dialect = dialect.lower()
        
        # Quote identifiers helper per dialect
        def q_ident(col: str) -> str:
            if dialect in ('postgres', 'postgresql', 'sqlite', 'duckdb'):
                return f'"{col}"'
            return f'`{col}`'

        table_identifier = q_ident(table_name) if dialect != 'duckdb' else 'df'

        select_parts: List[str] = []
        group_by_parts: List[str] = []

        # Dimensions in SELECT & GROUP BY
        for d in ir.dimensions:
            q_d = q_ident(d)
            select_parts.append(q_d)
            group_by_parts.append(q_d)

        # Date truncation formatting if date column & time granularity present
        if ir.date_cols and ir.time_granularity:
            date_col = ir.date_cols[0]
            q_date = q_ident(date_col)
            gran = ir.time_granularity.upper()

            if dialect == 'duckdb':
                date_expr = f"DATE_TRUNC('{gran.lower()}', TRY_CAST({q_date} AS DATE)) AS \"{date_col}_granularity\""
                grp_expr = f"DATE_TRUNC('{gran.lower()}', TRY_CAST({q_date} AS DATE))"
            elif dialect == 'sqlite':
                date_expr = f"STRFTIME('%Y-%m', {q_date}) AS \"{date_col}_granularity\""
                grp_expr = f"STRFTIME('%Y-%m', {q_date})"
            else: # postgres / mysql
                date_expr = f"DATE_TRUNC('{gran.lower()}', TRY_CAST({q_date} AS DATE)) AS \"{date_col}_granularity\""
                grp_expr = f"DATE_TRUNC('{gran.lower()}', TRY_CAST({q_date} AS DATE))"


            if any(d == date_col for d in ir.dimensions):
                q_d = q_ident(date_col)
                if q_d in select_parts:
                    idx = select_parts.index(q_d)
                    select_parts[idx] = date_expr
                if q_d in group_by_parts:
                    idx = group_by_parts.index(q_d)
                    group_by_parts[idx] = grp_expr
            else:
                select_parts.insert(0, date_expr)
                group_by_parts.insert(0, grp_expr)


        # Metrics with Aggregate Functions
        stat_fn = (ir.stat_fn or 'SUM').upper()
        if ir.metrics:
            for m in ir.metrics:
                q_m = q_ident(m)
                alias = f"\"{stat_fn}_{m}\""
                select_parts.append(f"{stat_fn}({q_m}) AS {alias}")
        elif ir.dimensions:
            select_parts.append("COUNT(*) AS \"Total_Count\"")
        else:
            select_parts.append("*")

        select_clause = f"SELECT {', '.join(select_parts)}"
        from_clause = f"FROM {table_identifier}"

        # WHERE Clause Filters
        where_parts: List[str] = []
        for f in ir.filters:
            col = f.get('col') or f.get('column') if isinstance(f, dict) else getattr(f, 'column', None)
            op = f.get('op') or f.get('operator', '=') if isinstance(f, dict) else getattr(f, 'operator', '=')
            val = f.get('val') if isinstance(f, dict) and 'val' in f else (f.get('value') if isinstance(f, dict) else getattr(f, 'value', None))
            
            if op in ('eq', 'equals'):
                op = '='

            if col and val is not None:
                q_c = q_ident(col)
                if op == 'year_eq':
                    where_parts.append(f"CAST(SUBSTR(CAST({q_c} AS VARCHAR), 1, 4) AS INT) = {val}")
                elif op in ('contains', 'like'):
                    where_parts.append(f"LOWER({q_c}) LIKE LOWER('%{val}%')")
                elif isinstance(val, str):
                    where_parts.append(f"{q_c} {op} '{val}'")
                else:
                    where_parts.append(f"{q_c} {op} {val}")
            elif col and op == 'is_null':
                where_parts.append(f"{q_ident(col)} IS NULL")
            elif col and op == 'is_not_null':
                where_parts.append(f"{q_ident(col)} IS NOT NULL")

        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""


        # GROUP BY Clause
        group_clause = f"GROUP BY {', '.join(group_by_parts)}" if group_by_parts and ir.metrics else ""

        # ORDER BY Clause
        order_parts: List[str] = []
        if ir.order_by:
            for ob in ir.order_by:
                col = ob.get('col')
                direction = ob.get('dir', 'DESC').upper()
                if col:
                    order_parts.append(f"{q_ident(col)} {direction}")
        elif ir.analysis_shape == "TIME_SERIES" or ir.intent == "trend":
            # Time series queries order chronologically ASC
            time_col = ir.time_dimension or (ir.date_cols[0] if ir.date_cols else None)
            if time_col and ir.time_granularity:
                order_parts.append(f"\"{time_col}_granularity\" ASC")
            elif time_col:
                order_parts.append(f"{q_ident(time_col)} ASC")
            elif group_by_parts:
                order_parts.append(f"{group_by_parts[0]} ASC")

        elif ir.metrics:
            # Default order by first metric descending
            m_first = ir.metrics[0]
            alias_first = f"\"{stat_fn}_{m_first}\""
            order_parts.append(f"{alias_first} DESC")

        order_clause = f"ORDER BY {', '.join(order_parts)}" if order_parts else ""


        # LIMIT Clause
        limit_val = ir.limit if ir.limit else (15 if ir.dimensions else 100)
        limit_clause = f"LIMIT {limit_val}" if limit_val else ""

        # Assemble SQL query
        sql_parts = [select_clause, from_clause, where_clause, group_clause, order_clause, limit_clause]
        return " ".join([p for p in sql_parts if p]).strip()
