"""Reserp Client for TenderRadar.

Secondary search provider implementing the Reserp v2 API (https://reserp.ai/docs).
Used as automatic fallback when SerpApi fails, or as primary when SEARCH_PROVIDER=reserp.

Endpoints supported:
- POST /v2/serp/search: Google search URL -> {ok, results: [{url, text}]}
- POST /v2/serp/structured: Google search URL -> raw blocks for diagnostics

Features:
- Full India geotargeting: gl=in, hl=en in Google search URLs.
- SQLite query caching with configurable TTL to conserve monthly request quota.
- High-fidelity mock engine matching SerpApi format when keys are absent or MOCK_SERPAPI=1.
- Strict mapping to the unified TenderRadar tender-result schema.
"""

import hashlib
import json
import logging
import urllib.parse
from typing import List, Dict, Any, Optional

import requests

from app.config import get_settings
from app.db import get_cached_search, set_cached_search
from app.normalizer import normalize_url, detect_portal_name
from app.serpapi_client import build_serp_query, generate_mock_results

logger = logging.getLogger(__name__)


def build_reserp_google_url(query: str, gl: str = "in", hl: str = "en") -> str:
    """Builds the full Google search URL with India geotargeting for Reserp v2 API."""
    params = {
        "q": query,
        "hl": hl,
        "gl": gl,
    }
    return f"https://www.google.com/search?{urllib.parse.urlencode(params)}"


def generate_mock_reserp_results(keyword: str, state_filter: Optional[str] = None) -> Dict[str, Any]:
    """Generates authentic Reserp v2 API response shape {ok, results: [{url, text}]} from fixtures."""
    fixtures = generate_mock_results(keyword, state_filter)
    results = []
    for item in fixtures:
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        combined_text = f"{title}\n{snippet}" if title else snippet
        results.append({
            "url": item.get("link", ""),
            "text": combined_text,
            "title": title,
            "snippet": snippet,
        })
    return {"ok": True, "results": results}


def generate_mock_reserp_structured(keyword: str, state_filter: Optional[str] = None) -> Dict[str, Any]:
    """Generates mock structured search blocks for /v2/serp/structured diagnostics."""
    fixtures = generate_mock_results(keyword, state_filter)
    blocks = []
    for item in fixtures:
        blocks.append({
            "type": "organic",
            "url": item.get("link", ""),
            "title": item.get("title", ""),
            "snippet": item.get("snippet", ""),
            "displayed_link": item.get("displayed_link", ""),
        })
    return {"ok": True, "blocks": blocks}


def parse_reserp_item_text(item: Dict[str, Any]) -> tuple[str, str]:
    """Extracts (title, snippet) from a Reserp result item."""
    # If title is explicitly provided in item dict
    explicit_title = item.get("title", "").strip()
    explicit_snippet = item.get("snippet", "").strip()
    if explicit_title:
        return explicit_title, explicit_snippet or item.get("text", "").strip()

    raw_text = item.get("text", "").strip()
    if not raw_text:
        return "Tender Notice", ""

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if len(lines) >= 2:
        title = lines[0]
        snippet = " ".join(lines[1:])
    elif len(lines) == 1:
        single = lines[0]
        # Split on sentence boundary if title is fused with snippet
        parts = single.split(". ", 1)
        if len(parts) == 2 and 15 <= len(parts[0]) <= 120:
            title = parts[0]
            snippet = single
        else:
            title = single[:100] + ("..." if len(single) > 100 else "")
            snippet = single
    else:
        title = "Tender Notice"
        snippet = raw_text

    return title, snippet


class ReserpClient:
    """Production Reserp v2 API client with caching, deduplication, and mock support."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        mock_mode: Optional[bool] = None,
        db_path: Optional[str] = None,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.RESERP_API_KEY
        self.base_url = (base_url if base_url is not None else settings.RESERP_BASE_URL).rstrip("/")
        # Mirror MOCK_SERPAPI pattern: MOCK_SERPAPI=1 or missing key triggers mock mode
        if mock_mode is not None:
            self.mock_mode = mock_mode
        else:
            self.mock_mode = settings.MOCK_SERPAPI or not bool(self.api_key)
        self.db_path = db_path if db_path is not None else settings.DATABASE_PATH
        self.cache_ttl_hours = settings.CACHE_TTL_HOURS

    def search_tenders(
        self,
        keyword: str,
        state_filter: Optional[str] = None,
        raise_on_error: bool = False,
    ) -> List[Dict[str, Any]]:
        """Executes a Reserp v2 search for tenders, checking cache first.

        POST /v2/serp/search with JSON {"url": "<google search url>"}.
        Maps response results into the unified tender-result schema:
        [
            {
                "title": ...,
                "canonical_url": ...,
                "original_url": ...,
                "portal_name": ...,
                "snippet": ...,
                "displayed_link": ...
            }
        ]
        """
        query = build_serp_query(keyword, state_filter)
        query_hash = hashlib.sha256(f"reserp:{query}".encode("utf-8")).hexdigest()

        # 1. Check SQLite Cache
        cached_results = get_cached_search(self.db_path, query_hash, max_age_hours=self.cache_ttl_hours)
        if cached_results is not None:
            logger.info(f"Reserp Cache HIT for query: '{keyword}' (Hash: {query_hash[:8]})")
            return cached_results

        # 2. Mock mode check
        if self.mock_mode or not self.api_key:
            logger.info(f"Using Mock Reserp Engine for keyword: '{keyword}'")
            raw_payload = generate_mock_reserp_results(keyword, state_filter)
            raw_items = raw_payload.get("results", [])
        else:
            # 3. Real Reserp Call
            google_url = build_reserp_google_url(query, gl="in", hl="en")
            endpoint = f"{self.base_url}/v2/serp/search"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            body = {"url": google_url}

            logger.info(f"Calling real Reserp v2 search at {endpoint} for: '{keyword}'")
            try:
                resp = requests.post(endpoint, json=body, headers=headers, timeout=20.0)
                if resp.status_code != 200:
                    raise RuntimeError(f"Reserp API HTTP {resp.status_code}: {resp.text}")
                data = resp.json()
                if not data.get("ok", True):
                    raise RuntimeError(f"Reserp API returned error payload: {data}")
                raw_items = data.get("results", [])
            except Exception as e:
                logger.error(f"Reserp request failed ({e})")
                if raise_on_error:
                    raise
                logger.warning("Falling back to simulated data for continuity.")
                raw_payload = generate_mock_reserp_results(keyword, state_filter)
                raw_items = raw_payload.get("results", [])

        # 4. Standardize results to match SerpApi tender-result shape
        cleaned_results: List[Dict[str, Any]] = []
        for item in raw_items:
            raw_url = item.get("url", "")
            if not raw_url:
                continue

            canonical_url = normalize_url(raw_url)
            portal_name = detect_portal_name(canonical_url)
            title, snippet = parse_reserp_item_text(item)

            cleaned_results.append({
                "title": title,
                "canonical_url": canonical_url,
                "original_url": raw_url,
                "portal_name": portal_name,
                "snippet": snippet,
                "displayed_link": item.get("displayed_link", raw_url),
            })

        # 5. Save to Cache
        set_cached_search(self.db_path, query_hash, query, cleaned_results)
        return cleaned_results

    def structured_search(
        self,
        google_url: Optional[str] = None,
        keyword: Optional[str] = None,
        state_filter: Optional[str] = None,
        raise_on_error: bool = False,
    ) -> Dict[str, Any]:
        """POST /v2/serp/structured returning raw blocks for diagnostics."""
        if not google_url:
            query = build_serp_query(keyword or "tender", state_filter)
            google_url = build_reserp_google_url(query, gl="in", hl="en")

        if self.mock_mode or not self.api_key:
            return generate_mock_reserp_structured(keyword or "tender", state_filter)

        endpoint = f"{self.base_url}/v2/serp/structured"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {"url": google_url}

        try:
            resp = requests.post(endpoint, json=body, headers=headers, timeout=20.0)
            if resp.status_code != 200:
                raise RuntimeError(f"Reserp structured API HTTP {resp.status_code}: {resp.text}")
            return resp.json()
        except Exception as e:
            logger.error(f"Reserp structured request failed ({e})")
            if raise_on_error:
                raise
            return generate_mock_reserp_structured(keyword or "tender", state_filter)
