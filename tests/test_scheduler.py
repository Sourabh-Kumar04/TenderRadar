"""Unit tests for the scan manager and scheduler."""

import os
import tempfile
import pytest
from app.db import (
    init_db,
    create_watchlist,
    get_watchlists,
    get_tenders,
    get_scan_logs
)
from app.scheduler import ScanManager


@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name
    init_db(db_path)
    yield db_path
    if os.path.exists(db_path):
        os.remove(db_path)


def test_scan_manager_single_watchlist_and_deduplication(temp_db):
    wl_id = create_watchlist(temp_db, "Solar Rooftop", "Renewables")
    manager = ScanManager(db_path=temp_db)
    
    # 1. Run First Scan
    res1 = manager.scan_watchlist_by_id(wl_id)
    assert res1["items_found"] > 0
    assert res1["items_new"] > 0

    tenders_after_first = get_tenders(temp_db, watchlist_id=wl_id)
    count_first = len(tenders_after_first)
    assert count_first == res1["items_new"]

    # 2. Run Second Scan immediately for same keyword
    # All items should be deduplicated (items_new == 0)!
    res2 = manager.scan_watchlist_by_id(wl_id)
    assert res2["items_found"] == res1["items_found"]
    assert res2["items_new"] == 0

    tenders_after_second = get_tenders(temp_db, watchlist_id=wl_id)
    assert len(tenders_after_second) == count_first  # Deduplication verified!


def test_scan_manager_full_scan(temp_db):
    create_watchlist(temp_db, "Solar Rooftop", "Renewables")
    create_watchlist(temp_db, "Hospital ICU Equipment", "Healthcare")

    manager = ScanManager(db_path=temp_db)
    info = manager.run_full_scan()
    
    assert info["status"] == "Completed"
    assert info["items_found"] > 0
    assert info["items_new"] > 0

    logs = get_scan_logs(temp_db)
    assert len(logs) > 0
    assert any("Completed full scan" in l["message"] for l in logs)


def test_scan_manager_fallback_behavior(temp_db, monkeypatch):
    manager = ScanManager(db_path=temp_db)

    # Simulate primary failure on serp_client
    def failing_search(*args, **kwargs):
        raise ConnectionError("Simulated primary SerpApi network failure")

    monkeypatch.setattr(manager.serp_client, "search_tenders", failing_search)

    # Search should automatically fallback to reserp_client and succeed
    results = manager.search_tenders("Solar Rooftop")
    assert len(results) > 0
    assert any("solar" in r["title"].lower() for r in results)


def test_scan_manager_provider_selection_reserp(temp_db, monkeypatch):
    from app.config import get_settings
    monkeypatch.setenv("SEARCH_PROVIDER", "reserp")
    get_settings.cache_clear()

    manager = ScanManager(db_path=temp_db)
    results = manager.search_tenders("Hospital ICU")
    assert len(results) > 0
    get_settings.cache_clear()

