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



