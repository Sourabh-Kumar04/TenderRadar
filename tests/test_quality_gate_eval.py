"""Eval dataset for testing quality gate prompt changes safely."""

EVAL_CASES = [
    # (title, url, snippet, expected_keep, description)
    (
        "Supply of 500 Desktop Computers for District Collectorate",
        "https://gem.gov.in/bid/12345",
        "GeM bid for supply of 500 desktop computers, EMD Rs 2 lakh, deadline 2026-11-15",
        True, "Real GeM tender - should KEEP"
    ),
    (
        "eProcurement System Government of India",
        "https://eprocure.gov.in/eprocure/app",
        "eProcurement System Government of India - portal homepage",
        False, "Portal homepage - should REJECT"
    ),
    (
        "NTPC Invites Bids for 870 kW Rooftop Solar",
        "https://saurenergy.com/news/ntpc-solar",
        "NTPC has invited bids for 870 kW rooftop solar PV plant. Last date...",
        True, "News article about real tender - should KEEP (as source)"
    ),
    (
        "How to Register on GeM Portal - Step by Step Guide",
        "https://example.com/gem-guide",
        "Complete guide to registering your company on Government e-Marketplace",
        False, "Help/guide article - should REJECT"
    ),
    (
        "153 Cloud Tenders In India 2026",
        "https://tenderdetail.com/cloud-tenders",
        "List of 153 cloud computing tenders across India...",
        False, "Aggregator listing page - should REJECT"
    ),
    (
        "Construction of Rural Roads under PMGSY Phase III",
        "https://etenders.hry.nic.in/tender/789",
        "Haryana PWD invites bids for construction of 15km rural road, estimated cost Rs 3.2 Cr",
        True, "Real state tender - should KEEP"
    ),
]

def run_eval(quality_gate_fn):
    """Run all eval cases through the quality gate. Returns pass/fail summary."""
    passed = 0
    failed = []
    for title, url, snippet, expected, desc in EVAL_CASES:
        result = quality_gate_fn(title, snippet, url, log_rejections=False)
        actual = result.get("keep", True)
        if actual == expected:
            passed += 1
        else:
            failed.append({"desc": desc, "expected": expected, "actual": actual,
                          "reason": result.get("reason", "")})
    return {
        "passed": passed,
        "total": len(EVAL_CASES),
        "failed": failed,
        "score": f"{passed}/{len(EVAL_CASES)}"
    }

if __name__ == "__main__":
    import sys
    sys.path.insert(0, "/mnt/d/01_Vibe_4_Hackathon/projects/tender-radar")
    from app.quality_gate import quality_gate
    result = run_eval(quality_gate)
    print(f"Eval score: {result['score']}")
    for f in result["failed"]:
        print(f"  FAIL: {f['desc']} (expected {f['expected']}, got {f['actual']})")
