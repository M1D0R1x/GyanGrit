# apps.flashcards.views
"""
Flashcard endpoints.

Teacher endpoints:
  GET  /api/v1/flashcards/decks/                  — list my decks
  POST /api/v1/flashcards/decks/                  — create deck
  GET  /api/v1/flashcards/decks/<id>/             — deck detail + cards
  PATCH /api/v1/flashcards/decks/<id>/            — update deck (title, description, published)
  DELETE /api/v1/flashcards/decks/<id>/           — delete deck
  POST /api/v1/flashcards/decks/<id>/cards/       — add card to deck
  PATCH /api/v1/flashcards/decks/<id>/cards/<cid>/ — edit card
  DELETE /api/v1/flashcards/decks/<id>/cards/<cid>/ — delete card

Student endpoints:
  GET  /api/v1/flashcards/study/                  — list available decks for student
  GET  /api/v1/flashcards/study/<deck_id>/due/    — cards due today for this deck
  POST /api/v1/flashcards/study/<deck_id>/review/ — submit rating for a card
  GET  /api/v1/flashcards/study/<deck_id>/stats/  — deck stats for this student
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

    # Annotate with student's due count
    today = datetime.date.today()
    result = []
    for deck in qs:
        due = 0
        if user.role == "STUDENT":
            card_ids = list(deck.cards.values_list("id", flat=True))
            # Due = cards with progress due today + new cards (no progress yet)
            reviewed_ids = set(
                FlashcardProgress.objects.filter(
                    student=user, card_id__in=card_ids, next_review__gt=today,
                ).values_list("card_id", flat=True)
            )
            due = len([c for c in card_ids if c not in reviewed_ids])

        d = _deck_to_dict(deck)
        d["due_count"] = due
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

    reviewed  = progress.count()
    mastered  = progress.filter(repetitions__gte=3).count()
    due_today = sum(1 for c in all_cards if not progress.filter(
        card_id=c, next_review__gt=today
    ).exists())
    total_reviews = sum(p.total_reviews for p in progress)

    return JsonResponse({
        "deck_id":      deck.id,
        "total_cards":  len(all_cards),
        "reviewed":     reviewed,
        "new":          len(all_cards) - reviewed,
        "mastered":     mastered,
        "due_today":    due_today,
        "total_reviews": total_reviews,
    })


# Fix missing import
from django.db import models
