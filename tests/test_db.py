"""Unit tests for SQLite database layer, CRUD, and deduplication constraints."""

import os
import tempfile
import pytest
from app.db import (
    init_db,
    create_watchlist,
    get_watchlists,
    get_watchlist,
    update_watchlist,
    delete_watchlist,
    toggle_watchlist_status,
    seed_default_watchlists_if_empty,
    insert_tender,
    tender_exists,
    get_tenders,
    get_tender,
    get_tenders_stats,
    log_scan,
    get_scan_logs,
    save_tender,
    unsave_tender,
    is_tender_saved,
    update_saved_tender_notes,
    get_saved_tenders
)


@pytest.fixture
def test_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name
    init_db(db_path)
    yield db_path
    if os.path.exists(db_path):
        os.remove(db_path)


def test_watchlist_crud(test_db):
    # 1. Create
    wl_id = create_watchlist(test_db, "Solar Rooftop", "Renewables", "₹50L+", "All India")
    assert wl_id > 0

    # 2. Read
    wl = get_watchlist(test_db, wl_id)
    assert wl is not None
    assert wl["keyword"] == "Solar Rooftop"
    assert wl["is_active"] == 1

    # 3. Update
    ok = update_watchlist(test_db, wl_id, min_value="₹1 Crore+")
    assert ok is True
    wl_updated = get_watchlist(test_db, wl_id)
    assert wl_updated["min_value"] == "₹1 Crore+"

    # 4. Toggle Status
    toggle_watchlist_status(test_db, wl_id)
    wl_toggled = get_watchlist(test_db, wl_id)
    assert wl_toggled["is_active"] == 0

    # 5. List
    all_wl = get_watchlists(test_db)
    assert len(all_wl) == 1

    # 6. Delete
    deleted = delete_watchlist(test_db, wl_id)
    assert deleted is True
    assert get_watchlist(test_db, wl_id) is None


def test_seed_default_watchlists(test_db):
    seed_default_watchlists_if_empty(test_db)
    watchlists = get_watchlists(test_db)
    assert len(watchlists) == 5
    # Second run should not duplicate
    seed_default_watchlists_if_empty(test_db)
    watchlists_after = get_watchlists(test_db)
    assert len(watchlists_after) == 5


def test_tender_insert_and_deduplication(test_db):
    wl_id = create_watchlist(test_db, "Solar EPC", "Renewables")
    
    canonical_url = "https://gem.gov.in/bids/GEM-2026-B-100"
    tender_data = {
        "watchlist_id": wl_id,
        "title": "Supply and Installation of Solar Power Plant",
        "canonical_url": canonical_url,
        "original_url": "https://gem.gov.in/bids/GEM-2026-B-100?utm_source=serp",
        "portal_name": "GeM (Government e-Marketplace)",
        "snippet": "Solar tender on GeM portal",
        "published_date": "2026-10-01",
        "deadline_date": "2026-10-18",
        "emd_amount": "₹ 2,00,000",
        "tender_fee": "Nil",
        "eligibility": "Class 1 EPC Contractor",
        "scope_summary": "500 KW Solar Installation",
        "key_takeaways": "Submit before deadline",
        "urgency_status": "Active (>7d)"
    }

    # 1. First insert must succeed
    t_id = insert_tender(test_db, tender_data)
    assert t_id is not None
    assert tender_exists(test_db, canonical_url) is True

    # 2. Second insert with EXACT same canonical URL must be blocked by deduplication!
    t_id_dup = insert_tender(test_db, tender_data)
    assert t_id_dup is None  # Deduplication enforced!

    # 3. Query Tenders
    tenders = get_tenders(test_db, watchlist_id=wl_id)
    assert len(tenders) == 1
    assert tenders[0]["canonical_url"] == canonical_url

    # 4. Detail view
    single = get_tender(test_db, t_id)
    assert single["title"] == tender_data["title"]
    assert single["watchlist_keyword"] == "Solar EPC"


def test_tender_filtering_and_sorting(test_db):
    wl_id = create_watchlist(test_db, "Civil Works")
    
    # Insert 3 tenders with different deadlines and portals
    insert_tender(test_db, {
        "watchlist_id": wl_id,
        "title": "Alpha Bridge Project",
        "canonical_url": "https://eprocure.gov.in/app/1",
        "original_url": "https://eprocure.gov.in/app/1",
        "portal_name": "CPPP (Central Public Procurement Portal)",
        "deadline_date": "2026-10-12",
        "urgency_status": "Urgent (<3d)"
    })
    insert_tender(test_db, {
        "watchlist_id": wl_id,
        "title": "Beta Road Repair",
        "canonical_url": "https://gem.gov.in/bids/2",
        "original_url": "https://gem.gov.in/bids/2",
        "portal_name": "GeM (Government e-Marketplace)",
        "deadline_date": "2026-10-25",
        "urgency_status": "Active (>7d)"
    })

    # Sort asc (earliest deadline first)
    asc_tenders = get_tenders(test_db, sort_by="deadline", sort_order="asc")
    assert asc_tenders[0]["title"] == "Alpha Bridge Project"
    assert asc_tenders[1]["title"] == "Beta Road Repair"

    # Sort desc (latest deadline first)
    desc_tenders = get_tenders(test_db, sort_by="deadline", sort_order="desc")
    assert desc_tenders[0]["title"] == "Beta Road Repair"

    # Filter by portal
    cppp_only = get_tenders(test_db, portal="CPPP")
    assert len(cppp_only) == 1
    assert cppp_only[0]["title"] == "Alpha Bridge Project"


def test_scan_logging(test_db):
    log_id = log_scan(test_db, None, "Success", 10, 3, "Test scan executed successfully")
    assert log_id > 0
    logs = get_scan_logs(test_db)
    assert len(logs) == 1
    assert logs[0]["items_found"] == 10
    assert logs[0]["items_new"] == 3


def test_saved_tenders_crud_and_persistence(test_db):
    t_id = insert_tender(test_db, {
        "title": "Solar Installation at AIIMS",
        "canonical_url": "https://gem.gov.in/bids/TEST-1",
        "original_url": "https://gem.gov.in/bids/TEST-1?sp=1",
        "portal_name": "GeM"
    })
    assert t_id is not None

    # Initially not saved
    assert is_tender_saved(test_db, t_id) is False
    t_before = get_tender(test_db, t_id)
    assert t_before["is_saved"] is False

    # 1. Save tender with notes
    res = save_tender(test_db, t_id, notes="Initial contractor review")
    assert res is not None
    assert res["tender_id"] == t_id
    assert res["notes"] == "Initial contractor review"
    assert is_tender_saved(test_db, t_id) is True

    # Check detail view reflection
    t_saved = get_tender(test_db, t_id)
    assert t_saved["is_saved"] is True
    assert t_saved["saved_notes"] == "Initial contractor review"

    # 2. Update notes
    updated = update_saved_tender_notes(test_db, t_id, "Updated: shortlisted for bid")
    assert updated is True
    assert get_tender(test_db, t_id)["saved_notes"] == "Updated: shortlisted for bid"

    # 3. Check stats
    stats = get_tenders_stats(test_db)
    assert stats["saved_count"] == 1

    # 4. Persistence verification: verify saved state survives new connection
    assert is_tender_saved(test_db, t_id) is True

    # 5. Unsave tender
    unsaved = unsave_tender(test_db, t_id)
    assert unsaved is True
    assert is_tender_saved(test_db, t_id) is False
    assert get_tender(test_db, t_id)["is_saved"] is False


def test_saved_tenders_ordering(test_db):
    import time
    t1 = insert_tender(test_db, {"title": "Tender 1", "canonical_url": "https://gem.gov.in/1", "original_url": "https://gem.gov.in/1", "portal_name": "GeM"})
    t2 = insert_tender(test_db, {"title": "Tender 2", "canonical_url": "https://gem.gov.in/2", "original_url": "https://gem.gov.in/2", "portal_name": "GeM"})
    t3 = insert_tender(test_db, {"title": "Tender 3", "canonical_url": "https://gem.gov.in/3", "original_url": "https://gem.gov.in/3", "portal_name": "GeM"})

    save_tender(test_db, t1, notes="Note 1")
    time.sleep(0.01)
    save_tender(test_db, t2, notes="Note 2")
    time.sleep(0.01)
    save_tender(test_db, t3, notes="Note 3")

    saved_list = get_saved_tenders(test_db)
    assert len(saved_list) == 3
    # Newest-first ordering: t3, then t2, then t1
    assert saved_list[0]["id"] == t3
    assert saved_list[1]["id"] == t2
    assert saved_list[2]["id"] == t1

