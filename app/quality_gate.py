"""AI quality gate: decide if a SerpApi result is worth showing."""

import json
import logging
from typing import Dict
from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def quality_gate(
    title: str,
    snippet: str,
    url: str,
    portal_name: str = "",
) -> Dict:
    """
    AI decides: is this a real tender worth showing?
    Returns {keep: bool, reason: str, tender_type: str}
    """
    settings = get_settings()
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
- It's a news article ABOUT tenders (not a tender itself)
- It's a portal homepage (not a specific tender)
- It's a help/training/MoU page
- It's an aggregator listing page ("X tenders in India")
- It's clearly not a procurement opportunity

KEEP if:
- It's a specific tender notice with scope/work described
- It's a bid invitation, RFP, EOI, or auction notice

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
        return {
            "keep": bool(data.get("keep", True)),
            "reason": str(data.get("reason", ""))[:100],
            "tender_type": str(data.get("tender_type", "unknown")),
        }
    except Exception as e:
        logger.warning(f"Quality gate failed: {e}")
        return fallback
