# TenderRadar — Hostile QA & Production Review Report

**Date of Audit:** October 7, 2026  
**Auditor:** Hostile QA Pass (Automated & Empirical Review)  
**Hackathon Target:** SerpApi India Hackathon 2026 (Deadline: Oct 10, 2026 23:59 IST)  
**Branch / Target:** `master` / `projects/tender-radar`  
**Overall Verdict:** **GO FOR DEMO (with Applied Fixes)**  

---

## 1. Executive Summary & Verdict

| Assessment Area | Status | Notes |
|---|---|---|
| **Live SerpApi Integration** | **PASS** | Live searches executed against Google Search API with `gl=in`, `location=India`. Caching and deduplication operational. |
| **Live Fireworks AI Integration** | **PASS** | Live inference on `accounts/fireworks/models/deepseek-v4p1-flash`. Rich bid analysis, sensible bid/no-bid verdicts, accurate flag generation. |
| **End-to-End Pipeline** | **PASS** | Profile configuration, watchlists, scans, verdict badge UI, "Recommended for me" filter, and CSV exports verified end-to-end. |
| **Resilience / Fault Tolerance** | **PASS** | Validated across 5 hostile break-it scenarios (invalid inputs, zero results, dead network/bad key, malformed LLM JSON, concurrent scans). |
| **Demo Readiness** | **GO** | Production-ready with 0 critical blockers remaining after bug fixes. Full pytest suite 100% green (63/63 passing). |

---

## 2. Per-Step Empirical Evidence

### Step 1: Fresh Environment & Initial Pytest Suite
- **Virtual Environment:** Fresh Python 3.12 venv created at `.venv`.
- **Dependencies Installed:** `requirements.txt` (FastAPI 0.142.3, Uvicorn 0.54.0, Pydantic 2.13.5, OpenAI 3.26.0, Google Search Results 2.4.2, APScheduler 3.11.3, Pytest 9.1.1).
- **Initial Test Suite Run:**
  - Command: `.venv/bin/pytest -v`
  - Total Tests: **59**
  - Passed: **59**
  - Failed: **0**
  - Execution Time: **16.59s**

---

### Step 2: Real SerpApi Live Calls
*Tested with real credentials from `.env` (`SERPAPI_API_KEY: 0d4c...`, redacted).*

- **SerpApi Account Status Check Before:**
  - Plan: `free`
  - Searches per month: `250`
  - Total searches left: `250`
  - This month usage: `0`

- **Live Searches Executed (`gl=in`, `hl=en`, `location=India`):**
  1. Query: `"solar" tender (site:eprocure.gov.in OR site:gem.gov.in OR ...)`
     - Results returned: **10** organic results
     - Latency: **30.58s** (uncached upstream Google scrape)
  2. Query: `"highway" tender (site:eprocure.gov.in OR site:gem.gov.in OR ...)`
     - Results returned: **10** organic results
     - Latency: **65.41s** (uncached upstream Google scrape)
  3. Re-scan Query: `"solar"`
     - Results returned: **10** organic results
     - Latency: **0.0052s** (**SerpApi SQLite Cache HIT**)

- **Database Insertion & Deduplication:**
  - Initial Solar tenders inserted: **10 / 10**
  - Initial Highway tenders inserted: **10 / 10**
  - Total tenders indexed in DB: **20**
  - Re-scan deduplication attempt (re-inserting all 20 items):
    - Duplicate entries blocked: **20**
    - Newly created entries: **0**
    - Database total before: **20** | Database total after: **20** (**100% Deduplication Invariance**)

- **SerpApi Account Status Check After:**
  - Total searches left: **248**
  - Searches consumed: **2** (exact match for 2 uncached queries; 0 credits consumed on cache hit)

---

### Step 3: Real Fireworks AI Live Calls
*Tested with real credentials from `.env` (`FIREWORKS_API_KEY: fw_H...`, model `accounts/fireworks/models/deepseek-v4p1-flash`, base URL `https://api.fireworks.ai/inference/v1`).*

- **Connectivity & Model Verification:**
  - Fireworks `/models` endpoint: HTTP 200, 20 models available
  - Target model verified: `accounts/fireworks/models/deepseek-v4p1-flash`

- **Live Summarization of Real Tenders:**
  1. *NH-365BG Greenfield Highway Tender* (`etenders.gov.in`):
     - Latency: **7.21s**
     - Scope Summary: Access-controlled 4-lane greenfield highway section of NH-365BG (29.462 km).
     - Eligibility: EPC highway contractor turnover and technical experience.
     - EMD: Extracted / Noted from RFP.
     - Key Takeaway: "Download full eTenders/NHAI document immediately; verify MSME exemption and JV eligibility."
  2. *Solar PV Plant Tenders* (`tenderdekho.com`):
     - Latency: **4.88s**
     - Scope Summary: Aggregated listing of solar photovoltaic (PV) plant opportunities for Indian Army and PWD.
     - Key Takeaway: "Use aggregator as lead source; verify each tender directly on official portal."
  3. *State Solar Tenders* (`solartenders.com`):
     - Latency: **6.05s**
     - Scope Summary: Multi-state tender listing across AP, Delhi, Gujarat, MP, Maharashtra, Rajasthan.

- **Live Bid Advisor Evaluation (Realistic Bidder Profile: SunShine Renewable Energies Pvt Ltd — Solar EPC contractor, turnover ₹1.5 Cr, EMD capacity ₹5 Lakhs, MSME registered):**
  1. *Highway Construction Tender (NH-365BG)*:
     - **Verdict:** `NO_BID` | **Match Score:** `8%`
     - **Reasons:** Civil highway construction is completely outside Solar/Renewable core competencies; contract value is orders of magnitude above ₹2 Cr bracket.
     - **Flags:** `critical`: Category mismatch; `critical`: Scale mismatch; `warning`: Submission deadline missing in notice.
  2. *Solar PV Aggregator Listing*:
     - **Verdict:** `REVIEW` | **Match Score:** `55%`
     - **Reasons:** Strong category match with solar focus, but aggregator listing requires manual verification of underlying RFP documents.
     - **Flags:** `warning`: Aggregator listing; `info`: MSME exemption potential.
  3. *State Solar Directory*:
     - **Verdict:** `NO_BID` | **Match Score:** `30%`
     - **Reasons:** Directory listing without actionable single RFP tender details.

---

### Step 4: End-to-End Pipeline Verification
- **HTTP Endpoints (curl / client HTTP 200 checks):**
  - `GET /` — HTTP 200 (168,567 bytes HTML rendered)
  - `GET /watchlists` — HTTP 200 (8,168 bytes HTML rendered)
  - `GET /scans` — HTTP 200 (3,704 bytes HTML rendered)
  - `GET /profile` — HTTP 200 (12,430 bytes HTML rendered)
  - `GET /tenders/1` — HTTP 200 (12,617 bytes HTML rendered)
- **Profile REST API:**
  - `POST /api/profile` — HTTP 200 (saved `Surya Power Solutions Pvt Ltd`)
  - `GET /api/profile` — HTTP 200 (retrieved active profile)
- **Verdict Badges:** Verified in rendered HTML (`badge-bid`, `badge-nobid`, `badge-review` present on tender cards).
- **"Recommended for me" Filter:**
  - `GET /?recommended=true` — HTTP 200
  - `GET /api/tenders?recommended=true` — HTTP 200, strictly returns items with verdict `BID`.
- **CSV Export:**
  - `GET /export/csv` — HTTP 200, Content-Type: `text/csv`
  - Header row verified: `['Tender ID', 'Title', 'Portal', 'Watchlist Keyword', 'Advisor Verdict', 'Match Score (%)', 'Submission Deadline', 'Urgency Status', 'EMD Amount', ...]`
  - Rows contain actual verdicts (`NO_BID`, `REVIEW`, `BID`) and computed match scores.

---

### Step 5: Hostile Break-It Attempts

| Scenario | Input / Action | Observed Behavior | Verdict |
|---|---|---|---|
| **1. Invalid Bidder Profile** | `min_contract_value: 5Cr`, `max: 1Cr`, negative values, empty `company_name` | Pydantic validation rejects with HTTP 422 Unprocessable Entity; Form submission cleanly redirects with 303 + error message query param. | **PASS** |
| **2. Zero Search Results** | Search for keyword returning 0 legitimate tenders | Previously triggered fake mock generation bug. Fixed: now returns `[]` cleanly without fabricating mock items. | **PASS (Fixed)** |
| **3. Invalid API Key / Dead Network** | `api_key: "INVALID_KEY_XYZ"` | Previously silently cached empty lists because `GoogleSearch.get_dict()` returned `{"error": ...}` without raising. Fixed: now raises RuntimeError and cleanly activates simulated mock continuity engine. | **PASS (Fixed)** |
| **4. Malformed LLM Response** | Truncated JSON / corrupted text / invalid field types returned by LLM | `json.loads` and type conversion exceptions are caught gracefully; both Summarizer and Advisor fall back to deterministic rule engine without throwing 500s. | **PASS** |
| **5. Concurrent Scans** | 5 concurrent threads triggering `run_full_scan()` simultaneously | Thread lock held strictly: 1 scan completed (`status: Completed`), 4 rejected cleanly with `status: Busy`. | **PASS** |

---

## 3. Bugs Discovered & Remediations

### Bug 1: CSV Export Omitted Bid Verdicts and Match Scores
- **Root Cause:** `app/main.py:export_csv` called `get_tenders` without `profile_hash`, leaving verdict fields unjoined in SQL. The CSV writer header and row tuples did not include verdict or match score columns.
- **Fix:** Joined active profile hash in `export_csv`, added `Advisor Verdict` and `Match Score (%)` to header row, and populated them in CSV rows.
- **Status:** **FIXED** (verified in `tests/test_routes.py`).

### Bug 2: Bid Advisor Failed to Short-Circuit on Pre-Filter Failures (Severe Performance & Cost Defect)
- **Root Cause:** In `app/bid_advisor.py:evaluate()`, the pre-filter checked category and financial eligibility. However, line 487 only checked `if self.summarizer.mock_mode or not self.summarizer.api_key:`. It failed to check `or not prefilter["passed"]`. As a result, tenders that were completely disqualified (e.g. Highway tenders for a Solar company) still incurred 8–12s blocking LLM calls to Fireworks AI, only to force `verdict = "NO_BID"` at line 615 anyway.
- **Fix:** Updated line 487 to `if self.summarizer.mock_mode or not self.summarizer.api_key or not prefilter["passed"]: return evaluate_mock(...)`.
- **Impact:** Disqualified tenders resolve in < 1ms rather than 10s of blocking I/O, saving substantial API quota and preventing severe dashboard latency.
- **Status:** **FIXED** (verified in `tests/test_bid_advisor.py`).

### Bug 3: Silent Failure on SerpApi Error Responses (`{"error": ...}`)
- **Root Cause:** In `app/serpapi_client.py:search_tenders()`, the official `GoogleSearch.get_dict()` call returns a dictionary with `{"error": "Invalid API key..."}` on authentication failure or quota exhaustion without raising a Python exception. The code only ran `raw_items = data.get("organic_results", [])`, which yielded `[]`. The client treated API errors as "zero organic results found", cached `[]` in SQLite for 24h, and prevented mock fallback from engaging.
- **Fix:** Added explicit `if "error" in data: raise RuntimeError(f"SerpApi returned error: {data['error']}")` before processing results.
- **Status:** **FIXED** (verified in `tests/test_serpapi.py`).

### Bug 4: Zero Legitimate Search Results Hallucinated Mock Tenders
- **Root Cause:** In `app/scheduler.py:ScanManager.search_tenders()`, line 155 had `if results: return results`. When SerpApi legitimately found 0 tenders, `results` was an empty list `[]` (truthy `False`), causing execution to fall through to `generate_mock_results()`. The system fabricated fake tenders for non-existent keywords.
- **Fix:** Changed check to `if results is not None: return results`.
- **Status:** **FIXED** (verified in `tests/test_scheduler.py`).

### Bug 5: Missing `POST /api/profile` Route
- **Root Cause:** `app/main.py` defined `GET /api/profile` and `PUT /api/profile`, but lacked `POST /api/profile`. Standard REST clients creating/updating the profile via POST received `HTTP 405 Method Not Allowed`.
- **Fix:** Added `@app.post("/api/profile")` decorator alongside `@app.put("/api/profile")`.
- **Status:** **FIXED** (verified in `tests/test_routes.py`).

---

## 4. Top 5 High-Impact Improvements for Hackathon Judging

Judged against the official SerpApi Hackathon rubric:
*Innovation (25%), Technical (25%), Meaningful SerpApi Use (25%), Presentation (20%), Wow Factor (5%)*.

### 1. Asynchronous Background Verdict Pre-computation & Non-blocking Feed
- **Rubric Focus:** Technical (25%) + Presentation (20%)
- **Current Weakness:** When a user updates their profile and visits the dashboard (`GET /`), if 10 new matching tenders are un-evaluated, the route computes verdicts sequentially. Even with short-circuiting, evaluating 5 matching tenders takes 30–45s synchronously in the web request.
- **Concrete Proposal:** Decouple verdict generation into a background queue (`BackgroundTasks` or APScheduler). The dashboard should display tenders immediately with a `"Evaluating..."` shimmer badge and dynamically update via SSE (Server-Sent Events) or lightweight HTMX polling.
- **Effort Estimate:** **Medium (3–4 hours)**.

### 2. Temporal Freshness Targeting via SerpApi `tbs=qdr` Parameter
- **Rubric Focus:** Meaningful SerpApi Use (25%) + Innovation (25%)
- **Current Weakness:** Indian government tenders expire quickly (typically 14–21 days from publication). Standard Google search queries sometimes return archived or completed tenders from 2022–2024.
- **Concrete Proposal:** Leverage SerpApi's native `tbs` parameter:
  - Daily Scans: `tbs=qdr:d` (tenders indexed in the past 24 hours).
  - Weekly Scans: `tbs=qdr:w` (past 7 days).
  - Add Corrigendum Mode: `"corrigendum" OR "extension of tender" tbs=qdr:d` to alert bidders of last-minute deadline extensions.
- **Effort Estimate:** **Small (1.5–2 hours)**.

### 3. Automated Tender RFP Document / Corrigendum Deep Extraction
- **Rubric Focus:** Wow Factor (5%) + Innovation (25%)
- **Current Weakness:** The system currently relies on SerpApi search snippets and meta descriptions. Many critical procurement details (e.g. turnover ratios, Class 1 local supplier preference clause 3(a), joint-venture restrictions) are buried in downloaded PDF tender notices.
- **Concrete Proposal:** In the tender detail view, add a "Deep Analyze RFP" button that fetches the portal notice page via `httpx`, extracts linked `.pdf` tender notices, parses the first 10 pages with `pypdf`, and feeds key clauses to DeepSeek to generate a 1-click **Bidder Compliance Matrix**.
- **Effort Estimate:** **Medium (4–6 hours)**.

### 4. Direct Portal Query Optimization (Eliminate Third-Party Aggregators)
- **Rubric Focus:** Meaningful SerpApi Use (25%)
- **Current Weakness:** The query `"solar" tender (site:eprocure.gov.in OR ...)` with parentheses causes Google to occasionally match private aggregator sites (`solartenders.com`, `tenderdekho.com`, `facebook.com`) that mention the portal URLs in their text.
- **Concrete Proposal:** Separate queries by portal or use exact site prefixes without parentheses (e.g., query 1: `site:gem.gov.in "solar" tender`, query 2: `site:eprocure.gov.in "solar" tender`). Furthermore, filter out non-government domains at the URL parsing stage if `portal_name` is not in the recognized government portal whitelist.
- **Effort Estimate:** **Small (1–2 hours)**.

### 5. Exportable "Bid Dossier" (Executive Summary + MSME Cover Letter PDF)
- **Rubric Focus:** Presentation (20%) + Wow Factor (5%)
- **Current Weakness:** The current export is CSV only. Contractors preparing a bid submission need executive memos to obtain management approval and MSME EMD exemption request letters.
- **Concrete Proposal:** Add a "Download Bid Dossier" button on `GET /tenders/{id}` that generates a formatted printable HTML/PDF containing:
  - Executive Bid/No-Bid rationale & match score.
  - Risk Flag checklist.
  - Auto-filled MSME Form requesting EMD and Tender Fee Exemption under Rule 170 of General Financial Rules (GFR) 2017.
- **Effort Estimate:** **Medium (3–4 hours)**.

---

## 5. What Remains Unverified

1. **Multi-day Unattended APScheduler Execution:**
   - APScheduler was verified initializing and adding the cron job at `06:00` daily. However, long-term continuous uptime over 48+ hours without process restarts was not verified in this single-session pass.
2. **High-Concurrency Rate Limits (>100 QPS):**
   - The SQLite database uses standard connection locking without WAL mode. High concurrent write throughput (dozens of simultaneous writes) was not stress-tested beyond 5 concurrent threads.
3. **Deep SerpApi Pagination:**
   - Currently, queries retrieve the top 10 results (`num: 10`) to conserve the 250 monthly free tier credits. Pagination via `start=10` / `page=2` was not exercised against live credits.

---

## 6. Final Pytest Verification Post-Fixes

```bash
$ .venv/bin/pytest -v
============================= test session starts ==============================
platform linux -- Python 3.12.13, pytest-9.1.1, pluggy-1.6.0
rootdir: /mnt/d/01_Vibe_4_Hackathon/projects/.muse-worktrees/447fe3d412fe4c108812fd46246d9963
plugins: anyio-4.15.1, asyncio-1.4.0
collected 63 items

tests/test_bid_advisor.py::test_currency_parsing PASSED                  [  1%]
tests/test_bid_advisor.py::test_inr_formatting PASSED                    [  3%]
tests/test_bid_advisor.py::test_prefilter_category_matching PASSED       [  4%]
tests/test_bid_advisor.py::test_prefilter_value_range PASSED             [  6%]
tests/test_bid_advisor.py::test_prefilter_emd_and_msme_exemption PASSED  [  7%]
tests/test_bid_advisor.py::test_mandatory_flags_coverage PASSED          [  9%]
tests/test_bid_advisor.py::test_verdict_schema_validation PASSED         [ 11%]
tests/test_bid_advisor.py::test_mock_verdict_determinism PASSED          [ 12%]
tests/test_bid_advisor.py::test_cache_invalidation_on_profile_change PASSED [ 14%]
tests/test_bid_advisor.py::test_api_tender_verdict_and_recommended_filter PASSED [ 15%]
tests/test_bid_advisor.py::test_advisor_short_circuits_prefilter_failure PASSED [ 17%]
tests/test_bidder_profile.py::test_default_profile PASSED                [ 19%]
tests/test_bidder_profile.py::test_profile_validation_range_and_non_negative PASSED [ 20%]
tests/test_bidder_profile.py::test_profile_comma_separated_strings PASSED [ 22%]
tests/test_bidder_profile.py::test_profile_hash_determinism PASSED       [ 23%]
tests/test_bidder_profile.py::test_profile_db_crud PASSED                [ 25%]
tests/test_bidder_profile.py::test_profile_api_endpoints PASSED          [ 26%]
tests/test_bidder_profile.py::test_profile_form_submission PASSED        [ 28%]
tests/test_db.py::test_watchlist_crud PASSED                             [ 30%]
tests/test_db.py::test_seed_default_watchlists PASSED                    [ 31%]
tests/test_db.py::test_tender_insert_and_deduplication PASSED            [ 33%]
tests/test_db.py::test_tender_filtering_and_sorting PASSED               [ 34%]
tests/test_db.py::test_scan_logging PASSED                               [ 36%]
tests/test_normalizer.py::test_normalize_url_strips_tracking_params PASSED [ 38%]
tests/test_normalizer.py::test_normalize_url_strips_fbclid_and_gclid PASSED [ 39%]
tests/test_normalizer.py::test_normalize_url_strips_fragments PASSED     [ 41%]
tests/test_normalizer.py::test_normalize_url_cleans_session_tokens PASSED [ 42%]
tests/test_normalizer.py::test_normalize_url_sorts_query_parameters PASSED [ 44%]
tests/test_normalizer.py::test_normalize_url_deduplication_invariance PASSED [ 46%]
tests/test_normalizer.py::test_detect_portal_names PASSED                [ 47%]
tests/test_routes.py::test_dashboard_renders PASSED                      [ 49%]
tests/test_routes.py::test_watchlists_page_renders PASSED                [ 50%]
tests/test_routes.py::test_create_watchlist_valid PASSED                 [ 52%]
tests/test_routes.py::test_create_watchlist_validation_empty PASSED      [ 53%]
tests/test_routes.py::test_create_watchlist_validation_too_long PASSED   [ 55%]
tests/test_routes.py::test_toggle_and_delete_watchlist PASSED            [ 57%]
tests/test_routes.py::test_full_scan_view PASSED                         [ 58%]
tests/test_routes.py::test_scans_page_renders PASSED                     [ 60%]
tests/test_routes.py::test_tender_detail_view PASSED                     [ 61%]
tests/test_routes.py::test_export_csv PASSED                             [ 63%]
tests/test_routes.py::test_api_watchlists_crud PASSED                    [ 65%]
tests/test_routes.py::test_api_tenders_and_stats PASSED                  [ 66%]
tests/test_routes.py::test_api_profile_post_and_put PASSED               [ 68%]
tests/test_scheduler.py::test_scan_manager_single_watchlist_and_deduplication PASSED [ 69%]
tests/test_scheduler.py::test_scan_manager_full_scan PASSED              [ 71%]
tests/test_scheduler.py::test_scan_manager_zero_results_handling PASSED  [ 73%]
tests/test_serpapi.py::test_build_serp_query PASSED                      [ 74%]
tests/test_serpapi.py::test_generate_mock_results_preset_category PASSED [ 76%]
tests/test_serpapi.py::test_generate_mock_results_dynamic_keyword PASSED [ 77%]
tests/test_serpapi.py::test_serpapi_client_caching_and_mock PASSED       [ 79%]
tests/test_serpapi.py::test_serpapi_error_response_raises_or_fallbacks PASSED [ 80%]
tests/test_summarizer.py::test_extract_regex_deadline_iso PASSED         [ 82%]
tests/test_summarizer.py::test_extract_regex_deadline_dmy PASSED         [ 84%]
tests/test_summarizer.py::test_extract_regex_deadline_named_month PASSED [ 85%]
tests/test_summarizer.py::test_extract_regex_emd PASSED                  [ 87%]
tests/test_summarizer.py::test_extract_regex_fee PASSED                  [ 88%]
tests/test_summarizer.py::test_compute_urgency PASSED                    [ 90%]
tests/test_summarizer.py::test_summarizer_mock_mode_no_keys_required PASSED [ 92%]
tests/test_summarizer.py::test_verify_deepseek_model_fallback PASSED     [ 93%]
tests/test_summarizer.py::test_summarizer_config_override PASSED         [ 95%]
tests/test_summarizer.py::test_summarizer_env_overrides PASSED           [ 96%]
tests/test_summarizer.py::test_summarizer_fireworks_base_url_precedence PASSED [ 98%]
tests/test_summarizer.py::test_summarizer_parsing_list_takeaways PASSED  [100%]

============================== 63 passed in 8.09s ==============================
```
