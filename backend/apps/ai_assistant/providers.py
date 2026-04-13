# apps/ai_assistant/providers.py
"""
Multi-provider AI fallback chain for GyanGrit.

Priority order:
  1. Bay of Assets  — claude-haiku-4-5 via round-robin key rotation (3+ keys, 70 RPM each)
  2. Groq            — llama-3.3-70b-versatile (30 req/min free)
  3. Together AI     — Llama-4-Maverick-17B
  4. Gemini          — gemini-2.0-flash (last resort)

BOA key rotation: atomic counter cycles through BOA_API_KEY_1..N.
Add more keys to .env → auto-discovered on startup. No code changes needed.
"""
import itertools
import logging
import threading

import requests

logger = logging.getLogger(__name__)

MAX_TOKENS = 512
TEMPERATURE = 0.7
TIMEOUT_S = 15

# ── BOA round-robin key rotator ────────────────────────────────────────────────
# Thread-safe: uses itertools.cycle + lock. Each call_ai() picks the next key.

_boa_cycle = None
_boa_lock = threading.Lock()


def _get_next_boa_key() -> str:
    """Return next BOA API key in round-robin. Empty string if no keys configured."""
    global _boa_cycle
    from django.conf import settings

    keys = getattr(settings, "BOA_API_KEYS", [])
    if not keys:
        return ""

    with _boa_lock:
        if _boa_cycle is None:
            _boa_cycle = itertools.cycle(keys)
        return next(_boa_cycle)


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


def _call_boa(messages: list[dict], system_prompt: str) -> str:
    """
    Call Bay of Assets API (OpenAI-compatible) with Claude Haiku 4.5.
    0.3x token weight = cheapest model. Round-robin across BOA_API_KEY_1..N.
    70 RPM per key × 3 keys = 210 RPM total capacity.
    """
    api_key = _get_next_boa_key()
    if not api_key:
        raise ProviderError("No BOA_API_KEY_N keys configured in .env")

    resp = requests.post(
        "https://api.bayofassets.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-haiku-4-5-20251001",
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "max_tokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
        },
        timeout=TIMEOUT_S,
    )

    if resp.status_code == 429:
        logger.warning("BOA rate-limited (key=%s...)", api_key[:12])
        raise ProviderRateLimitError(f"BOA HTTP 429")
    if resp.status_code == 402:
        logger.warning("BOA credits exhausted (key=%s...)", api_key[:12])
        raise ProviderRateLimitError(f"BOA HTTP 402")
    if resp.status_code == 503:
        raise ProviderRateLimitError(f"BOA HTTP 503")

    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_groq(messages: list[dict], system_prompt: str) -> str:
    """
    Call Groq API (OpenAI-compatible) with llama-3.3-70b-versatile.
    Free tier: 30 req/min, 14 400 req/day.
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
    Call Gemini 2.0 Flash API. Last-resort fallback.
    """
    from django.conf import settings

    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ProviderError("GEMINI_API_KEY not configured")

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
    ("boa",      _call_boa),
    ("groq",     _call_groq),
    ("together", _call_together),
    ("gemini",   _call_gemini),
]


def call_ai(messages: list[dict], curriculum_context: str) -> str:
    """
    Walk the provider chain until one succeeds.
    BOA (Claude Haiku) is primary. Falls through to Groq → Together → Gemini.
    """
    system_prompt = _build_system_prompt(curriculum_context)

    for provider_name, call_fn in _CHAIN:
        try:
            reply = call_fn(messages, system_prompt)
            if provider_name != "boa":
                logger.warning("AI response served by fallback provider: %s", provider_name)
            return reply
        except ProviderRateLimitError:
            logger.warning("Provider %s rate-limited — trying next", provider_name)
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

    logger.error("All AI providers in the chain failed or are rate-limited.")
    return (
        "All AI providers are busy right now. "
        "Please wait a minute and try your question again. "
        "If this keeps happening, contact your teacher."
    )
