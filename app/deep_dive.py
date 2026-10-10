"""Deep Dive AI agent: fetches tender page + AI analysis with must-care points."""

import re
import json
import logging
import requests
from typing import Dict, Any, Optional
from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def fetch_page_text(url: str, timeout: int = 12) -> str:
    """Best-effort fetch of tender page text. Returns empty on failure."""
    if not url:
        return ""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; TenderRadar/1.0)"}
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code != 200:
            return ""
        # Strip HTML tags crudely
        text = re.sub(r"<script.*?</script>", " ", r.text, flags=re.S | re.I)
        text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text[:8000]
    except Exception as e:
        logger.warning(f"Page fetch failed for {url}: {e}")
        return ""


def deep_dive_analysis(
    title: str,
    snippet: str,
    portal_name: str,
    page_url: str = "",
    scope: str = "",
) -> Dict[str, Any]:
    """Run AI deep-dive: summary, key details, risks, must-care points."""
    settings = get_settings()
    api_key = (
        getattr(settings, "FIREWORKS_API_KEY", "")
        or getattr(settings, "LLM_API_KEY", "")
    )
    base_url = (
        getattr(settings, "FIREWORKS_BASE_URL", "")
        or getattr(settings, "LLM_BASE_URL", "")
        or "https://api.fireworks.ai/inference/v1"
    )
    model = getattr(settings, "LLM_MODEL", "") or "accounts/fireworks/models/deepseek-v4p1-flash"

    page_text = fetch_page_text(page_url) if page_url else ""
    context = f"Title: {title}\nPortal: {portal_name}\nSnippet: {snippet}\n"
    if scope:
        context += f"Scope: {scope}\n"
    if page_text:
        context += f"\nPage content (excerpt):\n{page_text[:4000]}\n"

    fallback = {
        "summary": f"Tender from {portal_name}: {title}. Review the official portal for full details.",
        "key_details": {"deadline": "Check portal", "emd": "Check portal", "value": "Check portal"},
        "must_care": ["Verify deadline on the official portal before preparing documents."],
        "risks": [],
        "source": "fallback",
    }

    if not api_key:
        return fallback

    try:
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=45.0)
        prompt = f"""You are an expert Indian government procurement analyst. Analyze this tender and return structured intelligence.

{context}

Return STRICT JSON with these keys:
- "summary": 2-3 sentence plain-English summary of what this tender is for.
- "key_details": object with "deadline" (date or "Not found"), "emd" (amount or "Not found"), "value" (estimated value or "Not found"), "eligibility" (1-line).
- "must_care": array of 3-5 specific things a bidder MUST take care of (documents, certifications, deadlines, EMD payment mode, etc.).
- "risks": array of 1-3 risks or red flags (tight deadline, vague scope, high EMD, etc.).
Only use information present or reasonably inferred. Mark unknowns as "Not found"."""

        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a tender intelligence analyst. Output pure JSON only."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=2048,
        )
        raw = (resp.choices[0].message.content or "{}").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        data = json.loads(raw)
        data["source"] = "ai"
        return data
    except Exception as e:
        logger.warning(f"Deep dive AI failed: {e}")
        return fallback
