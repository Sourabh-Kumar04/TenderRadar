"""Unit tests for ReserpClient, Google URL builder, structured diagnostics, and mock engine."""

import os
import tempfile
import pytest
from app.db import init_db
from app.reserp_client import (
    build_reserp_google_url,
    generate_mock_reserp_results,
    generate_mock_reserp_structured,
    parse_reserp_item_text,
    ReserpClient,
)


def test_build_reserp_google_url():
    url = build_reserp_google_url('"Solar Rooftop" tender', gl="in", hl="en")
    assert "https://www.google.com/search?" in url
    assert "gl=in" in url
    assert "hl=en" in url
    assert "Solar+Rooftop" in url or "Solar%20Rooftop" in url


def test_generate_mock_reserp_results():
    data = generate_mock_reserp_results("solar")
    assert data["ok"] is True
    assert len(data["results"]) > 0
    item = data["results"][0]
    assert "url" in item
    assert "text" in item
    assert "solar" in item["text"].lower()


def test_generate_mock_reserp_structured():
    diag = generate_mock_reserp_structured("solar")
    assert diag["ok"] is True
    assert "blocks" in diag
    assert len(diag["blocks"]) > 0
    assert diag["blocks"][0]["type"] == "organic"


def test_parse_reserp_item_text():
    # Multi-line
    item_multi = {"text": "5MW Solar Power Plant NIT\nEMD ₹ 5 Lakhs, Deadline 2026-10-18"}
    t, s = parse_reserp_item_text(item_multi)
    assert t == "5MW Solar Power Plant NIT"
    assert "EMD ₹ 5 Lakhs" in s

    # Single-line with sentence period
    item_single = {"text": "Supply of ICU Monitors for AIIMS. EMD Amount 2 Lakhs. Closing 2026-10-25."}
    t2, s2 = parse_reserp_item_text(item_single)
    assert "Supply of ICU Monitors" in t2
    assert "Closing 2026-10-25" in s2

    # Explicit title in item
    item_explicit = {"title": "Bridge Construction Pune", "snippet": "PWD tender details"}
    t3, s3 = parse_reserp_item_text(item_explicit)
    assert t3 == "Bridge Construction Pune"
    assert s3 == "PWD tender details"


def test_reserp_client_caching_and_mock():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        init_db(db_path)
        # ReserpClient in mock mode without API key
        client = ReserpClient(api_key="", mock_mode=True, db_path=db_path)

        # 1st call: generate and cache
        results1 = client.search_tenders("solar rooftop")
        assert len(results1) > 0
        assert all("canonical_url" in r for r in results1)
        assert all("title" in r for r in results1)
        assert all("portal_name" in r for r in results1)
        canonical_urls1 = [r["canonical_url"] for r in results1]

        # 2nd call: retrieved from cache
        results2 = client.search_tenders("solar rooftop")
        canonical_urls2 = [r["canonical_url"] for r in results2]

        assert canonical_urls1 == canonical_urls2

        # Test structured search endpoint
        diag = client.structured_search(keyword="solar rooftop")
        assert diag["ok"] is True
        assert len(diag["blocks"]) > 0
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_reserp_mock_mode_flag_mirror():
    # Verify mock_mode is True when api_key is empty or mock_mode=True
    client = ReserpClient(api_key="", mock_mode=None)
    assert client.mock_mode is True

    # Real call error handling when raise_on_error is True
    # pointing to dummy endpoint should raise RuntimeError or RequestException
    client_error = ReserpClient(api_key="dummy_key", base_url="http://127.0.0.1:1/invalid", mock_mode=False)
    with pytest.raises(Exception):
        client_error.search_tenders("test query", raise_on_error=True)
