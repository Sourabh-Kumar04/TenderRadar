"""URL Normalization and Deduplication Engine for TenderRadar.

Ensures tenders discovered across diverse Google SerpApi search results
are strictly deduplicated using canonical URL representations rather than
volatile snippet titles.
"""

import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

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
