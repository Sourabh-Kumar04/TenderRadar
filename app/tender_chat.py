"""Tender-scoped AI chat: user chats with AI about one specific tender."""

import re
import json
import logging
from typing import List, Dict, Any
from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


from app.deep_dive import fetch_page_text
from app.doc_finder import get_tender_document
from app.multi_doc import get_tender_document_multi


def tender_chat(
    title: str,
    snippet: str,
    portal_name: str,
    scope: str = "",
    history: List[Dict[str, str]] = None,
    user_message: str = "",
    page_url: str = "",
) -> str:
    """Chat with AI scoped to one tender. Returns AI reply text."""
    settings = get_settings()
    api_key = (
        getattr(settings, "FIREWORKS_API_KEY", "")
        or getattr(settings, "LLM_API_KEY", "")
    )
    base_url = (
        getattr(settings, "FIREWORKS_BASE_URL", "")
        or getattr(settings, "LLM_BASE_URL", "")
        or "https://api.fireworks.ai/inference/v1"
    )
    model = getattr(settings, "LLM_MODEL", "") or "accounts/fireworks/models/deepseek-v4p1-flash"

    if not api_key:
        return "AI chat is not configured (missing API key)."

    # Try multi-source document retrieval (SerpApi + Bing + DDG + Wayback)
    doc = get_tender_document_multi(title, portal_name, page_url)
    has_doc = doc.get("found", False)
    if not has_doc:
        # Fallback to single-source
        doc = get_tender_document(title, portal_name)
        has_doc = doc.get("found", False)

    # Fallback: fetch tender page
    page_text = fetch_page_text(page_url) if page_url and not has_doc else ""
    has_page = bool(page_text and len(page_text) > 200)

    context = (
        "You are a sharp procurement assistant with access to the tender page. Rules:\n"
        "- Answer ONLY about this specific tender. Redirect anything else.\n"
        "- Be CONCISE. Max 4-5 lines unless asked for detail.\n"
        "- Use bullet points, not paragraphs.\n"
        "- NEVER say things like 'the title is truncated', 'not in the provided record', 'as an AI'.\n"
        "- If info is missing, just omit it. Don't announce what's missing.\n"
        "- For greetings, reply briefly and ask what they want to know.\n"
        "- NEVER say 'check the portal' or 'refer to the official document'.\n"
        "- If the tender page was fetched, EXTRACT the actual EMD, deadline, eligibility from it.\n"
        "- If not on the page, INFER from tender type and Indian govt norms (e.g. typical EMD % for CPPP works).\n"
        "- Label inferences as 'Typically:' not as fact.\n\n"
        f"Tender: {title}\nPortal: {portal_name}\nDetails: {snippet}\n"
    )
    if has_doc:
        src_name = doc.get('source', 'document')
        context += f"\nOFFICIAL TENDER DOCUMENT [via {src_name}] ({doc.get('pdf_url', 'archived')}) :\n{doc['text'][:8000]}\n"
        context += "\nAnswer ONLY from this document. Cite specific values.\n"
    elif has_page:
        context += f"\nFull tender page content:\n{page_text[:6000]}\n"
    else:
        context += "\n(No official document found - use snippet + clearly label estimates as 'Typically:')\n"

    if scope:
        context += f"Scope: {scope}\n"

    messages = [{"role": "system", "content": context}]
    for h in (history or [])[-10:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"][:1000]})
    messages.append({"role": "user", "content": user_message})

    try:
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=45.0)
        resp = client.chat.completions.create(
            model=model, messages=messages, temperature=0.4, max_tokens=1024,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        logger.warning(f"Tender chat failed: {e}")
        return "Sorry, I couldn't process that. Try again."
