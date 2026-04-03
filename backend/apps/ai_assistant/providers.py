# apps/ai_assistant/providers.py
"""
Multi-provider AI fallback chain for GyanGrit.

Priority order:
  1. Groq          — llama-3.3-70b-versatile (30 req/min, 14 400/day, FREE)
  2. Together AI   — Llama-4-Maverick-17B    ($25 free credit)
  3. Gemini        — gemini-2.0-flash         (last resort)

Each provider raises ProviderRateLimitError on 429/503.
call_ai() walks the chain and falls through to the next provider silently.
No time.sleep() — blocking Gunicorn gthread workers is forbidden (ADR-003).
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

MAX_TOKENS = 512
TEMPERATURE = 0.7
TIMEOUT_S = 15


class ProviderRateLimitError(Exception):
    """Raised when a provider returns 429 or 503."""


class ProviderError(Exception):
    """Raised for non-recoverable provider errors (4xx except 429)."""


# ── GyanGrit system prompt ─────────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """\
You are GyanGrit's AI study assistant for rural school students in Punjab, India.
Your role is to help students understand their curriculum. Be friendly, encouraging, and clear.
Answer in simple English. If a student asks in Punjabi or Hindi, respond in the same language.
Keep answers concise (2-4 sentences for simple questions, more for complex ones).
Do NOT answer questions unrelated to education (e.g. politics, entertainment).

Curriculum context for this student:
{curriculum_context}

Remember: You are a helpful tutor, not a search engine. Guide students to understand, not just memorise.\
"""


def _build_system_prompt(curriculum_context: str) -> str:
    ctx = curriculum_context if curriculum_context else "General school curriculum"
    return SYSTEM_PROMPT_TEMPLATE.format(curriculum_context=ctx)


# ── Provider implementations ───────────────────────────────────────────────────

def _call_groq(messages: list[dict], system_prompt: str) -> str:
    """
    Call Groq API (OpenAI-compatible) with llama-3.3-70b-versatile.
    Free tier: 30 req/min, 14 400 req/day.
    Raises ProviderRateLimitError on 429/503.
    """
    from django.conf import settings

    api_key = getattr(settings, "GROQ_API_KEY", "").strip()
    if not api_key:
        raise ProviderError("GROQ_API_KEY not configured")

    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "max_tokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
        },
        timeout=TIMEOUT_S,
    )

    if resp.status_code in (429, 503):
        logger.warning("Groq rate-limited (HTTP %d)", resp.status_code)
        raise ProviderRateLimitError(f"Groq HTTP {resp.status_code}")

    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_together(messages: list[dict], system_prompt: str) -> str:
    """
    Call Together AI using their OpenAI-compatible REST API.
    Model: meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8
    Free: $25 credit on signup.
    Raises ProviderRateLimitError on 429/503.
    """
    from django.conf import settings

    api_key = getattr(settings, "TOGETHER_API_KEY", "").strip()
    if not api_key:
        raise ProviderError("TOGETHER_API_KEY not configured")

    resp = requests.post(
        "https://api.together.xyz/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "max_tokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
        },
        timeout=TIMEOUT_S,
    )

    if resp.status_code in (429, 503):
        logger.warning("Together AI rate-limited (HTTP %d)", resp.status_code)
        raise ProviderRateLimitError(f"Together HTTP {resp.status_code}")

    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_gemini(messages: list[dict], system_prompt: str) -> str:
    """
    Call Gemini 2.0 Flash API.
    Last-resort fallback only — free tier is 15 req/min shared across all users.
    Raises ProviderRateLimitError on 429/503.
    """
    from django.conf import settings

    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ProviderError("GEMINI_API_KEY not configured")

    # Convert OpenAI-style messages to Gemini format
    contents = []
    for msg in messages:
        contents.append({
            "role": "user" if msg["role"] == "user" else "model",
            "parts": [{"text": msg["content"]}],
        })

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={api_key}"
    )

    resp = requests.post(
        url,
        json={
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
            },
        },
        timeout=TIMEOUT_S,
    )

    if resp.status_code in (429, 503):
        logger.warning("Gemini rate-limited (HTTP %d)", resp.status_code)
        raise ProviderRateLimitError(f"Gemini HTTP {resp.status_code}")

    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


# ── Provider chain ─────────────────────────────────────────────────────────────

_CHAIN = [
    ("groq",    _call_groq),
    ("together", _call_together),
    ("gemini",  _call_gemini),
]


def call_ai(messages: list[dict], curriculum_context: str) -> str:
    """
    Walk the provider chain until one succeeds.

    Args:
        messages:           List of {"role": "user"|"assistant", "content": "..."} dicts.
                            Matches the format stored in AIChatMessage.
        curriculum_context: Plain-text curriculum context injected into system prompt.

    Returns:
        Assistant reply string. Never raises — returns a friendly fallback message
        if ALL providers fail.
    """
    system_prompt = _build_system_prompt(curriculum_context)

    for provider_name, call_fn in _CHAIN:
        try:
            reply = call_fn(messages, system_prompt)
            if provider_name != "groq":
                # Log when we're not on the primary provider so we know to investigate
                logger.warning("AI response served by fallback provider: %s", provider_name)
            return reply
        except ProviderRateLimitError:
            logger.warning("Provider %s rate-limited — trying next in chain", provider_name)
            continue
        except ProviderError as exc:
            logger.info("Provider %s skipped (%s) — trying next", provider_name, exc)
            continue
        except requests.Timeout:
            logger.warning("Provider %s timed out — trying next", provider_name)
            continue
        except requests.ConnectionError:
            logger.warning("Provider %s connection error — trying next", provider_name)
            continue
        except Exception as exc:
            logger.error("Provider %s unexpected error: %s", provider_name, exc, exc_info=True)
            continue

    # All providers failed
    logger.error("All AI providers in the chain failed or are rate-limited.")
    return (
        "All AI providers are busy right now. 😊 "
        "Please wait a minute and try your question again. "
        "If this keeps happening, contact your teacher."
    )
