"""Find and extract real tender documents via SerpApi PDF search."""

import re
import io
import logging
import requests
from typing import Optional

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

from app.config import get_settings
from app.serpapi_client import SerpApiClient

logger = logging.getLogger(__name__)
_doc_cache = {}

def find_tender_pdf(title: str, portal_name: str = "") -> Optional[str]:
    """Search SerpApi for the tender's PDF document. Returns PDF URL or None."""
    settings = get_settings()
    try:
        client = SerpApiClient()
        # Search for PDF version of this tender
        query = f'"{title[:60]}" filetype:pdf'
        results = client.search_tenders(query)
        for r in results:
            url = r.get("link", "")
            if url.lower().endswith(".pdf"):
                return url
        return None
    except Exception as e:
        logger.warning(f"PDF search failed: {e}")
        return None

def extract_pdf_text(pdf_url: str, max_chars: int = 12000) -> str:
    """Download PDF and extract text."""
    if pdf_url in _doc_cache:
        return _doc_cache[pdf_url]
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; TenderRadar/1.0)"}
        r = requests.get(pdf_url, headers=headers, timeout=20)
        if r.status_code != 200:
            return ""
        if PdfReader is None:
            logger.warning("pypdf is not available for PDF extraction.")
            return ""
        reader = PdfReader(io.BytesIO(r.content))
        text = ""
        for page in reader.pages[:10]:  # First 10 pages
            text += page.extract_text() or ""
            if len(text) > max_chars:
                break
        text = re.sub(r'\s+', ' ', text)[:max_chars]
        _doc_cache[pdf_url] = text
        return text
    except Exception as e:
        logger.warning(f"PDF extract failed: {e}")
        return ""

def get_tender_document(title: str, portal_name: str = "") -> dict:
    """Find + extract tender document. Returns {pdf_url, text, found}."""
    pdf_url = find_tender_pdf(title, portal_name)
    if not pdf_url:
        return {"found": False, "pdf_url": None, "text": ""}
    text = extract_pdf_text(pdf_url)
    return {
        "found": bool(text and len(text) > 500),
        "pdf_url": pdf_url,
        "text": text,
    }
