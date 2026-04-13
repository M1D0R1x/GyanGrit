# apps.flashcards.views
"""
Flashcard endpoints.

Teacher endpoints:
  GET  /api/v1/flashcards/decks/                    — list my decks
  POST /api/v1/flashcards/decks/                    — create deck
  GET  /api/v1/flashcards/decks/<id>/               — deck detail + cards
  PATCH /api/v1/flashcards/decks/<id>/              — update deck
  DELETE /api/v1/flashcards/decks/<id>/             — delete deck
  POST /api/v1/flashcards/decks/<id>/cards/         — add card to deck
  PATCH /api/v1/flashcards/decks/<id>/cards/<cid>/  — edit card
  DELETE /api/v1/flashcards/decks/<id>/cards/<cid>/ — delete card

AI Teacher endpoints:
  POST /api/v1/flashcards/ai-generate/              — generate draft deck from lesson/text
  POST /api/v1/flashcards/ai-generate/<id>/publish/ — publish a draft AI-generated deck

Student endpoints:
  GET  /api/v1/flashcards/study/                    — list available decks
  GET  /api/v1/flashcards/study/<deck_id>/due/      — cards due today
  POST /api/v1/flashcards/study/<deck_id>/review/   — submit rating
  GET  /api/v1/flashcards/study/<deck_id>/stats/    — deck stats
"""
import json
import logging

from apps.accesscontrol.permissions import require_auth  # returns 401 JSON, not 302
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import datetime

from apps.accesscontrol.permissions import require_roles
from .models import FlashcardDeck, Flashcard, FlashcardProgress

logger = logging.getLogger(__name__)


# ── Serialisers ──────────────────────────────────────────────────────────────

def _card_to_dict(card: Flashcard, progress: FlashcardProgress | None = None) -> dict:
    d = {
        "id":    card.id,
        "front": card.front,
        "back":  card.back,
        "hint":  card.hint,
        "order": card.order,
    }
    if progress:
        d["progress"] = {
            "repetitions":   progress.repetitions,
            "ease_factor":   round(progress.ease_factor, 2),
            "interval":      progress.interval,
            "next_review":   progress.next_review.isoformat(),
            "total_reviews": progress.total_reviews,
            "correct_count": progress.correct_count,
        }
    return d


def _deck_to_dict(deck: FlashcardDeck, include_cards: bool = False) -> dict:
    d = {
        "id":           deck.id,
        "title":        deck.title,
        "description":  deck.description,
        "subject_id":   deck.subject_id,
        "subject_name": deck.subject.name,
        "section_id":   deck.section_id,
        "is_published": deck.is_published,
        "card_count":   deck.card_count,
        "created_at":   deck.created_at.isoformat(),
        "created_by":   deck.created_by.get_full_name() or deck.created_by.username,
    }
    if include_cards:
        d["cards"] = [_card_to_dict(c) for c in deck.cards.all()]
    return d


# ── Teacher: Deck CRUD ────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET", "POST"])
@csrf_exempt
def deck_list_create(request):
    user = request.user

    if request.method == "GET":
        if user.role == "ADMIN":
            qs = FlashcardDeck.objects.select_related("subject", "created_by")
        else:
            qs = FlashcardDeck.objects.filter(
                created_by=user
            ).select_related("subject", "created_by")
        return JsonResponse([_deck_to_dict(d) for d in qs], safe=False)

    # POST — create deck
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    from apps.academics.models import Subject, Section
    subject_id  = body.get("subject_id")
    section_id  = body.get("section_id")
    title       = body.get("title", "").strip()
    description = body.get("description", "").strip()

    if not title:
        return JsonResponse({"error": "title is required"}, status=400)
    if not subject_id:
        return JsonResponse({"error": "subject_id is required"}, status=400)

    subject = get_object_or_404(Subject, id=subject_id)
    section = Section.objects.filter(id=section_id).first() if section_id else None

    deck = FlashcardDeck.objects.create(
        title=title, description=description,
        subject=subject, section=section,
        created_by=user, is_published=False,
    )
    logger.info("FlashcardDeck created: id=%s by %s", deck.id, user.username)
    return JsonResponse(_deck_to_dict(deck, include_cards=True), status=201)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_exempt
def deck_detail(request, deck_id):
    user = request.user
    deck = get_object_or_404(
        FlashcardDeck.objects.select_related("subject", "section", "created_by"),
        id=deck_id,
    )

    if user.role not in ("ADMIN",) and deck.created_by_id != user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "GET":
        return JsonResponse(_deck_to_dict(deck, include_cards=True))

    if request.method == "PATCH":
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        if "title"        in body: deck.title        = body["title"].strip()
        if "description"  in body: deck.description  = body["description"].strip()
        if "is_published" in body: deck.is_published  = bool(body["is_published"])
        deck.save()
        return JsonResponse(_deck_to_dict(deck, include_cards=True))

    # DELETE
    deck.delete()
    return JsonResponse({"deleted": True})


# ── Teacher: Card CRUD ────────────────────────────────────────────────────────

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def card_create(request, deck_id):
    deck = get_object_or_404(FlashcardDeck, id=deck_id)
    if request.user.role not in ("ADMIN",) and deck.created_by_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    front = body.get("front", "").strip()
    back  = body.get("back",  "").strip()
    if not front or not back:
        return JsonResponse({"error": "front and back are required"}, status=400)

    order = deck.cards.count()
    card  = Flashcard.objects.create(
        deck=deck, front=front, back=back,
        hint=body.get("hint", "").strip(), order=order,
    )
    return JsonResponse(_card_to_dict(card), status=201)


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["PATCH", "DELETE"])
@csrf_exempt
def card_detail(request, deck_id, card_id):
    deck = get_object_or_404(FlashcardDeck, id=deck_id)
    card = get_object_or_404(Flashcard, id=card_id, deck=deck)
    if request.user.role not in ("ADMIN",) and deck.created_by_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    if request.method == "DELETE":
        card.delete()
        return JsonResponse({"deleted": True})

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if "front" in body: card.front = body["front"].strip()
    if "back"  in body: card.back  = body["back"].strip()
    if "hint"  in body: card.hint  = body["hint"].strip()
    if "order" in body: card.order = int(body["order"])
    card.save()
    return JsonResponse(_card_to_dict(card))


# ── Student: Study endpoints ──────────────────────────────────────────────────

@require_auth
@require_http_methods(["GET"])
def study_list(request):
    """
    List all published decks available to this student.
    Scoped to subjects they are enrolled in (via TeachingAssignment of their section).
    """
    user = request.user
    from apps.academics.models import TeachingAssignment

    if user.role in ("TEACHER", "PRINCIPAL", "ADMIN"):
        # Staff see all published decks
        qs = FlashcardDeck.objects.filter(
            is_published=True
        ).select_related("subject", "created_by")
    else:
        # Student: decks for their section's subjects
        section = getattr(user, "section", None)
        if not section:
            return JsonResponse([], safe=False)

        subject_ids = TeachingAssignment.objects.filter(
            section=section
        ).values_list("subject_id", flat=True).distinct()

        qs = FlashcardDeck.objects.filter(
            is_published=True,
            subject_id__in=subject_ids,
        ).filter(
            # section-scoped OR global (section=None means visible to all)
            models.Q(section=section) | models.Q(section__isnull=True)
        ).select_related("subject", "created_by")

    # Annotate with student's due count — single batch query across all decks
    today = datetime.date.today()
    result = []

    if user.role == "STUDENT":
        # Fetch ALL card IDs for these decks + NOT-due progress in 2 queries total
        deck_list = list(qs)
        all_card_ids_by_deck: dict[int, list[int]] = {}
        for deck in deck_list:
            all_card_ids_by_deck[deck.id] = []
        from django.db.models import Q as _Q
        all_card_rows = Flashcard.objects.filter(
            deck__in=deck_list
        ).values("id", "deck_id")
        for row in all_card_rows:
            all_card_ids_by_deck[row["deck_id"]].append(row["id"])

        not_due_set: set[int] = set(
            FlashcardProgress.objects.filter(
                student=user,
                card__deck__in=deck_list,
                next_review__gt=today,
            ).values_list("card_id", flat=True)
        )

        for deck in deck_list:
            card_ids = all_card_ids_by_deck[deck.id]
            d = _deck_to_dict(deck)
            d["due_count"] = len([c for c in card_ids if c not in not_due_set])
            result.append(d)
    else:
        for deck in qs:
            d = _deck_to_dict(deck)
            d["due_count"] = 0
            result.append(d)

    return JsonResponse(result, safe=False)


@require_auth
@require_http_methods(["GET"])
def study_due(request, deck_id):
    """
    Return cards due today for this student in this deck.
    New cards (no progress) are always included.
    Due cards (next_review <= today) are included.
    Sorted: overdue first, then new.
    Max 20 cards per session.
    """
    deck = get_object_or_404(
        FlashcardDeck.objects.prefetch_related("cards"),
        id=deck_id, is_published=True,
    )
    user  = request.user
    today = datetime.date.today()

    all_cards    = list(deck.cards.all())
    progress_map = {
        p.card_id: p
        for p in FlashcardProgress.objects.filter(
            student=user, card__deck=deck
        )
    }

    due_cards = []
    for card in all_cards:
        prog = progress_map.get(card.id)
        if prog is None or prog.next_review <= today:
            due_cards.append((card, prog))

    # Sort: overdue (has progress, past due) first, then new (no progress)
    due_cards.sort(key=lambda x: (
        0 if x[1] and x[1].next_review < today else
        1 if x[1] and x[1].next_review == today else 2
    ))

    # Limit to 20 per session
    due_cards = due_cards[:20]

    return JsonResponse({
        "deck_id":    deck.id,
        "deck_title": deck.title,
        "total_due":  len(due_cards),
        "cards": [_card_to_dict(card, prog) for card, prog in due_cards],
    })


@require_auth
@require_http_methods(["POST"])
@csrf_exempt
def study_review(request, deck_id):
    """
    Submit a review rating (0-3) for a card.
    Creates or updates FlashcardProgress.
    """
    deck = get_object_or_404(FlashcardDeck, id=deck_id, is_published=True)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    card_id = body.get("card_id")
    quality = body.get("quality")  # 0-3

    if card_id is None or quality is None:
        return JsonResponse({"error": "card_id and quality are required"}, status=400)

    quality = int(quality)
    if quality < 0 or quality > 3:
        return JsonResponse({"error": "quality must be 0-3"}, status=400)

    card = get_object_or_404(Flashcard, id=card_id, deck=deck)

    progress, _ = FlashcardProgress.objects.get_or_create(
        student=request.user, card=card,
        defaults={"next_review": datetime.date.today()},
    )
    progress.apply_rating(quality)

    return JsonResponse({
        "card_id":     card.id,
        "next_review": progress.next_review.isoformat(),
        "interval":    progress.interval,
        "repetitions": progress.repetitions,
        "ease_factor": round(progress.ease_factor, 2),
    })


@require_auth
@require_http_methods(["GET"])
def study_stats(request, deck_id):
    """Deck-level study stats for the current student."""
    deck = get_object_or_404(FlashcardDeck, id=deck_id, is_published=True)
    user  = request.user
    today = datetime.date.today()

    all_cards = list(deck.cards.values_list("id", flat=True))
    progress  = FlashcardProgress.objects.filter(student=user, card__deck=deck)

    # Aggregate in a single query
    from django.db.models import Count as _Count, Sum as _Sum
    agg = progress.aggregate(
        reviewed=_Count("id"),
        mastered=_Count("id", filter=models.Q(repetitions__gte=3)),
        total_reviews_sum=_Sum("total_reviews"),
    )
    reviewed      = agg["reviewed"] or 0
    mastered      = agg["mastered"] or 0
    total_reviews = agg["total_reviews_sum"] or 0

    # Cards not-yet-due = have progress AND next_review > today
    not_due_ids = set(
        progress.filter(next_review__gt=today).values_list("card_id", flat=True)
    )
    due_today = len([c for c in all_cards if c not in not_due_ids])

    return JsonResponse({
        "deck_id":       deck.id,
        "total_cards":   len(all_cards),
        "reviewed":      reviewed,
        "new":           len(all_cards) - reviewed,
        "mastered":      mastered,
        "due_today":     due_today,
        "total_reviews": total_reviews,
    })


# Fix missing import
from django.db import models


# ── AI Flashcard Generator ───────────────────────────────────────────────────────────────

AI_FLASHCARD_PROMPT = """\
You are creating flashcards for Indian government school students (Punjab State Board, grades 6-10).

LESSON CONTENT:
{content}

Generate EXACTLY {count} flashcard(s) as a JSON array. Each flashcard MUST:

1. Test a SPECIFIC fact, formula, definition, date, or concept from the lesson content above
2. Have a clear, unambiguous question on the "front"
3. Have a precise, factual answer on the "back" (not vague or generic)
4. Include a helpful "hint" that guides without giving away the answer

QUALITY RULES:
- NEVER ask "What is the main topic of this lesson?" or "What are the key points discussed?"
- NEVER reference "this lesson" or "this chapter" — ask about the ACTUAL subject matter
- Each card must stand alone — a student should be able to answer without seeing the lesson
- For Math/Physics: include actual numbers, formulas, or calculations
- For History: include real dates, names, events
- For Biology/Chemistry: include scientific terms, processes, reactions
- For Languages: include grammar rules with examples, translations
- Mix difficulty: 40% recall (definitions), 40% understanding (why/how), 20% application (solve/apply)

BAD EXAMPLES (never generate these):
- "What is discussed in this lesson?" — too vague
- "Name some important concepts" — too generic
- "What is the context of this chapter?" — meta, not content

GOOD EXAMPLES:
- Front: "What is the SI unit of force?" / Back: "Newton (N). 1 N = 1 kg m/s2" / Hint: "Named after Sir Isaac..."
- Front: "In which year did the Revolt of 1857 begin?" / Back: "1857, starting from Meerut on May 10" / Hint: "Also called the First War of Independence"
- Front: "What is photosynthesis?" / Back: "Process where green plants make glucose from CO2 and water using sunlight. 6CO2 + 6H2O -> C6H12O6 + 6O2" / Hint: "Happens in chloroplasts"

Respond with ONLY a JSON array, no markdown, no explanation:
[{{"front": "...", "back": "...", "hint": "..."}}, ...]
"""


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def ai_generate_flashcards(request):
    """
    POST /api/v1/flashcards/ai-generate/

    Generate a DRAFT flashcard deck using AI.
    Teacher reviews and edits cards, then calls the publish endpoint.

    Body:
      lesson_id: int (optional) — generate from lesson content
      text: str (optional)      — generate from pasted text
      subject_id: int (required if no lesson_id)
      section_id: int (optional)
      count: int (5–20, default 10) — number of cards to generate
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    lesson_id  = body.get("lesson_id")
    raw_text   = body.get("text", "").strip()
    subject_id = body.get("subject_id")
    section_id = body.get("section_id")
    count      = max(5, min(20, int(body.get("count", 10))))

    # ── Resolve source content ────────────────────────────────────────────────────────
    source_lesson = None
    deck_title    = "AI-Generated Flashcards"

    if lesson_id:
        from apps.content.models import Lesson
        try:
            lesson = Lesson.objects.select_related("course", "course__subject").get(id=lesson_id)
        except Lesson.DoesNotExist:
            return JsonResponse({"error": "Lesson not found"}, status=404)

        # Use lesson content as source
        content_parts = [lesson.title]
        if hasattr(lesson, "description") and lesson.description:
            content_parts.append(lesson.description)
        if hasattr(lesson, "content") and lesson.content:
            content_parts.append(lesson.content if isinstance(lesson.content, str) else str(lesson.content))

        raw_text      = "\n\n".join(content_parts)[:4000]
        source_lesson = lesson
        subject_id    = lesson.course.subject_id
        deck_title    = f"{lesson.title} — Flashcards"

    elif not raw_text:
        return JsonResponse({"error": "Either lesson_id or text is required"}, status=400)

    if not subject_id:
        return JsonResponse({"error": "subject_id is required when not using lesson_id"}, status=400)

    from apps.academics.models import Subject, Section
    subject = get_object_or_404(Subject, id=subject_id)
    section = Section.objects.filter(id=section_id).first() if section_id else None

    # ── AI generation ──────────────────────────────────────────────────────────────
    from apps.ai_assistant.providers import call_ai

    prompt = AI_FLASHCARD_PROMPT.format(count=count, content=raw_text[:4000])
    raw_response = call_ai(
        messages=[{"role": "user", "content": prompt}],
        curriculum_context="",  # the content IS in the prompt
    )

    # ── Parse JSON response ───────────────────────────────────────────────────────────
    import re as _re
    # Strip markdown code fences if AI wrapped the JSON
    clean = _re.sub(r"```(?:json)?\s*", "", raw_response).strip().strip("`")
    try:
        cards_data = json.loads(clean)
        if not isinstance(cards_data, list):
            raise ValueError("Expected a JSON array")
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("AI flashcard parse error: %s | raw=%s", exc, raw_response[:300])
        return JsonResponse(
            {"error": "AI returned an unexpected format. Please try again."},
            status=502,
        )

    # ── Create draft deck + cards in DB ───────────────────────────────────────────────
    deck = FlashcardDeck.objects.create(
        title=deck_title,
        description=f"AI-generated from {'lesson: ' + source_lesson.title if source_lesson else 'pasted text'}.",
        subject=subject,
        section=section,
        created_by=request.user,
        status=FlashcardDeck.Status.DRAFT,   # teacher must review before publishing
        ai_generated=True,
        source_lesson=source_lesson,
    )

    cards_created = []
    for i, card_data in enumerate(cards_data[:count]):
        front = str(card_data.get("front", "")).strip()
        back  = str(card_data.get("back",  "")).strip()
        hint  = str(card_data.get("hint",  "")).strip()[:300]
        if not front or not back:
            continue
        card = Flashcard.objects.create(deck=deck, front=front, back=back, hint=hint, order=i)
        cards_created.append(_card_to_dict(card))

    logger.info(
        "AI flashcard deck created: id=%s cards=%d teacher=%s",
        deck.id, len(cards_created), request.user.username,
    )

    return JsonResponse(
        {
            "deck_id":      deck.id,
            "title":        deck.title,
            "status":       deck.status,
            "ai_generated": True,
            "cards":        cards_created,
            "message":      "Review and edit the cards, then publish the deck to make it visible to students.",
        },
        status=201,
    )


@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
@csrf_exempt
def ai_publish_flashcard_deck(request, deck_id):
    """
    POST /api/v1/flashcards/ai-generate/<deck_id>/publish/

    Publish a DRAFT AI-generated flashcard deck.
    Sends notifications to all students in the deck's section.
    """
    deck = get_object_or_404(FlashcardDeck, id=deck_id)

    if request.user.role not in ("ADMIN",) and deck.created_by_id != request.user.id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    if deck.status == FlashcardDeck.Status.PUBLISHED:
        return JsonResponse({"error": "Deck is already published"}, status=400)

    deck.status = FlashcardDeck.Status.PUBLISHED
    deck.save()  # save() syncs is_published = True automatically

    # Notify students
    try:
        from apps.notifications.models import Notification, NotificationType
        from apps.accounts.models import User as UserModel

        if deck.section:
            student_ids = list(
                UserModel.objects.filter(role="STUDENT", section=deck.section)
                .values_list("id", flat=True)
            )
        else:
            # No section — notify all students enrolled in the subject
            from apps.academics.models import TeachingAssignment
            section_ids = TeachingAssignment.objects.filter(
                subject=deck.subject
            ).values_list("section_id", flat=True).distinct()
            student_ids = list(
                UserModel.objects.filter(role="STUDENT", section_id__in=section_ids)
                .values_list("id", flat=True)
            )

        notifs = [
            Notification(
                user_id=uid,
                subject=f"\U0001f4da New Flashcard Deck: {deck.title}",
                message=f"A new flashcard deck '{deck.title}' is ready for you to study.",
                notification_type=NotificationType.INFO,
                link=f"/flashcards",
            )
            for uid in student_ids
        ]
        if notifs:
            Notification.objects.bulk_create(notifs)

        logger.info(
            "Flashcard deck published: id=%s notified=%d students",
            deck.id, len(student_ids),
        )
    except Exception as exc:
        logger.warning("Notification failed on deck publish %s: %s", deck.id, exc)

    return JsonResponse(
        {
            "deck_id":   deck.id,
            "status":    deck.status,
            "published": True,
        }
    )
