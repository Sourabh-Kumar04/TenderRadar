"""AI quality gate: decide if a SerpApi result is worth showing."""

import json
import logging
from typing import Dict
from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def log_rejection(title: str, url: str, reason: str, db_path: str = None):
    """Log quality gate rejections for pattern analysis."""
    if not db_path:
        from app.config import get_settings
        db_path = get_settings().DATABASE_PATH
    try:
        import sqlite3
        from datetime import datetime
        c = sqlite3.connect(db_path)
        c.execute("""CREATE TABLE IF NOT EXISTS quality_rejections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT, url TEXT, reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")
        c.execute(
            "INSERT INTO quality_rejections (title, url, reason, created_at) VALUES (?, ?, ?, ?)",
            (title[:200], url[:500], reason[:200], datetime.now().isoformat())
        )
        c.commit()
        c.close()
    except Exception:
        pass


def quality_gate(
    title: str,
    snippet: str,
    url: str,
    portal_name: str = "",
    log_rejections: bool = True,
) -> Dict:
    """
    AI decides: is this a real tender worth showing?
    Returns {keep: bool, reason: str, tender_type: str}
    """
    settings = get_settings()
    # Mock mode: keep everything, skip API call (for tests)
    if getattr(settings, "MOCK_LLM", False):
        return {"keep": True, "reason": "mock", "tender_type": "unknown", "is_news_article": False}
    api_key = (
        getattr(settings, "FIREWORKS_API_KEY", "")
        or getattr(settings, "LLM_API_KEY", "")
    )
    # Default: keep if it looks like a tender (fail open for now)
    fallback = {"keep": True, "reason": "auto", "tender_type": "unknown"}

    if not api_key:
        return fallback

    try:
        base_url = (
            getattr(settings, "FIREWORKS_BASE_URL", "")
            or "https://api.fireworks.ai/inference/v1"
        )
        model = getattr(settings, "LLM_MODEL", "") or "accounts/fireworks/models/deepseek-v4p1-flash"
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=30.0)

        prompt = f"""You are a tender quality filter. Decide if this search result is a REAL, ACTIONABLE Indian government tender.

Title: {title}
URL: {url}
Portal: {portal_name}
Snippet: {snippet[:500]}

REJECT if:
- It's a portal homepage with no specific tender info
- It's a help/training/MoU page
- It's clearly not a procurement opportunity

KEEP if:
- It's a specific tender notice with scope/work described
- It's a bid invitation, RFP, EOI, or auction notice
- It's a NEWS ARTICLE about a specific tender (we'll extract details + follow to official URL)

Return JSON: {{"keep": true/false, "reason": "one-line reason", "tender_type": "works|goods|services|unknown"}}"""

        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a strict quality filter. Output JSON only."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=256,
        )
        raw = (resp.choices[0].message.content or "{}").strip()
        data = json.loads(raw)
        is_news = any(d in url.lower() for d in ['news', 'blog', 'article', 'energetica', 'mercom', 'saurenergy', 'economic-times', 'business-standard'])
        keep = bool(data.get("keep", True))
        reason = str(data.get("reason", ""))[:100]
        if not keep and log_rejections:
            log_rejection(title, url, reason)
        return {
            "keep": keep,
            "reason": reason,
            "tender_type": str(data.get("tender_type", "unknown")),
            "is_news_article": is_news,
        }
    except Exception as e:
        logger.warning(f"Quality gate failed: {e}")
        return fallback
