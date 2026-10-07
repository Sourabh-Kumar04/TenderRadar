"""SQLite Database Layer for TenderRadar.

Provides persistent storage for watchlists, deduplicated tenders,
structured LLM summaries, query cache to conserve SerpApi credits,
and audit scan logs.
"""

import sqlite3
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from app.models import compute_urgency


def get_db_connection(db_path: str) -> sqlite3.Connection:
    """Creates a connection to SQLite database with WAL mode and row factory."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db(db_path: str) -> None:
    """Initializes tables and indices."""
    with get_db_connection(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS watchlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'General',
                min_value TEXT NOT NULL DEFAULT 'Any',
                state_filter TEXT NOT NULL DEFAULT 'All India',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_scanned_at TEXT
            );

            CREATE TABLE IF NOT EXISTS tenders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                canonical_url TEXT NOT NULL UNIQUE,
                original_url TEXT NOT NULL,
                portal_name TEXT NOT NULL,
                snippet TEXT,
                published_date TEXT,
                deadline_date TEXT,
                emd_amount TEXT DEFAULT 'Not Specified',
                tender_fee TEXT DEFAULT 'Nil',
                eligibility TEXT,
                scope_summary TEXT,
                key_takeaways TEXT,
                urgency_status TEXT,
                raw_serp_data TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS search_cache (
                query_hash TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                results_json TEXT NOT NULL,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scan_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE SET NULL,
                status TEXT NOT NULL,
                items_found INTEGER NOT NULL DEFAULT 0,
                items_new INTEGER NOT NULL DEFAULT 0,
                message TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bidder_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                company_name TEXT NOT NULL,
                categories_json TEXT NOT NULL,
                min_contract_value REAL NOT NULL,
                max_contract_value REAL NOT NULL,
                annual_turnover REAL NOT NULL,
                max_emd_capacity REAL NOT NULL,
                msme_registered INTEGER NOT NULL DEFAULT 0,
                startup_registered INTEGER NOT NULL DEFAULT 0,
                certifications_json TEXT NOT NULL,
                preferred_states_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tender_verdicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
                profile_hash TEXT NOT NULL,
                verdict TEXT NOT NULL,
                match_score INTEGER NOT NULL,
                key_details_json TEXT NOT NULL,
                reasons_json TEXT NOT NULL,
                flags_json TEXT NOT NULL,
                tender_updated_at TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(tender_id, profile_hash)
            );

            CREATE INDEX IF NOT EXISTS idx_tenders_canonical ON tenders(canonical_url);
            CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON tenders(deadline_date);
            CREATE INDEX IF NOT EXISTS idx_tenders_watchlist ON tenders(watchlist_id);
            CREATE INDEX IF NOT EXISTS idx_watchlists_active ON watchlists(is_active);
            CREATE INDEX IF NOT EXISTS idx_scan_logs_created ON scan_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_verdicts_lookup ON tender_verdicts(tender_id, profile_hash);
        """)
        conn.commit()


# ==========================================
# Watchlist Operations
# ==========================================

def create_watchlist(db_path: str, keyword: str, category: str = "General", min_value: str = "Any", state_filter: str = "All India") -> int:
    now = datetime.now().isoformat()
    with get_db_connection(db_path) as conn:
        cursor = conn.execute(
            """INSERT INTO watchlists (keyword, category, min_value, state_filter, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, 1, ?, ?)""",
            (keyword.strip(), category.strip(), min_value.strip(), state_filter.strip(), now, now)
        )
        conn.commit()
        return cursor.lastrowid


def get_watchlists(db_path: str, active_only: bool = False) -> List[Dict[str, Any]]:
    query = """
        SELECT w.*, COUNT(t.id) AS tender_count
        FROM watchlists w
        LEFT JOIN tenders t ON w.id = t.watchlist_id
    """
    params: List[Any] = []
    if active_only:
        query += " WHERE w.is_active = 1"
    query += " GROUP BY w.id ORDER BY w.created_at DESC"
    
    with get_db_connection(db_path) as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def get_watchlist(db_path: str, watchlist_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM watchlists WHERE id = ?", (watchlist_id,)).fetchone()
        return dict(row) if row else None


def update_watchlist(db_path: str, watchlist_id: int, category: Optional[str] = None, min_value: Optional[str] = None, state_filter: Optional[str] = None, is_active: Optional[bool] = None) -> bool:
    fields = []
    values = []
    if category is not None:
        fields.append("category = ?")
        values.append(category)
    if min_value is not None:
        fields.append("min_value = ?")
        values.append(min_value)
    if state_filter is not None:
        fields.append("state_filter = ?")
        values.append(state_filter)
    if is_active is not None:
        fields.append("is_active = ?")
        values.append(1 if is_active else 0)
        
    if not fields:
        return False
        
    fields.append("updated_at = ?")
    values.append(datetime.now().isoformat())
    values.append(watchlist_id)
    
    with get_db_connection(db_path) as conn:
        cursor = conn.execute(f"UPDATE watchlists SET {', '.join(fields)} WHERE id = ?", tuple(values))
        conn.commit()
        return cursor.rowcount > 0


def toggle_watchlist_status(db_path: str, watchlist_id: int) -> bool:
    with get_db_connection(db_path) as conn:
        row = conn.execute("SELECT is_active FROM watchlists WHERE id = ?", (watchlist_id,)).fetchone()
        if not row:
            return False
        new_status = 0 if row["is_active"] else 1
        now = datetime.now().isoformat()
        conn.execute("UPDATE watchlists SET is_active = ?, updated_at = ? WHERE id = ?", (new_status, now, watchlist_id))
        conn.commit()
        return True


def delete_watchlist(db_path: str, watchlist_id: int) -> bool:
    with get_db_connection(db_path) as conn:
        cursor = conn.execute("DELETE FROM watchlists WHERE id = ?", (watchlist_id,))
        conn.commit()
        return cursor.rowcount > 0


def touch_watchlist_scanned(db_path: str, watchlist_id: int) -> None:
    now = datetime.now().isoformat()
    with get_db_connection(db_path) as conn:
        conn.execute("UPDATE watchlists SET last_scanned_at = ?, updated_at = ? WHERE id = ?", (now, now, watchlist_id))
        conn.commit()


def seed_default_watchlists_if_empty(db_path: str) -> None:
    """Pre-populates sample Indian procurement watchlists on first launch."""
    with get_db_connection(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM watchlists").fetchone()[0]
        if count == 0:
            defaults = [
                ("Solar Rooftop EPC", "Renewable Energy", "₹50 Lakh+", "All India"),
                ("Highway Road Construction", "Civil & Infrastructure", "₹5 Crore+", "National Highways"),
                ("Hospital Medical Equipment Supply", "Healthcare & Medical", "₹20 Lakh+", "Central & State Health"),
                ("Smart City CCTV Surveillance", "IT & Electronics", "₹1 Crore+", "Smart Cities Mission"),
                ("Cloud Migration IT Infrastructure", "Information Technology", "₹25 Lakh+", "NIC / Digital India"),
            ]
            now = datetime.now().isoformat()
            for kw, cat, min_v, st in defaults:
                conn.execute(
                    """INSERT INTO watchlists (keyword, category, min_value, state_filter, is_active, created_at, updated_at)
                       VALUES (?, ?, ?, ?, 1, ?, ?)""",
                    (kw, cat, min_v, st, now, now)
                )
            conn.commit()


# ==========================================
# Tender Operations & Deduplication
# ==========================================

def tender_exists(db_path: str, canonical_url: str) -> bool:
    """Checks whether a tender with this canonical URL is already indexed."""
    with get_db_connection(db_path) as conn:
        row = conn.execute("SELECT id FROM tenders WHERE canonical_url = ?", (canonical_url,)).fetchone()
        return row is not None


def insert_tender(db_path: str, tender_data: Dict[str, Any]) -> Optional[int]:
    """Inserts a new tender, ignoring if duplicate canonical_url."""
    now = datetime.now().isoformat()
    # Compute urgency dynamically
    urgency = tender_data.get("urgency_status")
    if not urgency or urgency == "Flexible / Open":
        urgency = compute_urgency(tender_data.get("deadline_date")).value

    with get_db_connection(db_path) as conn:
        try:
            cursor = conn.execute(
                """INSERT INTO tenders (
                    watchlist_id, title, canonical_url, original_url, portal_name,
                    snippet, published_date, deadline_date, emd_amount, tender_fee,
                    eligibility, scope_summary, key_takeaways, urgency_status,
                    raw_serp_data, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    tender_data.get("watchlist_id"),
                    tender_data.get("title", "Untitled Tender"),
                    tender_data.get("canonical_url"),
                    tender_data.get("original_url"),
                    tender_data.get("portal_name", "Government Portal"),
                    tender_data.get("snippet", ""),
                    tender_data.get("published_date"),
                    tender_data.get("deadline_date"),
                    tender_data.get("emd_amount", "Not Specified"),
                    tender_data.get("tender_fee", "Nil"),
                    tender_data.get("eligibility", ""),
                    tender_data.get("scope_summary", ""),
                    tender_data.get("key_takeaways", ""),
                    urgency,
                    tender_data.get("raw_serp_data", ""),
                    now,
                    now
                )
            )
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            # Canonical URL already exists (deduplicated!)
            return None


def get_tender(db_path: str, tender_id: int, profile_hash: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        if profile_hash:
            query = """
                SELECT t.*, w.keyword AS watchlist_keyword, w.category AS watchlist_category,
                       tv.verdict, tv.match_score, tv.key_details_json, tv.reasons_json, tv.flags_json,
                       tv.tender_updated_at AS verdict_tender_updated_at
                FROM tenders t
                LEFT JOIN watchlists w ON t.watchlist_id = w.id
                LEFT JOIN tender_verdicts tv ON t.id = tv.tender_id AND tv.profile_hash = ?
                WHERE t.id = ?
            """
            row = conn.execute(query, (profile_hash, tender_id)).fetchone()
        else:
            query = """
                SELECT t.*, w.keyword AS watchlist_keyword, w.category AS watchlist_category
                FROM tenders t
                LEFT JOIN watchlists w ON t.watchlist_id = w.id
                WHERE t.id = ?
            """
            row = conn.execute(query, (tender_id,)).fetchone()

        if not row:
            return None
        d = dict(row)
        if profile_hash and d.get("verdict"):
            try:
                d["advisor_verdict"] = {
                    "verdict": d["verdict"],
                    "match_score": d["match_score"],
                    "key_details": json.loads(d.get("key_details_json") or "{}"),
                    "reasons": json.loads(d.get("reasons_json") or "[]"),
                    "flags": json.loads(d.get("flags_json") or "[]")
                }
            except Exception:
                d["advisor_verdict"] = None
        return d


def get_tenders(
    db_path: str,
    watchlist_id: Optional[int] = None,
    portal: Optional[str] = None,
    urgency: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "deadline",
    sort_order: str = "asc",
    limit: int = 100,
    offset: int = 0,
    profile_hash: Optional[str] = None,
    recommended_only: bool = False
) -> List[Dict[str, Any]]:
    """Fetches tenders with flexible filtering, deadline sorting, and optional advisor verdicts."""
    conditions = []
    params: List[Any] = []

    if profile_hash:
        params.append(profile_hash)

    if watchlist_id is not None:
        conditions.append("t.watchlist_id = ?")
        params.append(watchlist_id)

    if portal:
        conditions.append("t.portal_name LIKE ?")
        params.append(f"%{portal}%")

    if urgency:
        conditions.append("t.urgency_status = ?")
        params.append(urgency)

    if search:
        conditions.append("(t.title LIKE ? OR t.scope_summary LIKE ? OR t.eligibility LIKE ? OR w.keyword LIKE ?)")
        term = f"%{search}%"
        params.extend([term, term, term, term])

    if recommended_only and profile_hash:
        conditions.append("tv.verdict = 'BID'")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Sort order
    order_clause = ""
    if sort_by == "deadline":
        # Keep non-null deadlines first in asc order, nulls at the end
        if sort_order.lower() == "desc":
            order_clause = "ORDER BY CASE WHEN t.deadline_date IS NULL OR t.deadline_date = '' THEN 1 ELSE 0 END, t.deadline_date DESC, t.id DESC"
        else:
            order_clause = "ORDER BY CASE WHEN t.deadline_date IS NULL OR t.deadline_date = '' THEN 1 ELSE 0 END, t.deadline_date ASC, t.id DESC"
    elif sort_by == "newest":
        order_clause = "ORDER BY t.created_at DESC"
    elif sort_by == "match_score" and profile_hash:
        order_clause = "ORDER BY CASE WHEN tv.match_score IS NULL THEN 1 ELSE 0 END, tv.match_score DESC, t.id DESC"
    elif sort_by == "urgency":
        order_clause = """ORDER BY CASE t.urgency_status
            WHEN 'Urgent (<3d)' THEN 1
            WHEN 'Closing Soon (<7d)' THEN 2
            WHEN 'Active (>7d)' THEN 3
            WHEN 'Flexible / Open' THEN 4
            WHEN 'Expired' THEN 5
            ELSE 6 END"""
    else:
        order_clause = "ORDER BY t.id DESC"

    if profile_hash:
        select_fields = """
            t.*, w.keyword AS watchlist_keyword, w.category AS watchlist_category,
            tv.verdict, tv.match_score, tv.key_details_json, tv.reasons_json, tv.flags_json,
            tv.tender_updated_at AS verdict_tender_updated_at
        """
        join_clause = """
            LEFT JOIN watchlists w ON t.watchlist_id = w.id
            LEFT JOIN tender_verdicts tv ON t.id = tv.tender_id AND tv.profile_hash = ?
        """
    else:
        select_fields = "t.*, w.keyword AS watchlist_keyword, w.category AS watchlist_category"
        join_clause = "LEFT JOIN watchlists w ON t.watchlist_id = w.id"

    query = f"""
        SELECT {select_fields}
        FROM tenders t
        {join_clause}
        {where_clause}
        {order_clause}
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])

    with get_db_connection(db_path) as conn:
        rows = conn.execute(query, params).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            # Recompute urgency in real-time in case time progressed
            d["urgency_status"] = compute_urgency(d.get("deadline_date")).value
            if profile_hash and d.get("verdict"):
                try:
                    d["advisor_verdict"] = {
                        "verdict": d["verdict"],
                        "match_score": d["match_score"],
                        "key_details": json.loads(d.get("key_details_json") or "{}"),
                        "reasons": json.loads(d.get("reasons_json") or "[]"),
                        "flags": json.loads(d.get("flags_json") or "[]")
                    }
                except Exception:
                    d["advisor_verdict"] = None
            results.append(d)
        return results


def get_tenders_stats(db_path: str) -> Dict[str, Any]:
    """Provides high-level dashboard metrics."""
    with get_db_connection(db_path) as conn:
        total_tenders = conn.execute("SELECT COUNT(*) FROM tenders").fetchone()[0]
        active_watchlists = conn.execute("SELECT COUNT(*) FROM watchlists WHERE is_active = 1").fetchone()[0]
        total_scans = conn.execute("SELECT COUNT(*) FROM scan_logs").fetchone()[0]

        # Count urgent & closing soon
        tenders = conn.execute("SELECT deadline_date FROM tenders").fetchall()
        urgent_count = 0
        for t in tenders:
            st = compute_urgency(t["deadline_date"])
            if st.value in ("Urgent (<3d)", "Closing Soon (<7d)"):
                urgent_count += 1

        portal_rows = conn.execute("""
            SELECT portal_name, COUNT(*) as cnt
            FROM tenders
            GROUP BY portal_name
            ORDER BY cnt DESC
            LIMIT 5
        """).fetchall()
        top_portals = {row["portal_name"]: row["cnt"] for row in portal_rows}

        return {
            "total_tenders": total_tenders,
            "active_watchlists": active_watchlists,
            "urgent_closing_soon": urgent_count,
            "total_scans": total_scans,
            "top_portals": top_portals
        }


# ==========================================
# Search Cache (SerpApi Credit Optimization)
# ==========================================

def get_cached_search(db_path: str, query_hash: str, max_age_hours: int = 24) -> Optional[List[Dict[str, Any]]]:
    """Returns cached SerpApi results if not expired."""
    min_time = time.time() - (max_age_hours * 3600)
    with get_db_connection(db_path) as conn:
        row = conn.execute(
            "SELECT results_json FROM search_cache WHERE query_hash = ? AND created_at >= ?",
            (query_hash, min_time)
        ).fetchone()
        if row:
            try:
                return json.loads(row["results_json"])
            except json.JSONDecodeError:
                return None
    return None


def set_cached_search(db_path: str, query_hash: str, query: str, results: List[Dict[str, Any]]) -> None:
    now = time.time()
    with get_db_connection(db_path) as conn:
        conn.execute(
            """INSERT INTO search_cache (query_hash, query, results_json, created_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(query_hash) DO UPDATE SET results_json = excluded.results_json, created_at = excluded.created_at""",
            (query_hash, query, json.dumps(results), now)
        )
        conn.commit()


# ==========================================
# Audit & Scan Logging
# ==========================================

def log_scan(db_path: str, watchlist_id: Optional[int], status: str, items_found: int, items_new: int, message: str) -> int:
    now = datetime.now().isoformat()
    with get_db_connection(db_path) as conn:
        cursor = conn.execute(
            """INSERT INTO scan_logs (watchlist_id, status, items_found, items_new, message, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (watchlist_id, status, items_found, items_new, message, now)
        )
        conn.commit()
        return cursor.lastrowid


def get_scan_logs(db_path: str, limit: int = 50) -> List[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        rows = conn.execute(
            """SELECT s.*, w.keyword AS watchlist_keyword
               FROM scan_logs s
               LEFT JOIN watchlists w ON s.watchlist_id = w.id
               ORDER BY s.id DESC
               LIMIT ?""",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


# ==========================================
# Bidder Profile & Tender Verdicts Storage
# ==========================================

def get_bidder_profile(db_path: str) -> Optional[Dict[str, Any]]:
    """Retrieves the single active bidder profile."""
    try:
        with get_db_connection(db_path) as conn:
            row = conn.execute("SELECT * FROM bidder_profile WHERE id = 1").fetchone()
    except sqlite3.OperationalError:
        init_db(db_path)
        with get_db_connection(db_path) as conn:
            row = conn.execute("SELECT * FROM bidder_profile WHERE id = 1").fetchone()

    if not row:
        return None
    d = dict(row)
    try:
        d["categories"] = json.loads(d.pop("categories_json", "[]"))
    except Exception:
        d["categories"] = []
    try:
        d["certifications"] = json.loads(d.pop("certifications_json", "[]"))
    except Exception:
        d["certifications"] = []
    try:
        d["preferred_states"] = json.loads(d.pop("preferred_states_json", "[]"))
    except Exception:
        d["preferred_states"] = []
    d["msme_registered"] = bool(d["msme_registered"])
    d["startup_registered"] = bool(d["startup_registered"])
    return d


def save_bidder_profile(db_path: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """Upserts the single active bidder profile."""
    now = datetime.now().isoformat()
    cats = profile_data.get("categories", [])
    if isinstance(cats, str):
        cats = [c.strip() for c in cats.split(",") if c.strip()]
    certs = profile_data.get("certifications", [])
    if isinstance(certs, str):
        certs = [c.strip() for c in certs.split(",") if c.strip()]
    states = profile_data.get("preferred_states", [])
    if isinstance(states, str):
        states = [s.strip() for s in states.split(",") if s.strip()]

    categories_json = json.dumps(cats)
    certifications_json = json.dumps(certs)
    preferred_states_json = json.dumps(states)
    msme = 1 if profile_data.get("msme_registered") else 0
    startup = 1 if profile_data.get("startup_registered") else 0

    def _execute_save():
        with get_db_connection(db_path) as conn:
            conn.execute(
                """INSERT INTO bidder_profile (
                    id, company_name, categories_json, min_contract_value, max_contract_value,
                    annual_turnover, max_emd_capacity, msme_registered, startup_registered,
                    certifications_json, preferred_states_json, updated_at
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    company_name = excluded.company_name,
                    categories_json = excluded.categories_json,
                    min_contract_value = excluded.min_contract_value,
                    max_contract_value = excluded.max_contract_value,
                    annual_turnover = excluded.annual_turnover,
                    max_emd_capacity = excluded.max_emd_capacity,
                    msme_registered = excluded.msme_registered,
                    startup_registered = excluded.startup_registered,
                    certifications_json = excluded.certifications_json,
                    preferred_states_json = excluded.preferred_states_json,
                    updated_at = excluded.updated_at""",
                (
                    str(profile_data.get("company_name", "")).strip(),
                    categories_json,
                    float(profile_data.get("min_contract_value", 0.0)),
                    float(profile_data.get("max_contract_value", 0.0)),
                    float(profile_data.get("annual_turnover", 0.0)),
                    float(profile_data.get("max_emd_capacity", 0.0)),
                    msme,
                    startup,
                    certifications_json,
                    preferred_states_json,
                    now
                )
            )
            conn.commit()

    try:
        _execute_save()
    except sqlite3.OperationalError:
        init_db(db_path)
        _execute_save()

    return get_bidder_profile(db_path) or {}


def get_tender_verdict(db_path: str, tender_id: int, profile_hash: str) -> Optional[Dict[str, Any]]:
    """Fetches cached verdict for a specific tender and profile hash."""
    try:
        with get_db_connection(db_path) as conn:
            row = conn.execute(
                """SELECT * FROM tender_verdicts
                   WHERE tender_id = ? AND profile_hash = ?""",
                (tender_id, profile_hash)
            ).fetchone()
    except sqlite3.OperationalError:
        init_db(db_path)
        with get_db_connection(db_path) as conn:
            row = conn.execute(
                """SELECT * FROM tender_verdicts
                   WHERE tender_id = ? AND profile_hash = ?""",
                (tender_id, profile_hash)
            ).fetchone()

    if not row:
        return None
    d = dict(row)
    try:
        d["key_details"] = json.loads(d.get("key_details_json") or "{}")
    except Exception:
        d["key_details"] = {}
    try:
        d["reasons"] = json.loads(d.get("reasons_json") or "[]")
    except Exception:
        d["reasons"] = []
    try:
        d["flags"] = json.loads(d.get("flags_json") or "[]")
    except Exception:
        d["flags"] = []
    return d


def save_tender_verdict(
    db_path: str,
    tender_id: int,
    profile_hash: str,
    verdict_data: Dict[str, Any],
    tender_updated_at: Optional[str] = None
) -> None:
    """Caches or updates a tender verdict for a given profile hash."""
    now = datetime.now().isoformat()
    key_details_json = json.dumps(verdict_data.get("key_details", {}))
    reasons_json = json.dumps(verdict_data.get("reasons", []))
    flags_json = json.dumps(verdict_data.get("flags", []))

    with get_db_connection(db_path) as conn:
        conn.execute(
            """INSERT INTO tender_verdicts (
                tender_id, profile_hash, verdict, match_score,
                key_details_json, reasons_json, flags_json,
                tender_updated_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tender_id, profile_hash) DO UPDATE SET
                verdict = excluded.verdict,
                match_score = excluded.match_score,
                key_details_json = excluded.key_details_json,
                reasons_json = excluded.reasons_json,
                flags_json = excluded.flags_json,
                tender_updated_at = excluded.tender_updated_at,
                created_at = excluded.created_at""",
            (
                tender_id,
                profile_hash,
                verdict_data.get("verdict", "REVIEW"),
                int(verdict_data.get("match_score", 50)),
                key_details_json,
                reasons_json,
                flags_json,
                tender_updated_at,
                now
            )
        )
        conn.commit()


def delete_tender_verdicts(db_path: str, profile_hash: Optional[str] = None) -> int:
    """Clears cached verdicts, optionally restricted to a specific profile hash."""
    with get_db_connection(db_path) as conn:
        if profile_hash:
            cursor = conn.execute("DELETE FROM tender_verdicts WHERE profile_hash = ?", (profile_hash,))
        else:
            cursor = conn.execute("DELETE FROM tender_verdicts")
        conn.commit()
        return cursor.rowcount

