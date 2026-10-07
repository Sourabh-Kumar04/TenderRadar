"""Data models and schemas for TenderRadar."""

from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator


class UrgencyStatus(str, Enum):
    URGENT = "Urgent (<3d)"
    CLOSING_SOON = "Closing Soon (<7d)"
    ACTIVE = "Active (>7d)"
    EXPIRED = "Expired"
    FLEXIBLE = "Flexible / Open"


def compute_urgency(deadline_str: Optional[str], ref_date: Optional[date] = None) -> UrgencyStatus:
    """Computes urgency badge status from ISO/standard deadline date string."""
    if not deadline_str or deadline_str.strip().lower() in ("n/a", "none", "unknown", "flexible", "not specified"):
        return UrgencyStatus.FLEXIBLE
    
    clean_date = deadline_str.strip().split(" ")[0].split("T")[0]
    try:
        deadline_date = datetime.strptime(clean_date, "%Y-%m-%d").date()
    except ValueError:
        # Try alternate formats like DD-MM-YYYY or DD/MM/YYYY
        try:
            deadline_date = datetime.strptime(clean_date.replace("/", "-"), "%d-%m-%Y").date()
        except ValueError:
            return UrgencyStatus.FLEXIBLE
            
    current_date = ref_date or datetime.now().date()
    delta_days = (deadline_date - current_date).days
    
    if delta_days < 0:
        return UrgencyStatus.EXPIRED
    elif delta_days <= 3:
        return UrgencyStatus.URGENT
    elif delta_days <= 7:
        return UrgencyStatus.CLOSING_SOON
    else:
        return UrgencyStatus.ACTIVE


class WatchlistCreate(BaseModel):
    keyword: str = Field(..., min_length=2, max_length=100, description="Search keyword for tender discovery")
    category: Optional[str] = Field("Infrastructure & EPC", max_length=100)
    min_value: Optional[str] = Field("Any", max_length=50)
    state_filter: Optional[str] = Field("All India", max_length=50)

    @field_validator("keyword")
    @classmethod
    def validate_keyword(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Watchlist keyword cannot be empty or whitespace only.")
        if len(cleaned) < 2:
            raise ValueError("Keyword must have at least 2 characters.")
        if len(cleaned) > 100:
            raise ValueError("Keyword must not exceed 100 characters.")
        return cleaned


class WatchlistUpdate(BaseModel):
    category: Optional[str] = None
    min_value: Optional[str] = None
    state_filter: Optional[str] = None
    is_active: Optional[bool] = None


class Watchlist(BaseModel):
    id: int
    keyword: str
    category: str
    min_value: str
    state_filter: str
    is_active: bool
    created_at: str
    updated_at: str
    last_scanned_at: Optional[str] = None
    tender_count: int = 0


class TenderSummary(BaseModel):
    scope_summary: str = Field(..., description="Concise scope of work / supply requirement")
    eligibility: str = Field("Open to qualified bidders / MSME criteria applicable", description="Technical / Turnover / Class qualifications")
    emd_amount: str = Field("Not Specified", description="EMD amount or exemption status")
    tender_fee: str = Field("Nil / Portal standard", description="Tender document fee")
    deadline_date: Optional[str] = Field(None, description="ISO format deadline YYYY-MM-DD if available")
    key_takeaways: str = Field("Review RFP document on portal for detailed annexures.", description="Quick strategic tip for bidders")
    urgency_status: UrgencyStatus = UrgencyStatus.FLEXIBLE


class Tender(BaseModel):
    id: int
    watchlist_id: Optional[int] = None
    watchlist_keyword: Optional[str] = None
    title: str
    canonical_url: str
    original_url: str
    portal_name: str
    snippet: Optional[str] = ""
    published_date: Optional[str] = None
    deadline_date: Optional[str] = None
    emd_amount: Optional[str] = "Not Specified"
    tender_fee: Optional[str] = "Nil"
    eligibility: Optional[str] = ""
    scope_summary: Optional[str] = ""
    key_takeaways: Optional[str] = ""
    urgency_status: UrgencyStatus = UrgencyStatus.FLEXIBLE
    created_at: str
    updated_at: str


class ScanLog(BaseModel):
    id: int
    watchlist_id: Optional[int] = None
    watchlist_keyword: Optional[str] = None
    status: str
    items_found: int = 0
    items_new: int = 0
    message: str = ""
    created_at: str


class StatsOverview(BaseModel):
    total_tenders: int = 0
    active_watchlists: int = 0
    urgent_closing_soon: int = 0
    total_scans: int = 0
    top_portals: Dict[str, int] = {}
