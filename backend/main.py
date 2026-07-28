import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.routes.analytics import router as analytics_router
from backend.routes.auth import router as auth_router
from backend.routes.connectors import router as connectors_router
from backend.routes.workspace_persistence import router as workspace_router
from backend.routes.chat import router as chat_router
from backend.database import Base, engine, run_auto_migrations
from backend.config import settings

# Initialize Database Models / Metadata & Auto-Migrate Missing Columns
try:
    Base.metadata.create_all(bind=engine)
    run_auto_migrations(engine)
except Exception as e:
    logging.warning("Database schema initialization note: %s", str(e))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("groq").setLevel(logging.WARNING)
logging.getLogger("groq._base_client").setLevel(logging.WARNING)
logger = logging.getLogger("insightai")

app = FastAPI(
    title="InsightAI Analytics API",
    description="High-performance FastAPI backend for InsightAI powering DuckDB SQL execution, NL2SQL synthesis, and analytics.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware for Vite / React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(connectors_router)
app.include_router(workspace_router)
app.include_router(chat_router)


# Global exception handler — guarantees all unhandled errors return JSON
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "error": "Internal server error", "path": str(request.url.path)},
    )


@app.get("/api/health")
async def health_check():
    """
    Health check endpoint verifying FastAPI & DuckDB backend status.
    """
    return {
        "status": "online",
        "service": "InsightAI Analytics FastAPI Backend",
        "engine": "DuckDB In-Memory Relational Engine",
        "version": "1.0.0"
    }


# Static file serving for production React frontend SPA
dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")
if os.path.exists(dist_dir):
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
