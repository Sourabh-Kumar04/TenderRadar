"""Configuration module for TenderRadar."""

import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    def __init__(self):
        # SerpApi Credentials (sponsor search provider)
        # SerpApi Credentials
        self.SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "").strip()

        
        # Fireworks AI / LLM Credentials & Configuration
        self.FIREWORKS_API_KEY: str = os.getenv("FIREWORKS_API_KEY", "").strip() or os.getenv("LLM_API_KEY", "").strip()
        self.LLM_API_KEY: str = self.FIREWORKS_API_KEY
        self.FIREWORKS_BASE_URL: str = os.getenv("FIREWORKS_BASE_URL", "").strip().rstrip("/") or os.getenv("LLM_BASE_URL", "https://api.fireworks.ai/inference/v1").strip().rstrip("/")
        self.LLM_BASE_URL: str = self.FIREWORKS_BASE_URL
        self.LLM_MODEL: str = os.getenv("LLM_MODEL", "accounts/fireworks/models/deepseek-v4p1-flash").strip()
        
        # Explicit mock mode flags or auto-fallback
        mock_serp = os.getenv("MOCK_SERPAPI", "").lower()
        self.MOCK_SERPAPI: bool = mock_serp in ("1", "true", "yes") or not bool(self.SERPAPI_API_KEY)
        
        mock_llm = os.getenv("MOCK_LLM", "").lower()
        self.MOCK_LLM: bool = mock_llm in ("1", "true", "yes") or not bool(self.FIREWORKS_API_KEY)
        
        # Database
        default_db_path = str(BASE_DIR / "data" / "tenders.db")
        self.DATABASE_PATH: str = os.getenv("DATABASE_PATH", default_db_path)
        
        # Cache & Scans
        self.CACHE_TTL_HOURS: int = int(os.getenv("CACHE_TTL_HOURS", "24"))
        self.SCAN_SCHEDULE_HOUR: int = int(os.getenv("SCAN_SCHEDULE_HOUR", "6"))
        self.SCAN_SCHEDULE_MINUTE: int = int(os.getenv("SCAN_SCHEDULE_MINUTE", "0"))
        
        # Server
        self.PORT: int = int(os.getenv("PORT", "8000"))
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")


@lru_cache()
def get_settings() -> Settings:
    """Returns singleton settings instance."""
    return Settings()
