"""Tender-scoped AI chat: user chats with AI about one specific tender."""

import re
import json
import logging
from typing import List, Dict, Any
from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def tender_chat(
    title: str,
    snippet: str,
    portal_name: str,
    scope: str = "",
    history: List[Dict[str, str]] = None,
    user_message: str = "",
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

    context = (
        f"You are a helpful procurement assistant. Answer ONLY about this specific tender. "
        f"If asked about anything else, politely redirect to the tender.\n\n"
        f"Tender: {title}\nPortal: {portal_name}\nDetails: {snippet}\n"
    )
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
