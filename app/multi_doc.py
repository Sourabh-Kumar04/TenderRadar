"""Multi-source tender document retriever - tries everything for max hit rate."""

import re
import io
import logging
import requests
from typing import Optional, Dict
from urllib.parse import quote

logger = logging.getLogger(__name__)
_cache = {}

SOURCES_TRIED = []

def _fetch(url: str, timeout: int = 15) -> str:
    try:
        h = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        r = requests.get(url, headers=h, timeout=timeout)
        return r.text if r.status_code == 200 else ""
    except:
        return ""

def _extract_pdf_text(pdf_url: str) -> str:
    try:
        from pypdf import PdfReader
        h = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(pdf_url, headers=h, timeout=20)
        if r.status_code != 200:
            return ""
        reader = PdfReader(io.BytesIO(r.content))
        text = ""
        for p in reader.pages[:15]:
            text += p.extract_text() or ""
        return re.sub(r'\s+', ' ', text)[:15000]
    except Exception as e:
        logger.debug(f"PDF extract failed: {e}")
        return ""

def _wayback_search(url: str) -> str:
    """Try Wayback Machine for archived version."""
    try:
        api = f"http://archive.org/wayback/available?url={quote(url)}"
        r = requests.get(api, timeout=10).json()
        snap = r.get("archived_snapshots", {}).get("closest", {})
        if snap.get("available"):
            return _fetch(snap["url"])
    except:
        pass
    return ""

def _bing_pdf_search(title: str) -> Optional[str]:
    """Bing search for tender PDFs."""
    try:
        q = quote(f'"{title[:50]}" filetype:pdf')
        html = _fetch(f"https://www.bing.com/search?q={q}&format=rss", timeout=12)
        for m in re.finditer(r'<link>(https?://[^<]+\.pdf[^<]*)</link>', html, re.I):
            return m.group(1)
    except:
        pass
    return None

def _duckduckgo_pdf_search(title: str) -> Optional[str]:
    """DuckDuckGo for tender PDFs."""
    try:
        q = quote(f'{title[:50]} filetype:pdf')
        html = _fetch(f"https://html.duckduckgo.com/html/?q={q}", timeout=12)
        for m in re.finditer(r'href="(https?://[^"]+\.pdf[^"]*)"', html, re.I):
            return m.group(1)
    except:
        pass
    return None

def _extract_from_article(article_url: str, title: str) -> Dict:
    """Fetch news/blog article, extract tender details + find official links."""
    result = {"found": False, "text": "", "source": None, "pdf_url": None, "official_links": []}
    html = _fetch(article_url, timeout=15)
    if len(html) < 500:
        return result

    # Extract article text
    text = re.sub(r'<script.*?</script>', ' ', html, flags=re.S | re.I)
    text = re.sub(r'<style.*?</style>', ' ', text, flags=re.S | re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)

    # Find official portal/document links - broad detection
    official_links = []
    official_hints = [
        '.gov.in', '.nic.in', '.org.in', '.gov.', '.nic.',
        'eprocure', 'etender', 'tender', 'gem.gov',
        'ireps', 'defproc', 'mahatenders', 'kppp',
        'tenderwizard', 'eproc.', '/tender/', '/bid/',
        'nit', 'rfp', 'eoi',  # Notice Inviting Tender, RFP, EOI
    ]
    for m in re.finditer(r'href="([^"]+)"', html, re.I):
        url = m.group(1).lower()
        # Skip social, ads, navigation
        if any(s in url for s in ['facebook', 'twitter', 'linkedin', 'whatsapp', 'telegram', 'advertisement', '#']):
            continue
        if any(h in url for h in official_hints):
            if url.startswith('/'):
                from urllib.parse import urljoin
                url = urljoin(article_url, url)
            if url.startswith('http'):
                official_links.append(url)

    # Find PDF links
    for m in re.finditer(r'href="([^"]+\.pdf[^"]*)"', html, re.I):
        pdf_url = m.group(1)
        if pdf_url.startswith('/'):
            from urllib.parse import urljoin
            pdf_url = urljoin(article_url, pdf_url)
        pdf_text = _extract_pdf_text(pdf_url)
        if len(pdf_text) > 500:
            return {"found": True, "text": pdf_text, "source": "article_pdf", "pdf_url": pdf_url, "official_links": official_links}

    # Try following official links
    for link in official_links[:3]:
        link_text = _fetch(link, timeout=12)
        if len(link_text) > 2000:
            clean = re.sub(r'<[^>]+>', ' ', link_text)
            clean = re.sub(r'\s+', ' ', clean)[:12000]
            # Check if it looks like a tender page (not just homepage)
            if any(kw in clean.lower() for kw in ['tender', 'bid', 'emd', 'deadline', 'corrigendum']):
                return {"found": True, "text": clean, "source": "article_official_link", "pdf_url": link, "official_links": official_links}

    # Fall back to article text itself if it has tender details
    if any(kw in text.lower() for kw in ['tender', 'bid', 'mw', 'kwp', 'emd', 'deadline']):
        return {"found": True, "text": text[:12000], "source": "article_text", "pdf_url": None, "official_links": official_links}

    return result


def get_tender_document_multi(title: str, portal_name: str = "", page_url: str = "") -> Dict:
    """Try all sources. Returns {found, text, source, pdf_url}."""
    cache_key = f"{title[:40]}"
    if cache_key in _cache:
        return _cache[cache_key]

    result = {"found": False, "text": "", "source": None, "pdf_url": None}

    # Layer 1: SerpApi PDF search (already in doc_finder)
    try:
        from app.doc_finder import get_tender_document as serp_pdf
        d = serp_pdf(title, portal_name)
        if d.get("found"):
            result.update({"found": True, "text": d["text"], "source": "serpapi_pdf", "pdf_url": d["pdf_url"]})
            _cache[cache_key] = result
            return result
    except:
        pass

    # Layer 2: Bing PDF search
    pdf_url = _bing_pdf_search(title)
    if pdf_url:
        text = _extract_pdf_text(pdf_url)
        if len(text) > 500:
            result.update({"found": True, "text": text, "source": "bing_pdf", "pdf_url": pdf_url})
            _cache[cache_key] = result
            return result

    # Layer 3: DuckDuckGo PDF search
    pdf_url = _duckduckgo_pdf_search(title)
    if pdf_url:
        text = _extract_pdf_text(pdf_url)
        if len(text) > 500:
            result.update({"found": True, "text": text, "source": "ddg_pdf", "pdf_url": pdf_url})
            _cache[cache_key] = result
            return result

    # Layer 4: Wayback Machine for the tender page
    if page_url:
        archived = _wayback_search(page_url)
        if len(archived) > 1000:
            # Check if archived page has PDF links
            for m in re.finditer(r'href="([^"]+\.pdf[^"]*)"', archived, re.I):
                pdf_text = _extract_pdf_text(m.group(1))
                if len(pdf_text) > 500:
                    result.update({"found": True, "text": pdf_text, "source": "wayback_pdf", "pdf_url": m.group(1)})
                    _cache[cache_key] = result
                    return result
            # Use archived page text itself
            clean = re.sub(r'<[^>]+>', ' ', archived)
            clean = re.sub(r'\s+', ' ', clean)[:12000]
            if len(clean) > 1000:
                result.update({"found": True, "text": clean, "source": "wayback_page", "pdf_url": None})
                _cache[cache_key] = result
                return result

    # Layer 5: If page_url is a news/blog article, extract from it
    if page_url and any(d in page_url.lower() for d in ['news', 'blog', 'article', 'energetica', 'mercom', 'saurenergy', 'tender247', 'bidassist', 'tendersinfo']):
        article_result = _extract_from_article(page_url, title)
        if article_result.get("found"):
            _cache[cache_key] = article_result
            return article_result

    _cache[cache_key] = result
    return result
