"""Tests for Bidder Profile CRUD, validation, and API routes."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.bidder_profile import (
    BidderProfile,
    get_default_profile,
    compute_profile_hash
)
from app.db import (
    init_db,
    get_bidder_profile,
    save_bidder_profile
)


@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "test_profile.db"
    init_db(str(db_file))
    return str(db_file)


def test_default_profile():
    profile = get_default_profile()
    assert profile.company_name == "Apex Infrastructure & Renewables Pvt Ltd"
    assert "Solar EPC" in profile.categories
    assert profile.min_contract_value == 2500000.0
    assert profile.max_contract_value == 50000000.0
    assert profile.msme_registered is True
    assert profile.startup_registered is False


def test_profile_validation_range_and_non_negative():
    # Valid profile
    p = BidderProfile(
        company_name="Valid Infra Ltd",
        categories=["Solar EPC"],
        min_contract_value=1000000.0,
        max_contract_value=5000000.0,
        annual_turnover=10000000.0,
        max_emd_capacity=500000.0
    )
    assert p.company_name == "Valid Infra Ltd"

    # Reject min > max
    with pytest.raises(ValidationError) as exc:
        BidderProfile(
            company_name="Invalid Range",
            min_contract_value=10000000.0,
            max_contract_value=5000000.0
        )
    assert "min_contract_value cannot be greater than max_contract_value" in str(exc.value)

    # Reject negative min_contract_value
    with pytest.raises(ValidationError):
        BidderProfile(
            company_name="Negative Min",
            min_contract_value=-1000.0,
            max_contract_value=5000000.0
        )

    # Reject negative annual_turnover
    with pytest.raises(ValidationError):
        BidderProfile(
            company_name="Negative Turnover",
            min_contract_value=0.0,
            max_contract_value=5000000.0,
            annual_turnover=-500.0
        )

    # Reject empty company name
    with pytest.raises(ValidationError):
        BidderProfile(company_name="   ")


def test_profile_comma_separated_strings():
    p = BidderProfile(
        company_name="String Parser Co",
        categories="Solar EPC, Civil Works, CCTV",
        certifications="ISO 9001, Class 1 License",
        preferred_states="Maharashtra, Gujarat"
    )
    assert p.categories == ["Solar EPC", "Civil Works", "CCTV"]
    assert p.certifications == ["ISO 9001", "Class 1 License"]
    assert p.preferred_states == ["Maharashtra", "Gujarat"]


def test_profile_hash_determinism():
    p1 = get_default_profile()
    p2 = get_default_profile()
    h1 = compute_profile_hash(p1)
    h2 = compute_profile_hash(p2)
    assert h1 == h2
    assert len(h1) == 16

    # Changing a single parameter alters hash
    p3 = BidderProfile(
        company_name=p1.company_name,
        categories=p1.categories,
        min_contract_value=p1.min_contract_value,
        max_contract_value=p1.max_contract_value + 1000.0,
        annual_turnover=p1.annual_turnover,
        max_emd_capacity=p1.max_emd_capacity,
        msme_registered=p1.msme_registered,
        startup_registered=p1.startup_registered,
        certifications=p1.certifications,
        preferred_states=p1.preferred_states
    )
    assert compute_profile_hash(p3) != h1


def test_profile_db_crud(temp_db):
    assert get_bidder_profile(temp_db) is None

    p = get_default_profile()
    saved = save_bidder_profile(temp_db, p.model_dump())
    assert saved["company_name"] == p.company_name
    assert saved["min_contract_value"] == p.min_contract_value
    assert saved["msme_registered"] is True

    # Update profile
    p_updated = BidderProfile(
        company_name="Updated Solar Power Corp",
        categories=["Renewable Energy", "Battery Storage"],
        min_contract_value=5000000.0,
        max_contract_value=150000000.0,
        annual_turnover=80000000.0,
        max_emd_capacity=3000000.0,
        msme_registered=False,
        startup_registered=True,
        certifications=["ISO 14001"],
        preferred_states=["Rajasthan", "All India"]
    )
    saved2 = save_bidder_profile(temp_db, p_updated.model_dump())
    assert saved2["company_name"] == "Updated Solar Power Corp"
    assert saved2["msme_registered"] is False
    assert saved2["startup_registered"] is True
    assert saved2["categories"] == ["Renewable Energy", "Battery Storage"]

    # Verify retrieval
    retrieved = get_bidder_profile(temp_db)
    assert retrieved["company_name"] == "Updated Solar Power Corp"
    assert retrieved["max_contract_value"] == 150000000.0


def test_profile_api_endpoints(temp_db, monkeypatch):
    from app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "DATABASE_PATH", temp_db)
    client = TestClient(app)

    # 1. GET /api/profile
    resp = client.get("/api/profile")
    assert resp.status_code == 200
    data = resp.json()
    assert "company_name" in data
    assert "categories" in data
    assert "min_contract_value" in data
    assert "max_contract_value" in data

    # 2. PUT /api/profile (valid update)
    update_payload = {
        "company_name": "Bharat Infra Dynamics Ltd",
        "categories": ["Highway Construction", "Bridges", "Flyovers"],
        "min_contract_value": 10000000.0,
        "max_contract_value": 200000000.0,
        "annual_turnover": 120000000.0,
        "max_emd_capacity": 5000000.0,
        "msme_registered": True,
        "startup_registered": False,
        "certifications": ["CPWD Class Special", "ISO 9001"],
        "preferred_states": ["Delhi", "Haryana", "Uttar Pradesh"]
    }
    put_resp = client.put("/api/profile", json=update_payload)
    assert put_resp.status_code == 200
    put_data = put_resp.json()
    assert put_data["company_name"] == "Bharat Infra Dynamics Ltd"
    assert put_data["max_contract_value"] == 200000000.0

    # 3. PUT /api/profile (invalid range min > max)
    invalid_payload = dict(update_payload)
    invalid_payload["min_contract_value"] = 500000000.0  # greater than max
    inv_resp = client.put("/api/profile", json=invalid_payload)
    assert inv_resp.status_code == 422  # Pydantic validation error

    # 4. PUT /api/profile (negative value)
    neg_payload = dict(update_payload)
    neg_payload["annual_turnover"] = -100.0
    neg_resp = client.put("/api/profile", json=neg_payload)
    assert neg_resp.status_code == 422


def test_profile_form_submission(temp_db, monkeypatch):
    from app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "DATABASE_PATH", temp_db)
    client = TestClient(app)

    # GET /profile page
    page_resp = client.get("/profile")
    assert page_resp.status_code == 200
    assert "Bidder Profile" in page_resp.text

    # POST /profile form submission (valid)
    form_data = {
        "company_name": "Surya Urja Solutions Pvt Ltd",
        "categories": "Solar EPC, Inverters, Battery ESS",
        "min_contract_value": "3000000",
        "max_contract_value": "60000000",
        "annual_turnover": "40000000",
        "max_emd_capacity": "1500000",
        "msme_registered": "true",
        "certifications": "ISO 9001, MNRE Empanelled",
        "preferred_states": "Gujarat, Rajasthan"
    }
    post_resp = client.post("/profile", data=form_data, follow_redirects=False)
    assert post_resp.status_code == 303
    assert "/profile?message=" in post_resp.headers["location"]

    # POST /profile form submission (invalid min > max)
    invalid_form = dict(form_data)
    invalid_form["min_contract_value"] = "90000000"
    invalid_form["max_contract_value"] = "10000000"
    post_inv = client.post("/profile", data=invalid_form, follow_redirects=False)
    assert post_inv.status_code == 303
    assert "/profile?error=" in post_inv.headers["location"]
