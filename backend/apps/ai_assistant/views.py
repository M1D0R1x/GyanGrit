# apps.ai_assistant.views
"""
AI Chatbot — doubt clearance using Gemini.

Endpoints:
  GET  /api/v1/ai/conversations/               — list student's conversations
  POST /api/v1/ai/chat/                        — send message, get AI response
  GET  /api/v1/ai/conversations/<id>/          — get conversation history
  DELETE /api/v1/ai/conversations/<id>/        — delete conversation

RAG approach:
  1. Fetch lesson titles + content summaries for the student's enrolled subjects
  2. Pass them as context to Gemini
  3. Gemini answers the student's question using the curriculum content

No vector DB needed for capstone — simple context injection works well
for a subject-scoped chatbot with ~20 lessons per subject.
"""
import json
import logging
import time

from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import ChatConversation, AIChatMessage

logger = logging.getLogger(__name__)

MAX_HISTORY = 10   # last N messages sent to Gemini for context
MAX_CONTEXT = 3000  # max characters of curriculum context to inject

# Gemini free tier: 15 requests/min, 1500 requests/day
GEMINI_MAX_RETRIES = 3
GEMINI_BASE_DELAY = 2.0  # seconds — doubles on each retry


# ── Curriculum context builder ─────────────────────────────────────────────────

def _build_curriculum_context(student, subject_id: int | None) -> str:
    """
    Fetch lesson titles + descriptions for the student's subject.
    Returned as a plain text block injected into the Gemini prompt.
    """
    from apps.content.models import Course, Lesson
    from apps.academics.models import TeachingAssignment

    section = getattr(student, "section", None)
    if not section:
        return ""

    subject_ids = (
        [subject_id] if subject_id
        else list(
            TeachingAssignment.objects.filter(section=section)
            .values_list("subject_id", flat=True).distinct()
        )
    )

    courses = Course.objects.filter(
        subject_id__in=subject_ids,
    ).prefetch_related("lessons").order_by("title")[:5]

    lines = []
    for course in courses:
        lines.append(f"\n## Course: {course.title}")
        if course.description:
            lines.append(course.description[:200])
        for lesson in course.lessons.all()[:10]:
            lines.append(f"  - Lesson: {lesson.title}")
            if hasattr(lesson, "description") and lesson.description:
                lines.append(f"    {lesson.description[:150]}")

    context = "\n".join(lines)
    return context[:MAX_CONTEXT]


# ── Gemini API call with retry ─────────────────────────────────────────────────

def _call_gemini(messages: list[dict], curriculum_context: str) -> str:
    """
    Call Gemini API with conversation history + curriculum context.
    Returns assistant text response.

    Implements exponential backoff retry for 429 (rate limit) and 503
    (service unavailable) responses. Gemini free tier allows 15 req/min.
    """
    from django.conf import settings
    import requests as http_requests

    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not api_key:
        return "AI assistant is not configured. Please contact your administrator."

    system_prompt = f"""You are GyanGrit's AI study assistant for rural school students in Punjab, India.
Your role is to help students understand their curriculum. Be friendly, encouraging, and clear.
Answer in simple English. If a student asks in Punjabi or Hindi, respond in the same language.
Keep answers concise (2-4 sentences for simple questions, more for complex ones).
Do NOT answer questions unrelated to education (e.g. politics, entertainment).

Curriculum context for this student:
{curriculum_context if curriculum_context else "General school curriculum"}

Remember: You are a helpful tutor, not a search engine. Guide students to understand, not just memorise."""

    # Build Gemini contents array from conversation history
    contents = []
    for msg in messages[-MAX_HISTORY:]:
        contents.append({
            "role":  "user"  if msg["role"] == "user" else "model",
            "parts": [{"text": msg["content"]}],
        })

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 512,
            "temperature":     0.7,
        },
    }

    # Model: gemini-2.0-flash (gemini-1.5-flash was deprecated in March 2026)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

    last_error = None
    for attempt in range(GEMINI_MAX_RETRIES + 1):
        try:
            resp = http_requests.post(url, json=payload, timeout=15)

            # Success
            if resp.ok:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]

            # Rate limited (429) or temporarily unavailable (503) — retry
            if resp.status_code in (429, 503):
                last_error = f"HTTP {resp.status_code}"
                if attempt < GEMINI_MAX_RETRIES:
                    # Exponential backoff: 2s, 4s, 8s
                    delay = GEMINI_BASE_DELAY * (2 ** attempt)
                    logger.warning(
                        "Gemini %d on attempt %d/%d — retrying in %.1fs",
                        resp.status_code, attempt + 1, GEMINI_MAX_RETRIES + 1, delay,
                    )
                    time.sleep(delay)
                    continue
                # Exhausted retries
                logger.error(
                    "Gemini rate limit: exhausted %d retries. Status=%d",
                    GEMINI_MAX_RETRIES, resp.status_code,
                )
                return (
                    "I'm getting a lot of questions right now! 😊 "
                    "Please wait 30 seconds and try again. "
                    "The AI tutor has a limit on how many questions it can answer per minute."
                )

            # Other HTTP errors — don't retry
            resp.raise_for_status()

        except http_requests.Timeout:
            last_error = "timeout"
            if attempt < GEMINI_MAX_RETRIES:
                delay = GEMINI_BASE_DELAY * (2 ** attempt)
                logger.warning("Gemini timeout on attempt %d — retrying in %.1fs", attempt + 1, delay)
                time.sleep(delay)
                continue
            return "The AI is taking too long to respond. Please try again in a moment."

        except http_requests.ConnectionError:
            last_error = "connection_error"
            if attempt < GEMINI_MAX_RETRIES:
                delay = GEMINI_BASE_DELAY * (2 ** attempt)
                logger.warning("Gemini connection error on attempt %d — retrying in %.1fs", attempt + 1, delay)
                time.sleep(delay)
                continue
            return "Could not connect to the AI service. Please check your internet and try again."

        except Exception as exc:
            logger.error("Gemini API error: %s", exc)
            return "Sorry, I couldn't process your question right now. Please try again."

    # Should never reach here, but safety net
    logger.error("Gemini: fell through retry loop. Last error: %s", last_error)
    return "Sorry, the AI tutor is temporarily unavailable. Please try again in a minute."


# ── Endpoints ──────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def list_conversations(request):
    convs = ChatConversation.objects.filter(
        student=request.user
    ).select_related("subject").order_by("-updated_at")[:20]

    return JsonResponse([
        {
            "id":           c.id,
            "subject_id":   c.subject_id,
            "subject_name": c.subject.name if c.subject else "General",
            "started_at":   c.started_at.isoformat(),
            "updated_at":   c.updated_at.isoformat(),
            "message_count": c.messages.count(),
        }
        for c in convs
    ], safe=False)


@require_auth
@require_http_methods(["POST"])
@csrf_exempt
def chat(request):
    """
    Send a message and get a response.
    Creates a conversation if conversation_id is not provided.
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    message        = body.get("message", "").strip()
    conversation_id = body.get("conversation_id")
    subject_id     = body.get("subject_id")

    if not message:
        return JsonResponse({"error": "message is required"}, status=400)
    if len(message) > 1000:
        return JsonResponse({"error": "Message too long (max 1000 chars)"}, status=400)

    # Get or create conversation
    if conversation_id:
        conv = get_object_or_404(ChatConversation, id=conversation_id, student=request.user)
    else:
        from apps.academics.models import Subject
        subject = Subject.objects.filter(id=subject_id).first() if subject_id else None
        conv = ChatConversation.objects.create(
            student=request.user,
            subject=subject,
        )

    # Save user message
    AIChatMessage.objects.create(conversation=conv, role="user",      content=message)

    # Build history
    history = list(
        conv.messages.order_by("created_at").values("role", "content")
    )

    # Build curriculum context
    context = _build_curriculum_context(request.user, conv.subject_id)

    # Call Gemini (with retry logic for 429 rate limits)
    ai_response = _call_gemini(history, context)

    # Save AI response
    ai_msg = AIChatMessage.objects.create(conversation=conv, role="assistant", content=ai_response)

    return JsonResponse({
        "conversation_id": conv.id,
        "message": {
            "id":         ai_msg.id,
            "role":       "assistant",
            "content":    ai_response,
            "created_at": ai_msg.created_at.isoformat(),
        },
    }, status=201)


@require_auth
@require_http_methods(["GET"])
def conversation_detail(request, conv_id):
    conv = get_object_or_404(ChatConversation, id=conv_id, student=request.user)
    messages = conv.messages.order_by("created_at")
    return JsonResponse({
        "id":           conv.id,
        "subject_id":   conv.subject_id,
        "subject_name": conv.subject.name if conv.subject else "General",
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in messages
        ],
    })


@require_auth
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_conversation(request, conv_id):
    conv = get_object_or_404(ChatConversation, id=conv_id, student=request.user)
    conv.delete()
    return JsonResponse({"deleted": True})
