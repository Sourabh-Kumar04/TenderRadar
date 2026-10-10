"""Precompute and verify cached bid verdicts for all current tenders."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.bid_advisor import get_or_compute_verdict
from app.bidder_profile import BidderProfile, compute_profile_hash, get_default_profile
from app.config import get_settings
from app.db import get_bidder_profile, get_tender_verdict, get_tenders, init_db


def main() -> None:
    settings = get_settings()
    init_db(settings.DATABASE_PATH)
    tenders = get_tenders(settings.DATABASE_PATH)
    profile_data = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_data) if profile_data else get_default_profile()

    for tender in tenders:
        get_or_compute_verdict(tender, profile, settings.DATABASE_PATH)

    profile_hash = compute_profile_hash(profile)
    cached = sum(
        get_tender_verdict(settings.DATABASE_PATH, int(tender["id"]), profile_hash) is not None
        for tender in tenders
    )
    print(f"Cached verdicts: {cached}/{len(tenders)}")
    if cached != len(tenders):
        raise SystemExit("Some tender verdicts were not cached")


if __name__ == "__main__":
    main()
