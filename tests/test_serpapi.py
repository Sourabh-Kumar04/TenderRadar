"""Unit tests for SerpApi client, query building, caching, and mock fixtures."""

import os
import tempfile
import pytest
from app.db import init_db
from app.serpapi_client import (
    build_serp_query,
    generate_mock_results,
    SerpApiClient
)


def test_build_serp_query():
    q1 = build_serp_query("Solar Rooftop")
    assert '"Solar Rooftop" tender' in q1
    assert "site:gem.gov.in" in q1
    assert "site:eprocure.gov.in" in q1

    q2 = build_serp_query("Highway Road", state_filter="Maharashtra")
    assert '"Maharashtra"' in q2
    assert "site:mahatenders.gov.in" in q2


def test_generate_mock_results_preset_category():
    results = generate_mock_results("solar")
    assert len(results) > 0
    assert any("solar" in r["title"].lower() for r in results)
    assert any("gem.gov.in" in r["link"] for r in results)


def test_generate_mock_results_dynamic_keyword():
    results = generate_mock_results("Smart Water Meters IoT")
    assert len(results) >= 2
    assert any("Smart Water Meters Iot" in r["title"] or "Smart Water Meters IoT" in r["title"] for r in results)


def test_serpapi_client_caching_and_mock():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        init_db(db_path)
        # Client initialized in mock mode with NO API key
        client = SerpApiClient(api_key="", mock_mode=True, db_path=db_path)
        
        # 1st call: Should generate and cache results
        results1 = client.search_tenders("solar rooftop")
        assert len(results1) > 0
        canonical_urls1 = [r["canonical_url"] for r in results1]

        # 2nd call: Should retrieve from SQLite search_cache
        results2 = client.search_tenders("solar rooftop")
        canonical_urls2 = [r["canonical_url"] for r in results2]
        
        assert canonical_urls1 == canonical_urls2
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
