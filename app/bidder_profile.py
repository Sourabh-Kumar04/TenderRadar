"""Bidder Profile module for TenderRadar.

Manages bidder organizational capabilities, financial thresholds,
MSME registrations, certifications, and preferred domains.
"""

import hashlib
import json
from typing import Dict, Any, List, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class BidderProfile(BaseModel):
    """Profile representing a contractor or SME bidder."""
    company_name: str = Field(..., min_length=1, description="Company or contractor name")
    categories: List[str] = Field(default_factory=list, description="Target tender categories")
    min_contract_value: float = Field(0.0, ge=0.0, description="Minimum contract value in INR")
    max_contract_value: float = Field(100000000.0, ge=0.0, description="Maximum contract value in INR")
    annual_turnover: float = Field(0.0, ge=0.0, description="Annual company turnover in INR")
    max_emd_capacity: float = Field(0.0, ge=0.0, description="Maximum EMD liquidity capacity in INR")
    msme_registered: bool = Field(False, description="Whether registered under MSME / Udyam")
    startup_registered: bool = Field(False, description="Whether registered under DPIIT Startup India")
    certifications: List[str] = Field(default_factory=list, description="Licenses and certifications")
    preferred_states: List[str] = Field(default_factory=list, description="Preferred operating states")

    @field_validator("categories", "certifications", "preferred_states", mode="before")
    @classmethod
    def parse_list_fields(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        if isinstance(v, (list, tuple, set)):
            return [str(item).strip() for item in v if str(item).strip()]
        return []

    @model_validator(mode="after")
    def validate_ranges(self) -> "BidderProfile":
        if self.min_contract_value < 0:
            raise ValueError("min_contract_value must be non-negative")
        if self.max_contract_value < 0:
            raise ValueError("max_contract_value must be non-negative")
        if self.annual_turnover < 0:
            raise ValueError("annual_turnover must be non-negative")
        if self.max_emd_capacity < 0:
            raise ValueError("max_emd_capacity must be non-negative")
        if self.min_contract_value > self.max_contract_value:
            raise ValueError("min_contract_value cannot be greater than max_contract_value")
        if not self.company_name or not self.company_name.strip():
            raise ValueError("company_name cannot be empty")
        return self


def get_default_profile() -> BidderProfile:
    """Returns sensible Indian contractor defaults."""
    return BidderProfile(
        company_name="Apex Infrastructure & Renewables Pvt Ltd",
        categories=[
            "Solar EPC",
            "Electrical Infrastructure",
            "Civil Construction",
            "CCTV Surveillance",
            "Renewable Energy"
        ],
        min_contract_value=2500000.0,     # ₹25 Lakhs
        max_contract_value=50000000.0,    # ₹5 Crores
        annual_turnover=30000000.0,       # ₹3 Crores
        max_emd_capacity=1000000.0,       # ₹10 Lakhs
        msme_registered=True,
        startup_registered=False,
        certifications=[
            "ISO 9001:2015",
            "Class A Electrical License",
            "MSME Udyam Registration"
        ],
        preferred_states=["Maharashtra", "Gujarat", "Delhi", "All India"]
    )


def compute_profile_hash(profile: BidderProfile) -> str:
    """Computes a stable deterministic SHA-256 hash of profile parameters."""
    data = {
        "company_name": profile.company_name.strip(),
        "categories": sorted([c.strip().lower() for c in profile.categories]),
        "min_contract_value": float(profile.min_contract_value),
        "max_contract_value": float(profile.max_contract_value),
        "annual_turnover": float(profile.annual_turnover),
        "max_emd_capacity": float(profile.max_emd_capacity),
        "msme_registered": bool(profile.msme_registered),
        "startup_registered": bool(profile.startup_registered),
        "certifications": sorted([c.strip().lower() for c in profile.certifications]),
        "preferred_states": sorted([s.strip().lower() for s in profile.preferred_states]),
    }
    encoded = json.dumps(data, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]
