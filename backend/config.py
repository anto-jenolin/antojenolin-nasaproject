"""
TerraPulse AI — Application Configuration
All settings are read from environment variables / .env file with
intelligent auto-discovery of local project datasets and paths.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
from pathlib import Path
import os


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_DB_PATH = str(BACKEND_DIR / "terrapulse.db").replace("\\", "/")


class Settings(BaseSettings):
    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── First-run Admin ───────────────────────────────────────────────────────
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_USERNAME: str = "admin"

    # ── Dataset Paths ─────────────────────────────────────────────────────────
    PARQUET_DIR: str = r"D:\MODIS\MOD13C2_Parquet"
    DERIVED_DIR: str = r"D:\MODIS\Derived"

    # ── LLM Provider ─────────────────────────────────────────────────────────
    LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── Application ───────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173"

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH}"

    @property
    def resolved_parquet_dir(self) -> Path:
        """Intelligently resolve PARQUET_DIR on any laptop or system."""
        p = Path(self.PARQUET_DIR)
        if p.exists():
            return p
        # Check bundled project data
        internal_data = PROJECT_ROOT / "data" / "MOD13C2_Parquet"
        if internal_data.exists():
            return internal_data
        cwd_data = Path.cwd() / "data" / "MOD13C2_Parquet"
        if cwd_data.exists():
            return cwd_data
        return p

    @property
    def resolved_derived_dir(self) -> Path:
        """Intelligently resolve or create DERIVED_DIR with write check."""
        internal_derived = PROJECT_ROOT / "data" / "Derived"
        internal_derived.mkdir(parents=True, exist_ok=True)
        # Test if configured DERIVED_DIR is writable
        try:
            p = Path(self.DERIVED_DIR)
            test_file = p / ".write_test"
            test_file.touch()
            test_file.unlink()
            return p
        except Exception:
            return internal_derived

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY and self.LLM_PROVIDER == "openai")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
