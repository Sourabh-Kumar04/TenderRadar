"""Bid/No-Bid Advisor Engine for TenderRadar.

Differentiator feature for SerpApi India Hackathon 2026:
Evaluates tenders against bidder organizational profile, enforces
deterministic pre-filters, generates structured verdicts via DeepSeek
or rule-based mock engine, flags critical risks, and caches decisions.
"""

import re
import json
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple

from app.config import get_settings
from app.models import (
    BidVerdict,
    VerdictStatus,
    FlagSeverity,
    BidFlag,
    KeyDetails
)
from app.bidder_profile import BidderProfile, compute_profile_hash
from app.db import (
    get_tender_verdict,
    save_tender_verdict,
    get_bidder_profile
)
from app.summarizer import TenderSummarizer

logger = logging.getLogger(__name__)


# ==========================================
# Indian Currency & Metadata Parsers
# ==========================================

def parse_indian_currency(text: str) -> Optional[float]:
    """Parses Indian currency strings into INR float value."""
    if not text:
        return None
    cleaned = text.strip()

    # 1. Match Crores (e.g. "Rs 5.5 Crore", "₹5 Cr", "12 Crores")
    m_cr = re.search(r"(?:₹|Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Crores?|Cr)\b", cleaned, re.IGNORECASE)
    if m_cr:
        try:
            return float(m_cr.group(1)) * 10_000_000.0
        except ValueError:
            pass

    # 2. Match Lakhs (e.g. "₹50 Lakhs", "50 Lac", "Rs. 25 L")
    m_lakh = re.search(r"(?:₹|Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Lakhs?|Lacs?|Lac|L)\b", cleaned, re.IGNORECASE)
    if m_lakh:
        try:
            return float(m_lakh.group(1)) * 100_000.0
        except ValueError:
            pass

    # 3. Match Thousands / k
    m_k = re.search(r"(?:₹|Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Thousand|k)\b", cleaned, re.IGNORECASE)
    if m_k:
        try:
            return float(m_k.group(1)) * 1_000.0
        except ValueError:
            pass

    # 4. Comma-separated Indian or Western format (e.g. ₹ 50,00,000 or ₹500,000)
    m_commas = re.search(r"(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?)", cleaned, re.IGNORECASE)
    if m_commas:
        try:
            return float(m_commas.group(1).replace(",", ""))
        except ValueError:
            pass

    # 5. Direct raw integer/float after currency symbol
    m_raw = re.search(r"(?:₹|Rs\.?|INR)\s*([0-9]{4,}(?:\.[0-9]+)?)", cleaned, re.IGNORECASE)
    if m_raw:
        try:
            return float(m_raw.group(1))
        except ValueError:
            pass

    return None


def format_inr(amount: float) -> str:
    """Formats numeric amount into canonical Indian currency notation."""
    if amount >= 10_000_000:
        cr = amount / 10_000_000.0
        return f"₹{cr:.2f} Cr" if cr % 1 != 0 else f"₹{int(cr)} Cr"
    elif amount >= 100_000:
        lakh = amount / 100_000.0
        return f"₹{lakh:.2f} Lakh" if lakh % 1 != 0 else f"₹{int(lakh)} Lakh"
    elif amount >= 1_000:
        return f"₹{amount:,.0f}"
    return f"₹{amount:.0f}"


def extract_estimated_value(text: str) -> Tuple[Optional[float], str]:
    """Extracts estimated contract value from snippet or tender scope."""
    if not text:
        return None, "Unknown"

    # Labeled pattern search
    labeled = re.search(
        r"(?:Estimated\s*(?:Cost|Value)|Tender\s*Value|Contract\s*Value|Project\s*Cost|ECPT|Approx(?:\.|\s+)(?:Cost|Value))[\s:]*([₹RsINR\.\d,\s]+(?:\s*(?:Crores?|Cr|Lakhs?|Lacs?|Lac|L))?)",
        text,
        re.IGNORECASE
    )
    if labeled:
        raw_val = labeled.group(1).strip()
        parsed = parse_indian_currency(raw_val)
        if parsed:
            return parsed, format_inr(parsed)

    # General currency occurrence
    parsed = parse_indian_currency(text)
    if parsed and parsed >= 50_000:  # Threshold to avoid small fee amounts
        return parsed, format_inr(parsed)

    return None, "Unknown"


def extract_turnover_requirement(text: str) -> Tuple[Optional[float], Optional[str]]:
    """Extracts minimum annual turnover requirement if mentioned in tender text."""
    if not text:
        return None, None
    m = re.search(
        r"(?:Turnover|Annual\s*Turnover|Average\s*Turnover)[\s:]*([₹RsINR\.\d,\s]+(?:\s*(?:Crores?|Cr|Lakhs?|Lacs?|Lac|L))?)",
        text,
        re.IGNORECASE
    )
    if m:
        raw_val = m.group(1).strip()
        parsed = parse_indian_currency(raw_val)
        if parsed:
            return parsed, format_inr(parsed)
    return None, None


# ==========================================
# Deterministic Pre-Filter
# ==========================================

def run_prefilter(tender: Dict[str, Any], profile: BidderProfile) -> Dict[str, Any]:
    """Executes deterministic pre-filter against bidder profile.
    
    Checks:
    1. Category keyword match against tender title/snippet.
    2. Estimated value within [min_contract_value, max_contract_value] (unknown if absent).
    3. EMD <= max_emd_capacity when EMD is stated (factoring MSME exemption).
    """
    title = tender.get("title", "")
    snippet = tender.get("snippet", "")
    scope = tender.get("scope_summary", "")
    portal = tender.get("portal_name", "")
    combined_text = f"{title} {snippet} {scope} {tender.get('watchlist_keyword', '')}".lower()

    # 1. Category keyword match
    category_match = False
    matched_categories = []
    stopwords = {"and", "the", "for", "works", "supply", "services", "work", "procurement"}
    for cat in profile.categories:
        cat_lower = cat.lower().strip()
        if not cat_lower:
            continue
        if cat_lower in combined_text:
            category_match = True
            matched_categories.append(cat)
            continue
        # Check meaningful tokens
        tokens = [t for t in re.split(r"[\s/,-]+", cat_lower) if len(t) >= 3 and t not in stopwords]
        for tok in tokens:
            if re.search(rf"\b{re.escape(tok)}\b", combined_text):
                category_match = True
                matched_categories.append(cat)
                break

    # If contractor has no categories configured, do not exclude
    if not profile.categories:
        category_match = True

    # 2. Estimated Value Filter
    est_val, est_val_str = extract_estimated_value(f"{title}. {snippet}. {scope}")
    value_match = True
    value_fail_reason = None
    if est_val is not None:
        if est_val < profile.min_contract_value:
            value_match = False
            value_fail_reason = f"Estimated value {est_val_str} is below minimum contract threshold ({format_inr(profile.min_contract_value)})."
        elif est_val > profile.max_contract_value:
            value_match = False
            value_fail_reason = f"Estimated value {est_val_str} exceeds maximum contract capacity ({format_inr(profile.max_contract_value)})."

    # 3. EMD Capacity Filter
    raw_emd = tender.get("emd_amount", "")
    emd_val = parse_indian_currency(str(raw_emd))
    if not emd_val and raw_emd in (None, "", "Not Specified"):
        # Check snippet for EMD
        emd_match_snip = re.search(r"\bEMD\b[\s:]*([₹RsINR\.\d,\s]+(?:\s*(?:Crores?|Cr|Lakhs?|Lacs?|Lac|L))?)", f"{snippet} {title}", re.IGNORECASE)
        if emd_match_snip:
            emd_val = parse_indian_currency(emd_match_snip.group(1))

    is_msme_exempt = False
    if profile.msme_registered or profile.startup_registered:
        if re.search(r"msme|exempt|startup|nsic", f"{raw_emd} {combined_text}", re.IGNORECASE):
            is_msme_exempt = True
        elif "gem" in portal.lower():
            # GeM policy grants MSME exemption for most services & goods
            is_msme_exempt = True

    emd_match = True
    emd_fail_reason = None
    if emd_val is not None and not is_msme_exempt:
        if emd_val > profile.max_emd_capacity:
            emd_match = False
            emd_fail_reason = f"EMD requirement {format_inr(emd_val)} exceeds maximum liquidity capacity ({format_inr(profile.max_emd_capacity)})."

    passed = category_match and value_match and emd_match

    reasons = []
    if category_match:
        if matched_categories:
            reasons.append(f"Domain match: Aligns with profile competencies ({', '.join(set(matched_categories))}).")
        else:
            reasons.append("Category match confirmed.")
    else:
        reasons.append(f"Category mismatch: Tender scope does not align with bidder target categories ({', '.join(profile.categories)}).")

    if value_match:
        if est_val is not None:
            reasons.append(f"Contract value {est_val_str} is within target bracket [{format_inr(profile.min_contract_value)} - {format_inr(profile.max_contract_value)}].")
        else:
            reasons.append("Estimated contract value is unstated in notice (passes pre-filter).")
    else:
        reasons.append(value_fail_reason)

    if emd_match:
        if is_msme_exempt:
            reasons.append("EMD is exempt under MSME / Startup India procurement policy.")
        elif emd_val is not None:
            reasons.append(f"EMD of {format_inr(emd_val)} is within company liquidity capacity ({format_inr(profile.max_emd_capacity)}).")
        else:
            reasons.append("EMD amount not specified in notice (passes pre-filter).")
    else:
        reasons.append(emd_fail_reason)

    return {
        "passed": passed,
        "category_match": category_match,
        "value_match": value_match,
        "emd_match": emd_match,
        "est_val": est_val,
        "est_val_str": est_val_str,
        "emd_val": emd_val,
        "emd_str": format_inr(emd_val) if emd_val else (raw_emd or "Not Specified"),
        "is_msme_exempt": is_msme_exempt,
        "reasons": reasons
    }


# ==========================================
# Mandatory Risk & Opportunity Flags
# ==========================================

def evaluate_mandatory_flags(
    tender: Dict[str, Any],
    profile: BidderProfile,
    prefilter: Dict[str, Any],
    ref_date: Optional[date] = None
) -> List[Dict[str, str]]:
    """Evaluates and generates risk & opportunity flags covering:
    - Tight deadline (<7 days, <3 days)
    - EMD near/over capacity
    - Turnover requirement vs profile
    - Restrictive eligibility
    - Missing critical info
    - MSME exemption applicability
    """
    flags: List[Dict[str, str]] = []
    now_date = ref_date or datetime.now().date()
    combined_text = f"{tender.get('title', '')} {tender.get('snippet', '')} {tender.get('scope_summary', '')} {tender.get('eligibility', '')}".lower()

    # 1. Deadline Flags (<7 days, <3 days, Expired)
    deadline_str = tender.get("deadline_date")
    if deadline_str and deadline_str.strip().lower() not in ("n/a", "none", "unknown", "flexible", "not specified"):
        try:
            clean_date = deadline_str.strip().split(" ")[0].split("T")[0]
            dl_date = datetime.strptime(clean_date, "%Y-%m-%d").date()
            delta = (dl_date - now_date).days
            if delta < 0:
                flags.append({"severity": "critical", "text": "Tender submission deadline has expired."})
            elif delta <= 3:
                flags.append({"severity": "critical", "text": f"Extremely tight deadline ({deadline_str}, {delta} days left, <3 days). Critical bid submission risk."})
            elif delta <= 7:
                flags.append({"severity": "warning", "text": f"Tight submission deadline ({deadline_str}, {delta} days left, <7 days). Immediate bid preparation required."})
        except Exception:
            flags.append({"severity": "warning", "text": "Submission deadline format unverified. Verify official portal cutoff."})
    else:
        flags.append({"severity": "warning", "text": "Submission deadline missing in notice. Review full RFP document on portal."})

    # 2. EMD Flags (near or over capacity)
    emd_val = prefilter.get("emd_val")
    is_msme_exempt = prefilter.get("is_msme_exempt")
    if emd_val is not None and not is_msme_exempt:
        if emd_val > profile.max_emd_capacity:
            flags.append({
                "severity": "critical",
                "text": f"EMD amount ({format_inr(emd_val)}) exceeds maximum company capacity of {format_inr(profile.max_emd_capacity)}."
            })
        elif emd_val >= 0.8 * profile.max_emd_capacity:
            flags.append({
                "severity": "warning",
                "text": f"EMD amount ({format_inr(emd_val)}) approaches maximum liquidity threshold ({format_inr(profile.max_emd_capacity)})."
            })

    # 3. Turnover Requirement vs Profile
    turnover_val, turnover_str = extract_turnover_requirement(combined_text)
    if turnover_val is not None:
        if turnover_val > profile.annual_turnover:
            flags.append({
                "severity": "critical",
                "text": f"Tender turnover requirement ({turnover_str}) exceeds company annual turnover of {format_inr(profile.annual_turnover)}."
            })
        elif turnover_val >= 0.7 * profile.annual_turnover:
            flags.append({
                "severity": "warning",
                "text": f"Tender turnover requirement ({turnover_str}) is near company limit ({format_inr(profile.annual_turnover)})."
            })

    # 4. Restrictive Eligibility
    eligibility_text = str(tender.get("eligibility", "")).lower()
    restrictive_indicators = [
        "class 1 only", "class i contractor", "super special class", "prior 5 years",
        "turnover of at least", "proprietary item", "oem certificate mandatory", "no jv",
        "joint venture not allowed", "iso 27001", "tier-3 data center"
    ]
    for ind in restrictive_indicators:
        if ind in eligibility_text or ind in combined_text:
            flags.append({
                "severity": "warning",
                "text": f"Restrictive qualification criteria detected: '{ind}'. Verify company eligibility before bidding."
            })
            break

    # 5. Missing Critical Info
    if prefilter.get("est_val") is None:
        flags.append({
            "severity": "info",
            "text": "Contract value unstated in notice summary. Confirm estimated BOQ value on portal."
        })
    if tender.get("emd_amount") in (None, "", "Not Specified") and not emd_val:
        flags.append({
            "severity": "info",
            "text": "EMD amount not specified in search notice. Check tender fee annexure on portal."
        })

    # 6. MSME Exemption Applicability
    if profile.msme_registered or profile.startup_registered:
        if is_msme_exempt or "gem" in str(tender.get("portal_name", "")).lower() or "msme" in combined_text:
            flags.append({
                "severity": "info",
                "text": "MSME / Startup exemption applicable for EMD & tender document fee under Indian Public Procurement Policy."
            })

    return flags


# ==========================================
# Deterministic Rule-Based Mock Evaluator
# ==========================================

def evaluate_mock(
    tender: Dict[str, Any],
    profile: BidderProfile,
    prefilter: Dict[str, Any],
    ref_date: Optional[date] = None
) -> Dict[str, Any]:
    """Computes a 100% deterministic rule-based bid verdict for mock mode."""
    flags = evaluate_mandatory_flags(tender, profile, prefilter, ref_date=ref_date)
    has_critical = any(f["severity"] == "critical" for f in flags)
    has_warning = any(f["severity"] == "warning" for f in flags)

    # Base score computation (0 - 100)
    score = 0

    # 1. Category fit (35 pts)
    if prefilter["category_match"]:
        score += 35

    # 2. Contract value fit (25 pts)
    if prefilter["value_match"]:
        if prefilter["est_val"] is not None:
            score += 25
        else:
            score += 15  # unknown value

    # 3. EMD feasibility (20 pts)
    if prefilter["emd_match"]:
        if prefilter["is_msme_exempt"]:
            score += 20
        elif prefilter["emd_val"] is not None:
            ratio = prefilter["emd_val"] / max(profile.max_emd_capacity, 1.0)
            if ratio <= 0.5:
                score += 20
            elif ratio <= 0.8:
                score += 15
            else:
                score += 10
        else:
            score += 15

    # 4. Submission timeline (20 pts)
    deadline_str = tender.get("deadline_date")
    now_date = ref_date or datetime.now().date()
    if deadline_str and deadline_str not in ("N/A", "Unknown", None):
        try:
            clean_date = deadline_str.strip().split(" ")[0].split("T")[0]
            dl = datetime.strptime(clean_date, "%Y-%m-%d").date()
            d_days = (dl - now_date).days
            if d_days > 7:
                score += 20
            elif d_days >= 4:
                score += 12
            elif d_days >= 0:
                score += 5
        except Exception:
            score += 10
    else:
        score += 10

    # Verdict assignment - dynamic threshold based on document availability
    # When has_document=0, we have less signal, so scale threshold down
    # to avoid penalizing data gaps instead of poor fit
    has_doc = tender.get("has_document", 0)
    bid_threshold = 75 if has_doc else 65
    nobid_threshold = 50 if has_doc else 40

    if not prefilter["passed"] or has_critical or score < nobid_threshold:
        verdict = "NO_BID"
    elif score >= bid_threshold and not has_warning:
        verdict = "BID"
    else:
        verdict = "REVIEW"

    # Assemble reasons
    reasons = list(prefilter["reasons"])
    if verdict == "BID":
        reasons.append(f"Recommended for bidding (Match Score {score}%): Strong capability, liquidity, and timeline alignment.")
    elif verdict == "REVIEW":
        reasons.append(f"Manual review recommended (Match Score {score}%): Proceed after verifying eligibility caveats or tight timelines.")
    else:
        reasons.append(f"Not recommended (Match Score {score}%): Key criteria, capacity limits, or deadlines pose high risk.")

    key_details = {
        "est_value": prefilter["est_val_str"],
        "emd": prefilter["emd_str"],
        "deadline": tender.get("deadline_date") or "Unknown",
        "eligibility_summary": str(tender.get("eligibility") or "Open competitive bidding on portal.")[:120]
    }

    return {
        "verdict": verdict,
        "match_score": min(max(score, 0), 100),
        "key_details": key_details,
        "reasons": reasons,
        "flags": flags
    }


# ==========================================
# Bid Advisor Main Engine
# ==========================================

class BidAdvisor:
    """Intelligent Bid/No-Bid Advisor using Fireworks DeepSeek or mock engine."""

    def __init__(self, summarizer: Optional[TenderSummarizer] = None):
        self.settings = get_settings()
        self.summarizer = summarizer or TenderSummarizer()

    def evaluate(
        self,
        tender: Dict[str, Any],
        profile: BidderProfile,
        ref_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Evaluates a tender notice and returns structured BidVerdict dict."""
        prefilter = run_prefilter(tender, profile)

        # In mock mode or if prefilter failed completely, use deterministic engine
        if self.summarizer.mock_mode or not self.summarizer.api_key or not prefilter["passed"]:
            return evaluate_mock(tender, profile, prefilter, ref_date=ref_date)

        # Real LLM Call via existing Fireworks summarizer client
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=self.summarizer.api_key,
                base_url=self.summarizer.base_url,
                timeout=30.0
            )

            prompt = f"""
You are an expert Indian Government procurement bid advisor. Evaluate this tender notice against the contractor's profile.

Tender Information:
- Title: {tender.get('title')}
- Portal: {tender.get('portal_name')}
- Snippet: {tender.get('snippet')}
- Scope of Work: {tender.get('scope_summary')}
- Stated Eligibility: {tender.get('eligibility')}
- EMD: {tender.get('emd_amount')}
- Document Fee: {tender.get('tender_fee')}
- Deadline: {tender.get('deadline_date')}

Bidder Profile:
- Company: {profile.company_name}
- Target Categories: {json.dumps(profile.categories)}
- Contract Value Bracket: INR {profile.min_contract_value:,.0f} to INR {profile.max_contract_value:,.0f}
- Annual Turnover: INR {profile.annual_turnover:,.0f}
- Max EMD Capacity: INR {profile.max_emd_capacity:,.0f}
- MSME Registered: {profile.msme_registered}
- Startup Registered: {profile.startup_registered}
- Certifications: {json.dumps(profile.certifications)}
- Preferred States: {json.dumps(profile.preferred_states)}

Pre-filter Analysis:
- Category Match: {prefilter['category_match']}
- Estimated Value: {prefilter['est_val_str']} (Value Match: {prefilter['value_match']})
- EMD Analysis: {prefilter['emd_str']} (EMD Match: {prefilter['emd_match']}, MSME Exempt: {prefilter['is_msme_exempt']})

Respond STRICTLY with a valid JSON object matching this schema:
{{
  "verdict": "BID" | "NO_BID" | "REVIEW",
  "match_score": integer between 0 and 100,
  "key_details": {{
    "est_value": "Estimated contract value string",
    "emd": "EMD amount string or Exempted",
    "deadline": "YYYY-MM-DD or Unknown",
    "eligibility_summary": "1-sentence summary of technical/financial eligibility"
  }},
  "reasons": [
    "2-4 concise strategic bullet points explaining the decision"
  ],
  "flags": [
    {{
      "severity": "info" | "warning" | "critical",
      "text": "specific flag description covering tight deadlines, EMD liquidity, turnover limits, or MSME exemptions"
    }}
  ]
}}
"""
            response = client.chat.completions.create(
                model=self.summarizer.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert Indian Government procurement bid advisor for GeM, CPPP, and IREPS tenders. Output pure JSON only."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=4096
            )
            raw_content = (response.choices[0].message.content or "{}").strip()
            if raw_content.startswith("```json"):
                raw_content = raw_content[7:]
            elif raw_content.startswith("```"):
                raw_content = raw_content[3:]
            if raw_content.endswith("```"):
                raw_content = raw_content[:-3]

            parsed = json.loads(raw_content.strip())

            # Validate & normalize fields
            verdict = str(parsed.get("verdict", "REVIEW")).upper().strip()
            if verdict not in ("BID", "NO_BID", "REVIEW"):
                verdict = "REVIEW"

            score = int(parsed.get("match_score", 50))
            score = max(0, min(100, score))

            kd = parsed.get("key_details", {})
            if not isinstance(kd, dict):
                kd = {}
            key_details = {
                "est_value": str(kd.get("est_value", prefilter["est_val_str"])),
                "emd": str(kd.get("emd", prefilter["emd_str"])),
                "deadline": str(kd.get("deadline", tender.get("deadline_date") or "Unknown")),
                "eligibility_summary": str(kd.get("eligibility_summary", tender.get("eligibility") or "Refer to RFP"))[:150]
            }

            reasons = parsed.get("reasons", [])
            if not isinstance(reasons, list) or not reasons:
                reasons = prefilter["reasons"]
            else:
                reasons = [str(r) for r in reasons if str(r).strip()]

            llm_flags = parsed.get("flags", [])
            clean_flags = []
            if isinstance(llm_flags, list):
                for f in llm_flags:
                    if isinstance(f, dict) and "severity" in f and "text" in f:
                        sev = str(f["severity"]).lower()
                        if sev in ("info", "warning", "critical"):
                            clean_flags.append({"severity": sev, "text": str(f["text"])})

            # Ensure mandatory safety flags are merged
            mand_flags = evaluate_mandatory_flags(tender, profile, prefilter, ref_date=ref_date)
            existing_texts = {f["text"].lower() for f in clean_flags}
            for mf in mand_flags:
                # Add if not closely covered
                if not any(mf["text"][:30].lower() in et for et in existing_texts):
                    clean_flags.append(mf)

            # Ensure critical pre-filter failure translates to NO_BID
            if not prefilter["passed"]:
                verdict = "NO_BID"
                score = min(score, 40)

            return {
                "verdict": verdict,
                "match_score": score,
                "key_details": key_details,
                "reasons": reasons,
                "flags": clean_flags
            }

        except Exception as e:
            logger.warning(f"LLM Bid Advisor call failed ({e}); falling back to deterministic mock engine.")
            return evaluate_mock(tender, profile, prefilter, ref_date=ref_date)


# Singleton advisor instance
advisor_engine = BidAdvisor()


def get_or_compute_verdict(
    tender: Dict[str, Any],
    profile: BidderProfile,
    db_path: str,
    force_refresh: bool = False,
    ref_date: Optional[date] = None
) -> Dict[str, Any]:
    """Retrieves cached verdict or computes & caches a new verdict.
    
    Verdicts are keyed by tender_id + profile_hash; recomputed only when
    the tender or profile changes.
    """
    tender_id = tender.get("id")
    if not tender_id:
        return advisor_engine.evaluate(tender, profile, ref_date=ref_date)

    p_hash = compute_profile_hash(profile)
    tender_updated_at = tender.get("updated_at")

    if not force_refresh:
        cached = get_tender_verdict(db_path, int(tender_id), p_hash)
        if cached:
            # Check if tender was modified after verdict creation
            cached_tender_up = cached.get("tender_updated_at")
            if not tender_updated_at or cached_tender_up == tender_updated_at:
                return {
                    "verdict": cached.get("verdict"),
                    "match_score": cached.get("match_score"),
                    "key_details": cached.get("key_details", {}),
                    "reasons": cached.get("reasons", []),
                    "flags": cached.get("flags", [])
                }

    # Compute verdict
    verdict_dict = advisor_engine.evaluate(tender, profile, ref_date=ref_date)

    # Cache into tender_verdicts table
    save_tender_verdict(
        db_path=db_path,
        tender_id=int(tender_id),
        profile_hash=p_hash,
        verdict_data=verdict_dict,
        tender_updated_at=tender_updated_at
    )

    return verdict_dict
