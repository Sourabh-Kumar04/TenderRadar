"""Tests for Bid/No-Bid Advisor engine, pre-filter, flags, determinism, and caching."""

from datetime import datetime, date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import BidVerdict, VerdictStatus
from app.bidder_profile import (
    BidderProfile,
    get_default_profile,
    compute_profile_hash
)
from app.bid_advisor import (
    BidAdvisor,
    run_prefilter,
    evaluate_mandatory_flags,
    evaluate_mock,
    get_or_compute_verdict,
    parse_indian_currency,
    format_inr
)
from app.db import (
    init_db,
    insert_tender,
    get_tender,
    get_tender_verdict,
    save_bidder_profile
)
from app.summarizer import TenderSummarizer


@pytest.fixture
def sample_profile() -> BidderProfile:
    return BidderProfile(
        company_name="Apex Solar & EPC Pvt Ltd",
        categories=["Solar EPC", "Renewable Energy", "Electrical Works"],
        min_contract_value=2000000.0,     # ₹20 Lakhs
        max_contract_value=50000000.0,    # ₹5 Crores
        annual_turnover=30000000.0,       # ₹3 Crores
        max_emd_capacity=1000000.0,       # ₹10 Lakhs
        msme_registered=True,
        startup_registered=False,
        certifications=["ISO 9001:2015", "Class A Electrical"],
        preferred_states=["Maharashtra", "Gujarat", "Delhi"]
    )


@pytest.fixture
def mock_summarizer() -> TenderSummarizer:
    return TenderSummarizer(api_key="", mock_mode=True)


@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "test_advisor.db"
    init_db(str(db_file))
    return str(db_file)


# ==========================================
# 1. Currency & Formatter Tests
# ==========================================

def test_currency_parsing():
    assert parse_indian_currency("₹ 50 Lakhs") == 5000000.0
    assert parse_indian_currency("Rs. 1.5 Crore") == 15000000.0
    assert parse_indian_currency("₹ 25 Cr") == 250000000.0
    assert parse_indian_currency("INR 5,00,000") == 500000.0
    assert parse_indian_currency("Rs. 25000") == 25000.0
    assert parse_indian_currency("50k") == 50000.0
    assert parse_indian_currency("Not specified") is None


def test_inr_formatting():
    assert format_inr(50000000.0) == "₹5 Cr"
    assert format_inr(2500000.0) == "₹25 Lakh"
    assert format_inr(250000.0) == "₹2.50 Lakh"
    assert format_inr(50000.0) == "₹50,000"


# ==========================================
# 2. Pre-Filter Logic Tests
# ==========================================

def test_prefilter_category_matching(sample_profile):
    # Match on "Solar"
    tender_match = {
        "title": "Design and Supply of 500kW Rooftop Solar PV System",
        "snippet": "Tender for installation of grid connected solar rooftop plant.",
        "scope_summary": "Complete solar execution.",
        "portal_name": "CPPP"
    }
    res = run_prefilter(tender_match, sample_profile)
    assert res["category_match"] is True

    # Mismatch on catering/clothing
    tender_mismatch = {
        "title": "Supply of Uniform Clothing and Fabric Material",
        "snippet": "Procurement of stitched cotton uniforms for municipal staff.",
        "scope_summary": "Textile stitching and delivery.",
        "portal_name": "GeM"
    }
    res2 = run_prefilter(tender_mismatch, sample_profile)
    assert res2["category_match"] is False
    assert res2["passed"] is False


def test_prefilter_value_range(sample_profile):
    # In range: ₹1 Crore (bracket is ₹20L to ₹5Cr)
    t_in_range = {
        "title": "Solar Installation at Railway Junction",
        "snippet": "Estimated Tender Value: Rs. 1.2 Crore. Complete turnkey execution.",
        "scope_summary": "Solar works",
        "portal_name": "IREPS"
    }
    res1 = run_prefilter(t_in_range, sample_profile)
    assert res1["value_match"] is True
    assert res1["est_val"] == 12000000.0

    # Below min: ₹5 Lakhs (min is ₹20L)
    t_below = {
        "title": "Solar Light Maintenance",
        "snippet": "Estimated Value: Rs. 5 Lakhs only for street lights repair.",
        "portal_name": "GeM"
    }
    res2 = run_prefilter(t_below, sample_profile)
    assert res2["value_match"] is False
    assert res2["passed"] is False

    # Above max: ₹20 Crores (max is ₹5Cr)
    t_above = {
        "title": "Mega Solar Power Plant 50MW",
        "snippet": "Estimated Cost: Rs. 20 Crore under SECI national mission.",
        "portal_name": "CPPP"
    }
    res3 = run_prefilter(t_above, sample_profile)
    assert res3["value_match"] is False
    assert res3["passed"] is False

    # Unknown value passes pre-filter
    t_unknown = {
        "title": "Solar Rooftop Panel Procurement",
        "snippet": "Tender published for government hospital rooftop solar.",
        "portal_name": "CPPP"
    }
    res4 = run_prefilter(t_unknown, sample_profile)
    assert res4["value_match"] is True
    assert res4["est_val"] is None


def test_prefilter_emd_and_msme_exemption(sample_profile):
    # EMD within capacity: ₹5 Lakhs (capacity ₹10 Lakhs)
    t_emd_ok = {
        "title": "Solar EPC Works",
        "snippet": "Scope includes panels and cabling.",
        "emd_amount": "₹ 5,00,000",
        "portal_name": "CPPP"
    }
    res1 = run_prefilter(t_emd_ok, sample_profile)
    assert res1["emd_match"] is True

    # EMD exceeds capacity (non-MSME contractor): ₹25 Lakhs
    non_msme_profile = BidderProfile(
        company_name="Large Heavy Infra Ltd",
        categories=["Solar EPC"],
        min_contract_value=1000000.0,
        max_contract_value=50000000.0,
        annual_turnover=50000000.0,
        max_emd_capacity=500000.0,  # ₹5 Lakhs limit
        msme_registered=False
    )
    t_emd_huge = {
        "title": "Solar EPC Substation",
        "snippet": "EMD requirement is ₹ 25,00,000 via Bank Guarantee.",
        "emd_amount": "₹ 25,00,000",
        "portal_name": "CPPP"
    }
    res2 = run_prefilter(t_emd_huge, non_msme_profile)
    assert res2["emd_match"] is False
    assert res2["passed"] is False

    # EMD exceeds numeric limit but MSME is exempted on GeM or tender explicitly notes MSME
    t_msme_exempt = {
        "title": "Solar EPC Works",
        "snippet": "EMD is ₹ 20,00,000. Exempted for MSME and Startups.",
        "emd_amount": "Exempted for MSME",
        "portal_name": "GeM"
    }
    res3 = run_prefilter(t_msme_exempt, sample_profile)
    assert res3["emd_match"] is True
    assert res3["is_msme_exempt"] is True


# ==========================================
# 3. Mandatory Flags Tests
# ==========================================

def test_mandatory_flags_coverage(sample_profile):
    ref_date = date(2026, 10, 1)

    # 1. Tight deadline (<7 days, e.g. 5 days)
    t_tight = {
        "title": "Solar Inverter Supply",
        "snippet": "Supply of 50kW inverters.",
        "deadline_date": "2026-10-06",
        "portal_name": "CPPP"
    }
    pref1 = run_prefilter(t_tight, sample_profile)
    flags1 = evaluate_mandatory_flags(t_tight, sample_profile, pref1, ref_date=ref_date)
    assert any(f["severity"] == "warning" and "<7 days" in f["text"] for f in flags1)

    # 2. Critical deadline (<3 days, e.g. 2 days)
    t_crit = {
        "title": "Solar Inverter Supply",
        "snippet": "Immediate delivery.",
        "deadline_date": "2026-10-03",
        "portal_name": "CPPP"
    }
    pref2 = run_prefilter(t_crit, sample_profile)
    flags2 = evaluate_mandatory_flags(t_crit, sample_profile, pref2, ref_date=ref_date)
    assert any(f["severity"] == "critical" and "<3 days" in f["text"] for f in flags2)

    # 3. Restrictive eligibility flag
    t_restrict = {
        "title": "Solar EPC Super Project",
        "snippet": "Notice requires Class 1 only contractor with OEM authorization.",
        "eligibility": "Class 1 contractor with joint venture not allowed.",
        "portal_name": "CPPP"
    }
    pref3 = run_prefilter(t_restrict, sample_profile)
    flags3 = evaluate_mandatory_flags(t_restrict, sample_profile, pref3, ref_date=ref_date)
    assert any(f["severity"] == "warning" and "Restrictive" in f["text"] for f in flags3)

    # 4. Missing critical info flags
    t_missing = {
        "title": "Solar Panel Installation",
        "snippet": "Installation work notice.",
        "deadline_date": None,
        "emd_amount": "Not Specified",
        "portal_name": "CPPP"
    }
    pref4 = run_prefilter(t_missing, sample_profile)
    flags4 = evaluate_mandatory_flags(t_missing, sample_profile, pref4, ref_date=ref_date)
    assert any(f["severity"] == "warning" and "deadline missing" in f["text"].lower() for f in flags4)
    assert any(f["severity"] == "info" and "contract value unstated" in f["text"].lower() for f in flags4)

    # 5. MSME exemption flag
    t_msme = {
        "title": "Solar Maintenance",
        "snippet": "Published on GeM portal.",
        "portal_name": "GeM"
    }
    pref5 = run_prefilter(t_msme, sample_profile)
    flags5 = evaluate_mandatory_flags(t_msme, sample_profile, pref5, ref_date=ref_date)
    assert any(f["severity"] == "info" and "MSME" in f["text"] for f in flags5)


# ==========================================
# 4. Strict Verdict JSON Schema Validation
# ==========================================

def test_verdict_schema_validation(sample_profile):
    tender = {
        "title": "Rooftop Solar EPC at Municipal Corporation",
        "snippet": "Estimated Value: ₹ 75,00,000. EMD: ₹ 1,50,000. Deadline: 2026-10-25.",
        "scope_summary": "Rooftop solar installation 200kW.",
        "eligibility": "Registered electrical contractor with ISO certificate.",
        "emd_amount": "₹ 1,50,000",
        "deadline_date": "2026-10-25",
        "portal_name": "CPPP"
    }
    ref_date = date(2026, 10, 1)

    pref = run_prefilter(tender, sample_profile)
    verdict_dict = evaluate_mock(tender, sample_profile, pref, ref_date=ref_date)

    # Must validate cleanly into Pydantic model
    validated = BidVerdict(**verdict_dict)
    assert validated.verdict in (VerdictStatus.BID, VerdictStatus.NO_BID, VerdictStatus.REVIEW)
    assert 0 <= validated.match_score <= 100
    assert validated.key_details.est_value != ""
    assert isinstance(validated.reasons, list)
    assert len(validated.reasons) > 0
    assert isinstance(validated.flags, list)
    for flag in validated.flags:
        assert flag.severity in ("info", "warning", "critical")
        assert len(flag.text) > 0


# ==========================================
# 5. Mock-Mode Verdict Determinism
# ==========================================

def test_mock_verdict_determinism(sample_profile, mock_summarizer):
    advisor = BidAdvisor(summarizer=mock_summarizer)
    tender = {
        "title": "Grid Connected Solar Plant 1MW",
        "snippet": "Estimated Cost: Rs. 3.5 Crore. EMD: Rs. 7 Lakhs. Deadline: 2026-10-30.",
        "scope_summary": "Turnkey Solar PV Plant.",
        "eligibility": "Electrical EPC contractor with prior solar experience.",
        "emd_amount": "Rs. 7 Lakhs",
        "deadline_date": "2026-10-30",
        "portal_name": "CPPP"
    }
    ref_date = date(2026, 10, 1)

    res1 = advisor.evaluate(tender, sample_profile, ref_date=ref_date)
    res2 = advisor.evaluate(tender, sample_profile, ref_date=ref_date)

    assert res1["verdict"] == res2["verdict"]
    assert res1["match_score"] == res2["match_score"]
    assert res1["reasons"] == res2["reasons"]
    assert res1["flags"] == res2["flags"]
    assert res1["key_details"] == res2["key_details"]
    assert res1["verdict"] == "BID"


# ==========================================
# 6. Cache Invalidation on Profile Change
# ==========================================

def test_cache_invalidation_on_profile_change(temp_db, sample_profile):
    tender_data = {
        "title": "Turnkey Solar Power EPC 500kW",
        "canonical_url": "https://cppp.gov.in/tender/solar-500kw-001",
        "original_url": "https://cppp.gov.in/tender/solar-500kw-001",
        "portal_name": "CPPP",
        "snippet": "Estimated Cost: Rs. 1.5 Crore. EMD: Rs. 3 Lakhs.",
        "deadline_date": "2026-10-28",
        "emd_amount": "Rs. 3 Lakhs",
        "scope_summary": "Solar rooftop EPC system installation.",
        "eligibility": "Class A contractor"
    }
    tender_id = insert_tender(temp_db, tender_data)
    assert tender_id is not None
    tender = get_tender(temp_db, tender_id)

    # 1. First evaluation with Solar profile (should BID)
    hash_p1 = compute_profile_hash(sample_profile)
    v1 = get_or_compute_verdict(tender, sample_profile, temp_db)
    assert v1["verdict"] == "BID"

    # Verify verdict is stored in DB
    cached1 = get_tender_verdict(temp_db, tender_id, hash_p1)
    assert cached1 is not None
    assert cached1["verdict"] == "BID"

    # 2. Modify profile to a Civil / Road contractor (no solar in categories)
    road_profile = BidderProfile(
        company_name="Apex Road Construction Pvt Ltd",
        categories=["Highway Road Construction", "Bridge Engineering"],
        min_contract_value=5000000.0,
        max_contract_value=50000000.0,
        annual_turnover=30000000.0,
        max_emd_capacity=1000000.0
    )
    hash_p2 = compute_profile_hash(road_profile)
    assert hash_p1 != hash_p2

    # 3. Re-evaluate with changed profile
    v2 = get_or_compute_verdict(tender, road_profile, temp_db)
    assert v2["verdict"] == "NO_BID"  # Pre-filter fails due to category mismatch!

    # Verify new cache row created for new profile hash
    cached2 = get_tender_verdict(temp_db, tender_id, hash_p2)
    assert cached2 is not None
    assert cached2["verdict"] == "NO_BID"


# ==========================================
# 7. Recommended Filter & API Integration Tests
# ==========================================

def test_api_tender_verdict_and_recommended_filter(temp_db, sample_profile, monkeypatch):
    from app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "DATABASE_PATH", temp_db)
    client = TestClient(app)

    # Save active profile
    save_bidder_profile(temp_db, sample_profile.model_dump())

    # Insert two tenders: one matching, one non-matching
    t1_id = insert_tender(temp_db, {
        "title": "Solar EPC Installation 250kW",
        "canonical_url": "https://cppp.gov.in/tender/test-solar-001",
        "original_url": "https://cppp.gov.in/tender/test-solar-001",
        "portal_name": "CPPP",
        "snippet": "Estimated Value: Rs. 80 Lakhs. Solar works.",
        "deadline_date": "2026-10-30",
        "emd_amount": "Rs. 1.5 Lakhs"
    })
    t2_id = insert_tender(temp_db, {
        "title": "Hospital Kitchen Catering Services",
        "canonical_url": "https://gem.gov.in/tender/catering-002",
        "original_url": "https://gem.gov.in/tender/catering-002",
        "portal_name": "GeM",
        "snippet": "Supply of diet food and patient catering.",
        "deadline_date": "2026-10-30",
        "emd_amount": "Rs. 2 Lakhs"
    })

    # Test GET /api/tenders/{id}/verdict
    resp1 = client.get(f"/api/tenders/{t1_id}/verdict")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["verdict"] in ("BID", "REVIEW")
    assert data1["match_score"] >= 60

    resp2 = client.get(f"/api/tenders/{t2_id}/verdict")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["verdict"] == "NO_BID"

    # Test GET /api/tenders?recommended=true
    rec_resp = client.get("/api/tenders?recommended=true")
    assert rec_resp.status_code == 200
    rec_tenders = rec_resp.json()
    for t in rec_tenders:
        assert t["verdict"] == "BID"


def test_advisor_short_circuits_prefilter_failure(sample_profile, monkeypatch):
    from unittest.mock import MagicMock
    # Create summarizer with mock_mode=False and api_key set
    mock_summ = TenderSummarizer(api_key="real_looking_key", mock_mode=False)
    # If LLM was called, this mock would be invoked
    mock_openai_call = MagicMock()
    monkeypatch.setattr("openai.OpenAI", mock_openai_call)

    advisor = BidAdvisor(summarizer=mock_summ)

    # Tender completely mismatched (Catering vs Solar EPC)
    mismatched_tender = {
        "title": "Supply of Cooked Meals and Dietary Food to Hospital",
        "snippet": "Catering services for inpatient wards.",
        "portal_name": "GeM"
    }

    verdict = advisor.evaluate(mismatched_tender, sample_profile)
    assert verdict["verdict"] == "NO_BID"
    # OpenAI client should NOT have been instantiated or called because prefilter failed!
    assert not mock_openai_call.called

