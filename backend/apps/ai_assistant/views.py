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

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import ChatConversation, AIChatMessage

logger = logging.getLogger(__name__)

MAX_HISTORY = 10   # last N messages sent to Gemini for context
MAX_CONTEXT = 3000  # max characters of curriculum context to inject


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


# ── Gemini API call ────────────────────────────────────────────────────────────

def _call_gemini(messages: list[dict], curriculum_context: str) -> str:
    """
    Call Gemini API with conversation history + curriculum context.
    Returns assistant text response.
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

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    try:
        resp = http_requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except http_requests.Timeout:
        return "The AI is taking too long to respond. Please try again."
    except Exception as exc:
        logger.error("Gemini API error: %s", exc)
        return "Sorry, I couldn't process your question right now. Please try again."


# ── Endpoints ──────────────────────────────────────────────────────────────────

@login_required
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


@login_required
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

    # Call Gemini
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


@login_required
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


@login_required
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_conversation(request, conv_id):
    conv = get_object_or_404(ChatConversation, id=conv_id, student=request.user)
    conv.delete()
    return JsonResponse({"deleted": True})

