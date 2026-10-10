"""Tender verification: check URL reachability, find PDFs and documents."""

import re
import logging
import requests
from typing import Dict, Any, List
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


def verify_tender(url: str, timeout: int = 10) -> Dict[str, Any]:
    """Verify a tender URL: reachable? find PDFs/documents?"""
    result = {
        "reachable": False,
        "status_code": None,
        "pdfs": [],
        "has_documents": False,
        "verified": False,
    }
    if not url:
        return result
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; TenderRadar/1.0)"}
        r = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        result["status_code"] = r.status_code
        if r.status_code != 200:
            return result
        result["reachable"] = True

        # Find PDF links
        pdfs = set()
        for m in re.finditer(r'href=["\']([^"\']+\.pdf[^"\']*)["\']', r.text, re.I):
            pdf_url = urljoin(url, m.group(1))
            # Filter to same domain or gov domains
            if urlparse(pdf_url).netloc.endswith(".gov.in") or urlparse(pdf_url).netloc in urlparse(url).netloc:
                pdfs.add(pdf_url)
        result["pdfs"] = sorted(pdfs)[:5]
        result["has_documents"] = len(pdfs) > 0
        # Verified = reachable + on official gov domain
        host = urlparse(url).netloc.lower()
        result["verified"] = result["reachable"] and (host.endswith(".gov.in") or host.endswith(".nic.in"))
        return result
    except Exception as e:
        logger.warning(f"Verification failed for {url}: {e}")
        return result
