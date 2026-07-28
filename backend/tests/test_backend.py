import sys
from pathlib import Path

# Add project root to sys.path if needed
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

def run_backend_check():
    print("--- BACKEND COMPILATION & INTEGRITY CHECK ---")

    # 1. Config Test
    from backend.config import settings
    print(f"1. Config Loaded [Host={settings.HOST}, Port={settings.PORT}, LLM_Provider={settings.LLM_PROVIDER}, Model={settings.OLLAMA_MODEL}]")

    # 2. Ollama Service Test
    from backend.services.ollama_service import OllamaService
    ollama_service = OllamaService()
    print("2. Ollama Service Loaded")

    # 3. Unified LLM Manager Test
    from backend.services.llm_service import generate_llm_content_with_fallback
    print("3. LLM Manager Service Loaded")

    # 4. DuckDB Service Test
    from backend.services.duckdb_service import execute_sql_on_data
    print("4. DuckDB Relational Engine Loaded")

    # 5. Dataset Memory Test
    from backend.services.dataset_memory_service import dataset_memory_service
    print("5. Dataset Memory Service Loaded")

    # 6. Semantic Search Test
    from backend.services.semantic_search_service import semantic_search_service
    print("6. Semantic Search Service Loaded")

    # 7. Conversation Memory Test
    from backend.services.conversation_memory_service import conversation_memory_service
    print("7. Conversation Memory Service Loaded")

    # 8. Query Planner Test
    from backend.services.query_planner_service import query_planner_service
    print("8. Query Planner Service Loaded")

    # 9. Chart Recommender Test
    from backend.services.chart_recommender import recommend_chart
    print("9. Chart Recommender Service Loaded")

    # 10. Local Rule Engine Test
    from backend.services.local_nl2sql_service import generate_local_ai_profile
    print("10. Local Rule Engine Loaded")

    # 11. API Routers Test
    from backend.routes.analytics import router as analytics_router
    from backend.routes.auth import router as auth_router
    print("11. API Routers Loaded")

    # 12. Main App Compilation Test
    from backend.main import app
    print(f"12. FastAPI Application '{app.title}' Initialized Successfully")

    print("\n[SUCCESS] ALL BACKEND MODULES AND ROUTERS COMPILED AND INITIALIZED WITH ZERO ERRORS!")

if __name__ == "__main__":
    run_backend_check()
