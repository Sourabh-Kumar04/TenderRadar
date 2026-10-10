"""Tests for Vercel serverless adaptation: read-only DB handling and scheduler suppression."""

import os
import shutil
import tempfile
import sqlite3
import pytest
from app.db import (
    init_db,
    get_db_connection,
    get_watchlists,
    create_watchlist,
    get_tenders,
    get_tenders_stats,
    log_scan,
    get_scan_logs,
    save_bidder_profile,
    get_bidder_profile,
    save_tender,
    is_tender_saved,
    get_saved_tenders,
    unsave_tender,
    save_tender_verdict,
    get_tender_verdict
)
from app.scheduler import ScanManager


@pytest.fixture
def readonly_db(tmp_path):
    """Creates a temporary SQLite database pre-seeded with tables and makes it read-only."""
    db_file = tmp_path / "test_ro.db"
    init_db(str(db_file))
    
    # Insert a dummy watchlist and tender
    with get_db_connection(str(db_file)) as conn:
        conn.execute(
            "INSERT INTO watchlists (keyword, category, min_value, state_filter, is_active, created_at, updated_at) "
            "VALUES ('Solar', 'Energy', '1 Cr', 'All India', 1, '2026-01-01', '2026-01-01')"
        )
        conn.execute(
            "INSERT INTO tenders (title, canonical_url, original_url, portal_name, created_at, updated_at) "
            "VALUES ('Solar EPC Tender', 'https://example.com/solar', 'https://example.com/solar', 'GeM', '2026-01-01', '2026-01-01')"
        )
        conn.commit()
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")

    # Make file and parent dir read-only
    os.chmod(str(db_file), 0o444)
    yield str(db_file)
    os.chmod(str(db_file), 0o666)


def test_readonly_db_reads_succeed(readonly_db):
    """Verify that read operations succeed on a read-only database."""
    watchlists = get_watchlists(readonly_db)
    assert len(watchlists) >= 1
    assert watchlists[0]["keyword"] == "Solar"

    tenders = get_tenders(readonly_db)
    assert len(tenders) == 1
    assert tenders[0]["title"] == "Solar EPC Tender"

    stats = get_tenders_stats(readonly_db)
    assert stats["total_tenders"] == 1


def test_readonly_db_writes_fallback_gracefully(readonly_db):
    """Verify that writes like log_scan and save_tender fallback to in-memory storage without crashing."""
    # 1. log_scan fallback
    scan_id = log_scan(readonly_db, None, "Success", 5, 2, "Test scan in read-only")
    assert scan_id is not None
    logs = get_scan_logs(readonly_db, limit=10)
    assert any("Test scan in read-only" in l.get("message", "") for l in logs)

    # 2. save_bidder_profile fallback
    prof = save_bidder_profile(readonly_db, {
        "company_name": "Read-Only Solar Co",
        "categories": ["Renewable"],
        "min_contract_value": 100000.0,
        "max_contract_value": 5000000.0,
        "annual_turnover": 10000000.0,
        "max_emd_capacity": 500000.0,
        "msme_registered": True,
        "startup_registered": False,
        "certifications": ["ISO9001"],
        "preferred_states": ["Delhi"]
    })
    assert prof["company_name"] == "Read-Only Solar Co"
    fetched_prof = get_bidder_profile(readonly_db)
    assert fetched_prof["company_name"] == "Read-Only Solar Co"

    # 3. save_tender fallback
    saved = save_tender(readonly_db, 1, notes="Demo bookmark")
    assert saved is not None
    assert is_tender_saved(readonly_db, 1) is True

    # 4. save_tender_verdict fallback
    save_tender_verdict(readonly_db, 1, "test_hash", {
        "verdict": "BID",
        "match_score": 92,
        "key_details": {"type": "Solar"},
        "reasons": ["Great fit"],
        "flags": []
    })
    verdict = get_tender_verdict(readonly_db, 1, "test_hash")
    assert verdict is not None
    assert verdict["verdict"] == "BID"
    assert verdict["match_score"] == 92


def test_scheduler_disabled_on_vercel(monkeypatch):
    """Verify that APScheduler is not started when VERCEL environment is present."""
    monkeypatch.setenv("VERCEL", "1")
    mgr = ScanManager()
    mgr.start_scheduler()
    assert mgr.scheduler.running is False
