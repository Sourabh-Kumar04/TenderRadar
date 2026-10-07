"""LLM Summarizer Pipeline for TenderRadar.

Summarizes raw tender snippets and metadata into clean, structured bid intelligence:
- Scope of work / technical supply
- Eligibility & turnover criteria
- EMD (Earnest Money Deposit) & document fees
- Normalized submission deadline (YYYY-MM-DD)
- Strategic key takeaways for contractors & SME bidders

Includes a rule-based mock engine to run 100% offline without API keys.
"""

import re
import json
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional, List
import requests
from openai import OpenAI

from app.config import get_settings
from app.models import TenderSummary, UrgencyStatus, compute_urgency

logger = logging.getLogger(__name__)


def extract_regex_deadline(text: str) -> Optional[str]:
    """Finds deadline date in Indian tender text (ISO or DD-MM-YYYY formats)."""
    # 1. Match YYYY-MM-DD
    iso_match = re.search(r"\b(202\d{1}-[01]\d-[0-3]\d)\b", text)
    if iso_match:
        return iso_match.group(1)

    # 2. Match DD-MM-YYYY or DD/MM/YYYY
    dmy_match = re.search(r"\b([0-3]\d)[/-]([01]\d)[/-](202\d{1})\b", text)
    if dmy_match:
        day, month, year = dmy_match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # 3. Match 'DD Month YYYY' like '18 Oct 2026' or '25 October 2026'
    months = {
        "jan": "01", "january": "01",
        "feb": "02", "february": "02",
        "mar": "03", "march": "03",
        "apr": "04", "april": "04",
        "may": "05",
        "jun": "06", "june": "06",
        "jul": "07", "july": "07",
        "aug": "08", "august": "08",
        "sep": "09", "september": "09",
        "oct": "10", "october": "10",
        "nov": "11", "november": "11",
        "dec": "12", "december": "12"
    }
    month_regex = "|".join(months.keys())
    named_match = re.search(rf"\b([0-3]?\d)\s+({month_regex})\s+(202\d)\b", text, flags=re.IGNORECASE)
    if named_match:
        day, mon, year = named_match.groups()
        mon_num = months[mon.lower()]
        return f"{year}-{mon_num}-{day.zfill(2)}"

    return None


def extract_regex_emd(text: str) -> str:
    """Extracts EMD amount or exemption from tender text."""
    emd_match = re.search(
        r"\b(?:Earnest Money Deposit|EMD Amount|EMD)\b[\s:]*([₹RsINR\.\s]*[\d,]+(?:\.\d+)?(?:\s*(?:Lakhs?|Crores?|Cr|L))?(?:\s*\([^)]*\))?)",
        text,
        re.IGNORECASE
    )
    if emd_match:
        val = emd_match.group(1).strip()
        if len(val) >= 2:
            return val
            
    if re.search(r"MSME Exempt|Exempted for MSME|NSIC/MSME", text, re.IGNORECASE):
        return "Exempted for MSME / Startups"

    return "Not Specified (Check RFP)"


def extract_regex_fee(text: str) -> str:
    """Extracts tender document fee."""
    fee_match = re.search(r"(?:Tender Fee|Document Fee|Cost of Document)[\s:]*([₹Rs\.\d,\s]+(?:Lakhs?|Nil)?)", text, re.IGNORECASE)
    if fee_match:
        val = fee_match.group(1).strip()
        if len(val) > 1:
            return val
    return "Nil / Online Portal"


def rule_based_mock_summary(title: str, snippet: str, portal_name: str) -> TenderSummary:
    """Intelligent fallback/mock summarizer extracting structured parameters via heuristics."""
    combined = f"{title}. {snippet}"
    
    # 1. Deadline
    deadline = extract_regex_deadline(combined)
    if not deadline:
        # Generate a reasonable default deadline within 10 days for simulated tenders
        deadline = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")

    # 2. EMD
    emd = extract_regex_emd(combined)

    # 3. Fee
    fee = extract_regex_fee(combined)

    # 4. Eligibility
    elig_match = re.search(r"(?:Eligibility|Qualification|Turnover|Criteria)[\s:]*([^.]+?\.)", combined, re.IGNORECASE)
    if elig_match:
        eligibility = elig_match.group(1).strip()
    else:
        if "gem" in portal_name.lower():
            eligibility = "Registered OEM/Reseller on GeM portal with verified GSTIN and financial capability."
        elif "railway" in portal_name.lower() or "ireps" in portal_name.lower():
            eligibility = "Railway approved contractor / vendor registration on IREPS required."
        else:
            eligibility = "Open competitive bidding. Prior track record in similar supply/execution required."

    # 5. Scope summary
    # Clean title to create concise scope
    clean_title = re.sub(r"^(Tender Notice for|RFP for|Bid Number:\s*[A-Z0-9/]+\.\s*|Supply and Maintenance of|Implementation of)\s*", "", title, flags=re.IGNORECASE)
    scope_summary = f"Comprehensive execution and supply for {clean_title.strip()} under {portal_name}."

    # 6. Key takeaways
    takeaways = (
        f"Official bid published on {portal_name}. "
        f"{'EMD is ' + emd + '. ' if emd != 'Not Specified' else ''}"
        "Ensure technical bids, GST compliance certificates, and power of attorney are submitted before the online closing hour."
    )

    urgency = compute_urgency(deadline)

    return TenderSummary(
        scope_summary=scope_summary,
        eligibility=eligibility,
        emd_amount=emd,
        tender_fee=fee,
        deadline_date=deadline,
        key_takeaways=takeaways,
        urgency_status=urgency
    )


def query_fireworks_models(api_key: str, base_url: str = "https://api.fireworks.ai/inference/v1") -> List[str]:
    """Queries GET /models from Fireworks AI to list available models."""
    clean_base = base_url.rstrip("/")
    endpoint = f"{clean_base}/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        resp = requests.get(endpoint, headers=headers, timeout=15.0)
        if resp.status_code == 200:
            data = resp.json()
            return [m["id"] for m in data.get("data", [])]
        logger.warning(f"Fireworks /models returned HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Failed to query Fireworks models list: {e}")
    return []


def verify_deepseek_model(
    api_key: str,
    target_name: str = "deepseek-v4p1-flash",
    base_url: str = "https://api.fireworks.ai/inference/v1"
) -> str:
    """Verifies and returns the exact Fireworks model ID matching target_name.
    
    If the exact ID is not found, selects the closest flash-tier DeepSeek model.
    """
    model_ids = query_fireworks_models(api_key, base_url)
    
    # 1. Exact match or suffix match
    for m in model_ids:
        if m == target_name or m.endswith(f"/{target_name}"):
            return m
            
    # 2. Flash-tier DeepSeek search
    flash_candidates = [m for m in model_ids if "deepseek" in m.lower() and "flash" in m.lower()]
    if flash_candidates:
        chosen = flash_candidates[0]
        logger.info(f"Target '{target_name}' mapped to available flash model: '{chosen}'")
        return chosen

    # 3. Any DeepSeek model
    ds_candidates = [m for m in model_ids if "deepseek" in m.lower()]
    if ds_candidates:
        chosen = ds_candidates[0]
        logger.info(f"Target '{target_name}' mapped to available DeepSeek model: '{chosen}'")
        return chosen

    # Default canonical Fireworks model path
    return f"accounts/fireworks/models/{target_name}"


class TenderSummarizer:
    """Summarizes tender notices using Fireworks AI (DeepSeek V4P1 Flash) or rule-based fallback."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        mock_mode: Optional[bool] = None
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else (settings.FIREWORKS_API_KEY or settings.LLM_API_KEY)
        self.base_url = (base_url if base_url is not None else settings.LLM_BASE_URL).rstrip("/")
        self.model = model if model is not None else settings.LLM_MODEL
        self.mock_mode = mock_mode if mock_mode is not None else settings.MOCK_LLM

    def summarize(self, title: str, snippet: str, portal_name: str) -> TenderSummary:
        """Processes raw tender data and returns structured TenderSummary."""
        # Check mock mode or missing API key
        if self.mock_mode or not self.api_key:
            return rule_based_mock_summary(title, snippet, portal_name)

        # Real LLM Call using Fireworks OpenAI-compatible endpoint
        try:
            client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=30.0)
            
            prompt = f"""
You are an expert Indian Government procurement analyst. Analyze this tender search result and extract structured bid intelligence.

Title: {title}
Portal / Issuing Authority: {portal_name}
Snippet: {snippet}

Respond with valid JSON containing the following keys:
- "scope_summary": Concise 1-2 sentence description of work/supply requested.
- "eligibility": Technical/turnover/contractor requirements.
- "emd_amount": EMD required (e.g. ₹ 5,00,000, 2% of bid value, or Exempted for MSME).
- "tender_fee": Document fee or Nil.
- "deadline_date": ISO date format "YYYY-MM-DD" or null if not found.
- "key_takeaways": 1 actionable strategic tip for contractors/SMEs bidding on this.
"""
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional tender intelligence analyzer for Indian government contracts. Output pure JSON only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=4096
            )
            raw_content = response.choices[0].message.content or "{}"
            raw_content = raw_content.strip()
            # Strip markdown code fences if model enclosed JSON
            if raw_content.startswith("```json"):
                raw_content = raw_content[7:]
            elif raw_content.startswith("```"):
                raw_content = raw_content[3:]
            if raw_content.endswith("```"):
                raw_content = raw_content[:-3]

            parsed = json.loads(raw_content.strip())

            deadline_val = parsed.get("deadline_date")
            urgency = compute_urgency(deadline_val)

            return TenderSummary(
                scope_summary=parsed.get("scope_summary", f"Works/Supply for {title}"),
                eligibility=parsed.get("eligibility", "Refer to detailed tender document on portal."),
                emd_amount=parsed.get("emd_amount", "Not Specified"),
                tender_fee=parsed.get("tender_fee", "Nil"),
                deadline_date=deadline_val,
                key_takeaways=parsed.get("key_takeaways", f"Submit documents on {portal_name} prior to cutoff."),
                urgency_status=urgency
            )

        except Exception as e:
            logger.warning(f"LLM API call failed ({e}); falling back to intelligent rule-based summarizer.")
            return rule_based_mock_summary(title, snippet, portal_name)
