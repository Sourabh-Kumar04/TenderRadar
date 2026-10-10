"""Main FastAPI application for TenderRadar.

Provides server-rendered Jinja2 UI, background scheduling,
REST API endpoints, and CSV export.
"""

import io
import csv
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Request, Form, Query, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import get_settings
from app.db import (
    init_db,
    seed_default_watchlists_if_empty,
    get_watchlists,
    get_watchlist,
    create_watchlist,
    update_watchlist,
    delete_watchlist,
    toggle_watchlist_status,
    get_tenders,
    get_tender,
    get_tenders_stats,
    get_scan_logs,
    get_bidder_profile,
    save_bidder_profile,
    save_tender,
    unsave_tender,
    is_tender_saved,
    update_saved_tender_notes,
    get_saved_tenders,
    get_search_cache_count
)
from app.models import (
    WatchlistCreate,
    WatchlistUpdate,
    Tender,
    StatsOverview,
    BidVerdict,
    SavedTenderSaveRequest
)
from app.normalizer import select_portal_url, display_title
from app.bidder_profile import (
    BidderProfile,
    get_default_profile,
    compute_profile_hash
)
from app.bid_advisor import get_or_compute_verdict
from app.deep_dive import deep_dive_analysis
from app.tender_chat import tender_chat
from app.verifier import verify_tender
from app.scheduler import scan_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("tenderradar")

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: database initialization, default seeding, and scheduler startup."""
    settings = get_settings()
    logger.info("Initializing database...")
    init_db(settings.DATABASE_PATH)
    seed_default_watchlists_if_empty(settings.DATABASE_PATH)

    # Initialize default bidder profile if empty
    existing_profile = get_bidder_profile(settings.DATABASE_PATH)
    if not existing_profile:
        default_prof = get_default_profile()
        save_bidder_profile(settings.DATABASE_PATH, default_prof.model_dump())
        logger.info(f"Initialized default bidder profile: '{default_prof.company_name}'")

    # Pre-populate on empty database so dashboard is immediately ready
    stats = get_tenders_stats(settings.DATABASE_PATH)
    if stats["total_tenders"] == 0:
        logger.info("Database empty; initiating initial discovery scan...")
        scan_manager.run_full_scan()

    logger.info("Starting APScheduler...")
    scan_manager.start_scheduler()

    yield
    
    logger.info("Shutting down APScheduler...")
    scan_manager.shutdown_scheduler()


app = FastAPI(
    title="TenderRadar API",
    description="Indian Government Tender Discovery & Tracking Agent powered by SerpApi",
    version="1.0.0",
    lifespan=lifespan
)

# Static and Templates
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
templates.env.globals["select_portal_url"] = select_portal_url
templates.env.globals["display_title"] = display_title
templates.env.globals["is_mock_serpapi"] = get_settings().MOCK_SERPAPI



# ==========================================
# Web UI Routes (Server-Rendered Jinja2)
# ==========================================

@app.get("/", response_class=HTMLResponse)
async def dashboard_view(
    request: Request,
    search: Optional[str] = Query(None),
    portal: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    watchlist_id: Optional[str] = Query(None),
    sort_order: str = Query("match_score"),
    recommended: Optional[str] = Query(None),
    verdict: Optional[str] = Query(None),
    doc_backed: Optional[str] = Query(None),
    message: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    # Handle empty watchlist_id from form
    _wl_id = int(watchlist_id) if watchlist_id and watchlist_id.strip() else None
    settings = get_settings()
    if sort_order == "match_score":
        sort_by = "match_score"
        order = "desc"
    elif sort_order == "newest":
        sort_by = "newest"
        order = "desc"
    elif sort_order == "desc":
        sort_by = "deadline"
        order = "desc"
    else:
        sort_by = "deadline"
        order = "asc"

    # Load active bidder profile
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    if profile_dict:
        profile = BidderProfile(**profile_dict)
    else:
        profile = get_default_profile()
        save_bidder_profile(settings.DATABASE_PATH, profile.model_dump())
    profile_hash = compute_profile_hash(profile)

    selected_verdict = verdict.upper() if verdict else None
    is_recommended = recommended in ("1", "true", "yes") or selected_verdict == "BID"
    if is_recommended and not selected_verdict:
        selected_verdict = "BID"

    tenders = get_tenders(
        db_path=settings.DATABASE_PATH,
        watchlist_id=_wl_id,
        portal=portal,
        urgency=urgency,
        search=search,
        sort_by=sort_by,
        sort_order=order,
        limit=100,
        profile_hash=profile_hash,
        recommended_only=False
    )

    # Ensure all displayed tenders have verdicts computed & cached
    bid_count = 0
    review_count = 0
    nobid_count = 0
    for t in tenders:
        if not t.get("advisor_verdict"):
            verd = get_or_compute_verdict(t, profile, settings.DATABASE_PATH)
            t["verdict"] = verd.get("verdict")
            t["match_score"] = verd.get("match_score")
            t["advisor_verdict"] = verd
        
        v = t.get("verdict")
        if v == "BID":
            bid_count += 1
        elif v == "REVIEW":
            review_count += 1
        elif v == "NO_BID":
            nobid_count += 1

    # Filter by verdict if requested
    if selected_verdict:
        tenders = [t for t in tenders if t.get("verdict") == selected_verdict]

    # Filter to document-backed only if requested
    show_doc_backed = doc_backed in ("1", "true", "yes")
    if show_doc_backed:
        tenders = [t for t in tenders if t.get("has_document") == 1]

    # In-memory match score sort guarantee
    if sort_by == "match_score":
        tenders.sort(key=lambda x: x.get("match_score") or 0, reverse=True)

    stats = get_tenders_stats(settings.DATABASE_PATH)
    stats["bid_count"] = bid_count
    stats["review_count"] = review_count
    stats["nobid_count"] = nobid_count

    watchlists = get_watchlists(settings.DATABASE_PATH)

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "active_page": "dashboard",
            "tenders": tenders,
            "stats": stats,
            "watchlists": watchlists,
            "profile": profile,
            "recommended": is_recommended,
            "selected_verdict": selected_verdict,
            "search_query": search,
            "selected_portal": portal,
            "selected_urgency": urgency,
            "selected_watchlist": watchlist_id,
            "sort_order": sort_order,
            "doc_backed": show_doc_backed,
            "sort_by": sort_by,
            "is_mock_serpapi": settings.MOCK_SERPAPI,
            "is_mock_llm": settings.MOCK_LLM,
            "message": message,
            "error": error
        }
    )


@app.get("/profile", response_class=HTMLResponse)
async def profile_view(
    request: Request,
    message: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    if profile_dict:
        profile = BidderProfile(**profile_dict)
    else:
        profile = get_default_profile()
        save_bidder_profile(settings.DATABASE_PATH, profile.model_dump())

    return templates.TemplateResponse(
        request=request,
        name="profile.html",
        context={
            "active_page": "profile",
            "profile": profile,
            "message": message,
            "error": error
        }
    )


@app.post("/profile")
async def update_profile_form(
    company_name: str = Form(...),
    categories: str = Form(""),
    min_contract_value: float = Form(0.0),
    max_contract_value: float = Form(100000000.0),
    annual_turnover: float = Form(0.0),
    max_emd_capacity: float = Form(0.0),
    msme_registered: Optional[bool] = Form(False),
    startup_registered: Optional[bool] = Form(False),
    certifications: str = Form(""),
    preferred_states: str = Form("")
):
    settings = get_settings()
    try:
        profile = BidderProfile(
            company_name=company_name,
            categories=categories,
            min_contract_value=min_contract_value,
            max_contract_value=max_contract_value,
            annual_turnover=annual_turnover,
            max_emd_capacity=max_emd_capacity,
            msme_registered=bool(msme_registered),
            startup_registered=bool(startup_registered),
            certifications=certifications,
            preferred_states=preferred_states
        )
        save_bidder_profile(settings.DATABASE_PATH, profile.model_dump())
        return RedirectResponse(
            url="/profile?message=Bidder+profile+saved+successfully.+Advisor+recommendations+updated.",
            status_code=status.HTTP_303_SEE_OTHER
        )
    except Exception as e:
        err_msg = str(e).replace("\n", " ").replace(" ", "+")
        return RedirectResponse(
            url=f"/profile?error={err_msg}",
            status_code=status.HTTP_303_SEE_OTHER
        )


@app.get("/watchlists", response_class=HTMLResponse)
async def watchlists_view(
    request: Request,
    message: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    settings = get_settings()
    watchlists = get_watchlists(settings.DATABASE_PATH)
    return templates.TemplateResponse(
        request=request,
        name="watchlists.html",
        context={
            "active_page": "watchlists",
            "watchlists": watchlists,
            "message": message,
            "error": error
        }
    )


@app.post("/watchlists")
async def create_watchlist_form(
    keyword: str = Form(...),
    category: str = Form("Infrastructure & EPC"),
    min_value: str = Form("Any"),
    state_filter: str = Form("All India")
):
    settings = get_settings()
    clean_kw = keyword.strip()
    
    # Server-side validation
    if not clean_kw:
        return RedirectResponse(
            url="/watchlists?error=Watchlist+keyword+cannot+be+empty.",
            status_code=status.HTTP_303_SEE_OTHER
        )
    if len(clean_kw) < 2:
        return RedirectResponse(
            url="/watchlists?error=Watchlist+keyword+must+have+at+least+2+characters.",
            status_code=status.HTTP_303_SEE_OTHER
        )
    if len(clean_kw) > 100:
        return RedirectResponse(
            url="/watchlists?error=Watchlist+keyword+must+not+exceed+100+characters.",
            status_code=status.HTTP_303_SEE_OTHER
        )

    wl_id = create_watchlist(
        db_path=settings.DATABASE_PATH,
        keyword=clean_kw,
        category=category,
        min_value=min_value,
        state_filter=state_filter
    )
    
    # Immediate scan for the newly created keyword
    scan_manager.scan_watchlist_by_id(wl_id)

    return RedirectResponse(
        url=f"/watchlists?message=Watchlist+'{clean_kw}'+created+and+scanned+successfully.",
        status_code=status.HTTP_303_SEE_OTHER
    )


@app.post("/watchlists/{watchlist_id}/toggle")
async def toggle_watchlist_view(watchlist_id: int):
    settings = get_settings()
    toggle_watchlist_status(settings.DATABASE_PATH, watchlist_id)
    return RedirectResponse(
        url="/watchlists?message=Watchlist+status+updated.",
        status_code=status.HTTP_303_SEE_OTHER
    )


@app.post("/watchlists/{watchlist_id}/delete")
async def delete_watchlist_view(watchlist_id: int):
    settings = get_settings()
    delete_watchlist(settings.DATABASE_PATH, watchlist_id)
    return RedirectResponse(
        url="/watchlists?message=Watchlist+removed.",
        status_code=status.HTTP_303_SEE_OTHER
    )


@app.post("/watchlists/{watchlist_id}/scan")
async def scan_single_watchlist_view(watchlist_id: int):
    res = scan_manager.scan_watchlist_by_id(watchlist_id)
    msg = f"Scan complete for '{res.get('keyword', '')}': {res.get('items_found', 0)} found ({res.get('items_new', 0)} new)."
    return RedirectResponse(
        url=f"/?watchlist_id={watchlist_id}&message={msg}",
        status_code=status.HTTP_303_SEE_OTHER
    )


@app.post("/scan")
async def trigger_scan_view():
    res = scan_manager.run_full_scan()
    msg = res.get("message", "Scan initiated.")
    return RedirectResponse(
        url=f"/?message={msg}",
        status_code=status.HTTP_303_SEE_OTHER
    )


@app.get("/scans", response_class=HTMLResponse)
async def scans_view(request: Request):
    settings = get_settings()
    logs = get_scan_logs(settings.DATABASE_PATH, limit=50)
    cache_count = get_search_cache_count(settings.DATABASE_PATH)
    return templates.TemplateResponse(
        request=request,
        name="scans.html",
        context={
            "active_page": "scans",
            "logs": logs,
            "scan_status": scan_manager.last_scan_info,
            "cache_count": cache_count,
            "is_mock_serpapi": settings.MOCK_SERPAPI
        }
    )


@app.get("/tenders/{tender_id}", response_class=HTMLResponse)
async def tender_detail_view(request: Request, tender_id: int):
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    profile_hash = compute_profile_hash(profile)

    tender = get_tender(settings.DATABASE_PATH, tender_id, profile_hash=profile_hash)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if not tender.get("advisor_verdict"):
        verd = get_or_compute_verdict(tender, profile, settings.DATABASE_PATH)
        tender["verdict"] = verd.get("verdict")
        tender["match_score"] = verd.get("match_score")
        tender["advisor_verdict"] = verd

    return templates.TemplateResponse(
        request=request,
        name="tender_detail.html",
        context={
            "active_page": "dashboard",
            "tender": tender,
            "profile": profile
        }
    )


@app.get("/saved", response_class=HTMLResponse)
async def saved_view(
    request: Request,
    message: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    profile_hash = compute_profile_hash(profile)

    saved_tenders = get_saved_tenders(settings.DATABASE_PATH, profile_hash=profile_hash)
    for t in saved_tenders:
        if not t.get("advisor_verdict"):
            verd = get_or_compute_verdict(t, profile, settings.DATABASE_PATH)
            t["verdict"] = verd.get("verdict")
            t["match_score"] = verd.get("match_score")
            t["advisor_verdict"] = verd

    stats = get_tenders_stats(settings.DATABASE_PATH)

    return templates.TemplateResponse(
        request=request,
        name="saved.html",
        context={
            "active_page": "saved",
            "tenders": saved_tenders,
            "stats": stats,
            "profile": profile,
            "message": message,
            "error": error
        }
    )


@app.post("/tenders/{tender_id}/save")
async def save_tender_form(
    tender_id: int,
    notes: Optional[str] = Form(None),
    redirect_to: Optional[str] = Form(None)
):
    settings = get_settings()
    res = save_tender(settings.DATABASE_PATH, tender_id, notes=notes)
    if not res:
        raise HTTPException(status_code=404, detail="Tender not found")
    target = redirect_to or "/saved?message=Tender+saved+to+your+bookmarks."
    return RedirectResponse(url=target, status_code=status.HTTP_303_SEE_OTHER)


@app.post("/tenders/{tender_id}/unsave")
async def unsave_tender_form(
    tender_id: int,
    redirect_to: Optional[str] = Form(None)
):
    settings = get_settings()
    unsave_tender(settings.DATABASE_PATH, tender_id)
    target = redirect_to or "/saved?message=Tender+removed+from+bookmarks."
    return RedirectResponse(url=target, status_code=status.HTTP_303_SEE_OTHER)


@app.post("/tenders/{tender_id}/notes")
async def update_notes_form(
    tender_id: int,
    notes: str = Form(""),
    redirect_to: Optional[str] = Form("/saved")
):
    settings = get_settings()
    if not is_tender_saved(settings.DATABASE_PATH, tender_id):
        save_tender(settings.DATABASE_PATH, tender_id, notes=notes)
    else:
        update_saved_tender_notes(settings.DATABASE_PATH, tender_id, notes=notes)
    target = f"{redirect_to}?message=Notes+saved+successfully."
    return RedirectResponse(url=target, status_code=status.HTTP_303_SEE_OTHER)


# ==========================================
# CSV Export Route
# ==========================================

@app.get("/export/csv")
async def export_csv(
    search: Optional[str] = Query(None),
    portal: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    watchlist_id: Optional[int] = Query(None),
    sort_order: str = Query("asc")
):
    """Exports tenders to CSV file based on active filters."""
    settings = get_settings()
    sort_by = "newest" if sort_order == "newest" else "deadline"
    order = "desc" if sort_order == "desc" else "asc"

    # Load active bidder profile to join personalized verdicts
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    profile_hash = compute_profile_hash(profile)

    tenders = get_tenders(
        db_path=settings.DATABASE_PATH,
        watchlist_id=watchlist_id,
        portal=portal,
        urgency=urgency,
        search=search,
        sort_by=sort_by,
        sort_order=order,
        limit=1000,
        profile_hash=profile_hash
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    writer.writerow([
        "Tender ID",
        "Title",
        "Portal",
        "Watchlist Keyword",
        "Advisor Verdict",
        "Match Score (%)",
        "Submission Deadline",
        "Urgency Status",
        "EMD Amount",
        "Tender Document Fee",
        "Scope of Work",
        "Eligibility Criteria",
        "Bid Strategy / Takeaways",
        "Canonical URL",
        "Original Portal URL",
        "Discovered Date"
    ])

    for t in tenders:
        writer.writerow([
            t.get("id"),
            t.get("title"),
            t.get("portal_name"),
            t.get("watchlist_keyword") or "General",
            t.get("verdict") or "REVIEW",
            t.get("match_score") if t.get("match_score") is not None else "N/A",
            t.get("deadline_date") or "N/A",
            t.get("urgency_status"),
            t.get("emd_amount") or "N/A",
            t.get("tender_fee") or "Nil",
            t.get("scope_summary"),
            t.get("eligibility"),
            t.get("key_takeaways"),
            t.get("canonical_url"),
            t.get("original_url"),
            t.get("created_at")
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tenderradar_bids_export.csv"}
    )


# ==========================================
# REST API Endpoints (JSON)
# ==========================================

@app.get("/api/profile")
async def api_get_profile():
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    if profile_dict:
        return BidderProfile(**profile_dict)
    default_p = get_default_profile()
    save_bidder_profile(settings.DATABASE_PATH, default_p.model_dump())
    return default_p


@app.post("/api/profile")
@app.put("/api/profile")
async def api_update_profile(profile: BidderProfile):
    settings = get_settings()
    saved = save_bidder_profile(settings.DATABASE_PATH, profile.model_dump())
    return BidderProfile(**saved)


@app.get("/api/watchlists")
async def api_list_watchlists():
    settings = get_settings()
    return get_watchlists(settings.DATABASE_PATH)


@app.post("/api/watchlists", status_code=status.HTTP_201_CREATED)
async def api_create_watchlist(data: WatchlistCreate):
    settings = get_settings()
    wl_id = create_watchlist(
        db_path=settings.DATABASE_PATH,
        keyword=data.keyword,
        category=data.category or "General",
        min_value=data.min_value or "Any",
        state_filter=data.state_filter or "All India"
    )
    # Trigger background scan
    scan_manager.scan_watchlist_by_id(wl_id)
    return get_watchlist(settings.DATABASE_PATH, wl_id)


@app.get("/api/watchlists/{watchlist_id}")
async def api_get_watchlist(watchlist_id: int):
    settings = get_settings()
    wl = get_watchlist(settings.DATABASE_PATH, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return wl


@app.put("/api/watchlists/{watchlist_id}")
async def api_update_watchlist(watchlist_id: int, data: WatchlistUpdate):
    settings = get_settings()
    ok = update_watchlist(
        db_path=settings.DATABASE_PATH,
        watchlist_id=watchlist_id,
        category=data.category,
        min_value=data.min_value,
        state_filter=data.state_filter,
        is_active=data.is_active
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Watchlist not found or no changes made")
    return get_watchlist(settings.DATABASE_PATH, watchlist_id)


@app.delete("/api/watchlists/{watchlist_id}")
async def api_delete_watchlist(watchlist_id: int):
    settings = get_settings()
    ok = delete_watchlist(settings.DATABASE_PATH, watchlist_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return {"status": "success", "message": f"Watchlist #{watchlist_id} deleted"}


@app.get("/api/tenders")
async def api_list_tenders(
    watchlist_id: Optional[int] = None,
    portal: Optional[str] = None,
    urgency: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "deadline",
    sort_order: str = "asc",
    recommended: bool = Query(False),
    limit: int = 100,
    offset: int = 0
):
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    p_hash = compute_profile_hash(profile)

    tenders = get_tenders(
        db_path=settings.DATABASE_PATH,
        watchlist_id=watchlist_id,
        portal=portal,
        urgency=urgency,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
        profile_hash=p_hash,
        recommended_only=recommended
    )
    for t in tenders:
        if not t.get("advisor_verdict"):
            verd = get_or_compute_verdict(t, profile, settings.DATABASE_PATH)
            t["verdict"] = verd.get("verdict")
            t["match_score"] = verd.get("match_score")
            t["advisor_verdict"] = verd

    if recommended:
        tenders = [t for t in tenders if t.get("verdict") == "BID"]
    return tenders


@app.get("/api/tenders/{tender_id}")
async def api_get_tender(tender_id: int):
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    p_hash = compute_profile_hash(profile)
    t = get_tender(settings.DATABASE_PATH, tender_id, profile_hash=p_hash)
    if not t:
        raise HTTPException(status_code=404, detail="Tender not found")
    if not t.get("advisor_verdict"):
        verd = get_or_compute_verdict(t, profile, settings.DATABASE_PATH)
        t["verdict"] = verd.get("verdict")
        t["match_score"] = verd.get("match_score")
        t["advisor_verdict"] = verd
    return t


@app.post("/api/tenders/{tender_id}/deep-dive")
async def api_deep_dive(tender_id: int):
    """AI agent: fetch tender page + deep analysis with must-care points."""
    settings = get_settings()
    tender = get_tender(settings.DATABASE_PATH, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    result = deep_dive_analysis(
        title=tender.get("title", ""),
        snippet=tender.get("snippet", ""),
        portal_name=tender.get("portal_name", ""),
        page_url=tender.get("original_url") or tender.get("canonical_url") or "",
        scope=tender.get("scope_summary", ""),
    )
    return {"tender_id": tender_id, "deep_dive": result}


@app.post("/api/tenders/{tender_id}/chat")
async def api_tender_chat(tender_id: int, payload: dict):
    """Chat with AI scoped to one tender."""
    settings = get_settings()
    tender = get_tender(settings.DATABASE_PATH, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    reply = tender_chat(
        title=tender.get("title", ""),
        snippet=tender.get("snippet", ""),
        portal_name=tender.get("portal_name", ""),
        scope=tender.get("scope_summary", ""),
        history=payload.get("history", []),
        user_message=payload.get("message", ""),
        page_url=tender.get("original_url") or tender.get("canonical_url") or "",
    )
    return {"reply": reply}


@app.get("/api/tenders/{tender_id}/verify")
async def api_verify_tender(tender_id: int):
    """Verify tender URL, find PDFs/documents (ground truth check)."""
    settings = get_settings()
    tender = get_tender(settings.DATABASE_PATH, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    url = tender.get("original_url") or tender.get("canonical_url") or ""
    return {"tender_id": tender_id, "verification": verify_tender(url)}


@app.get("/auto-bid", response_class=HTMLResponse)
async def autobid_page(request: Request):
    """Coming soon page for Auto-Bid Agent."""
    return templates.TemplateResponse(
        request=request, name="autobid.html",
        context={"active_page": "dashboard"},
    )


@app.get("/api/tenders/{tender_id}/verdict")
async def api_get_tender_verdict_route(tender_id: int):
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    tender = get_tender(settings.DATABASE_PATH, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return get_or_compute_verdict(tender, profile, settings.DATABASE_PATH)


@app.post("/api/tenders/{tender_id}/save")
async def api_save_tender(
    tender_id: int,
    payload: Optional[SavedTenderSaveRequest] = None,
    notes: Optional[str] = Query(None)
):
    settings = get_settings()
    note_text = payload.notes if payload and payload.notes is not None else notes
    res = save_tender(settings.DATABASE_PATH, tender_id, notes=note_text)
    if not res:
        raise HTTPException(status_code=404, detail="Tender not found")
    return {
        "status": "success",
        "saved": True,
        "tender_id": tender_id,
        "notes": res.get("notes", ""),
        "saved_at": res.get("saved_at", "")
    }


@app.delete("/api/tenders/{tender_id}/save")
async def api_unsave_tender(tender_id: int):
    settings = get_settings()
    tender = get_tender(settings.DATABASE_PATH, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    unsave_tender(settings.DATABASE_PATH, tender_id)
    return {
        "status": "success",
        "saved": False,
        "tender_id": tender_id
    }


@app.get("/api/saved")
async def api_get_saved_tenders():
    settings = get_settings()
    profile_dict = get_bidder_profile(settings.DATABASE_PATH)
    profile = BidderProfile(**profile_dict) if profile_dict else get_default_profile()
    p_hash = compute_profile_hash(profile)

    saved = get_saved_tenders(settings.DATABASE_PATH, profile_hash=p_hash)
    for t in saved:
        if not t.get("advisor_verdict"):
            verd = get_or_compute_verdict(t, profile, settings.DATABASE_PATH)
            t["verdict"] = verd.get("verdict")
            t["match_score"] = verd.get("match_score")
            t["advisor_verdict"] = verd
    return saved


@app.patch("/api/tenders/{tender_id}/notes")
@app.put("/api/tenders/{tender_id}/notes")
async def api_update_saved_notes(tender_id: int, payload: SavedTenderSaveRequest):
    settings = get_settings()
    if not is_tender_saved(settings.DATABASE_PATH, tender_id):
        raise HTTPException(status_code=404, detail="Saved tender not found")
    update_saved_tender_notes(settings.DATABASE_PATH, tender_id, payload.notes or "")
    return {
        "status": "success",
        "tender_id": tender_id,
        "notes": payload.notes or ""
    }



@app.post("/api/scan")
async def api_trigger_scan(payload: Optional[Dict[str, Any]] = None):
    watchlist_id = payload.get("watchlist_id") if payload else None
    if watchlist_id:
        return scan_manager.scan_watchlist_by_id(int(watchlist_id))
    return scan_manager.run_full_scan()


@app.get("/api/scan/status")
async def api_scan_status():
    return scan_manager.last_scan_info


@app.get("/api/stats")
async def api_stats():
    settings = get_settings()
    return get_tenders_stats(settings.DATABASE_PATH)
