"""Unit tests for URL normalization and deduplication engine."""

import pytest
from app.normalizer import normalize_url, detect_portal_name


def test_normalize_url_strips_tracking_params():
    url = "https://gem.gov.in/bids/GEM-2026-B-89102?utm_source=email&utm_medium=banner&utm_campaign=diwali&ref=search"
    expected = "https://gem.gov.in/bids/GEM-2026-B-89102"
    assert normalize_url(url) == expected


def test_normalize_url_strips_fbclid_and_gclid():
    url = "https://eprocure.gov.in/tender/123?gclid=XYZ123&fbclid=ABC789&source=google"
    expected = "https://eprocure.gov.in/tender/123"
    assert normalize_url(url) == expected


def test_normalize_url_strips_fragments():
    url = "https://etenders.gov.in/eprocure/app?page=details#section-technical-bids"
    expected = "https://etenders.gov.in/eprocure/app?page=details"
    assert normalize_url(url) == expected


def test_normalize_url_cleans_session_tokens():
    url = "https://eprocure.gov.in/eprocure/app;jsessionid=ABCD1234EFGH5678?service=direct&sp=101"
    expected = "https://eprocure.gov.in/eprocure/app?service=direct&sp=101"
    assert normalize_url(url) == expected


def test_normalize_url_sorts_query_parameters():
    url1 = "https://gem.gov.in/search?page=2&category=solar&sort=date"
    url2 = "https://gem.gov.in/search?sort=date&category=solar&page=2"
    assert normalize_url(url1) == normalize_url(url2)
    assert normalize_url(url1) == "https://gem.gov.in/search?category=solar&page=2&sort=date"


def test_normalize_url_deduplication_invariance():
    # Two links found by Google SerpApi for the exact same tender with different tracking tags
    link_a = "https://eprocure.gov.in/eprocure/app?tenderId=89102&utm_source=twitter"
    link_b = "https://eprocure.gov.in/eprocure/app?utm_medium=cpc&tenderId=89102&ref=portal#overview"
    assert normalize_url(link_a) == normalize_url(link_b)


def test_detect_portal_names():
    assert "GeM" in detect_portal_name("https://gem.gov.in/bids/123")
    assert "CPPP" in detect_portal_name("https://eprocure.gov.in/eprocure/app")
    assert "eTenders" in detect_portal_name("https://etenders.gov.in/eprocure/app")
    assert "IREPS" in detect_portal_name("https://www.ireps.gov.in/eps/view")
    assert "MahaTenders" in detect_portal_name("https://mahatenders.gov.in/nicgep/app")
    assert "KPPP" in detect_portal_name("https://kppp.karnataka.gov.in/portal")
    assert "Odisha" in detect_portal_name("https://tendersodisha.gov.in/nicgep/app")
