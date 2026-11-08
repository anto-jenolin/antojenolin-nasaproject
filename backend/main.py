"""
TerraPulse AI — FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from pathlib import Path

from config import settings
from database import init_db, get_db, SessionLocal
from auth import create_first_admin

# ── Route imports ─────────────────────────────────────────────────────────────
from api.auth_routes import router as auth_router
from api.dataset_routes import router as dataset_router
from api.explorer_routes import router as explorer_router
from api.ml_routes import router as ml_router
from api.xai_routes import router as xai_router
from api.chat_routes import router as chat_router
from api.admin_routes import router as admin_router
from api.preprocessing_routes import router as preprocessing_router


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan: startup / shutdown
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    print("[TerraPulse] Initialising database …")
    init_db()

    print("[TerraPulse] Checking for first-run admin …")
    db = SessionLocal()
    try:
        create_first_admin(db)
    finally:
        db.close()

    print("[TerraPulse] Backend ready.")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    print("[TerraPulse] Shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TerraPulse AI",
    description=(
        "AI-powered Earth observation platform built on NASA MODIS MOD13C2 "
        "global vegetation data (Feb 2000 – present)."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(dataset_router)
app.include_router(explorer_router)
app.include_router(ml_router)
app.include_router(xai_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(preprocessing_router)


# ─────────────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["system"])
async def health():
    """Quick liveness probe — no auth required."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "llm_configured": settings.llm_configured,
        "parquet_dir": str(settings.PARQUET_DIR),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Serve built frontend (production SPA)
# ─────────────────────────────────────────────────────────────────────────────
from fastapi.responses import FileResponse

# Check both possible locations: adjacent frontend/dist or local static_dist
possible_dirs = [
    Path(__file__).parent.parent / "frontend" / "dist",
    Path(__file__).parent / "static_dist",
    Path("/app/frontend/dist"),
]

frontend_dist_dir = None
for d in possible_dirs:
    if d.exists() and (d / "index.html").exists():
        frontend_dist_dir = d
        break

if frontend_dist_dir:
    # Mount assets subfolder
    assets_dir = frontend_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Catch-all route to serve index.html for React Router SPA routes like /login, /explorer, /predict
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow static files if they exist in dist
        file_path = frontend_dist_dir / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Fall back to index.html for client-side routing
        return FileResponse(frontend_dist_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=(settings.APP_ENV == "development"),
    )
