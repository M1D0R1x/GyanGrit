# apps.ai_assistant.views
"""
AI Chatbot — doubt clearance using a multi-provider AI chain.

Provider priority: Groq (llama-3.3-70b) → Together AI (Llama-4-Maverick) → Gemini 2.0 Flash
Fallback logic is in providers.py — views.py only calls call_ai().

Endpoints:
  GET  /api/v1/ai/conversations/               — list student's conversations
  POST /api/v1/ai/chat/                        — send message, get AI response
  GET  /api/v1/ai/conversations/<id>/          — get conversation history
  DELETE /api/v1/ai/conversations/<id>/        — delete conversation

RAG approach:
  1. Fetch lesson titles + content summaries for the student's enrolled subjects
  2. Pass them as context to the AI provider
  3. AI answers the student's question using the curriculum content

No vector DB needed for capstone — simple context injection works well
for a subject-scoped chatbot with ~20 lessons per subject.
"""
import json
import logging

from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import ChatConversation, AIChatMessage
from .providers import call_ai
from .ratelimit import check_ai_rate_limit

logger = logging.getLogger(__name__)

MAX_HISTORY = 10   # last N messages sent to the AI for context
MAX_CONTEXT = 3000  # max characters of curriculum context to inject


# ── Curriculum context builder ─────────────────────────────────────────────────

def _build_curriculum_context(student, subject_id: int | None) -> str:
    """
    Fetch lesson titles + descriptions for the student's subject.
    Returned as a plain text block injected into the AI prompt.
    Cached 5 minutes per student+subject to avoid repeated DB hits.
    """
    from django.core.cache import cache
    _cache_key = f"ai_ctx:s{getattr(student, 'id', 0)}:sub{subject_id or 0}"
    cached = cache.get(_cache_key)
    if cached is not None:
        return cached

    from apps.content.models import Course, Lesson
    from apps.academics.models import TeachingAssignment

    section = getattr(student, "section", None)
    if not section:
        cache.set(_cache_key, "", timeout=300)
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

    context = "\n".join(lines)[:MAX_CONTEXT]
    cache.set(_cache_key, context, timeout=300)  # 5 minute TTL
    return context



# ── Endpoints ──────────────────────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def list_conversations(request):
    from django.db.models import Count
    convs = (
        ChatConversation.objects
        .filter(student=request.user)
        .select_related("subject")
        .annotate(message_count=Count("messages"))
        .order_by("-updated_at")[:20]
    )

    return JsonResponse([
        {
            "id":            c.id,
            "subject_id":    c.subject_id,
            "subject_name":  c.subject.name if c.subject else "General",
            "started_at":    c.started_at.isoformat(),
            "updated_at":    c.updated_at.isoformat(),
            "message_count": c.message_count,  # from annotation — no extra query
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

    # Redis rate limit: 10 requests per user per minute (ADR-003)
    if not check_ai_rate_limit(request.user.id):
        return JsonResponse(
            {
                "error": "Too many requests. Please wait a minute before asking another question.",
                "retry_after": 60,
            },
            status=429,
        )

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

    # Build history (last MAX_HISTORY messages)
    history = list(
        conv.messages.order_by("created_at").values("role", "content")
    )[-MAX_HISTORY:]

    # Build curriculum context
    context = _build_curriculum_context(request.user, conv.subject_id)

    # Call AI via provider chain: Groq → Together AI → Gemini
    ai_response = call_ai(history, context)

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
