"""Integration tests for FastAPI web routes, Jinja2 rendering, CSV export, and REST API."""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import init_db, create_watchlist, seed_default_watchlists_if_empty
from app.main import app
from app.scheduler import scan_manager


@pytest.fixture
def client_with_temp_db(monkeypatch):
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    settings = get_settings()
    monkeypatch.setattr(settings, "DATABASE_PATH", db_path)
    monkeypatch.setattr(scan_manager, "db_path", db_path)
    monkeypatch.setattr(scan_manager.serp_client, "db_path", db_path)
    monkeypatch.setattr(scan_manager.serp_client, "mock_mode", True)
    monkeypatch.setattr(scan_manager.summarizer, "mock_mode", True)
    monkeypatch.setattr(settings, "MOCK_SERPAPI", True)
    monkeypatch.setattr(settings, "MOCK_LLM", True)

    init_db(db_path)
    seed_default_watchlists_if_empty(db_path)
    scan_manager.run_full_scan()

    with TestClient(app) as client:
        yield client

    if os.path.exists(db_path):
        os.remove(db_path)


def test_dashboard_renders(client_with_temp_db):
    response = client_with_temp_db.get("/")
    assert response.status_code == 200
    assert "TenderRadar" in response.text
    assert "Indian Tender Discovery Hub" in response.text
    assert "Discovered" in response.text


def test_watchlists_page_renders(client_with_temp_db):
    response = client_with_temp_db.get("/watchlists")
    assert response.status_code == 200
    assert "Tender Watchlists" in response.text
    assert "Add New Watchlist Keyword" in response.text


def test_create_watchlist_valid(client_with_temp_db):
    response = client_with_temp_db.post(
        "/watchlists",
        data={
            "keyword": "Electric Vehicle EV Charging Stations",
            "category": "Clean Energy",
            "min_value": "₹1 Crore+",
            "state_filter": "Delhi NCR"
        },
        follow_redirects=False
    )
    assert response.status_code == 303
    assert "/watchlists?message=" in response.headers["location"]


def test_create_watchlist_validation_empty(client_with_temp_db):
    response = client_with_temp_db.post(
        "/watchlists",
        data={"keyword": "   "},
        follow_redirects=False
    )
    assert response.status_code == 303
    assert "error=" in response.headers["location"]


def test_create_watchlist_validation_too_long(client_with_temp_db):
    response = client_with_temp_db.post(
        "/watchlists",
        data={"keyword": "A" * 105},
        follow_redirects=False
    )
    assert response.status_code == 303
    assert "error=" in response.headers["location"]


def test_toggle_and_delete_watchlist(client_with_temp_db):
    api_res = client_with_temp_db.get("/api/watchlists")
    watchlists = api_res.json()
    assert len(watchlists) > 0
    wl_id = watchlists[0]["id"]

    # Toggle
    toggle_res = client_with_temp_db.post(f"/watchlists/{wl_id}/toggle", follow_redirects=False)
    assert toggle_res.status_code == 303

    # Scan single
    scan_res = client_with_temp_db.post(f"/watchlists/{wl_id}/scan", follow_redirects=False)
    assert scan_res.status_code == 303

    # Delete
    del_res = client_with_temp_db.post(f"/watchlists/{wl_id}/delete", follow_redirects=False)
    assert del_res.status_code == 303


def test_full_scan_view(client_with_temp_db):
    res = client_with_temp_db.post("/scan", follow_redirects=False)
    assert res.status_code == 303
    assert "/?message=" in res.headers["location"]


def test_scans_page_renders(client_with_temp_db):
    res = client_with_temp_db.get("/scans")
    assert res.status_code == 200
    assert "Scan Monitor & Audit Logs" in res.text


def test_tender_detail_view(client_with_temp_db):
    tenders_res = client_with_temp_db.get("/api/tenders")
    tenders = tenders_res.json()
    assert len(tenders) > 0
    t_id = tenders[0]["id"]

    res = client_with_temp_db.get(f"/tenders/{t_id}")
    assert res.status_code == 200
    assert tenders[0]["title"] in res.text
    assert "Scope of Work" in res.text

    # Non-existent tender
    res_404 = client_with_temp_db.get("/tenders/999999")
    assert res_404.status_code == 404


def test_export_csv(client_with_temp_db):
    res = client_with_temp_db.get("/export/csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=tenderradar_bids_export.csv" in res.headers["content-disposition"]
    csv_text = res.text
    assert "Tender ID,Title,Portal,Watchlist Keyword,Advisor Verdict,Match Score (%)" in csv_text
    lines = csv_text.strip().split("\n")
    assert len(lines) >= 2  # Header + at least one tender row


# ==========================================
# REST API Tests
# ==========================================

def test_api_watchlists_crud(client_with_temp_db):
    # Create
    create_payload = {
        "keyword": "High Speed Rail Track Maintenance",
        "category": "Railways",
        "min_value": "₹10 Cr+",
        "state_filter": "Western Zone"
    }
    post_res = client_with_temp_db.post("/api/watchlists", json=create_payload)
    assert post_res.status_code == 201
    created = post_res.json()
    wl_id = created["id"]
    assert created["keyword"] == "High Speed Rail Track Maintenance"

    # Get single
    get_res = client_with_temp_db.get(f"/api/watchlists/{wl_id}")
    assert get_res.status_code == 200
    assert get_res.json()["keyword"] == created["keyword"]

    # Update
    update_res = client_with_temp_db.put(f"/api/watchlists/{wl_id}", json={"category": "High Speed Rail"})
    assert update_res.status_code == 200
    assert update_res.json()["category"] == "High Speed Rail"

    # Delete
    del_res = client_with_temp_db.delete(f"/api/watchlists/{wl_id}")
    assert del_res.status_code == 200


def test_api_tenders_and_stats(client_with_temp_db):
    tenders_res = client_with_temp_db.get("/api/tenders?limit=10")
    assert tenders_res.status_code == 200
    tenders = tenders_res.json()
    assert isinstance(tenders, list)
    assert len(tenders) > 0

    stats_res = client_with_temp_db.get("/api/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_tenders"] > 0
    assert stats["active_watchlists"] > 0

    status_res = client_with_temp_db.get("/api/scan/status")
    assert status_res.status_code == 200


def test_api_profile_post_and_put(client_with_temp_db):
    prof_payload = {
        "company_name": "Bharat Solar Solutions Ltd",
        "categories": ["Solar EPC", "Renewable Energy"],
        "min_contract_value": 1000000.0,
        "max_contract_value": 20000000.0,
        "annual_turnover": 15000000.0,
        "max_emd_capacity": 500000.0,
        "msme_registered": True
    }
    # Test POST
    post_res = client_with_temp_db.post("/api/profile", json=prof_payload)
    assert post_res.status_code == 200
    assert post_res.json()["company_name"] == "Bharat Solar Solutions Ltd"

    # Test PUT
    prof_payload["company_name"] = "Bharat Solar & Infra Ltd"
    put_res = client_with_temp_db.put("/api/profile", json=prof_payload)
    assert put_res.status_code == 200
    assert put_res.json()["company_name"] == "Bharat Solar & Infra Ltd"


# ==========================================
# Saved Tenders & Portal Link Tests
# ==========================================

def test_saved_page_view(client_with_temp_db):
    # Empty state initially
    res = client_with_temp_db.get("/saved")
    assert res.status_code == 200
    assert "Saved Tenders" in res.text
    assert "No Saved Tenders Yet" in res.text

    # Get an existing tender to save
    tenders = client_with_temp_db.get("/api/tenders").json()
    assert len(tenders) > 0
    t_id = tenders[0]["id"]

    # Save via web form
    post_res = client_with_temp_db.post(
        f"/tenders/{t_id}/save",
        data={"notes": "Reviewed by board", "redirect_to": "/saved"},
        follow_redirects=False
    )
    assert post_res.status_code == 303

    # Now saved page should list it
    res_after = client_with_temp_db.get("/saved")
    assert res_after.status_code == 200
    assert tenders[0]["title"] in res_after.text
    assert "Reviewed by board" in res_after.text

    # Unsave via web form
    unsave_res = client_with_temp_db.post(
        f"/tenders/{t_id}/unsave",
        data={"redirect_to": "/saved"},
        follow_redirects=False
    )
    assert unsave_res.status_code == 303


def test_api_saved_tenders_crud_and_ordering(client_with_temp_db):
    tenders = client_with_temp_db.get("/api/tenders").json()
    assert len(tenders) >= 2
    t1_id = tenders[0]["id"]
    t2_id = tenders[1]["id"]

    # 1. Save t1
    save1 = client_with_temp_db.post(f"/api/tenders/{t1_id}/save", json={"notes": "First bookmark"})
    assert save1.status_code == 200
    assert save1.json()["saved"] is True
    assert save1.json()["notes"] == "First bookmark"

    # 2. Save t2
    save2 = client_with_temp_db.post(f"/api/tenders/{t2_id}/save", json={"notes": "Second bookmark"})
    assert save2.status_code == 200
    assert save2.json()["saved"] is True

    # 3. GET /api/saved ordering (newest-first)
    saved_list = client_with_temp_db.get("/api/saved").json()
    assert len(saved_list) >= 2
    assert saved_list[0]["id"] == t2_id
    assert saved_list[1]["id"] == t1_id
    assert saved_list[1]["saved_notes"] == "First bookmark"

    # 4. Update notes via PATCH
    notes_res = client_with_temp_db.patch(f"/api/tenders/{t1_id}/notes", json={"notes": "Updated bid notes"})
    assert notes_res.status_code == 200
    assert notes_res.json()["notes"] == "Updated bid notes"

    # 5. Delete bookmark
    del_res = client_with_temp_db.delete(f"/api/tenders/{t1_id}/save")
    assert del_res.status_code == 200
    assert del_res.json()["saved"] is False

    # Check that t1 is no longer in /api/saved
    saved_after = client_with_temp_db.get("/api/saved").json()
    saved_ids = [item["id"] for item in saved_after]
    assert t1_id not in saved_ids
    assert t2_id in saved_ids


def test_rendered_portal_button_url_and_theme(client_with_temp_db):
    tenders = client_with_temp_db.get("/api/tenders").json()
    assert len(tenders) > 0
    tender = tenders[0]
    t_id = tender["id"]

    # Check rendered dashboard HTML
    dash_res = client_with_temp_db.get("/")
    assert dash_res.status_code == 200
    assert "Open Official Portal" in dash_res.text
    # Check that href is an official URL and not empty
    assert 'href="http' in dash_res.text
    assert "btn-save" in dash_res.text

    # Check rendered tender detail page HTML
    detail_res = client_with_temp_db.get(f"/tenders/{t_id}")
    assert detail_res.status_code == 200
    assert "Open Official Portal" in detail_res.text or "Open Official Tender Portal" in detail_res.text
    assert 'target="_blank"' in detail_res.text


