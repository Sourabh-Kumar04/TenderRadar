"""URL Normalization and Deduplication Engine for TenderRadar.

Ensures tenders discovered across diverse Google SerpApi search results
are strictly deduplicated using canonical URL representations rather than
volatile snippet titles.
"""

import re
import html
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode, parse_qs, unquote
from typing import Optional


# --- Official Indian government tender portal homepages ---
# Used when a discovered URL points to a news/blog/aggregator instead of the
# real bidding portal. Keys are lowercase substrings matched against portal_name.
OFFICIAL_PORTAL_URLS = {
    "gem": "https://gem.gov.in",
    "cppp": "https://eprocure.gov.in/eprocure/app",
    "central public procurement": "https://eprocure.gov.in/eprocure/app",
    "eprocure": "https://eprocure.gov.in/eprocure/app",
    "etenders": "https://etenders.gov.in/eprocure/app",
    "ireps": "https://www.ireps.gov.in",
    "railways": "https://www.ireps.gov.in",
    "mahatenders": "https://mahatenders.gov.in",
    "maharashtra": "https://mahatenders.gov.in",
    "kppp": "https://kppp.karnataka.gov.in",
    "karnataka": "https://kppp.karnataka.gov.in",
    "odisha": "https://tendersodisha.gov.in",
    "tendersodisha": "https://tendersodisha.gov.in",
}

# URL path fragments that indicate news articles / blog posts (not tender pages)
NEWS_PATH_HINTS = ("/news/", "/blog/", "/article/", "/articles/", "/press-release/", "/media/")

def _host_is_official_portal(host: str) -> bool:
    """True if the host looks like a real Indian government tender portal."""
    h = (host or "").lower()
    if not h:
        return False
    if h.endswith(".gov.in") or h.endswith(".nic.in"):
        return True
    return False

def _url_looks_like_news(url: str, host: str) -> bool:
    """True if the URL is probably a news/blog article, not a tender page."""
    u = (url or "").lower()
    h = (host or "").lower()
    if any(hint in u for hint in NEWS_PATH_HINTS):
        return True
    # Known tender-news aggregator domains
    for d in ("energetica-india.net", "mercomindia.com", "saurenergy.com",
              "tendersinfo.com", "tender247.com", "bidassist.com"):
        if d in h:
            return True
    return False

def official_portal_url_for(portal_name: Optional[str]) -> str:
    """Best-effort official bidding-portal homepage for a portal name."""
    name = (portal_name or "").lower()
    for key, url in OFFICIAL_PORTAL_URLS.items():
        if key in name:
            return url
    return "https://eprocure.gov.in/eprocure/app"

# Tracking and volatile parameters to discard
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "zanpid",
    "msclkid",
    "ref",
    "referer",
    "referrer",
    "source",
    "sessionid",
    "jsessionid",
    "phpsessid",
    "aspsessionid",
    "_ga",
    "_gl",
    "ncforminfo",
    "client",
    "ved",
    "usg",
    "ei",
    "sig",
}


def normalize_url(raw_url: str) -> str:
    """Canonicalize a URL to prevent duplicate tender entries.
    
    1. Trims whitespace.
    2. Strips fragments (#...).
    3. Normalizes scheme to lowercase (defaults to https if missing).
    4. Normalizes host to lowercase, removes default ports (:80, :443) and trailing dots.
    5. Strips embedded Java servlet session tokens (e.g. ;jsessionid=XYZ) common on NIC portals.
    6. Removes tracking/session query parameters.
    7. Alphabetically sorts remaining query parameters.
    8. Normalizes multiple slashes and strips trailing slash.
    """
    if not raw_url:
        return ""
    
    url = raw_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    # Remove URL fragment
    parsed = urlparse(url)
    
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    
    # Remove default ports
    if ":" in netloc:
        host, port = netloc.split(":", 1)
        if (scheme == "http" and port == "80") or (scheme == "https" and port == "443"):
            netloc = host
            
    # Strip leading/trailing dots in hostname
    netloc = netloc.strip(".")
    
    path = parsed.path
    # Strip matrix session parameters like ;jsessionid=... from path
    path = re.sub(r";jsessionid=[^/?#]*", "", path, flags=re.IGNORECASE)
    path = re.sub(r"/+", "/", path)  # Collapse multiple slashes
    if path.endswith("/") and len(path) > 1:
        path = path[:-1]
    if not path:
        path = "/"
        
    # Strip jsessionid or session tokens from URL params
    params = parsed.params
    if params and re.search(r"jsessionid|session|sid", params, re.IGNORECASE):
        params = ""

    # Process and filter query parameters
    query_params = parse_qsl(parsed.query, keep_blank_values=False)
    filtered_params = [
        (k, v) for k, v in query_params
        if k.lower() not in TRACKING_PARAMS and not k.lower().startswith("utm_")
    ]
    
    # Sort query params for deterministic canonical URL
    filtered_params.sort(key=lambda item: (item[0], item[1]))
    new_query = urlencode(filtered_params)
    
    # Reassemble canonical URL (empty fragment)
    canonical = urlunparse((scheme, netloc, path, params, new_query, ""))
    return canonical


def detect_portal_name(url: str) -> str:
    """Identifies the issuing authority or procurement portal from domain name."""
    if not url:
        return "Government Portal"
    
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    
    if "gem.gov.in" in host:
        return "GeM (Government e-Marketplace)"
    elif "eprocure.gov.in" in host:
        return "CPPP (Central Public Procurement Portal)"
    elif "etenders.gov.in" in host:
        return "eTenders (Central Public Portal)"
    elif "ireps.gov.in" in host:
        return "IREPS (Indian Railways)"
    elif "defproc.gov.in" in host:
        return "Defence e-Procurement Portal"
    elif "mahatenders.gov.in" in host:
        return "MahaTenders (Maharashtra)"
    elif "kppp.karnataka.gov.in" in host or "eproc.karnataka.gov.in" in host:
        return "KPPP (Karnataka eProcurement)"
    elif "wbtenders.gov.in" in host:
        return "WBTenders (West Bengal)"
    elif "tendersodisha.gov.in" in host:
        return "Odisha e-Procurement"
    elif "tenderwizard.com" in host:
        return "TenderWizard PSU Portal"
    elif "nhai.gov.in" in host:
        return "NHAI e-Portal"
    elif ".gov.in" in host or ".nic.in" in host:
        return f"Gov Portal ({host.replace('www.', '')})"
    else:
        return host.replace("www.", "")


def select_portal_url(original_url: Optional[str], canonical_url: Optional[str] = None, portal_name: Optional[str] = None) -> str:
    """Selects and cleans the best official portal URL for outbound navigation.
    
    The button MUST open the tender's real official portal page.
    1. canonical_url is strictly for deduplication; the button must prioritize
       the best original URL to preserve essential government session tokens,
       parameters, and landing routes.
    2. Unescapes HTML entities (e.g. &amp; -> &).
    3. Unwraps search-engine redirects (e.g. google.com/url?q=... or google.com/url?url=...).
    4. Falls back gracefully to canonical_url if original_url is missing, empty, or invalid.
    """
    candidate = (original_url or "").strip()
    if not candidate and canonical_url:
        candidate = canonical_url.strip()
    if not candidate:
        return ""

    # 1. Unescape HTML entities
    candidate = html.unescape(candidate).strip()

    # 2. Ensure scheme is present
    if not candidate.startswith(("http://", "https://")):
        candidate = "https://" + candidate

    parsed = urlparse(candidate)
    host = parsed.netloc.lower()

    # 3. Unwrap search redirects (e.g., Google or SerpApi search redirects)
    if any(host == g or host.endswith("." + g) for g in ("google.com", "google.co.in", "google.co", "google.org")):
        # Check regex match for q= or url= to preserve query params of destination URL even if unquoted
        m = re.search(r"[?&](?:q|url)=(https?%3A%2F%2F[^&]+|https?://.*?)(?:&(?:sa|ved|usg|sig|ei|source)=|$)", candidate, re.IGNORECASE)
        if m:
            raw_target = m.group(1)
            target = unquote(raw_target).strip()
            target = html.unescape(target).strip()
            if target.startswith(("http://", "https://")):
                candidate = target
                parsed = urlparse(candidate)
                host = parsed.netloc.lower()
        else:
            qs = parse_qs(parsed.query)
            target = qs.get("q", [None])[0] or qs.get("url", [None])[0]
            if target:
                target = unquote(target).strip()
                target = html.unescape(target).strip()
                if target.startswith(("http://", "https://")):
                    candidate = target
                    parsed = urlparse(candidate)
                    host = parsed.netloc.lower()

    # 4b. If the candidate is a news/blog article (not a real bidding portal),
    # redirect to the official portal homepage instead of the news link.
    if host and (_url_looks_like_news(candidate, host) or not _host_is_official_portal(host)):
        return official_portal_url_for(portal_name)

    # 4. If candidate ended up malformed without valid host, fall back to canonical_url
    if not host and canonical_url:
        fallback = html.unescape(canonical_url).strip()
        if fallback and not fallback.startswith(("http://", "https://")):
            fallback = "https://" + fallback
        return fallback

    return candidate
