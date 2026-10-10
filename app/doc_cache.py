"""Document cache in SQLite - avoid re-fetching on every chat request."""

import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24

def _get_db(db_path: str):
    from app.config import get_settings
    path = db_path or get_settings().DATABASE_PATH
    c = sqlite3.connect(path)
    c.execute("""CREATE TABLE IF NOT EXISTS document_cache (
        cache_key TEXT PRIMARY KEY,
        text TEXT,
        pdf_url TEXT,
        source TEXT,
        created_at TEXT
    )""")
    c.commit()
    return c

def get_cached_document(cache_key: str, db_path: str = None) -> Optional[Dict]:
    try:
        c = _get_db(db_path)
        row = c.execute(
            "SELECT text, pdf_url, source, created_at FROM document_cache WHERE cache_key=?",
            (cache_key,)
        ).fetchone()
        c.close()
        if not row:
            return None
        text, pdf_url, source, created_at = row
        # Check TTL
        age = datetime.now() - datetime.fromisoformat(created_at)
        if age > timedelta(hours=CACHE_TTL_HOURS):
            return None
        return {"found": True, "text": text, "pdf_url": pdf_url, "source": source}
    except Exception as e:
        logger.debug(f"Cache read failed: {e}")
        return None

def cache_document(cache_key: str, text: str, pdf_url: str, source: str, db_path: str = None):
    try:
        c = _get_db(db_path)
        c.execute(
            """INSERT OR REPLACE INTO document_cache
               (cache_key, text, pdf_url, source, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (cache_key, text[:15000], pdf_url, source, datetime.now().isoformat())
        )
        c.commit()
        c.close()
    except Exception as e:
        logger.debug(f"Cache write failed: {e}")


def is_duplicate_title(title: str, db_path: str = None) -> bool:
    """Check if this exact title already exists (title-level dedup)."""
    try:
        from app.config import get_settings
        path = db_path or get_settings().DATABASE_PATH
        c = sqlite3.connect(path)
        # Normalize: lowercase, strip, remove extra spaces
        import re
        norm = re.sub(r'\s+', ' ', title.lower().strip())
        # Check for existing tenders with same normalized title
        rows = c.execute("SELECT title FROM tenders").fetchall()
        c.close()
        for (existing,) in rows:
            existing_norm = re.sub(r'\s+', ' ', existing.lower().strip())
            if norm == existing_norm and len(norm) > 10:
                return True
        return False
    except Exception:
        return False
