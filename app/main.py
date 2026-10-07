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
    get_scan_logs
)
from app.models import (
    WatchlistCreate,
    WatchlistUpdate,
    Tender,
    StatsOverview
)
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


# ==========================================
# Web UI Routes (Server-Rendered Jinja2)
# ==========================================

@app.get("/", response_class=HTMLResponse)
async def dashboard_view(
    request: Request,
    search: Optional[str] = Query(None),
    portal: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    watchlist_id: Optional[int] = Query(None),
    sort_order: str = Query("asc"),
    message: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    settings = get_settings()
    sort_by = "newest" if sort_order == "newest" else "deadline"
    order = "desc" if sort_order == "desc" else "asc"

    tenders = get_tenders(
        db_path=settings.DATABASE_PATH,
        watchlist_id=watchlist_id,
        portal=portal,
        urgency=urgency,
        search=search,
        sort_by=sort_by,
        sort_order=order,
        limit=100
    )
    stats = get_tenders_stats(settings.DATABASE_PATH)
    watchlists = get_watchlists(settings.DATABASE_PATH)

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "active_page": "dashboard",
            "tenders": tenders,
            "stats": stats,
            "watchlists": watchlists,
            "search_query": search,
            "selected_portal": portal,
            "selected_urgency": urgency,
            "selected_watchlist": watchlist_id,
            "sort_order": sort_order,
            "sort_by": sort_by,
            "message": message,
            "error": error
        }
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
    return templates.TemplateResponse(
        request=request,
        name="scans.html",
        context={
            "active_page": "scans",
            "logs": logs,
            "scan_status": scan_manager.last_scan_info
        }
    )


@app.get("/tenders/{tender_id}", response_class=HTMLResponse)
async def tender_detail_view(request: Request, tender_id: int):
    settings = get_settings()
    tender = get_tender(settings.DATABASE_PATH, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    return templates.TemplateResponse(
        request=request,
        name="tender_detail.html",
        context={
            "active_page": "dashboard",
            "tender": tender
        }
    )


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

    tenders = get_tenders(
        db_path=settings.DATABASE_PATH,
        watchlist_id=watchlist_id,
        portal=portal,
        urgency=urgency,
        search=search,
        sort_by=sort_by,
        sort_order=order,
        limit=1000
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    writer.writerow([
        "Tender ID",
        "Title",
        "Portal",
        "Watchlist Keyword",
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
    limit: int = 100,
    offset: int = 0
):
    settings = get_settings()
    return get_tenders(
        db_path=settings.DATABASE_PATH,
        watchlist_id=watchlist_id,
        portal=portal,
        urgency=urgency,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset
    )


@app.get("/api/tenders/{tender_id}")
async def api_get_tender(tender_id: int):
    settings = get_settings()
    t = get_tender(settings.DATABASE_PATH, tender_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tender not found")
    return t


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
