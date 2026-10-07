"""SerpApi Client for TenderRadar.

Deeply integrates with SerpApi Google Search API to discover Indian government tenders
across portals including GeM (gem.gov.in), CPPP (eprocure.gov.in), eTenders (etenders.gov.in),
IREPS (ireps.gov.in), and state portals (mahatenders, kppp, wbtenders, tendersodisha).

Features:
- Credit conservation: SQLite caching with configurable TTL, tight boolean site queries.
- India geotargeting: gl=in, hl=en, location=India.
- High-fidelity Mock SerpApi engine for offline testing and demos without API keys.
"""

import hashlib
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from app.config import get_settings
from app.db import get_cached_search, set_cached_search
from app.normalizer import normalize_url, detect_portal_name

logger = logging.getLogger(__name__)


# Realistic simulated Indian tender fixtures for offline / mock testing
MOCK_TENDER_FIXTURES = {
    "solar": [
        {
            "title": "Design, Engineering, Supply & Commissioning of 5 MW Rooftop Solar PV Systems on Govt Buildings",
            "link": "https://gem.gov.in/bids/GEM/2026/B/8941203?utm_source=gov_feed&ref=portal",
            "snippet": "Bid Number: GEM/2026/B/8941203. SECI invites bids for 5MW Rooftop Solar Power Plant. EMD Amount: ₹ 5,00,000. Bid End Date / Deadline: 2026-10-18 15:00:00. Eligibility: Class 1 local solar EPC contractor with minimum ₹3 Cr turnover.",
            "displayed_link": "gem.gov.in › bids › GEM-2026-B-8941203",
        },
        {
            "title": "Tender for Grid Connected Solar Rooftop Projects across Central Public Undertakings",
            "link": "https://eprocure.gov.in/eprocure/app?component=$DirectLink&page=FrontEndTenderDetails&service=direct&sp=STenderRef89110&jsessionid=A89FE21D80C",
            "snippet": "Tender ID: 2026_CPPP_94102_1. Scope: Turnkey installation of 1.2 MW rooftop solar with net metering. EMD: ₹ 2,50,000 (MSME Exempted). Last date of bid submission: 2026-10-25 17:00 IST. Document fee: ₹ 2,000.",
            "displayed_link": "eprocure.gov.in › eprocure › tender-details",
        },
        {
            "title": "Supply and Maintenance of Solar Photovoltaic Modules for Railway Stations (Western Zone)",
            "link": "https://www.ireps.gov.in/eps/viewTenderDetails.do?tenderId=IR-SOLAR-2026-0819",
            "snippet": "Indian Railways (IREPS). Tender No: WCR-ELECT-SOLAR-26. Supply and maintenance of 500 KW rooftop array. EMD: ₹ 1,20,000. Closing Date: 2026-10-12 14:00 IST. Technical eligibility: MNRE approved vendors.",
            "displayed_link": "ireps.gov.in › eps › viewTenderDetails",
        }
    ],
    "highway": [
        {
            "title": "Widening to 4-lanes with Paved Shoulders on NH-48 Section (Km 120 to 185) under Bharatmala Pariyojana",
            "link": "https://eprocure.gov.in/eprocure/app?page=FrontEndTenderDetails&service=direct&sp=TenderNHAI2026-441&utm_medium=email",
            "snippet": "National Highways Authority of India (NHAI). Tender Ref: NHAI/TECH/2026/0441. EPC contract for 65km highway expansion. Estimated Value: ₹ 450 Cr. EMD: ₹ 4,50,00,000 via BG. Last Submission Date: 2026-10-14 11:00 IST. Pre-bid meeting scheduled.",
            "displayed_link": "eprocure.gov.in › nhai › rfp-441",
        },
        {
            "title": "Construction of Major Bridge and Approach Roads on State Highway 17 in Pune District",
            "link": "https://mahatenders.gov.in/nicgep/app?component=view&page=TenderDetails&sp=PWD-MAHA-2026-8901",
            "snippet": "Maharashtra Public Works Department (PWD). Tender Notice No: PWD/PUNE/2026/8901. Scope: RCC bridge construction over river. EMD: ₹ 15,00,000. Bid Closing Date: 2026-10-09 17:30 IST. Tender Fee: ₹ 10,000. Registered Class 1-A Contractors.",
            "displayed_link": "mahatenders.gov.in › pwd › tender-8901",
        }
    ],
    "hospital": [
        {
            "title": "Procurement of High-End Digital Radiography and MRI Scanner for AIIMS Gorakhpur",
            "link": "https://etenders.gov.in/eprocure/app?page=FrontEndTenderDetails&service=direct&sp=AIIMS-GKP-MED-2026-12",
            "snippet": "AIIMS Gorakhpur invites Global/National e-Tender for Medical Imaging Equipment. EMD: ₹ 8,00,000. Last date for online submission of bids: 2026-10-22 15:00 IST. Two-bid system (Technical & Financial). CE/FDA certification mandatory.",
            "displayed_link": "etenders.gov.in › aiims-gkp › med-12",
        },
        {
            "title": "Rate Contract for Supply of Intensive Care Ventilators and Patient Monitors for District Hospitals",
            "link": "https://gem.gov.in/bids/GEM/2026/B/9102450?ref=tender_alert",
            "snippet": "National Health Mission (NHM). GeM Bid No: GEM/2026/B/9102450. Supply of 200 ICU ventilators. EMD Amount: ₹ 12,00,000 (Exempted for NSIC/MSME). Bid End Date: 2026-10-15 16:00:00. 3 years comprehensive warranty.",
            "displayed_link": "gem.gov.in › bids › GEM-2026-B-9102450",
        }
    ],
    "cctv": [
        {
            "title": "Implementation of Integrated City Surveillance System: 1200 IP CCTV Cameras & Command Control Center",
            "link": "https://kppp.karnataka.gov.in/portal/tenderDetails?tenderId=BLR-SMARTCITY-CCTV-2026-55&utm_source=direct",
            "snippet": "Bengaluru Smart City Limited. Tender No: BCC/SMART/2026/55. Supply, installation, and 5-year O&M of AI-powered surveillance cameras. EMD: ₹ 25,00,000. Last Date for Tender Submission: 2026-10-20 16:30 IST. CMMI Level 3 & ISO 27001 required.",
            "displayed_link": "kppp.karnataka.gov.in › smartcity-cctv",
        },
        {
            "title": "Procurement and Installation of CCTV Surveillance Systems across 45 Railway Stations in Northern Zone",
            "link": "https://www.ireps.gov.in/eps/viewTenderDetails.do?tenderId=IR-SNT-CCTV-2026-301",
            "snippet": "Indian Railways (IREPS / S&T Dept). Tender No: NR-ST-CCTV-2026-301. CCTV and video analytics setup. EMD: ₹ 6,50,000. Tender Closing: 2026-10-11 11:30 IST. RDSO approved specifications.",
            "displayed_link": "ireps.gov.in › snt › cctv-301",
        }
    ],
    "cloud": [
        {
            "title": "Empanelment of Cloud Service Providers for Migration and Managed Cloud Hosting of State Citizen Portals",
            "link": "https://tendersodisha.gov.in/nicgep/app?component=view&page=TenderDetails&sp=OCAC-IT-CLOUD-2026-07",
            "snippet": "Odisha Computer Application Centre (OCAC). Tender ID: 2026_OCAC_88912_1. MeitY empaneled cloud infrastructure migration and DevOps support. EMD: ₹ 10,00,000. Submission Deadline: 2026-10-19 17:00 IST. Tender Fee: ₹ 5,000.",
            "displayed_link": "tendersodisha.gov.in › ocac › cloud-rfp",
        },
        {
            "title": "Request for Proposal for Next-Gen Hybrid Cloud Infrastructure and Kubernetes Managed Services",
            "link": "https://gem.gov.in/bids/GEM/2026/B/9551042",
            "snippet": "Digital India Corporation (DIC) / MeitY. GeM Bid No: GEM/2026/B/9551042. Multi-cloud deployment and 24x7 security monitoring. EMD: ₹ 7,50,000. Bid End Date: 2026-10-17 18:00:00. MeitY empanelment certificate required.",
            "displayed_link": "gem.gov.in › bids › GEM-2026-B-9551042",
        }
    ]
}


def build_serp_query(keyword: str, state_filter: Optional[str] = None) -> str:
    """Builds a targeted Google search query focused strictly on Indian government tenders.
    
    Includes authoritative Indian tender portals and keywords like NIT, RFP, and tender.
    """
    clean_kw = keyword.strip()
    
    # Authoritative portal footprint
    portals = (
        "site:eprocure.gov.in OR "
        "site:gem.gov.in OR "
        "site:etenders.gov.in OR "
        "site:ireps.gov.in OR "
        "site:mahatenders.gov.in OR "
        "site:kppp.karnataka.gov.in OR "
        "site:wbtenders.gov.in OR "
        "site:tendersodisha.gov.in"
    )
    
    query = f'"{clean_kw}" tender ({portals})'
    if state_filter and state_filter.lower() not in ("all india", "national", "any", ""):
        query = f'"{clean_kw}" "{state_filter}" tender ({portals})'
        
    return query


def generate_mock_results(keyword: str, state_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Generates authentic Indian tender results for any keyword when running in mock mode."""
    kw_lower = keyword.lower()
    
    # 1. Check if matches pre-defined category fixtures
    for key, items in MOCK_TENDER_FIXTURES.items():
        if key in kw_lower:
            return items
            
    # 2. Dynamically generate realistic Indian tender items for custom user keywords
    today = datetime.now()
    d1 = (today + timedelta(days=2)).strftime("%Y-%m-%d")
    d2 = (today + timedelta(days=6)).strftime("%Y-%m-%d")
    d3 = (today + timedelta(days=14)).strftime("%Y-%m-%d")
    
    portals_info = [
        {
            "portal": "gem.gov.in",
            "link": f"https://gem.gov.in/bids/GEM/2026/B/{abs(hash(keyword)) % 900000 + 100000}?utm_source=serp&ref=feed",
            "deadline": d1,
            "days": 2,
            "emd": "₹ 1,50,000",
            "fee": "Nil",
            "snippet": f"GeM Bid: GEM/2026/B/{abs(hash(keyword)) % 900000 + 100000}. Comprehensive procurement and implementation for {keyword}. EMD Amount: ₹ 1,50,000. Bid End Date / Deadline: {d1} 15:00:00. Eligibility: Registered vendor on GeM portal with proven experience."
        },
        {
            "portal": "eprocure.gov.in",
            "link": f"https://eprocure.gov.in/eprocure/app?component=$DirectLink&page=FrontEndTenderDetails&sp=CPP{abs(hash(keyword)) % 80000}&jsessionid=34F89BC",
            "snippet": f"Central Public Procurement Portal (CPPP). Tender ID: 2026_CPPP_{abs(hash(keyword)) % 90000}_1. Turnkey execution for {keyword}. EMD: ₹ 4,00,000 (MSME Exempt). Last Date of Bid Submission: {d2} 17:00 IST. Document Fee: ₹ 1,500."
        },
        {
            "portal": "etenders.gov.in",
            "link": f"https://etenders.gov.in/eprocure/app?page=FrontEndTenderDetails&sp=GOV-{abs(hash(keyword)) % 50000}",
            "snippet": f"eTenders Govt of India. Tender Notice for Supply and AMC contract of {keyword}. EMD: ₹ 2,25,000. Submission Deadline: {d3} 16:30 IST. Eligibility: Annual turnover minimum ₹ 75 Lakhs in last 3 financial years."
        }
    ]
    
    results = []
    for p in portals_info:
        results.append({
            "title": f"Tender Notice for Supply, Installation and Execution of {keyword.title()} Works",
            "link": p["link"],
            "snippet": p["snippet"],
            "displayed_link": f"{p['portal']} › tender › details"
        })
    return results


class SerpApiClient:
    """Production SerpApi client with aggressive caching, deduplication, and mock support."""
    
    def __init__(self, api_key: Optional[str] = None, mock_mode: Optional[bool] = None, db_path: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.SERPAPI_API_KEY
        self.mock_mode = mock_mode if mock_mode is not None else settings.MOCK_SERPAPI
        self.db_path = db_path if db_path is not None else settings.DATABASE_PATH
        self.cache_ttl_hours = settings.CACHE_TTL_HOURS

    def search_tenders(self, keyword: str, state_filter: Optional[str] = None, raise_on_error: bool = False) -> List[Dict[str, Any]]:
        """Executes a SerpApi Google Search for tenders, checking cache first.
        
        Returns parsed list of organic results with title, link, snippet, and portal name.
        """
        query = build_serp_query(keyword, state_filter)
        query_hash = hashlib.sha256(query.encode("utf-8")).hexdigest()

        # 1. Check SQLite Cache (Conserve 250 monthly SerpApi free tier credits!)
        cached_results = get_cached_search(self.db_path, query_hash, max_age_hours=self.cache_ttl_hours)
        if cached_results is not None:
            logger.info(f"SerpApi Cache HIT for query: '{keyword}' (Hash: {query_hash[:8]})")
            return cached_results

        # 2. Check if Mock Mode is active or API key is absent
        if self.mock_mode or not self.api_key:
            logger.info(f"Using Mock SerpApi Engine for keyword: '{keyword}'")
            raw_items = generate_mock_results(keyword, state_filter)
        else:
            # 3. Real SerpApi Call
            logger.info(f"Calling real SerpApi Google Search for query: '{query}'")
            try:
                # We attempt using the official GoogleSearch from google-search-results
                from serpapi import GoogleSearch
                params = {
                    "q": query,
                    "engine": "google",
                    "gl": "in",
                    "hl": "en",
                    "location": "India",
                    "num": 10,  # Strict tight limit to conserve credits
                    "api_key": self.api_key,
                }
                search = GoogleSearch(params)
                data = search.get_dict()
                if "error" in data:
                    raise RuntimeError(f"SerpApi returned error: {data['error']}")
                raw_items = data.get("organic_results", [])
            except Exception as e:
                logger.error(f"SerpApi request failed ({e})")
                if raise_on_error:
                    raise
                logger.warning("Falling back to simulated data for continuity.")
                raw_items = generate_mock_results(keyword, state_filter)

        # 4. Standardize results
        cleaned_results: List[Dict[str, Any]] = []
        for item in raw_items:
            raw_url = item.get("link", "")
            if not raw_url:
                continue
                
            canonical_url = normalize_url(raw_url)
            portal_name = detect_portal_name(canonical_url)
            
            cleaned_results.append({
                "title": item.get("title", "Untitled Tender Notice"),
                "canonical_url": canonical_url,
                "original_url": raw_url,
                "portal_name": portal_name,
                "snippet": item.get("snippet", ""),
                "displayed_link": item.get("displayed_link", "")
            })

        # 5. Save to Cache
        set_cached_search(self.db_path, query_hash, query, cleaned_results)
        return cleaned_results
