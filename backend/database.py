import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("insightai.database")

# Check for Supabase PostgreSQL URL, fallback to local SQLite for Guest/Demo Mode
SUPABASE_URL = os.getenv("SUPABASE_DATABASE_URL", "").strip()

if SUPABASE_URL:
    # Ensure postgresql:// prefix (some providers give postgres://)
    if SUPABASE_URL.startswith("postgres://"):
        SUPABASE_URL = SUPABASE_URL.replace("postgres://", "postgresql://", 1)

    # Auto-encode unescaped '@' in password if multiple '@' symbols exist in URI
    prefix, _, rest = SUPABASE_URL.partition("://")
    if rest.count("@") > 1:
        userinfo, host_part = rest.rsplit("@", 1)
        if ":" in userinfo:
            user, password = userinfo.split(":", 1)
            import urllib.parse
            password = urllib.parse.quote_plus(urllib.parse.unquote(password))
            SUPABASE_URL = f"{prefix}://{user}:{password}@{host_part}"

    DATABASE_URL = SUPABASE_URL
    logger.info("Connecting to Supabase PostgreSQL Database.")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
else:
    # Guest / Demo Mode SQLite database
    if os.environ.get("VERCEL"):
        SQLITE_PATH = "/tmp/insightai_persistence.db"
    else:
        SQLITE_PATH = os.path.join(os.path.dirname(__file__), "insightai_persistence.db")
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
    logger.info("No Supabase URL found. Initializing Guest Mode SQLite Persistence at '%s'.", SQLITE_PATH)
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_auto_migrations(target_engine):
    """
    Ensures existing PostgreSQL or SQLite tables get newly added columns
    without requiring manual database resets or Alembic migrations.
    """
    from sqlalchemy import text
    is_sqlite = target_engine.dialect.name == "sqlite"

    columns_to_add = [
        # Table: query_history
        ("query_history", "explanation", "TEXT"),
        ("query_history", "execution_time_ms", "INTEGER DEFAULT 0"),
        ("query_history", "chart_type", "VARCHAR(50) DEFAULT 'bar'"),
        ("query_history", "result_row_count", "INTEGER DEFAULT 0"),
        ("query_history", "status", "VARCHAR(20) DEFAULT 'success'"),
        ("query_history", "dataset_id", "VARCHAR(128)"),
        ("query_history", "dataset_name", "VARCHAR(255)"),

        # Table: imported_datasets
        ("imported_datasets", "data_rows_json", "JSONB" if not is_sqlite else "TEXT"),
        ("imported_datasets", "description", "TEXT"),
        ("imported_datasets", "summary_json", "JSONB" if not is_sqlite else "TEXT"),
        ("imported_datasets", "schema_json", "JSONB" if not is_sqlite else "TEXT"),

        # Table: users
        ("users", "last_opened_project_id", "VARCHAR(36)"),
        ("users", "role", "VARCHAR(100) DEFAULT 'Enterprise Data Analyst'"),
        ("users", "company", "VARCHAR(255) DEFAULT 'InsightAI Workspace'"),

        # Table: saved_dashboards
        ("saved_dashboards", "pinned_cards_json", "JSONB" if not is_sqlite else "TEXT"),
        ("saved_dashboards", "layout_json", "JSONB" if not is_sqlite else "TEXT"),
        ("saved_dashboards", "filters_json", "JSONB" if not is_sqlite else "TEXT"),
    ]

    with target_engine.begin() as conn:
        for table, col, col_type in columns_to_add:
            try:
                if is_sqlite:
                    res = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                    existing_cols = [r[1] for r in res]
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                        logger.info(f"SQLite Migration: Added column '{col}' to table '{table}'.")
                else:
                    # PostgreSQL ALTER TABLE ADD COLUMN IF NOT EXISTS
                    # Fallback JSONB -> JSON if database doesn't support JSONB
                    try:
                        sql = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type};"
                        conn.execute(text(sql))
                    except Exception:
                        if "JSONB" in col_type:
                            sql = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} JSON;"
                            conn.execute(text(sql))
                    logger.info(f"PostgreSQL Migration: Ensured column '{col}' on table '{table}'.")
            except Exception as err:
                logger.debug(f"Auto-migration note for {table}.{col}: {err}")

def get_db():
    """
    FastAPI dependency delivering database session per request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
