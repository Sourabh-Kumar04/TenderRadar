"""Unit tests for the LLM summarizer and regex/heuristic fallback."""

from datetime import date, timedelta
import pytest
from app.models import compute_urgency, UrgencyStatus
from app.summarizer import (
    extract_regex_deadline,
    extract_regex_emd,
    extract_regex_fee,
    rule_based_mock_summary,
    TenderSummarizer
)


def test_extract_regex_deadline_iso():
    text = "Bid submission ends on 2026-10-24 15:00:00 IST for railway supply."
    assert extract_regex_deadline(text) == "2026-10-24"


def test_extract_regex_deadline_dmy():
    text = "Last date of bid submission: 25/10/2026 at 17:00 hrs."
    assert extract_regex_deadline(text) == "2026-10-25"


def test_extract_regex_deadline_named_month():
    text = "Opening date is 10 Oct 2026, closing on 18 October 2026."
    # Finds date
    assert extract_regex_deadline(text) in ("2026-10-10", "2026-10-18")


def test_extract_regex_emd():
    t1 = "NHAI invites RFP. EMD Amount: ₹ 4,50,00,000 via Bank Guarantee."
    assert "4,50,00,000" in extract_regex_emd(t1)

    t2 = "Turnkey solar rooftop. EMD: ₹ 2,50,000 (MSME Exempted)."
    assert "2,50,000" in extract_regex_emd(t2)

    t3 = "Supply of ventilators. NSIC/MSME exemption applicable for earnest deposit."
    assert "Exempted" in extract_regex_emd(t3)


def test_extract_regex_fee():
    t1 = "Online portal tender. Tender Fee: ₹ 5,000 to be paid via NEFT."
    assert "5,000" in extract_regex_fee(t1)

    t2 = "Document Fee: Nil for online downloads."
    assert "Nil" in extract_regex_fee(t2)


def test_compute_urgency():
    today = date.today()

    # 2 days left -> Urgent (<3d)
    d_urgent = (today + timedelta(days=2)).strftime("%Y-%m-%d")
    assert compute_urgency(d_urgent) == UrgencyStatus.URGENT

    # 5 days left -> Closing Soon (<7d)
    d_soon = (today + timedelta(days=5)).strftime("%Y-%m-%d")
    assert compute_urgency(d_soon) == UrgencyStatus.CLOSING_SOON

    # 15 days left -> Active (>7d)
    d_active = (today + timedelta(days=15)).strftime("%Y-%m-%d")
    assert compute_urgency(d_active) == UrgencyStatus.ACTIVE

    # Past date -> Expired
    d_expired = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    assert compute_urgency(d_expired) == UrgencyStatus.EXPIRED

    # None / Empty -> Flexible
    assert compute_urgency(None) == UrgencyStatus.FLEXIBLE
    assert compute_urgency("") == UrgencyStatus.FLEXIBLE


def test_summarizer_mock_mode_no_keys_required():
    # Summarizer initialized with mock_mode=True and NO keys
    summarizer = TenderSummarizer(api_key="", mock_mode=True)
    summary = summarizer.summarize(
        title="Supply of 1000 Solar Street Lights under Gram Panchayat Scheme",
        snippet="Tender No: GP-SOLAR-2026. EMD: ₹ 1,50,000. Last date: 2026-10-28 17:00 IST. Registered MNRE vendors with 3 years experience.",
        portal_name="eTenders Portal"
    )
    assert summary.scope_summary is not None
    assert "1,50,000" in summary.emd_amount
    assert summary.deadline_date == "2026-10-28"
    assert summary.urgency_status is not None


def test_verify_deepseek_model_fallback(monkeypatch):
    from app.summarizer import verify_deepseek_model
    
    # 1. Exact match in catalog
    monkeypatch.setattr(
        "app.summarizer.query_fireworks_models",
        lambda *args, **kwargs: ["accounts/fireworks/models/deepseek-v4p1-flash", "accounts/fireworks/models/llama-3"]
    )
    m1 = verify_deepseek_model("dummy_key", "deepseek-v4p1-flash")
    assert m1 == "accounts/fireworks/models/deepseek-v4p1-flash"

    # 2. Closest flash-tier DeepSeek model if exact is absent
    monkeypatch.setattr(
        "app.summarizer.query_fireworks_models",
        lambda *args, **kwargs: ["accounts/fireworks/models/deepseek-v3-flash", "accounts/fireworks/models/qwen"]
    )
    m2 = verify_deepseek_model("dummy_key", "deepseek-v4p1-flash")
    assert m2 == "accounts/fireworks/models/deepseek-v3-flash"

    # 3. Default path when catalog is unreachable
    monkeypatch.setattr(
        "app.summarizer.query_fireworks_models",
        lambda *args, **kwargs: []
    )
    m3 = verify_deepseek_model("dummy_key", "deepseek-v4p1-flash")
    assert m3 == "accounts/fireworks/models/deepseek-v4p1-flash"


def test_summarizer_config_override():
    custom_model = "accounts/fireworks/models/custom-model"
    custom_url = "https://custom.endpoint/v1"
    summarizer = TenderSummarizer(
        api_key="test_key",
        base_url=custom_url,
        model=custom_model,
        mock_mode=True
    )
    assert summarizer.model == custom_model
    assert summarizer.base_url == custom_url


def test_summarizer_env_overrides(monkeypatch):
    monkeypatch.setenv("FIREWORKS_BASE_URL", "https://api.fireworks.ai/custom/v1")
    monkeypatch.setenv("FIREWORKS_API_KEY", "fw_test_key_12345")
    monkeypatch.setenv("LLM_MODEL", "accounts/fireworks/models/deepseek-v4p1-flash")
    monkeypatch.setenv("MOCK_LLM", "1")

    summarizer = TenderSummarizer()
    assert summarizer.base_url == "https://api.fireworks.ai/custom/v1"
    assert summarizer.api_key == "fw_test_key_12345"
    assert summarizer.model == "accounts/fireworks/models/deepseek-v4p1-flash"
    assert summarizer.mock_mode is True


def test_summarizer_fireworks_base_url_precedence(monkeypatch):
    monkeypatch.setenv("FIREWORKS_BASE_URL", "https://api.fireworks.ai/primary/v1")
    monkeypatch.setenv("LLM_BASE_URL", "https://api.fireworks.ai/secondary/v1")
    monkeypatch.setenv("MOCK_LLM", "1")

    summarizer = TenderSummarizer()
    assert summarizer.base_url == "https://api.fireworks.ai/primary/v1"


def test_summarizer_parsing_list_takeaways(monkeypatch):
    import json
    from unittest.mock import MagicMock

    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "scope_summary": "Supply of Solar Inverters",
        "eligibility": "Class 1 contractor",
        "emd_amount": "₹ 50,000",
        "tender_fee": "Nil",
        "deadline_date": "2026-11-15",
        "key_takeaways": [
            "Point 1: Ensure OEM authorization.",
            "Point 2: Submit EMD exemption if MSME."
        ]
    })
    mock_client.chat.completions.create.return_value.choices = [mock_choice]
    monkeypatch.setattr("app.summarizer.OpenAI", lambda **kwargs: mock_client)

    summarizer = TenderSummarizer(api_key="valid_key", mock_mode=False)
    res = summarizer.summarize(
        title="Solar Inverter Supply",
        snippet="Deadline: 2026-11-15. EMD ₹ 50,000",
        portal_name="GeM"
    )

    assert res.scope_summary == "Supply of Solar Inverters"
    assert "Point 1: Ensure OEM authorization." in res.key_takeaways
    assert "Point 2: Submit EMD exemption if MSME." in res.key_takeaways
    assert res.deadline_date == "2026-11-15"


